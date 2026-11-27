import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,readFile,readdir,rm,writeFile,stat} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {publishCompletedCdr} from "../telephony/cdr-spool-publish.mjs";
import {deliverSpool} from "../telephony/cdr-spool-delivery.mjs";
const uuid="12345678-1234-4234-8234-123456789abc";
const raw={variables:{uuid,pgi_host_carrier:"Carrier A"}};
const body=Buffer.from(JSON.stringify(raw));
async function withSpool(fn){
 const spool=await mkdtemp(path.join(os.tmpdir(),"pgi-publish-"));
 const pending=path.join(spool,"pending");await mkdir(pending,{mode:0o700});
 try{await fn(spool,pending);}finally{await rm(spool,{recursive:true,force:true});}
}
test("publish atomically, retain exact bytes, reject conflicting content and deliver",()=>withSpool(async(spool,pending)=>{
 assert.deepEqual(await publishCompletedCdr(spool,body),{queued:true,already_present:false});
 const file=path.join(pending,uuid+".json");
 assert.deepEqual(await readFile(file),body);
 assert.equal((await stat(file)).mode&0o777,0o600);
 assert.deepEqual(await publishCompletedCdr(spool,body),{queued:true,already_present:true});
 await assert.rejects(publishCompletedCdr(spool,Buffer.from(JSON.stringify({variables:{...raw.variables,pgi_host_carrier:"Carrier B"}}))),/CDR_UUID_CONTENT_CONFLICT/);
 assert.deepEqual(await readFile(file),body);
 const config={spool,url:"https://voice.example.invalid/api/v1/ingest/freeswitch",authorization:"Basic test"};
 const failure=await deliverSpool(config,{fetchImpl:async()=>{throw Error("offline");}});
 assert.equal(failure.retry,1);assert.deepEqual(await readFile(file),body);
 const success=await deliverSpool(config,{fetchImpl:async()=>new Response(JSON.stringify({duplicate:false}),{status:201})});
 assert.equal(success.delivered,1);assert.deepEqual(await readdir(pending),[]);
}));
test("invalid CDR and busy writer never create a pending file",()=>withSpool(async(spool,pending)=>{
 await assert.rejects(publishCompletedCdr(spool,Buffer.from("bad")),/CDR_JSON_INVALID/);
 await assert.rejects(publishCompletedCdr(spool,Buffer.from(JSON.stringify({variables:{uuid}}))),/CDR_HOST_CARRIER_REQUIRED/);
 await assert.rejects(publishCompletedCdr(spool,Buffer.alloc(262145)),/CDR_PAYLOAD_SIZE/);
 await writeFile(path.join(spool,"publish.lock"),"",{mode:0o600});
 await assert.rejects(publishCompletedCdr(spool,body),/CDR_PUBLISH_BUSY/);
 assert.deepEqual(await readdir(pending),[]);
}));
