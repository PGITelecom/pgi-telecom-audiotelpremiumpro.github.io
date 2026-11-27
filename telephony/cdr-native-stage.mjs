// Prepare finished FreeSWITCH A-leg JSON CDRs for PGI's durable delivery spool.
// Runs only on an authorized private voice host, under the same dedicated UID.
import {constants} from "node:fs";
import {open,lstat,readdir,realpath,mkdir,link,unlink} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {pathToFileURL} from "node:url";
import {validateSpoolEnvelope} from "./cdr-spool-delivery.mjs";
const UUID="[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const NATIVE=new RegExp("^a_("+UUID+")\\.cdr\\.json$","i");
const LIMIT=262144;
function fail(code){const e=new Error(code);e.code=code;throw e;}
async function directory(dir){
 if(!path.isAbsolute(dir)||dir==="/"||await realpath(dir)!==dir)fail("CDR_STAGE_DIRECTORY");
 const s=await lstat(dir);
 if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==process.getuid()||(s.mode&0o077)!==0)fail("CDR_STAGE_PRIVATE_DIRECTORY");
 return s;
}
async function syncDirectory(dir){const h=await open(dir,constants.O_RDONLY|constants.O_DIRECTORY);try{await h.sync();}finally{await h.close();}}
async function readStable(file,now,minAgeMs){
 const h=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const before=await h.stat();
  if(!before.isFile()||before.uid!==process.getuid()||(before.mode&0o077)!==0||before.nlink!==1||before.size>LIMIT)fail("CDR_STAGE_INSECURE_FILE");
  if(now-before.mtimeMs<minAgeMs)return null;
  const body=await h.readFile({encoding:"utf8"});
  const after=await h.stat();
  if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)return null;
  return {body,stat:after};
 }finally{await h.close();}
}
function compact(raw){
 const v=raw?.variables;
 if(!v||typeof v!=="object"||Array.isArray(v))fail("CDR_STAGE_VARIABLES");
 // Preserve precisely the fields consumed by normalizeFreeSwitchCdr.
 const keys=["uuid","start_epoch","start_uepoch","start_stamp","answer_epoch","answer_uepoch","answer_stamp","end_epoch","end_uepoch","end_stamp","progress_epoch","progress_uepoch","progress_stamp","progress_media_epoch","progress_media_uepoch","progress_media_stamp","duration","billsec","hangup_cause","bridge_hangup_cause","caller_id_number","ani","destination_number","pgi_ivr_epoch","pgi_ivr_stamp","pgi_queue_epoch","pgi_queue_stamp","pgi_origin_carrier","pgi_origin_type","pgi_expert_id","pgi_expert_name","pgi_call_destination_id","pgi_host_carrier","pgi_hangup_party","sip_hangup_disposition","sip_term_status","last_bridge_proto_specific_hangup_cause","read_codec","write_codec","rtp_audio_in_packet_loss_percent","rtp_audio_in_jitter_max_variance","rtp_audio_in_rtt","rtp_audio_in_mos","rtp_audio_in_packet_count","rtp_audio_out_packet_count","rtp_audio_in_packet_loss","rtp_audio_in_media_bytes","rtp_audio_out_media_bytes","pgi_dtmf_errors"];
 const variables={};
 for(const k of keys)if(Object.hasOwn(v,k)){
  const value=v[k];if(value!==null&&typeof value!=="string"&&typeof value!=="number")fail("CDR_STAGE_VARIABLE_TYPE");
  if(typeof value==="string"&&value.length>512)fail("CDR_STAGE_VARIABLE_LENGTH");
  variables[k]=value;
 }
 // Native FreeSWITCH variables are unencoded; optional callStats intentionally
 // not copied because this producer's source is mod_json_cdr, not arbitrary JSON.
 return {variables};
}
export async function stageNativeCdrs({source,spool,batch=100,minAgeMs=30000,now=Date.now()}={}){
 if(!Number.isSafeInteger(batch)||batch<1||batch>200||!Number.isSafeInteger(minAgeMs)||minAgeMs<1000||!Number.isFinite(now))fail("CDR_STAGE_LIMIT");
 await directory(source);await directory(spool);
 const pending=path.join(spool,"pending");await directory(pending);
 if(source===spool||source===pending||source.startsWith(spool+"/")||spool.startsWith(source+"/"))fail("CDR_STAGE_DIRECTORY_OVERLAP");
 const counts={staged:0,already_staged:0,deferred:0,requires_review:0};
 const entries=(await readdir(source,{withFileTypes:true})).filter(e=>e.isFile()&&NATIVE.test(e.name)).slice(0,batch);
 for(const entry of entries){
  const filename=entry.name.match(NATIVE)[1].toLowerCase()+".json",original=path.join(source,entry.name),target=path.join(pending,filename);
  let snapshot,body;
  try{
   snapshot=await readStable(original,now,minAgeMs);
   if(!snapshot){counts.deferred++;continue;}
   const raw=compact(JSON.parse(snapshot.body));
   validateSpoolEnvelope(raw,filename);
   if(!raw.variables.destination_number||!(raw.variables.end_epoch||raw.variables.end_uepoch||raw.variables.end_stamp))fail("CDR_STAGE_INCOMPLETE");
   body=JSON.stringify(raw);
  }catch{counts.requires_review++;continue;}
  const temp=path.join(pending,".stage-"+randomUUID());
  try{
   const h=await open(temp,"wx",0o600);
   try{await h.writeFile(body);await h.sync();}finally{await h.close();}
   try{await link(temp,target);counts.staged++;}
   catch(e){
    if(e.code!=="EEXIST")throw e;
    const existing=await readStable(target,now+minAgeMs,0);
    if(!existing||existing.body!==body)fail("CDR_STAGE_CONFLICT");
    counts.already_staged++;
   }
   await unlink(temp);await syncDirectory(pending);
   const current=await lstat(original);
   if(current.ino!==snapshot.stat.ino||current.dev!==snapshot.stat.dev||current.mtimeMs!==snapshot.stat.mtimeMs||current.ctimeMs!==snapshot.stat.ctimeMs||current.size!==snapshot.stat.size)fail("CDR_STAGE_SOURCE_CHANGED");
   // Delete the native source only after the pending copy is durable.
   await unlink(original);await syncDirectory(source);
  }catch{counts.requires_review++;}
  finally{await unlink(temp).catch(e=>{if(e.code!=="ENOENT")throw e;});}
 }
 return counts;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const r=await stageNativeCdrs({source:process.env.PGI_CDR_NATIVE_DIR,spool:process.env.PGI_CDR_SPOOL_DIR});
  console.log(JSON.stringify(r));if(r.requires_review)process.exitCode=1;
 }catch(e){console.error("Native CDR staging failed:",e.code||"CONFIG_OR_RUNTIME_ERROR");process.exitCode=1;}
}
