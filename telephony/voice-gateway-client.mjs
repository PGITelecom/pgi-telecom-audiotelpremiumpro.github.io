// Private media-node client. No automatic retry of signaling actions.
// On ambiguous timeout retry the same root call/event with a fresh nonce.
import https from "node:https";
import {randomUUID} from "node:crypto";
import {voiceCallId} from "../backend/src/voice-reservation-lifecycle.mjs";
import {signVoiceMachineRequest} from "../backend/src/voice-machine-auth.mjs";
const PATHS=new Set(["/voice/v1/reserve","/voice/v1/observe"]);
function fail(code){const e=new Error(code);e.code=code;return e;}
export async function voiceGatewayRequest({origin,node,keyId,secret,tls,path,payload,timeoutMs=10000}={}){
 let url;
 try{url=new URL(origin);}catch{throw fail("VOICE_GATEWAY_ORIGIN_INVALID");}
 if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash||!PATHS.has(path))throw fail("VOICE_GATEWAY_ORIGIN_INVALID");
 if(!tls?.cert||!tls?.key||!tls?.ca||!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>20000)throw fail("VOICE_GATEWAY_CLIENT_INVALID");
 const root=voiceCallId(payload?.call_id);
 const body=Buffer.from(JSON.stringify(payload));
 const timestamp=Math.floor(Date.now()/1000),nonce=randomUUID();
 const signature=signVoiceMachineRequest({node,keyId,timestamp,nonce,path,body},secret);
 return new Promise((resolve,reject)=>{
  let timer;
  const req=https.request(new URL(path,url),{method:"POST",cert:tls.cert,key:tls.key,ca:tls.ca,rejectUnauthorized:true,minVersion:"TLSv1.3",agent:false,headers:{"Content-Type":"application/json","Content-Length":body.length,"x-pgi-voice-node":node,"x-pgi-voice-key":keyId,"x-pgi-voice-time":String(timestamp),"x-pgi-voice-nonce":nonce,"x-pgi-voice-signature":signature}},res=>{
   const chunks=[];let total=0;
   res.on("data",chunk=>{total+=chunk.length;if(total>16384){req.destroy(fail("VOICE_GATEWAY_RESPONSE_INVALID"));return;}chunks.push(chunk);});
   res.on("aborted",()=>reject(fail("VOICE_GATEWAY_RESULT_UNKNOWN")));
   res.on("error",()=>reject(fail("VOICE_GATEWAY_RESULT_UNKNOWN")));
   res.on("end",()=>{
    if(total>16384)return reject(fail("VOICE_GATEWAY_RESPONSE_INVALID"));
    let data;
    try{data=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{return reject(fail("VOICE_GATEWAY_RESPONSE_INVALID"));}
    if(res.statusCode!==200){
     const code=typeof data?.error==="string"&&/^VOICE_[A-Z0-9_]{1,80}$/.test(data.error)?data.error:"VOICE_GATEWAY_RESULT_UNKNOWN";
     return reject(fail(code));
    }
    if(!data||typeof data!=="object"||data.call_id!==root||data.node_id!==node)return reject(fail("VOICE_GATEWAY_RESPONSE_INVALID"));
    resolve(data);
   });
  });
  req.on("error",()=>reject(fail("VOICE_GATEWAY_RESULT_UNKNOWN")));
  req.on("close",()=>clearTimeout(timer));
  timer=setTimeout(()=>req.destroy(fail("VOICE_GATEWAY_RESULT_UNKNOWN")),timeoutMs);
  req.end(body);
 });
}
