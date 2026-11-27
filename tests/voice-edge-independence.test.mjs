import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHmac} from "node:crypto";
import {validateCarrierProfile} from "../backend/src/carrier-profile-validation.mjs";
import {planVoiceEdge} from "../telephony/voice-edge-plan.mjs";
import {issueTurnCredentials} from "../telephony/turn-credentials.mjs";
import {assessVoiceRisk,voiceRiskSnapshot,VOICE_RISK_SQL} from "../backend/src/voice-risk-review.mjs";
const profile=()=>JSON.parse(readFileSync(new URL("../config/carriers/_template.json",import.meta.url),"utf8"));
test("portable carrier profile validates exact mappings and never approves network activation",()=>{
 const p=profile();const r=validateCarrierProfile(p);
 assert.equal(r.valid,true);assert.equal(r.network_activation_authorized,false);
 assert.throws(()=>validateCarrierProfile({...p,sip:{...p.sip,secretRef:"raw-secret-value"}}),/FORMAT/);
 assert.throws(()=>validateCarrierProfile({...p,sip:{...p.sip,authMode:"mtls"}}),/SECRET_REFERENCE/);
 assert.throws(()=>validateCarrierProfile({...p,cdr:{...p.cdr,timezone:"Invalid/Zone"}}),/TIMEZONE/);
 const q=profile();delete q.cdr.fields.amount_ht;
 assert.throws(()=>validateCarrierProfile(q),/MAPPING_INCOMPLETE/);
});
test("SIP plan conservatively sizes fixed-peer RTP and preserves no-activation gates",()=>{
 const p=profile();p.sip.transport="tls";p.capabilities.tls=true;p.capabilities.srtp=true;
 const input={business_unit:"audiotel_platform",carrier_profile:p,signaling_peer_ipv4:["192.0.2.10"],media_peer_ipv4:["192.0.2.11"],sip_listen_port:5061,rtp_start_port:10000,rtp_end_port:10499,target_concurrent_calls:100,media_legs_per_call:2,estimated_kbps_per_media_leg_per_direction:100,reserve_percent:25,evidence:Object.fromEntries(["peer_addresses_verified","contract_verified","media_capacity_verified","security_reviewed","mgit_verified","failover_verified","private_machine_ingress_verified"].map(k=>[k,true]))};
 const r=planVoiceEdge(input);
 assert.equal(r.capacity.required_rtp_ports,500);assert.equal(r.capacity.estimated_mbps_per_direction,25);
 assert.equal(r.status,"candidate_for_independent_review");
 assert.equal(r.network_activation_authorized,false);assert.equal(r.network_rule_intent.public_esl,false);
 assert.equal(planVoiceEdge({...input,rtp_end_port:10099}).status,"blocked");
 assert.throws(()=>planVoiceEdge({...input,signaling_peer_ipv4:["0.0.0.0"]}),/SIGNALING_PEERS/);
 assert.throws(()=>planVoiceEdge({...input,sip_listen_port:10001}),/OVERLAP/);
});
test("TURN credential generation is short lived and keeps shared material server side",()=>{
 const material="example-only-"+ "x".repeat(32);
 const r=issueTurnCredentials({subject:"opaque_user",sharedSecret:material,turnUrls:["turns:turn.example.invalid:5349?transport=tcp"],ttlSeconds:120,now:new Date("2026-10-01T00:00:00Z")});
 assert.equal(r.expires_at,"2026-10-01T00:02:00.000Z");
 assert.equal(r.iceServers[0].credential,createHmac("sha1",material).update(r.iceServers[0].username).digest("base64"));
 assert.ok(!JSON.stringify(r).includes(material));
 assert.throws(()=>issueTurnCredentials({subject:"opaque_user",sharedSecret:material,turnUrls:["turn:turn.example.invalid:3478"]}),/TURN_TLS_URL_REQUIRED/);
});
test("voice risk uses minimum sample sizes, distinguishes missing measurements and never blocks calls",async()=>{
 const p={business_unit:"audiotel_platform",calls:100,connected_calls:70,failed_calls:25,quality_samples:20,low_mos_samples:3,calls_last_hour:30,baseline_hourly_calls:5};
 const r=assessVoiceRisk(p);
 assert.deepEqual(r.alerts.map(x=>x.code),["high_failure_rate","low_mos_share","traffic_surge_review","quality_coverage_insufficient"]);
 assert.equal(r.automatic_block_authorized,false);
 assert.throws(()=>assessVoiceRisk({...p,quality_samples:71}),/SAMPLES/);
 const store={sql:{unsafe:async(q,args)=>{assert.equal(q,VOICE_RISK_SQL);assert.deepEqual(args,["2026-10-01T12:00:00.000Z","2026-10-08T12:00:00.000Z"]);return [{scoped_calls:100,total_groups:1,groups:[{host_carrier_id:"1",carrier_name:"Carrier A",...p}]}];}}};
 const observed=await voiceRiskSnapshot(store,new Date("2026-10-08T12:25:00Z"));
 assert.equal(observed.groups[0].alerts.length,4);assert.equal(observed.network_evidence_independently_verified,false);
 const oversized=await voiceRiskSnapshot({sql:{unsafe:async()=>[{scoped_calls:10001,total_groups:1,groups:[]}]}});
 assert.equal(oversized.status,"volume_limit_reached");
});
