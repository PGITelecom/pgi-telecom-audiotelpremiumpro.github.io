import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,readFile,readdir,utimes,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {stageNativeCdrs} from "../telephony/cdr-native-stage.mjs";
import {runCdrPipeline} from "../telephony/cdr-pipeline.mjs";
const uuid="12345678-1234-4234-8234-123456789abc";
const raw={variables:{uuid,pgi_host_carrier:"Carrier A",destination_number:"0890000000",end_epoch:"1793527260",start_epoch:"1793527200",billsec:"59",pgi_call_destination_id:"7",sip_auth_password:"must not be copied"},callStats:{audio:{inbound:{mos:4.2,private_note:"discard"}}},app_log:{private:"discard"}};
async function setup(fn){
 const root=await mkdtemp(path.join(os.tmpdir(),"pgi-native-"));
 try{const source=path.join(root,"native"),spool=path.join(root,"spool"),pending=path.join(spool,"pending");await mkdir(source,{mode:0o700});await mkdir(spool,{mode:0o700});await mkdir(pending,{mode:0o700});await fn({source,spool,pending});}
 finally{await rm(root,{recursive:true,force:true});}
}
async function native(source,value=raw){
 const file=path.join(source,"a_"+uuid+".cdr.json");await writeFile(file,JSON.stringify(value),{mode:0o600});await utimes(file,new Date(0),new Date(0));return file;
}
test("native A-leg CDR is minimized and durably staged, with no overwrite",()=>setup(async({source,spool,pending})=>{
 await native(source);const r=await stageNativeCdrs({source,spool});
 assert.equal(r.staged,1);assert.deepEqual(await readdir(source),[]);
 const file=path.join(pending,uuid+".json"),body=JSON.parse(await readFile(file,"utf8"));
 assert.equal(body.variables.pgi_call_destination_id,"7");assert.equal(body.callStats.audio.inbound.mos,4.2);
 assert.equal(body.variables.sip_auth_password,undefined);assert.equal(body.app_log,undefined);
 await native(source);assert.equal((await stageNativeCdrs({source,spool})).already_staged,1);
 await native(source,{...raw,variables:{...raw.variables,billsec:"22"}});
 assert.equal((await stageNativeCdrs({source,spool})).requires_review,1);assert.equal((await readdir(source)).length,1);assert.equal(JSON.parse(await readFile(file,"utf8")).variables.billsec,"59");
}));
test("unsettled, invalid or non A-leg native files never enter the delivery spool",()=>setup(async({source,spool,pending})=>{
 const f=await native(source);await utimes(f,new Date(),new Date());
 assert.equal((await stageNativeCdrs({source,spool})).deferred,1);
 await native(source,{variables:{uuid}});
 assert.equal((await stageNativeCdrs({source,spool})).requires_review,1);
 await writeFile(path.join(source,uuid+".cdr.json"),JSON.stringify(raw),{mode:0o600});
 assert.deepEqual(await readdir(pending),[]);
}));
test("staging failure does not stop previously durable CDR delivery",async()=>{
 const env={PGI_CDR_API_URL:"https://voice-ingress.example.invalid/api/v1/ingest/freeswitch",PGI_CDR_ALLOWED_HOST:"voice-ingress.example.invalid",PGI_CDR_SPOOL_DIR:"/var/lib/pgi-voice/cdr",PGI_CDR_NATIVE_DIR:"/var/lib/pgi-voice/native-cdr",PGI_TELEPHONY_USER:"voice-test",PGI_TELEPHONY_PASSWORD:"local-test"};
 let sent=false;const r=await runCdrPipeline(env,{stage:async()=>{throw Error("broken native input");},deliver:async()=>{sent=true;return {delivered:1};}});
 assert.equal(sent,true);assert.equal(r.healthy,false);
});
