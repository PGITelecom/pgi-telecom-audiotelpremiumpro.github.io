// Normalize provider exports without a proprietary SDK, in a read-only review path.
import {createHash} from "node:crypto";
const FIELDS=Object.freeze(["external_call_id","started_at","ended_at","conversation_seconds","payout_eligible_seconds","confirmed_payout_ht"]);
function fail(code){const e=new Error(code);e.code=code;e.status=400;throw e;}
function own(o,k){return o&&typeof o==="object"&&!Array.isArray(o)&&Object.hasOwn(o,k)?o[k]:undefined;}
function timestamp(v){if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v)))fail("CARRIER_TIMESTAMP_REQUIRES_OFFSET");return new Date(v).toISOString();}
function seconds(v){if(typeof v==="string"&&/^\d{1,8}$/.test(v))v=Number(v);if(!Number.isSafeInteger(v)||v<0||v>604800)fail("CARRIER_INVALID_DURATION");return v;}
function micro(v){if(typeof v!=="string"||!/^\d{1,7}(?:\.\d{1,6})?$/.test(v))fail("CARRIER_AMOUNT_REQUIRES_DECIMAL_STRING");const [a,b=""]=v.split(".");return Number(a)*1_000_000+Number(b.padEnd(6,"0"));}
export function normalizeCarrierExport(input={}){
 if(input.business_unit!=="audiotel_platform"||input.currency!=="EUR")fail("CARRIER_SCOPE_INVALID");
 const provider=input.provider_key;
 if(typeof provider!=="string"||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/.test(provider))fail("CARRIER_PROVIDER_INVALID");
 const mapping=input.field_mapping;
 if(!mapping||typeof mapping!=="object"||Array.isArray(mapping))fail("CARRIER_MAPPING_INVALID");
 const inverse=new Map();
 for(const [from,to] of Object.entries(mapping)){
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$/.test(from)||["constructor","prototype","__proto__"].includes(from)||!FIELDS.includes(to)||inverse.has(to))fail("CARRIER_MAPPING_INVALID");
  inverse.set(to,from);
 }
 if(FIELDS.some(f=>!inverse.has(f)))fail("CARRIER_MAPPING_INCOMPLETE");
 if(!Array.isArray(input.rows)||input.rows.length<1||input.rows.length>1000)fail("CARRIER_ROW_COUNT_INVALID");
 const seen=new Set();let total=0;
 const rows=input.rows.map(raw=>{
  const get=k=>own(raw,inverse.get(k));
  const id=get("external_call_id");
  if(typeof id!=="string"||!/^[a-zA-Z0-9][a-zA-Z0-9_.:@/-]{0,159}$/.test(id)||seen.has(id))fail("CARRIER_CALL_ID_INVALID_OR_DUPLICATE");
  seen.add(id);
  const started=timestamp(get("started_at")),ended=timestamp(get("ended_at"));
  const elapsed=(Date.parse(ended)-Date.parse(started))/1000;
  const conversation=seconds(get("conversation_seconds")),eligible=seconds(get("payout_eligible_seconds"));
  if(elapsed<0||conversation>Math.ceil(elapsed))fail("CARRIER_CHRONOLOGY_INVALID");
  // Payout seconds may differ from elapsed due to contractual rounding; retain as reported.
  const amount=micro(get("confirmed_payout_ht"));
  if(!Number.isSafeInteger(total+amount))fail("CARRIER_AMOUNT_OVERFLOW");total+=amount;
  return Object.freeze({external_call_id:id,started_at:started,ended_at:ended,conversation_seconds:conversation,
   payout_eligible_seconds:eligible,reported_payout_micro_eur:amount});
 });
 const digest=createHash("sha256").update(JSON.stringify({provider,rows:[...rows].sort((a,b)=>a.external_call_id.localeCompare(b.external_call_id))})).digest("hex");
 return Object.freeze({schema_version:"pgi-carrier-export-preview/1",business_unit:"audiotel_platform",provider_key:provider,currency:"EUR",
  row_count:rows.length,canonical_digest:digest,total_reported_payout_micro_eur:total,rows:Object.freeze(rows),
  source_authenticated:false,settlement_verified:false,ledger_write_authorized:false,payout_authorized:false});
}
