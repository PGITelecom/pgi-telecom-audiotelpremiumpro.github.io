// Voice host only: reliable delivery of completed FreeSWITCH JSON CDRs.
// No new SaaS, credentials or runtime dependency. Never log caller data.
import {open,readdir,rename,unlink,mkdir,lstat,realpath} from "node:fs/promises";
import {constants} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
function fail(code){const e=new Error(code);e.code=code;throw e;}
export function cdrDeliveryConfig(env=process.env){
 const url=new URL(String(env.PGI_CDR_API_URL||""));
 if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/api/v1/ingest/freeswitch")fail("CDR_API_HTTPS_REQUIRED");
 const allowed=String(env.PGI_CDR_ALLOWED_HOST||"").toLowerCase();
 if(!allowed||url.host.toLowerCase()!==allowed)fail("CDR_API_HOST_MISMATCH");
 const user=env.PGI_TELEPHONY_USER,password=env.PGI_TELEPHONY_PASSWORD;
 if(!user||!password||String(user).includes(":"))fail("CDR_AUTH_REQUIRED");
 const spool=String(env.PGI_CDR_SPOOL_DIR||"");
 if(!path.isAbsolute(spool)||spool==="/")fail("CDR_PRIVATE_SPOOL_REQUIRED");
 return {url:url.href,authorization:"Basic "+Buffer.from(user+":"+password).toString("base64"),spool};
}
export function validateSpoolEnvelope(raw,filename){
 const uuid=String(raw?.variables?.uuid||"");
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(uuid)||filename.toLowerCase()!==uuid.toLowerCase()+".json")fail("CDR_UUID_FILE_MISMATCH");
 // Keep the entire original CDR on the voice host for delivery, but never
 // guess the carrier after a switch. Missing provenance requires review.
 if(typeof raw.variables.pgi_host_carrier!=="string"||!raw.variables.pgi_host_carrier.trim())fail("CDR_HOST_CARRIER_REQUIRED");
}
async function privateDir(dir,{create=false}={}){
 if(create)await mkdir(dir,{recursive:false,mode:0o700}).catch(e=>{if(e.code!=="EEXIST")throw e;});
 const s=await lstat(dir);
 if(!s.isDirectory()||s.isSymbolicLink()||(s.mode&0o077)!==0||s.uid!==process.getuid()||await realpath(dir)!==dir)fail("CDR_INSECURE_DIRECTORY");
}
export async function deliverSpool(config,{fetchImpl=fetch,batch=100}={}){
 if(!Number.isSafeInteger(batch)||batch<1||batch>200)fail("CDR_BATCH_LIMIT");
 await privateDir(config.spool);
 const pending=path.join(config.spool,"pending"),quarantine=path.join(config.spool,"quarantine");
 await privateDir(pending);await privateDir(quarantine,{create:true});
 // Only one timer/process drains this spool. Crash leaves pending files intact.
 const lockPath=path.join(config.spool,"drain.lock");
 let lock;
 try{lock=await open(lockPath,"wx",0o600);}catch(e){if(e.code==="EEXIST")return {busy:true};throw e;}
 const counts={delivered:0,quarantined:0,retry:0,stopped:false};
 try{
  const entries=(await readdir(pending,{withFileTypes:true})).filter(x=>x.isFile()&&/^[a-f0-9-]{36}\.json$/i.test(x.name)).slice(0,batch);
  for(const entry of entries){
   const file=path.join(pending,entry.name);
   let body,handle;
   try{
    handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
    const st=await handle.stat();
    if(!st.isFile()||st.uid!==process.getuid()||(st.mode&0o077)!==0||st.nlink!==1||st.size>262144)fail("CDR_INSECURE_FILE");
    body=await handle.readFile({encoding:"utf8"});
    validateSpoolEnvelope(JSON.parse(body),entry.name);
   }catch(e){
    // Leave unsafe filesystem entries untouched for manual investigation.
    if(e.code==="CDR_INSECURE_FILE"||["ELOOP","ENOENT"].includes(e.code)){counts.retry++;continue;}
    const target=path.join(quarantine,entry.name);
    try{await lstat(target);counts.retry++;continue;}catch(e){if(e.code!=="ENOENT")throw e;}
    await rename(file,target);counts.quarantined++;continue;
   }finally{await handle?.close();}
   let response;
   try{
    response=await fetchImpl(config.url,{method:"POST",headers:{Authorization:config.authorization,"Content-Type":"application/json",Accept:"application/json"},body,redirect:"error",signal:AbortSignal.timeout(10000)});
    // The existing API returns 201 for new events and 200 for deduplicated
    // events. Only those documented acknowledgements permit deletion.
    if(response.status===200||response.status===201){
     const result=await response.json();
     if(!result||typeof result.duplicate!=="boolean")fail("CDR_ACK_INVALID");
     await unlink(file);counts.delivered++;continue;
    }
    await response.body?.cancel();
    if([400,413,415,422].includes(response.status)){
     const target=path.join(quarantine,entry.name);
     try{await lstat(target);counts.retry++;continue;}catch(e){if(e.code!=="ENOENT")throw e;}
     await rename(file,target);counts.quarantined++;continue;
    }
    // Authentication, contract readiness, rate limit, network or server error:
    // keep the original file and stop so repeated failures do not hammer PGI.
    counts.retry++;counts.stopped=true;break;
   }catch{counts.retry++;counts.stopped=true;break;}
  }
  return counts;
 }finally{await lock.close();await unlink(lockPath);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const result=await deliverSpool(cdrDeliveryConfig());
  console.log(JSON.stringify(result));
  if(result.stopped||result.retry||result.quarantined)process.exitCode=1;
 }catch(e){console.error("CDR delivery failed:",e.code||"CONFIG_OR_RUNTIME_ERROR");process.exitCode=1;}
}
