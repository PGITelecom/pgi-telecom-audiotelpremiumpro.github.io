// Local, read-only CDR queue supervision. No CDR payloads or identifiers logged.
import {lstat,realpath,opendir,statfs} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
function fail(code){const e=new Error(code);e.code=code;throw e;}
async function privateDir(dir){
 const s=await lstat(dir);
 if(!s.isDirectory()||s.uid!==process.getuid()||(s.mode&0o077)!==0||await realpath(dir)!==dir)fail("CDR_INSECURE_DIRECTORY");
}
async function inspect(dir,now,optional=false){
 const result={records:0,bytes:0,oldest_seconds:0,staged:0,invalid:0,complete:true};
 try{await privateDir(dir);}catch(e){if(optional&&e.code==="ENOENT")return result;throw e;}
 let scanned=0;
 for await(const entry of await opendir(dir)){
  if(++scanned>100000){result.complete=false;break;}
  let s;
  try{s=await lstat(path.join(dir,entry.name));}catch(e){if(e.code==="ENOENT")continue;throw e;}
  if(!s.isFile()||s.uid!==process.getuid()||(s.mode&0o077)!==0||s.nlink!==1){result.invalid++;continue;}
  if(/^\.stage-[a-f0-9-]{36}$/i.test(entry.name)){result.staged++;continue;}
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.json$/i.test(entry.name)||s.size>262144||s.size===0){result.invalid++;continue;}
  result.records++;result.bytes+=s.size;
  result.oldest_seconds=Math.max(result.oldest_seconds,Math.max(0,Math.floor((now-s.mtimeMs)/1000)));
 }
 return result;
}
async function lockAge(file,now){
 try{
  const s=await lstat(file);
  if(!s.isFile()||s.uid!==process.getuid()||(s.mode&0o077)!==0||s.nlink!==1)fail("CDR_INSECURE_LOCK");
  return Math.max(0,Math.floor((now-s.mtimeMs)/1000));
 }catch(e){if(e.code==="ENOENT")return null;throw e;}
}
export async function inspectCdrSpool(spool,{now=Date.now(),maxPendingAge=900,minFreeBytes=268435456,maxDrainLockAge=1500,maxPublishLockAge=60}={}){
 if(!path.isAbsolute(spool)||spool==="/"||path.normalize(spool)!==spool)fail("CDR_PRIVATE_SPOOL_REQUIRED");
 if(![now,maxPendingAge,minFreeBytes,maxDrainLockAge,maxPublishLockAge].every(v=>Number.isSafeInteger(v)&&v>0))fail("CDR_HEALTH_THRESHOLD_INVALID");
 await privateDir(spool);
 const pending=await inspect(path.join(spool,"pending"),now);
 const quarantine=await inspect(path.join(spool,"quarantine"),now,true);
 const fs=await statfs(spool,{bigint:true});
 const free=fs.bavail*fs.bsize;
 const drain=await lockAge(path.join(spool,"drain.lock"),now);
 const publish=await lockAge(path.join(spool,"publish.lock"),now);
 const alerts=[];
 if(free<BigInt(minFreeBytes))alerts.push("LOW_DISK_SPACE");
 if(pending.oldest_seconds>maxPendingAge)alerts.push("CDR_DELIVERY_DELAY");
 if(quarantine.records)alerts.push("CDR_QUARANTINE_REVIEW");
 if(pending.invalid||quarantine.invalid)alerts.push("CDR_INVALID_FILES");
 if(pending.staged||quarantine.staged)alerts.push("CDR_STAGED_FILES_REVIEW");
 if(!pending.complete||!quarantine.complete)alerts.push("CDR_SCAN_LIMIT_REACHED");
 if(drain!==null&&drain>maxDrainLockAge)alerts.push("CDR_DRAIN_LOCK_REVIEW");
 if(publish!==null&&publish>maxPublishLockAge)alerts.push("CDR_PUBLISH_LOCK_REVIEW");
 return {healthy:alerts.length===0,observed_at:new Date(now).toISOString(),pending,quarantine,free_bytes:free.toString(),drain_lock_seconds:drain,publish_lock_seconds:publish,alerts};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const result=await inspectCdrSpool(process.env.PGI_CDR_SPOOL_DIR||"");
  console.log(JSON.stringify(result));
  if(!result.healthy)process.exitCode=1;
 }catch(e){console.error("CDR health failed:",e.code||"CONFIG_OR_RUNTIME_ERROR");process.exitCode=1;}
}
