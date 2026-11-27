// Prepared private backend adapter. NOT registered in the current API.
// Exclusive cutover required: never mix legacy counter-based release and this
// lifecycle on the same destinations. Authenticated node identity must be
// derived by the machine gateway, not accepted from an arbitrary client.
import {randomUUID} from "node:crypto";
import {voiceCallId,voiceNodeId,mediaObservation} from "./voice-reservation-lifecycle.mjs";
function fail(code){const e=new Error(code);e.code=code;throw e;}
function id(v){
 const s=typeof v==="bigint"?String(v):typeof v==="string"?v:Number.isSafeInteger(v)?String(v):"";
 if(!/^[1-9][0-9]{0,18}$/.test(s)||BigInt(s)>9223372036854775807n)fail("VOICE_CONTEXT_ID_INVALID");
 return s;
}
function output(r){
 return {call_id:r.call_id,node_id:r.node_id,generation:r.generation,tenant_id:String(r.tenant_id),sva_number_id:String(r.sva_number_id),destination_id:String(r.destination_id),state:r.state,sequence:Number(r.sequence)};
}
async function lockCall(tx,call){
 await tx.unsafe("SELECT pg_advisory_xact_lock(hashtextextended('pgi-voice-reservation:' || $1::text,0))",[call]);
}
async function getCall(tx,call){
 return (await tx.unsafe("SELECT * FROM voice_call_reservations WHERE call_id=$1::uuid FOR UPDATE",[call]))[0];
}
export async function reserveVoiceLine(sql,input,{authenticatedNode}={}){
 const call=voiceCallId(input?.call_id),node=voiceNodeId(authenticatedNode);
 const tenant=id(input.tenant_id),sva=id(input.sva_number_id),destination=id(input.destination_id);
 return sql.begin(async tx=>{
  await lockCall(tx,call);
  const old=await getCall(tx,call);
  if(old){
   if(old.node_id!==node||String(old.tenant_id)!==tenant||String(old.sva_number_id)!==sva||String(old.destination_id)!==destination)fail("VOICE_RESERVATION_CONTEXT_CONFLICT");
   if(old.state==="released")fail("VOICE_CALL_ALREADY_RELEASED");
   const d=(await tx.unsafe("SELECT destination_uri FROM tenant_call_destinations WHERE id=$1",[destination]))[0];
   return {...output(old),destination_uri:d?.destination_uri||null,duplicate:true};
  }
  const control=(await tx.unsafe("SELECT mode FROM voice_gateway_control WHERE singleton=true FOR SHARE"))[0];
  if(control?.mode!=="enabled")fail("VOICE_GATEWAY_NOT_ACCEPTING_CALLS");
  const number=(await tx.unsafe("SELECT sn.id,sn.tenant_id,sn.market_id,t.tenant_type FROM sva_numbers sn JOIN tenants t ON t.id=sn.tenant_id WHERE sn.id=$1 AND sn.tenant_id=$2 AND sn.status IN ('active','porting') FOR SHARE OF sn",[sva,tenant]))[0];
  if(!number)fail("VOICE_NUMBER_NOT_ROUTABLE");
  const access=(await tx.unsafe("SELECT pgi_tenant_has_premium_routing_access($1,$2,now()) AS allowed",[tenant,number.market_id]))[0];
  if(!access?.allowed)fail("VOICE_SUBSCRIPTION_REQUIRED");
  if(number.tenant_type!=="internal"){
   const assignment=(await tx.unsafe("SELECT id FROM tenant_number_assignments WHERE tenant_id=$1 AND sva_number_id=$2 AND status='active' AND (valid_from IS NULL OR valid_from<=now()) AND (valid_to IS NULL OR valid_to>=now()) LIMIT 1",[tenant,sva]))[0];
   if(!assignment)fail("VOICE_ASSIGNMENT_INACTIVE");
   const payout=(await tx.unsafe("SELECT pgi_tenant_has_payout_terms($1,$2,$3,now()) AS allowed",[tenant,number.market_id,sva]))[0];
   if(!payout?.allowed)fail("VOICE_PAYOUT_TERMS_REQUIRED");
  }
  // Serialize capacity allocation per destination. This implementation is for
  // explicit SIP destinations only; no legacy fallback or browser-selected URI.
  const dest=(await tx.unsafe("SELECT d.id,d.max_concurrent_calls,d.destination_uri FROM tenant_call_destinations d JOIN voice_gateway_destinations g ON g.destination_id=d.id WHERE d.id=$1 AND d.tenant_id=$2 AND d.status='testing' AND d.active_calls=0 AND d.destination_type='sip' AND (d.sva_number_id=$3 OR d.sva_number_id IS NULL) AND g.node_id=$4 FOR UPDATE OF d",[destination,tenant,sva,node]))[0];
  if(!dest||dest.max_concurrent_calls==null)fail("VOICE_DESTINATION_NOT_READY");
  const used=(await tx.unsafe("SELECT count(*)::text AS used FROM voice_call_reservations WHERE destination_id=$1 AND state<>'released'",[destination]))[0];
  if(BigInt(used.used)>=BigInt(dest.max_concurrent_calls))fail("VOICE_CAPACITY_EXHAUSTED");
  const inserted=(await tx.unsafe("INSERT INTO voice_call_reservations(call_id,node_id,generation,tenant_id,sva_number_id,destination_id,state) VALUES($1::uuid,$2,$3::uuid,$4,$5,$6,'reserved') RETURNING *",[call,node,randomUUID(),tenant,sva,destination]))[0];
  return {...output(inserted),destination_uri:dest.destination_uri,duplicate:false};
 });
}
export async function recordVoiceMediaObservation(sql,input,{authenticatedNode}={}){
 const call=voiceCallId(input?.call_id),node=voiceNodeId(authenticatedNode);
 return sql.begin(async tx=>{
  await lockCall(tx,call);
  const row=await getCall(tx,call);
  if(!row||row.node_id!==node)fail("VOICE_RESERVATION_NOT_FOUND");
  const next=mediaObservation({...row,sequence:Number(row.sequence)},{...input,call_id:call,node_id:node});
  if(!next.applied)return {...output(row),applied:false,release_capacity:false};
  const updated=(await tx.unsafe("UPDATE voice_call_reservations SET state=$2,sequence=$3,last_observation=$4,last_observed_at=now(),released_at=CASE WHEN $2='released' THEN now() ELSE NULL END WHERE call_id=$1::uuid RETURNING *",[call,next.state,next.sequence,next.last_observation]))[0];
  return {...output(updated),applied:true,release_capacity:next.release_capacity};
 });
}

