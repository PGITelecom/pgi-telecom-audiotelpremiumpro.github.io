import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {mkdtemp,writeFile,readFile,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {buildVoiceHostFiles,writeVoiceHostBundle} from "../telephony/voice-host-bundle.mjs";
import {collectCarrierExport} from "../telephony/carrier-sftp-collection.mjs";
const profile=()=>JSON.parse(readFileSync(new URL("../config/carriers/_template.json",import.meta.url),"utf8"));
function plan(){
 const p=profile();p.sip.transport="tls";p.capabilities.tls=true;p.capabilities.srtp=true;
 return {business_unit:"audiotel_platform",carrier_profile:p,signaling_peer_ipv4:["192.0.2.10"],media_peer_ipv4:["192.0.2.11"],sip_listen_port:5061,rtp_start_port:10000,rtp_end_port:10499,target_concurrent_calls:100,media_legs_per_call:2,estimated_kbps_per_media_leg_per_direction:100,reserve_percent:25,evidence:Object.fromEntries(["peer_addresses_verified","contract_verified","media_capacity_verified","security_reviewed","mgit_verified","failover_verified","private_machine_ingress_verified"].map(k=>[k,true]))};
}
test("native voice bundle is reproducible and never applies firewall rules",async()=>{
 const p=plan(),files=buildVoiceHostFiles(p);
 assert.match(files["carrier-acl.fragment.xml"],/192\.0\.2\.10\/32/);
 assert.match(files["voice-edge.nft"],/tcp dport 5061 drop/);
 assert.match(files["voice-edge.nft"],/udp dport 10000-10499 drop/);
 assert.equal(JSON.parse(files["manifest.json"]).network_activation_authorized,false);
 assert.deepEqual(buildVoiceHostFiles(p),files);
 assert.throws(()=>buildVoiceHostFiles({...p,evidence:{}}),/PLAN_BLOCKED/);
 const root=await mkdtemp(path.join(os.tmpdir(),"pgi-bundle-"));
 try{const r=await writeVoiceHostBundle(p,root);assert.equal(r.file_count,5);assert.equal(await readFile(path.join(root,r.package_id,"voice-edge.nft"),"utf8"),files["voice-edge.nft"]);}
 finally{await rm(root,{recursive:true,force:true});}
});
test("SFTP export reads one exact file with pinned host, normalizes locally, and never modifies a ledger",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"pgi-sftp-"));
 try{
  const identity=path.join(root,"identity"),known=path.join(root,"known_hosts");
  await writeFile(identity,"fake-test-material",{mode:0o600});await writeFile(known,"fake-test-host",{mode:0o600});
  const input={business_unit:"audiotel_platform",currency:"EUR",provider_key:"carrier-a",host:"carrier.example.invalid",username:"readonly",port:22,remote_path:"/exports/2026-10-01.csv",identity_file:identity,known_hosts_file:known,output_dir:root,delimiter:";",decimal_separator:".",field_mapping:{id:"external_call_id",start:"started_at",stop:"ended_at",talk:"conversation_seconds",bill:"payout_eligible_seconds",amount:"confirmed_payout_ht"},evidence:{contract_verified:true,read_only_account_verified:true,host_key_independently_verified:true,bounded_private_volume_verified:true}};
  const r=await collectCarrierExport(input,{spawn:(exe,args,opts)=>{
   assert.equal(exe,"/usr/bin/sftp");assert.ok(args.includes("-oStrictHostKeyChecking=yes"));assert.ok(args.includes("-oIdentitiesOnly=yes"));assert.equal(opts.input,"get /exports/2026-10-01.csv export.csv\n");
   writeFileSync(path.join(opts.cwd,"export.csv"),"id;start;stop;talk;bill;amount\ncall-a;2026-10-01T10:00:00Z;2026-10-01T10:01:00Z;60;60;0.35\n",{mode:0o600});return {status:0};
  }});
  assert.equal(r.row_count,1);assert.equal(r.ledger_write_authorized,false);
  const manifest=JSON.parse(await readFile(path.join(root,r.package_id,"manifest.json"),"utf8"));assert.equal(manifest.bank_receipt_verified,false);
  await assert.rejects(collectCarrierExport({...input,remote_path:"/exports/*.csv"}),/INVALID_ENDPOINT/);
  await assert.rejects(collectCarrierExport({...input,evidence:{}}),/EVIDENCE_REQUIRED/);
 }finally{await rm(root,{recursive:true,force:true});}
});
