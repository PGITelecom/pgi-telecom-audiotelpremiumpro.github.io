/**
 * Audiotel Premium Pro: OFFLINE operator-exploitant network control plane.
 * Pure model. It DOES NOT bind sockets, answer calls, allocate Arcep numbers,
 * contact carriers, authorize routing in production or touch client accounts.
 * Production routing remains in backend/server.mjs + store.selectCallDestination.
 */
import {isIP} from "node:net";

const SVA=/^\+338[129]\d{7}$/;
const E164=/^\+[1-9]\d{6,14}$/;
const ID=/^[A-Za-z0-9_-]{2,80}$/;
const SIP=/^sip:([A-Za-z0-9_.-]{1,64})@([a-zA-Z0-9.-]{3,253})$/;
const object=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const fail=code=>{throw Object.assign(new Error("APP_NETWORK_"+code),{code:"APP_NETWORK_"+code,status:422});};
const exactObject=(o,keys,name)=>{
 if(!object(o)||Object.keys(o).some(k=>!keys.includes(k)))fail("INVALID_"+name);
 return o;
};
function id(v,name){if(typeof v!=="string"||!ID.test(v))fail("INVALID_"+name);return v;}
function safePositive(v,name,allowZero=false){
 if(!Number.isSafeInteger(v)||(allowZero?v<0:v<1)||v>100000)fail("INVALID_"+name);
 return v;
}
function privateIp(v){
 if(typeof v!=="string"||isIP(v)!==4)return false;
 const bits=v.split(".").map(Number);
 if(bits.some(n=>n<0||n>255))return false;
 return bits[0]===10||(bits[0]===172&&bits[1]>=16&&bits[1]<=31)||
  (bits[0]===192&&bits[1]===168);
}
function validateDestination(route,allowedDomains){
 if(typeof route.destination_uri!=="string")fail("MISSING_DESTINATION");
 if(route.destination_type==="pstn"){
  if(!E164.test(route.destination_uri)||SVA.test(route.destination_uri))
   fail("INVALID_PSTN_DESTINATION");
 }else if(route.destination_type==="sip"){
  const match=route.destination_uri.match(SIP);
  if(!match||!allowedDomains.includes(match[2].toLowerCase()))
   fail("SIP_DESTINATION_NOT_APPROVED");
 }else fail("UNSUPPORTED_DESTINATION_TYPE");
}
export function validateAudiotelNetworkLab(manifest){
 exactObject(manifest,["business_unit","environment","nodes","peers","tenants",
  "numbers","destinations","approved_sip_domains"],"MANIFEST");
 if(manifest.business_unit!=="audiotel_platform"||
    manifest.environment!=="isolated_offline_simulation")
  fail("ENVIRONMENT_DISABLED");
 for(const key of ["nodes","peers","tenants","numbers","destinations","approved_sip_domains"]){
  if(!Array.isArray(manifest[key])||manifest[key].length>5000)fail("INVALID_"+key.toUpperCase());
 }
 const domains=manifest.approved_sip_domains.map(d=>{
  if(typeof d!=="string"||! /^[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63})+$/.test(d))
   fail("INVALID_SIP_DOMAIN");
  return d;
 });
 if(new Set(domains).size!==domains.length)fail("DUPLICATE_DOMAIN");
 if(manifest.nodes.length<2)fail("SECOND_MEDIA_NODE_REQUIRED");
 const nodes=manifest.nodes.map(n=>{
  exactObject(n,["id","private_ipv4","sip_port","priority","status"],"MEDIA_NODE");
  id(n.id,"NODE_ID");
  if(!privateIp(n.private_ipv4))fail("UNSAFE_NODE_IP");
  safePositive(n.sip_port,"SIP_PORT");
  if(n.sip_port>65535)fail("INVALID_SIP_PORT");
  safePositive(n.priority,"NODE_PRIORITY",true);
  if(!["simulated_healthy","simulated_unavailable"].includes(n.status))
   fail("INVALID_NODE_STATUS");
  return {...n};
 });
 if(new Set(nodes.map(n=>n.id)).size!==nodes.length)fail("DUPLICATE_MEDIA_NODE");
 if(new Set(nodes.map(n=>n.private_ipv4+":"+n.sip_port)).size!==nodes.length)fail("DUPLICATE_MEDIA_ENDPOINT");
 const peers=manifest.peers.map(p=>{
  exactObject(p,["id","status"],"PEER");
  id(p.id,"PEER_ID");
  if(!["simulated_allowed","simulated_blocked"].includes(p.status))fail("INVALID_PEER_STATUS");
  return {...p};
 });
 if(new Set(peers.map(p=>p.id)).size!==peers.length)fail("DUPLICATE_PEER");
 const tenants=manifest.tenants.map(t=>{
  exactObject(t,["id","status","kyb"],"TENANT");
  id(t.id,"TENANT_ID");
  if(!["simulated_active","simulated_suspended"].includes(t.status)||
     !["simulated_verified","not_verified"].includes(t.kyb))fail("INVALID_TENANT_STATE");
  return {...t};
 });
 if(new Set(tenants.map(t=>t.id)).size!==tenants.length)fail("DUPLICATE_TENANT");
 const numbers=manifest.numbers.map(n=>{
  exactObject(n,["e164","tenant_id","state","origin"],"NUMBER");
  if(typeof n.e164!=="string"||!SVA.test(n.e164))fail("INVALID_SVA_NUMBER");
  id(n.tenant_id,"TENANT_ID");
  if(!tenants.some(t=>t.id===n.tenant_id))fail("NUMBER_TENANT_UNKNOWN");
  if(!["simulated_assigned","reserved","blocked"].includes(n.state))fail("INVALID_NUMBER_STATE");
  if(!["arcep_direct_candidate","ported_candidate"].includes(n.origin))fail("INVALID_NUMBER_ORIGIN");
  return {...n};
 });
 if(new Set(numbers.map(n=>n.e164)).size!==numbers.length)fail("DUPLICATE_SVA_NUMBER");
 const destinations=manifest.destinations.map(r=>{
  exactObject(r,["id","tenant_id","number_e164","destination_uri","destination_type",
   "priority","capacity","active_calls","status"],"DESTINATION");
  id(r.id,"DESTINATION_ID");id(r.tenant_id,"TENANT_ID");
  if(!tenants.some(t=>t.id===r.tenant_id))fail("DESTINATION_TENANT_UNKNOWN");
  if(r.number_e164!=null&&
   !numbers.some(n=>n.e164===r.number_e164&&n.tenant_id===r.tenant_id))
   fail("CROSS_TENANT_DESTINATION");
  validateDestination(r,domains);
  safePositive(r.priority,"DESTINATION_PRIORITY",true);
  safePositive(r.capacity,"DESTINATION_CAPACITY");
  safePositive(r.active_calls,"ACTIVE_CALLS",true);
  if(!["simulated_enabled","disabled"].includes(r.status))fail("DESTINATION_NOT_EXPLICITLY_APPROVED");
  return {...r};
 });
 if(new Set(destinations.map(d=>d.id)).size!==destinations.length)fail("DUPLICATE_DESTINATION");
 return Object.freeze({
  business_unit:"audiotel_platform",environment:"isolated_offline_simulation",
  nodes:Object.freeze(nodes),peers:Object.freeze(peers),
  tenants:Object.freeze(tenants),numbers:Object.freeze(numbers),
  destinations:Object.freeze(destinations),approved_sip_domains:Object.freeze(domains),
  real_arcep_rights_verified:false,carrier_interconnect_authenticated:false,
  commercial_activation_authorized:false,live_sip_routing_authorized:false,
  live_payout_authorized:false
 });
}
const denied=reason=>Object.freeze({
 status:"offline_denied",reason,operational_call_authorized:false,
 telecom_network_connected:false,payout_authorized:false
});
export function simulateAudiotelIncomingCall(network,request){
 if(!network||network.environment!=="isolated_offline_simulation"||
    network.business_unit!=="audiotel_platform")return denied("NETWORK_NOT_VALIDATED");
 if(!object(request)||Object.keys(request).some(k=>!["called_e164","peer_id"].includes(k)))
  return denied("INVALID_REQUEST");
 if(!SVA.test(request.called_e164||""))return denied("INVALID_SVA_DNIS");
 const peer=network.peers.find(p=>p.id===request.peer_id);
 if(!peer||peer.status!=="simulated_allowed")return denied("INGRESS_PEER_NOT_AUTHENTICATED");
 const number=network.numbers.find(n=>n.e164===request.called_e164);
 if(!number||number.state!=="simulated_assigned")return denied("NUMBER_NOT_AFFECTED");
 const tenant=network.tenants.find(t=>t.id===number.tenant_id);
 if(!tenant||tenant.status!=="simulated_active"||tenant.kyb!=="simulated_verified")
  return denied("CLIENT_NOT_ELIGIBLE");
 const options=network.destinations.filter(r=>r.tenant_id===number.tenant_id&&
   (r.number_e164===number.e164||r.number_e164===null)&&
   r.status==="simulated_enabled"&&r.active_calls<r.capacity
 ).sort((a,b)=>Number(a.number_e164===null)-Number(b.number_e164===null)||
             a.priority-b.priority||a.id.localeCompare(b.id));
 if(!options.length)return denied("DESTINATION_NOT_AVAILABLE");
 const nodes=network.nodes.filter(n=>n.status==="simulated_healthy")
   .sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
 if(!nodes.length)return denied("NO_HEALTHY_MEDIA_NODE");
 return Object.freeze({
  status:"simulated_route",reason:"offline_only",called_e164:number.e164,
  tenant_id:number.tenant_id,selected_destination_id:options[0].id,
  selected_destination_type:options[0].destination_type,
  selected_destination_uri:options[0].destination_uri,
  backup_destination_ids:Object.freeze(options.slice(1).map(x=>x.id)),
  selected_media_node_id:nodes[0].id,
  backup_media_node_ids:Object.freeze(nodes.slice(1).map(x=>x.id)),
  tenant_separation_verified_in_supplied_snapshot:true,
  carrier_peer_authenticated_in_live_network:false,
  operational_call_authorized:false,telecom_network_connected:false,
  payout_authorized:false
 });
}
/**
 * Kamailio dispatcher destinations file, never a running config. Uses only
 * validated RFC1918 nodes, and cannot configure a public SIP listener.
 */
export function renderKamailioDispatcherForLab(network){
 if(!network||network.environment!=="isolated_offline_simulation"||
   network.live_sip_routing_authorized!==false)fail("UNSAFE_NETWORK");
 const nodes=network.nodes.slice().sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
 if(nodes.some(n=>!privateIp(n.private_ipv4)))fail("UNSAFE_NODE_IP");
 return "# SIMULATION ONLY - no live SIP or carrier interconnect\n"+
  "# Complete operator and IP ACL review required before activation.\n"+
  nodes.map(n=>"# "+n.id+" "+n.status+"\n1 sip:"+n.private_ipv4+":"+n.sip_port+" 8").join("\n")+"\n";
}
