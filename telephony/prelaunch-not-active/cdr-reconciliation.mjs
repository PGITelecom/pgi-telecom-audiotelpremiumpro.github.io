/**
 * Cross-check of FreeSWITCH and collection-operator CDR extracts.
 * OFFLINE ONLY: references and durations, not payments, taxes, ANI or voice.
 * Never treats billable_seconds as payable seconds without a carrier contract.
 */
const E164=/^\+338[129]\d{7}$/;
const REF=/^[a-zA-Z0-9_.:/-]{6,160}$/;
const isObj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
function fail(code){
 throw Object.assign(new Error("APP_CDR_"+code),{code:"APP_CDR_"+code,status:422});
}
function row(x,kind){
 const common=["call_reference","carrier_reference","tenant_id","sva_e164",
   "eligible_seconds","status"];
 if(!isObj(x)||Object.keys(x).some(k=>!common.includes(k)))fail("UNEXPECTED_"+kind+"_FIELD");
 for(const k of ["call_reference","carrier_reference","tenant_id"]){
  if(typeof x[k]!=="string"||!REF.test(x[k]))fail("INVALID_"+kind+"_REFERENCE");
 }
 if(!E164.test(x.sva_e164))fail("INVALID_SVA");
 if(!Number.isSafeInteger(x.eligible_seconds)||x.eligible_seconds<0||x.eligible_seconds>86400)
  fail("INVALID_DURATION");
 if(!["candidate","preliminary","confirmed","disputed"].includes(x.status))
  fail("INVALID_STATUS");
 return {...x};
}
function key(r){return r.carrier_reference+"|"+r.call_reference;}
function countByKey(rows){
 const index=new Map(),duplicates=[];
 for(const r of rows){
  const k=key(r);
  if(index.has(k))duplicates.push(k);
  else index.set(k,r);
 }
 return {index,duplicates:[...new Set(duplicates)].sort()};
}
export function reconcileAudiotelCdrOffline(input={}){
 if(!isObj(input)||Object.keys(input).some(k=>!["business_unit","mode",
   "freeswitch","operator","tolerance_seconds"].includes(k)))fail("INPUT");
 if(input.business_unit!=="audiotel_platform"||input.mode!=="offline_simulation")
  fail("PRELAUNCH_ONLY");
 const fs=input.freeswitch,op=input.operator;
 if(!Array.isArray(fs)||!Array.isArray(op)||fs.length>10000||op.length>10000)
  fail("INVALID_BATCH");
 const tol=input.tolerance_seconds??1;
 if(!Number.isSafeInteger(tol)||tol<0||tol>30)fail("INVALID_TOLERANCE");
 const f=countByKey(fs.map(x=>row(x,"FREESWITCH")));
 const o=countByKey(op.map(x=>row(x,"OPERATOR")));
 const duplicated=new Set([...f.duplicates,...o.duplicates]);
 const carrierOnly=[],fsOnly=[],mismatch=[],matched=[];
 for(const [k,local] of f.index){
  if(duplicated.has(k))continue;
  const upstream=o.index.get(k);
  if(!upstream){fsOnly.push(k);continue;}
  const differences=[];
  if(local.tenant_id!==upstream.tenant_id)differences.push("tenant_mismatch");
  if(local.sva_e164!==upstream.sva_e164)differences.push("dnis_mismatch");
  if(Math.abs(local.eligible_seconds-upstream.eligible_seconds)>tol)
   differences.push("eligible_duration_mismatch");
  if(local.status==="disputed"||upstream.status==="disputed")
   differences.push("disputed_call");
  if(local.status!=="confirmed"||upstream.status!=="confirmed")
   differences.push("unconfirmed_ledger");
  if(differences.length)mismatch.push(Object.freeze({reference:k,reasons:Object.freeze(differences)}));
  else matched.push(k);
 }
 for(const k of o.index.keys()){
  if(duplicated.has(k))continue;
  if(!f.index.has(k))carrierOnly.push(k);
 }
 const discrepancies=fsOnly.length+carrierOnly.length+duplicated.size+mismatch.length;
 return Object.freeze({
  business_unit:"audiotel_platform",mode:"offline_simulation",
  compared_freeswitch_records:fs.length,compared_operator_records:op.length,
  exact_match_count:matched.length,
  unmatched_local_call_references:Object.freeze(fsOnly.sort()),
  unmatched_operator_call_references:Object.freeze(carrierOnly.sort()),
  duplicate_call_references:Object.freeze([...duplicated].sort()),
  discrepancies:Object.freeze(mismatch.sort((a,b)=>a.reference.localeCompare(b.reference))),
  discrepancy_count:discrepancies,
  matching_completed:discrepancies===0,
  // Even zero discrepancies does NOT prove signed operator CDR or bank receipts.
  operator_source_authenticated:false,
  actual_bank_receipts_reconciled:false,
  payout_eligible_seconds_contract_verified:false,
  real_accounting_entry_authorized:false,
  payments_authorized:false,
  business_activation_authorized:false
 });
}
