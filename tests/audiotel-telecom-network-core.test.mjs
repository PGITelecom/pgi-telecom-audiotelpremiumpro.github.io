import test from "node:test";
import assert from "node:assert/strict";
import {validateAudiotelNetworkLab,simulateAudiotelIncomingCall,renderKamailioDispatcherForLab} from "../telephony/prelaunch-not-active/network-core.mjs";
const cfg=()=>({
 business_unit:"audiotel_platform",environment:"isolated_offline_simulation",
 nodes:[{id:"media_a",private_ipv4:"10.12.0.21",sip_port:5080,priority:0,status:"simulated_healthy"},
 {id:"media_b",private_ipv4:"10.12.0.22",sip_port:5080,priority:1,status:"simulated_healthy"}],
 peers:[{id:"carrier_a",status:"simulated_allowed"},{id:"carrier_b",status:"simulated_blocked"}],
 tenants:[{id:"tenant_one",status:"simulated_active",kyb:"simulated_verified"},
 {id:"tenant_two",status:"simulated_active",kyb:"simulated_verified"}],
 numbers:[{e164:"+33890123456",tenant_id:"tenant_one",state:"simulated_assigned",origin:"arcep_direct_candidate"},
 {e164:"+33890123457",tenant_id:"tenant_two",state:"simulated_assigned",origin:"ported_candidate"},
 {e164:"+33890123458",tenant_id:"tenant_one",state:"reserved",origin:"arcep_direct_candidate"}],
 approved_sip_domains:["tenant-one.example.test","tenant-two.example.test"],
 destinations:[{id:"one_sip",tenant_id:"tenant_one",number_e164:"+33890123456",
 destination_uri:"sip:agent1@tenant-one.example.test",destination_type:"sip",
 priority:0,capacity:4,active_calls:1,status:"simulated_enabled"},
 {id:"one_backup",tenant_id:"tenant_one",number_e164:null,
 destination_uri:"+33123456789",destination_type:"pstn",priority:1,capacity:2,active_calls:0,status:"simulated_enabled"},
 {id:"two_sip",tenant_id:"tenant_two",number_e164:"+33890123457",
 destination_uri:"sip:agent2@tenant-two.example.test",destination_type:"sip",
 priority:0,capacity:10,active_calls:0,status:"simulated_enabled"}]
});
const v=()=>validateAudiotelNetworkLab(cfg());
const q={called_e164:"+33890123456",peer_id:"carrier_a"};
test("offline isolation and zero ability to make calls or transfers",()=>{
 assert.throws(()=>validateAudiotelNetworkLab({...cfg(),environment:"production"}),{code:"APP_NETWORK_ENVIRONMENT_DISABLED"});
 assert.throws(()=>validateAudiotelNetworkLab({...cfg(),business_unit:"direct_sva"}),{code:"APP_NETWORK_ENVIRONMENT_DISABLED"});
 const n=v(),d=simulateAudiotelIncomingCall(n,q);
 assert.equal(d.status,"simulated_route");
 assert.equal(d.selected_destination_id,"one_sip");
 assert.deepEqual(d.backup_destination_ids,["one_backup"]);
 assert.deepEqual(d.backup_media_node_ids,["media_b"]);
 assert.equal(d.tenant_id,"tenant_one");
 assert.equal(d.carrier_peer_authenticated_in_live_network,false);
 assert.equal(d.operational_call_authorized,false);
 assert.equal(d.payout_authorized,false);
 assert.equal(n.real_arcep_rights_verified,false);
 assert.equal(n.commercial_activation_authorized,false);
});
test("tenant isolation, capacity and carrier credentials",()=>{
 const t=cfg();
 for(const x of t.destinations)if(x.tenant_id==="tenant_one")x.active_calls=x.capacity;
 assert.equal(simulateAudiotelIncomingCall(validateAudiotelNetworkLab(t),q).reason,"DESTINATION_NOT_AVAILABLE");
 assert.equal(simulateAudiotelIncomingCall(v(),{...q,peer_id:"carrier_b"}).reason,"INGRESS_PEER_NOT_AUTHENTICATED");
 assert.equal(simulateAudiotelIncomingCall(v(),{...q,called_e164:"+33890123458"}).reason,"NUMBER_NOT_AFFECTED");
 assert.equal(simulateAudiotelIncomingCall(v(),{...q,called_e164:"0890123456"}).reason,"INVALID_SVA_DNIS");
});
test("KYC and suspension reject calls before route selection",()=>{
 let t=cfg();t.tenants[0].status="simulated_suspended";
 assert.equal(simulateAudiotelIncomingCall(validateAudiotelNetworkLab(t),q).reason,"CLIENT_NOT_ELIGIBLE");
 t=cfg();t.tenants[0].kyb="not_verified";
 assert.equal(simulateAudiotelIncomingCall(validateAudiotelNetworkLab(t),q).reason,"CLIENT_NOT_ELIGIBLE");
});
test("media failover never authorizes real network activity",()=>{
 const t=cfg();t.nodes[0].status="simulated_unavailable";t.destinations[0].active_calls=4;
 const d=simulateAudiotelIncomingCall(validateAudiotelNetworkLab(t),q);
 assert.equal(d.selected_media_node_id,"media_b");
 assert.equal(d.selected_destination_id,"one_backup");
 assert.equal(d.operational_call_authorized,false);
 t.nodes[1].status="simulated_unavailable";
 assert.equal(simulateAudiotelIncomingCall(validateAudiotelNetworkLab(t),q).reason,"NO_HEALTHY_MEDIA_NODE");
});
test("cross-tenant routing, unauthorized SIP and premium recursion are rejected",()=>{
 let t=cfg();t.destinations[0].tenant_id="tenant_two";
 assert.throws(()=>validateAudiotelNetworkLab(t),{code:"APP_NETWORK_CROSS_TENANT_DESTINATION"});
 t=cfg();t.destinations[0].destination_uri="sip:agent@attacker.example.org";
 assert.throws(()=>validateAudiotelNetworkLab(t),{code:"APP_NETWORK_SIP_DESTINATION_NOT_APPROVED"});
 t=cfg();t.destinations[1].destination_uri="+33890123457";
 assert.throws(()=>validateAudiotelNetworkLab(t),{code:"APP_NETWORK_INVALID_PSTN_DESTINATION"});
});
test("no public destinations, duplicate allocations or single-node network",()=>{
 let t=cfg();t.nodes[0].private_ipv4="203.0.113.18";
 assert.throws(()=>validateAudiotelNetworkLab(t),{code:"APP_NETWORK_UNSAFE_NODE_IP"});
 t=cfg();t.numbers.push({...t.numbers[0],tenant_id:"tenant_two"});
 assert.throws(()=>validateAudiotelNetworkLab(t),{code:"APP_NETWORK_DUPLICATE_SVA_NUMBER"});
 t=cfg();t.nodes.splice(1,1);
 assert.throws(()=>validateAudiotelNetworkLab(t),{code:"APP_NETWORK_SECOND_MEDIA_NODE_REQUIRED"});
});
test("Kamailio dispatcher output is private, non-production and secret-free",()=>{
 const s=renderKamailioDispatcherForLab(v());
 assert.match(s,/1 sip:10\.12\.0\.21:5080 8/);
 assert.match(s,/1 sip:10\.12\.0\.22:5080 8/);
 assert.match(s,/SIMULATION ONLY/);
 assert.doesNotMatch(s,/password|Authorization|203\.0\.113/);
 assert.throws(()=>renderKamailioDispatcherForLab({environment:"production",live_sip_routing_authorized:true}),{code:"APP_NETWORK_UNSAFE_NETWORK"});
});


