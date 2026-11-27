// Standalone private voice host process, never imported by the public backend.
// Starts only with an explicitly enabled private configuration and mTLS.
import https from "node:https";
import {pathToFileURL} from "node:url";
import {createPrivateVoiceGateway} from "../backend/src/private-voice-gateway.mjs";
import {loadVoiceGatewayConfig,readPrivateVoiceFile,normalizeFingerprint} from "./voice-gateway-config.mjs";
const MAX_BODY=16384;
const PATHS=new Set(["/voice/v1/reserve","/voice/v1/observe"]);
function fail(code){const e=new Error(code);e.code=code;throw e;}
function header(req,name){
 const v=req.headersDistinct?.[name];
 if(!Array.isArray(v)||v.length!==1||typeof v[0]!=="string")fail("VOICE_HEADER_INVALID");
 return v[0];
}
function json(res,status,body){
 if(res.destroyed||res.headersSent)return;
 const data=JSON.stringify(body);
 res.writeHead(status,{"Content-Type":"application/json","Content-Length":Buffer.byteLength(data),"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Connection":"close"});
 res.end(data);
}
function statusFor(error){
 const c=String(error?.code||"");
 if(/REPLAY|CONFLICT|EXHAUSTED|ALREADY_RELEASED|FENCE_MISMATCH/.test(c))return 409;
 if(/AUTH_FAILED|REQUEST_EXPIRED|CERT|KEY_ID/.test(c))return 401;
 if(/NOT_AUTHORIZED|CONTEXT|SUBSCRIPTION|PAYOUT|ASSIGNMENT/.test(c))return 403;
 if(/INVALID|HEADER|BODY/.test(c))return 400;
 if(/NOT_READY|NOT_FOUND|NOT_ROUTABLE|AMBIGUOUS/.test(c))return 404;
 return 503;
}
async function rawBody(req){
 if(req.headers["transfer-encoding"]!==undefined)fail("VOICE_BODY_INVALID");
 if(header(req,"content-type")!=="application/json")fail("VOICE_BODY_INVALID");
 const declared=header(req,"content-length");
 if(!/^[1-9][0-9]{0,4}$/.test(declared)||Number(declared)>MAX_BODY)fail("VOICE_BODY_INVALID");
 const chunks=[];let total=0;
 for await(const chunk of req){total+=chunk.length;if(total>Number(declared)||total>MAX_BODY)fail("VOICE_BODY_INVALID");chunks.push(chunk);}
 if(total!==Number(declared))fail("VOICE_BODY_INVALID");
 return Buffer.concat(chunks,total);
}
export function createVoiceGatewayServer({sql,config,tls}={}){
 if(!sql||!config||!tls)fail("VOICE_GATEWAY_UNCONFIGURED");
 const active=new Map();let total=0;
 const server=https.createServer({...tls,requestCert:true,rejectUnauthorized:true,minVersion:"TLSv1.3",maxHeaderSize:8192,requestTimeout:10000,headersTimeout:5000,keepAliveTimeout:1000},async(req,res)=>{
  let admitted=false,node;
  try{
   if(req.method!=="POST"||!PATHS.has(req.url)){json(res,404,{error:"VOICE_ROUTE_NOT_FOUND"});req.resume();return;}
   if(!req.socket.authorized)fail("VOICE_CERT_AUTH_FAILED");
   node=header(req,"x-pgi-voice-node");
   const keyId=header(req,"x-pgi-voice-key"),stamp=header(req,"x-pgi-voice-time");
   const fingerprint=normalizeFingerprint(req.socket.getPeerCertificate()?.fingerprint256);
   const known=config.keys.get(node+":"+keyId);
   if(!known||!known.enabled||known.certificate_sha256!==fingerprint)fail("VOICE_CERT_AUTH_FAILED");
   if(!/^[0-9]{1,12}$/.test(stamp))fail("VOICE_HEADER_INVALID");
   if(total>=64||(active.get(node)||0)>=8){json(res,429,{error:"VOICE_GATEWAY_BUSY"});req.resume();return;}
   total++;active.set(node,(active.get(node)||0)+1);admitted=true;
   const body=await rawBody(req);
   const dispatch=createPrivateVoiceGateway({sql,resolveKey:async(n,k)=>{
    const x=config.keys.get(n+":"+k);
    return x?.certificate_sha256===fingerprint?x:null;
   }});
   const result=await dispatch({node,keyId,timestamp:Number(stamp),nonce:header(req,"x-pgi-voice-nonce"),signature:header(req,"x-pgi-voice-signature"),path:req.url,body});
   json(res,200,result);
  }catch(e){
   const code=typeof e?.code==="string"&&/^VOICE_[A-Z0-9_]{1,80}$/.test(e.code)?e.code:"VOICE_GATEWAY_UNAVAILABLE";
   json(res,statusFor(e),{error:code});req.resume();
  }finally{if(admitted){total--;const count=(active.get(node)||1)-1;if(count)active.set(node,count);else active.delete(node);}}
 });
 server.maxConnections=128;
 server.maxRequestsPerSocket=1;
 server.setTimeout(15000,socket=>socket.destroy());
 server.on("tlsClientError",()=>{/* no certificate identities logged */});
 return server;
}
async function main(){
 const config=await loadVoiceGatewayConfig(process.env.PGI_VOICE_GATEWAY_CONFIG_FILE||"");
 const [cert,key,ca]=await Promise.all([config.cert_file,config.key_file,config.ca_file].map(file=>readPrivateVoiceFile(file)));
 const database=process.env.PGI_VOICE_DATABASE_URL;
 if(!database)fail("VOICE_DATABASE_REQUIRED");
 const dbUrl=new URL(database);
 if(!["postgres:","postgresql:"].includes(dbUrl.protocol)||!dbUrl.hostname||!dbUrl.username||!dbUrl.password||!dbUrl.pathname.slice(1)||dbUrl.hash)fail("VOICE_DATABASE_INVALID");
 // Ignore URI query parameters that could weaken transport or role settings.
 if(dbUrl.search)fail("VOICE_DATABASE_OPTIONS_FORBIDDEN");
 const {default:postgres}=await import("postgres");
 const sql=postgres(dbUrl.href,{ssl:{rejectUnauthorized:true},max:4,connect_timeout:10,idle_timeout:20,connection:{statement_timeout:8000,lock_timeout:3000}});
 try{
  // Fail startup if preparation tables do not exist; mode remains database-owned.
  const gate=(await sql.unsafe("SELECT mode FROM voice_gateway_control WHERE singleton=true"))[0];
  if(!["disabled","draining","enabled"].includes(gate?.mode))fail("VOICE_GATEWAY_SCHEMA_NOT_READY");
  const server=createVoiceGatewayServer({sql,config,tls:{cert,key,ca}});
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(config.port,config.bind_ipv4,resolve);});
  console.log("PGI private voice gateway started");
  let stopping=false;
  async function stop(){if(stopping)return;stopping=true;server.close();server.closeIdleConnections?.();await sql.end({timeout:5});}
  process.once("SIGTERM",()=>{void stop();});process.once("SIGINT",()=>{void stop();});
 }catch(e){await sql.end({timeout:5});throw e;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(e=>{console.error("Voice gateway startup failed:",/^VOICE_[A-Z0-9_]+$/.test(e?.code||"")?e.code:"VOICE_GATEWAY_UNAVAILABLE");process.exitCode=1;});
}
