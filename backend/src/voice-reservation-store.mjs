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
   return {...output(old),duplicate:true};
  }
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
  const dest=(await tx.unsafe("SELECT id,max_concurrent_calls FROM tenant_call_destinations WHERE id=$1 AND tenant_id=$2 AND status='active' AND destination_type='sip' AND (sva_number_id=$3 OR sva_number_id IS NULL) FOR UPDATE",[destination,tenant,sva]))[0];
  if(!dest||dest.max_concurrent_calls==null)fail("VOICE_DESTINATION_NOT_READY");
  const used=(await tx.unsafe("SELECT count(*)::text AS used FROM voice_call_reservations WHERE destination_id=$1 AND state<>'released'",[destination]))[0];
  if(BigInt(used.used)>=BigInt(dest.max_concurrent_calls))fail("VOICE_CAPACITY_EXHAUSTED");
  const inserted=(await tx.unsafe("INSERT INTO voice_call_reservations(call_id,node_id,generation,tenant_id,sva_number_id,destination_id,state) VALUES($1::uuid,$2,$3::uuid,$4,$5,$6,'reserved') RETURNING *",[call,node,randomUUID(),tenant,sva,destination]))[0];
  return {...output(inserted),duplicate:false};
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