test("validated topology cannot be altered or recreated as a trusted route context",()=>{
 const net=v();
 assert.equal(Object.isFrozen(net),true);
 assert.equal(Object.isFrozen(net.numbers[0]),true);
 assert.equal(Object.isFrozen(net.nodes[0]),true);
 assert.equal(Object.isFrozen(net.destinations[0]),true);
 const spoof={...net,nodes:net.nodes};
 assert.equal(simulateAudiotelIncomingCall(spoof,q).reason,"NETWORK_NOT_VALIDATED");
 assert.throws(()=>renderKamailioDispatcherForLab(spoof),{code:"APP_NETWORK_UNSAFE_NETWORK"});
});
test("dispatcher excludes unhealthy nodes; none means no destinations",()=>{
 let t=cfg();t.nodes[0].status="simulated_unavailable";
 const s=renderKamailioDispatcherForLab(validateAudiotelNetworkLab(t));
 assert.doesNotMatch(s,/10\.12\.0\.21/);
 assert.match(s,/10\.12\.0\.22/);
 t.nodes[1].status="simulated_unavailable";
 assert.throws(()=>renderKamailioDispatcherForLab(validateAudiotelNetworkLab(t)),
  {code:"APP_NETWORK_NO_HEALTHY_MEDIA_NODE"});
});
test("international and French premium PSTN endpoints require separately approved policy",()=>{
 const t=cfg();t.destinations[1].destination_uri="+441234567890";
 assert.throws(()=>validateAudiotelNetworkLab(t),{code:"APP_NETWORK_INVALID_PSTN_DESTINATION"});
});