// The authenticated media node supplies the actually dialed SVA number.
// Never trust tenant or destination IDs supplied by an endpoint or browser.
export async function resolveVoiceAdmission(sql,{node_id,call_id,sva_number}={}){
 const node=voiceNodeId(node_id),call=voiceCallId(call_id);
 if(typeof sva_number!=="string"||!sva_number.trim()||sva_number.length>64||sva_number!==sva_number.trim())fail("VOICE_SVA_NUMBER_INVALID");
 const numbers=await sql.unsafe("SELECT sn.id,sn.tenant_id FROM sva_numbers sn WHERE sn.status IN ('active','porting') AND (sn.e164=$1 OR sn.display_number=$1 OR EXISTS(SELECT 1 FROM sva_number_aliases a WHERE a.sva_number_id=sn.id AND a.enabled AND a.alias=$1)) LIMIT 2",[sva_number]);
 if(numbers.length!==1||!numbers[0].tenant_id)fail("VOICE_NUMBER_AMBIGUOUS_OR_UNAVAILABLE");
 const sva=String(numbers[0].id),tenant=String(numbers[0].tenant_id);
 const existing=(await sql.unsafe("SELECT call_id,node_id,tenant_id,sva_number_id,destination_id FROM voice_call_reservations WHERE call_id=$1::uuid",[call]))[0];
 if(existing){
  if(existing.node_id!==node||String(existing.tenant_id)!==tenant||String(existing.sva_number_id)!==sva)fail("VOICE_RESERVATION_CONTEXT_CONFLICT");
  return {allowed:true,exclusive:true,existing:true,node_id:node,call_id:call,tenant_id:tenant,sva_number_id:sva,destination_id:String(existing.destination_id)};
 }
 const d=(await sql.unsafe(
  "SELECT d.id FROM tenant_call_destinations d JOIN voice_gateway_destinations g ON g.destination_id=d.id"+
  " CROSS JOIN LATERAL (SELECT count(*) AS occupied FROM voice_call_reservations r WHERE r.destination_id=d.id AND r.state<>'released') cap"+
  " WHERE g.node_id=$1 AND d.tenant_id=$2 AND (d.sva_number_id=$3 OR d.sva_number_id IS NULL)"+
  " AND d.status='testing' AND d.active_calls=0 AND d.destination_type='sip' AND d.max_concurrent_calls>cap.occupied"+
  " ORDER BY CASE WHEN d.sva_number_id=$3 THEN 0 ELSE 1 END,d.priority,cap.occupied,d.id LIMIT 1",[node,tenant,sva]))[0];
 if(!d)fail("VOICE_DESTINATION_NOT_READY");
 return {allowed:true,exclusive:true,existing:false,node_id:node,call_id:call,tenant_id:tenant,sva_number_id:sva,destination_id:String(d.id)};
}
