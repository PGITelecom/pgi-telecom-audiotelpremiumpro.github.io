// Provider-neutral, fail-closed CDR normalization in PREVIEW ONLY.
// No carrier API calls, tenant/database writes, bank instructions or PII from callers.
import {createHash} from "node:crypto";

function reject(code){
 const error=new Error(code);error.code=code;error.status=422;throw error;
}
const CDR_FIELDS=Object.freeze([
 "external_call_id","called_number","started_at","ended_at",
 "conversation_seconds","payout_eligible_seconds"
]);
const ref=/^[A-Za-z0-9][A-Za-z0-9_.:/-]{5,127}$/;
const sva=/^\+3389[0-9]{7}$/;
const timestamp=/^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,3})?(?:Z|[+-][0-9]{2}:[0-9]{2})$/;

function date(value){
 if(typeof value!=="string"||!timestamp.test(value))reject("CDR_TIMESTAMP_FORMAT_INVALID");
 const n=Date.parse(value);
 if(!Number.isFinite(n)||new Date(n).getUTCFullYear()<2020)reject("CDR_TIMESTAMP_INVALID");
 return n;
}
function duration(value){
 if((typeof value!=="number"&&typeof value!=="string")||
    value===""||value===null||typeof value==="boolean"||
    !/^\d+$/.test(String(value)))reject("CDR_DURATION_INVALID");
 const n=Number(value);
 if(!Number.isSafeInteger(n)||n<0||n>86400)reject("CDR_DURATION_INVALID");
 return n;
}
function validateMap(profile){
 if(!profile||typeof profile!=="object"||Array.isArray(profile)||
    profile.schemaVersion!==1||!profile.capabilities||profile.capabilities.cdr!==true||
    !profile.cdr||profile.cdr.delivery==="none")reject("CDR_ADAPTER_UNAVAILABLE");
 const carrier=profile.carrier?.code;
 if(typeof carrier!=="string"||!/^[A-Z0-9_-]{2,32}$/.test(carrier))
  reject("CDR_CARRIER_INVALID");
 const mappings=profile.cdr.fields;
 if(!mappings||typeof mappings!=="object"||Array.isArray(mappings))
  reject("CDR_MAPPING_INVALID");
 const inverse=Object.create(null);
 for(const [foreign,canonical] of Object.entries(mappings)){
  if(typeof foreign!=="string"||!/^[a-zA-Z][A-Za-z0-9_]{0,63}$/.test(foreign))
   reject("CDR_SOURCE_FIELD_INVALID");
  if(CDR_FIELDS.includes(canonical)){
   if(inverse[canonical])reject("CDR_AMBIGUOUS_MAPPING");
   inverse[canonical]=foreign;
  }
 }
 for(const field of CDR_FIELDS)if(!inverse[field])reject("CDR_REQUIRED_FIELD_MISSING_"+field);
 return {carrier,inverse};
}
function id(value){
 const x=String(value??"").trim();
 if(!ref.test(x))reject("CDR_REFERENCE_INVALID");
 return x;
}

/**
 * Prepare a privacy-minimal, provider-independent CDR batch.
 * "authorizedNumbers" MUST be derived by the caller from an authenticated
 * tenant-scoped database query; never from an arbitrary public request body.
 * This function deliberately does not create a write request or a payout.
 */
export function previewCarrierCdrBatch({adapter,rows,authorizedNumbers}={}){
 const {carrier,inverse}=validateMap(adapter);
 if(!Array.isArray(authorizedNumbers)||authorizedNumbers.length<1||
    authorizedNumbers.length>10000)reject("CDR_NUMBER_SCOPE_REQUIRED");
 const allowed=new Set();
 for(const number of authorizedNumbers){
  if(typeof number!=="string"||!sva.test(number)||allowed.has(number))
   reject("CDR_NUMBER_SCOPE_INVALID");
  allowed.add(number);
 }
 if(!Array.isArray(rows)||rows.length<1||rows.length>5000)
  reject("CDR_BATCH_SIZE_INVALID");
 const seen=new Set(),normalized=[];
 for(const raw of rows){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))
   reject("CDR_ROW_INVALID");
  // Only allowlisted canonical values are read: caller CLI, raw PII,
  // bank/payment details and arbitrary source columns are never copied.
  const externalCallId=id(raw[inverse.external_call_id]);
  if(seen.has(externalCallId))reject("CDR_DUPLICATE_EXTERNAL_ID");
  seen.add(externalCallId);
  const called=raw[inverse.called_number];
  if(typeof called!=="string"||!sva.test(called))
   reject("CDR_DNIS_INVALID");
  if(!allowed.has(called))reject("CDR_NUMBER_OUTSIDE_AUTHORIZED_SCOPE");
  const start=date(raw[inverse.started_at]),end=date(raw[inverse.ended_at]);
  if(start>end)reject("CDR_TIME_ORDER_INVALID");
  const conversation=duration(raw[inverse.conversation_seconds]);
  const eligible=duration(raw[inverse.payout_eligible_seconds]);
  if(eligible>conversation)reject("CDR_BILLABLE_EXCEEDS_CONVERSATION");
  if(conversation*1000>end-start+1000)reject("CDR_DURATION_EXCEEDS_INTERVAL");
  normalized.push(Object.freeze({
   external_call_id:externalCallId,
   called_number:called,
   started_at:new Date(start).toISOString(),
   ended_at:new Date(end).toISOString(),
   conversation_seconds:conversation,
   payout_eligible_seconds:eligible,
   source_carrier_code:carrier,
   unique_source_key:carrier+":"+externalCallId
  }));
 }
 normalized.sort((a,b)=>a.unique_source_key.localeCompare(b.unique_source_key,"en"));
 const sourceFingerprint=createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
 return Object.freeze({
  schema_version:"audiotel-carrier-neutral-cdr-preview/1",
  business_unit:"direct_sva",
  source_carrier_code:carrier,
  record_count:normalized.length,
  canonical_rows:Object.freeze(normalized),
  source_fingerprint:sourceFingerprint,
  caller_personal_data_transferred:false,
  financial_source_authenticated:false,
  cdr_source_authenticated:false,
  tenant_authorization_verified_by_this_function:false,
  accounting_write_authorized:false,
  production_import_authorized:false,
  number_activation_authorized:false,
  payout_authorized:false,
  external_actions_executed:false
 });
}
