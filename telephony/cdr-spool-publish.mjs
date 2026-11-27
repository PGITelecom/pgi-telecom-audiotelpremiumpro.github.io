// Private voice host only. Publish a completed CDR without losing the source.
import {open,lstat,realpath,rename,unlink} from "node:fs/promises";
import {constants} from "node:fs";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {pathToFileURL} from "node:url";
import {validateSpoolEnvelope} from "./cdr-spool-delivery.mjs";
const MAX=262144;
function fail(code){const e=new Error(code);e.code=code;throw e;}
async function privateDir(dir){
 const s=await lstat(dir);
 if(!s.isDirectory()||s.uid!==process.getuid()||(s.mode&0o077)!==0||await realpath(dir)!==dir)fail("CDR_INSECURE_DIRECTORY");
}
async function syncDir(dir){
 const h=await open(dir,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
 try{await h.sync();}finally{await h.close();}
}
async function existing(file,body){
 let h;
 try{
  h=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
  const s=await h.stat();
  if(!s.isFile()||s.uid!==process.getuid()||(s.mode&0o077)!==0||s.nlink!==1||s.size>MAX)fail("CDR_EXISTING_INSECURE");
  if(!(await h.readFile()).equals(body))fail("CDR_UUID_CONTENT_CONFLICT");
  return true;
 }catch(e){if(e.code==="ENOENT")return false;throw e;}finally{await h?.close();}
}
export async function publishCompletedCdr(spool,body){
 if(!path.isAbsolute(spool)||spool==="/"||path.normalize(spool)!==spool)fail("CDR_PRIVATE_SPOOL_REQUIRED");
 if(!Buffer.isBuffer(body)||body.length===0||body.length>MAX)fail("CDR_PAYLOAD_SIZE");
 let raw;
 try{raw=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(body));}catch{fail("CDR_JSON_INVALID");}
 const uuid=String(raw?.variables?.uuid||"").toLowerCase();
 const filename=uuid+".json";
 validateSpoolEnvelope(raw,filename);
 const pending=path.join(spool,"pending");
 await privateDir(spool);await privateDir(pending);
 // Shared by all publishers; no concurrent writer can replace a pending CDR.
 // A stale lock is deliberately fail-closed. Source data must be retained.
 const lockPath=path.join(spool,"publish.lock");
 let lock;
 try{lock=await open(lockPath,"wx",0o600);}catch(e){if(e.code==="EEXIST")fail("CDR_PUBLISH_BUSY");throw e;}
 const target=path.join(pending,filename);
 let tmp;
 try{
  if(await existing(target,body)){await syncDir(pending);return {queued:true,already_present:true};}
  tmp=path.join(pending,".stage-"+randomUUID());
  const h=await open(tmp,"wx",0o600);
  try{await h.writeFile(body);await h.sync();}finally{await h.close();}
  await rename(tmp,target);tmp=undefined;
  await syncDir(pending);
  return {queued:true,already_present:false};
 }finally{
  try{if(tmp)await unlink(tmp).catch(e=>{if(e.code!=="ENOENT")throw e;});}
  finally{await lock.close();await unlink(lockPath);}
 }
}
async function readStdin(){
 const chunks=[];let total=0;
 for await(const chunk of process.stdin){total+=chunk.length;if(total>MAX)fail("CDR_PAYLOAD_SIZE");chunks.push(chunk);}
 return Buffer.concat(chunks,total);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  // Only a trusted, authorized producer supplies a completed CDR on stdin.
  // Never delete its source solely because this command returned success.
  const result=await publishCompletedCdr(process.env.PGI_CDR_SPOOL_DIR||"",await readStdin());
  console.log(JSON.stringify(result));
 }catch(e){console.error("CDR publish failed:",e.code||"CONFIG_OR_RUNTIME_ERROR");process.exitCode=1;}
}
