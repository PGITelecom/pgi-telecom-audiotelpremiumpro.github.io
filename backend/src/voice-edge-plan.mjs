// Offline preparation of a minimal SIP edge allowlist and media capacity budget.
// No installation, network requests, live credentials or firewall changes.
import {isIP} from "node:net";
import {validateCarrierProfile} from "./carrier-profile-validation.mjs";
function fail(code){const e=new Error(code);e.code=code;e.status=400;throw e;}
function integer(v,k,min,max){if(!Number.isSafeInteger(v)||v<min||v>max)fail("VOICE_PLAN_INVALID_"+k);return v;}
function ipv4List(values,k){
 if(!Array.isArray(values)||values.length<1||values.length>64||new Set(values).size!==values.length)fail("VOICE_PLAN_INVALID_"+k);
 for(const ip of values){
  // Exact peer addresses only. No CIDR wildcard, hostname, shell or config injection.
  if(typeof ip!=="string"||isIP(ip)!==4||ip.startsWith("0.")||ip.startsWith("127.")||Number(ip.split(".")[0])>=224||ip==="255.255.255.255")fail("VOICE_PLAN_INVALID_"+k);
 }
 return [...values].sort();
}
export function planVoiceEdge(input={}){
 if(input?.business_unit!=="audiotel_platform")fail("VOICE_PLAN_SCOPE");
 const reviewed=validateCarrierProfile(input.carrier_profile),p=input.carrier_profile;
 if(!p.capabilities.directSip)fail("VOICE_PLAN_DIRECT_SIP_REQUIRED");
 const signal=ipv4List(input.signaling_peer_ipv4,"SIGNALING_PEERS"),media=ipv4List(input.media_peer_ipv4,"MEDIA_PEERS");
 const sipPort=integer(input.sip_listen_port,"SIP_PORT",1024,65535);
 const start=integer(input.rtp_start_port,"RTP_START",1024,65534),end=integer(input.rtp_end_port,"RTP_END",start+1,65535);
 if(start%2!==0||end%2!==1||sipPort>=start&&sipPort<=end)fail("VOICE_PLAN_PORT_OVERLAP_OR_ALIGNMENT");
 const concurrent=integer(input.target_concurrent_calls,"CONCURRENCY",1,10000);
 const legs=integer(input.media_legs_per_call,"LEGS",2,4);
 const perLeg=integer(input.estimated_kbps_per_media_leg_per_direction,"BANDWIDTH",16,2000);
 const reserve=integer(input.reserve_percent,"RESERVE",10,100);
 const peak=Math.ceil(concurrent*(100+reserve)/100);
 const ports=peak*legs*2,bandwidth=Math.ceil(peak*legs*perLeg/1000);
 const evidence=["peer_addresses_verified","contract_verified","media_capacity_verified","security_reviewed","mgit_verified","failover_verified","private_machine_ingress_verified"].filter(k=>input.evidence?.[k]!==true);
 if(end-start+1<ports)evidence.push("insufficient_rtp_ports");
 if(p.sip.transport!=="tls"||p.capabilities.srtp!==true)evidence.push("unencrypted_transport_requires_explicit_review");
 return {schema_version:"pgi-voice-edge-plan/1",adapter_key:reviewed.adapter_key,
  signaling:{peer_ipv4:signal,port:sipPort,protocol:p.sip.transport==="udp"?"udp":"tcp",transport:p.sip.transport},
  media:{peer_ipv4:media,port_start:start,port_end:end,protocol:"udp"},
  capacity:{target_concurrent_calls:concurrent,reserved_concurrent_calls:peak,required_rtp_ports:ports,available_rtp_ports:end-start+1,estimated_mbps_per_direction:bandwidth},
  network_rule_intent:{default_inbound:"deny",allow_signaling_only_from_listed_peers:true,allow_media_only_from_listed_peers:true,public_esl:false,public_admin:false,public_sip_registration:false},
  review_items:[...reviewed.review_items,...evidence],status:evidence.length||reviewed.review_items.length?"blocked":"candidate_for_independent_review",
  limitations:["ipv4_fixed_peers_only","no_webrtc_public_ice_or_turn_rules","bandwidth_estimate_excludes_measured_protocol_overhead_and_host_resources","no_firewall_or_trunk_activation"],
  network_activation_authorized:false,deployment_authorized:false,provider_switch_authorized:false};
}
