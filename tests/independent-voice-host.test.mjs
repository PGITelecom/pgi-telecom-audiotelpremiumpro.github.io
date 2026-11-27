import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {normalizeFreeSwitchCdr} from "../backend/src/cdr-freeswitch.mjs";
import {cdrDeliveryConfig,deliverSpool} from "../telephony/cdr-spool-delivery.mjs";
import {planLocalAnnouncements,renderLocalAnnouncements,validPcmWave} from "../telephony/local-announcements.mjs";

const uuid="12345678-1234-4234-8234-123456789abc";
const raw={variables:{uuid,start_epoch:"1793527200",end_epoch:"1793527260",answer_epoch:"1793527201",billsec:"59",duration:"60",destination_number:"0890000000",pgi_host_carrier:"Carrier A",pgi_call_destination_id:"7",pgi_dtmf_errors:"2"}};
test("independent FreeSWITCH CDR retains the actual destination and DTMF measurement",()=>{
 const r=normalizeFreeSwitchCdr(raw,{callerHashKey:"local-test"});
 assert.equal(r.payload.call_destination_id,7);
 assert.equal(r.payload.quality.dtmf_errors,2);
 assert.equal(r.payload.host_carrier,"Carrier A");
 assert.throws(()=>normalizeFreeSwitchCdr({variables:{...raw.variables,pgi_call_destination_id:"-1"}},{callerHashKey:"local-test"}),/FREESWITCH_DESTINATION_ID_INVALID/);
 assert.throws(()=>normalizeFreeSwitchCdr({variables:{...raw.variables,pgi_expert_id:"3"}},{callerHashKey:"local-test"}),/FREESWITCH_ROUTE_ID_CONFLICT/);
});
test("CDR delivery fails closed on insecure endpoint or mismatched host",()=>{
 const env={PGI_CDR_API_URL:"https://voice-ingress.example.invalid/api/v1/ingest/freeswitch",PGI_CDR_ALLOWED_HOST:"voice-ingress.example.invalid",PGI_TELEPHONY_USER:"voice-test",PGI_TELEPHONY_PASSWORD:"local-test",PGI_CDR_SPOOL_DIR:"/var/lib/pgi-voice/cdr"};
 assert.equal(cdrDeliveryConfig(env).url,env.PGI_CDR_API_URL);
 assert.throws(()=>cdrDeliveryConfig({...env,PGI_CDR_ALLOWED_HOST:"other.example.invalid"}),/HOST_MISMATCH/);
 assert.throws(()=>cdrDeliveryConfig({...env,PGI_CDR_API_URL:env.PGI_CDR_API_URL.replace("https:","http:")}),/HTTPS_REQUIRED/);
});
test("CDR spool retries network failures and deletes only acknowledged events",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"pgi-cdr-"));
 try{
  const pending=path.join(root,"pending");await mkdir(pending,{mode:0o700});
  const filename=uuid+".json";const file=path.join(pending,filename);
  await writeFile(file,JSON.stringify(raw),{mode:0o600});
  const config={spool:root,url:"https://voice-ingress.example.invalid/api/v1/ingest/freeswitch",authorization:"Basic test"};
  const failed=await deliverSpool(config,{fetchImpl:async()=>{throw Error("offline");}});
  assert.equal(failed.retry,1);assert.equal(failed.stopped,true);assert.ok(await readFile(file));
  const ok=await deliverSpool(config,{fetchImpl:async(url,options)=>{
   assert.equal(options.redirect,"error");assert.equal(JSON.parse(options.body).variables.uuid,uuid);
   return new Response(JSON.stringify({duplicate:true}),{status:200});
  }});
  assert.equal(ok.delivered,1);assert.deepEqual(await readdir(pending),[]);
  await writeFile(file,JSON.stringify({variables:{uuid}}),{mode:0o600});
  const invalid=await deliverSpool(config,{fetchImpl:async()=>{throw Error("must not send");}});
  assert.equal(invalid.quarantined,1);assert.deepEqual(await readdir(path.join(root,"quarantine")),[filename]);
 }finally{await rm(root,{recursive:true,force:true});}
});
const flow={entry:"hello",default_locale:"fr-FR",nodes:[{id:"hello",type:"tts",text:"Bonjour",next:"again"},{id:"again",type:"announcement",text:"Bonjour",next:"end"},{id:"end",type:"terminate"}]};
function wave(){
 const w=Buffer.alloc(46);w.write("RIFF",0);w.writeUInt32LE(38,4);w.write("WAVEfmt ",8);w.writeUInt32LE(16,16);w.writeUInt16LE(1,20);w.writeUInt16LE(1,22);w.writeUInt32LE(22050,24);w.writeUInt32LE(44100,28);w.writeUInt16LE(2,32);w.writeUInt16LE(16,34);w.write("data",36);w.writeUInt32LE(2,40);return w;
}
test("offline voice plan deduplicates identical announcements and publishes an isolated validated WAV package",async()=>{
 assert.equal(planLocalAnnouncements(flow).assets.length,1);
 assert.equal(planLocalAnnouncements(flow).references.length,2);
 assert.equal(validPcmWave(wave()),true);assert.equal(validPcmWave(Buffer.from("bad")),false);
 const root=await mkdtemp(path.join(os.tmpdir(),"pgi-voice-"));
 try{
  const fs=await import("node:fs");
  const result=await renderLocalAnnouncements(flow,root,{spawn:(exe,args,options)=>{
   assert.equal(exe,"/usr/bin/espeak-ng");assert.equal(options.input,"Bonjour");assert.equal(args[0],"--stdin");
   fs.writeFileSync(args.at(-1),wave());return {status:0};
  }});
  assert.equal(result.asset_count,1);assert.equal(result.network_activation_authorized,false);
  const manifest=JSON.parse(await readFile(path.join(root,result.package_id,"manifest.json"),"utf8"));
  assert.equal(manifest.references.length,2);assert.equal(manifest.assets.length,1);
 }finally{await rm(root,{recursive:true,force:true});}
});
