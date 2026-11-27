// Compare external settlement lines with independently supplied PGI CDR expectations.
// Preview only: no ledger mutation, collection proof or payout authorization.
import {createHash} from "node:crypto";
function fail(code){const e=new Error(code);e.code=code;e.status=400;throw e;}
function integer(v,name,max=1_000_000_000_000){if(!Number.isSafeInteger(v)||v<0||v>max)fail("RECON_INVALID_"+name);return v;}
function id(v){if(typeof v!=="string"||!/^[a-zA-Z0-9][a-zA-Z0-9_.:@/-]{0,159}$/.test(v))fail("RECON_INVALID_ID");return v;}
function keyed(rows,amountField){if(!Array.isArray(rows)||rows.length>1000)fail("RECON_INVALID_ROWS");const m=new Map();for(const r of rows){const k=id(r?.external_call_id);if(m.has(k))fail("RECON_DUPLICATE_CALL");m.set(k,integer(r[amountField],"AMOUNT"));}return m;}
export function reconcileWholesalePreview(input={}){
 if(input.business_unit!=="audiotel_platform"||input.currency!=="EUR")fail("RECON_SCOPE");
 const provider=id(input.provider_key),period=input.period;
 if(typeof period!=="string"||!/^20\d\d-(0[1-9]|1[0-2])$/.test(period))fail("RECON_INVALID_PERIOD");
 const expected=keyed(input.expected_rows,"expected_micro_eur"),reported=keyed(input.reported_rows,"reported_micro_eur");
 const ids=[...new Set([...expected.keys(),...reported.keys()])].sort();
 if(!ids.length)fail("RECON_EMPTY");
 const rows=ids.map(k=>{const e=expected.get(k),r=reported.get(k);const delta=(r??0)-(e??0);
  return Object.freeze({external_call_id:k,expected_micro_eur:e??null,reported_micro_eur:r??null,delta_micro_eur:delta,
   status:e===undefined?"unexpected":r===undefined?"missing":delta<0?"shortfall":delta>0?"overage":"matched"});});
 const total=key=>rows.reduce((s,r)=>{const n=s+(r[key]??0);if(!Number.isSafeInteger(n))fail("RECON_OVERFLOW");return n;},0);
 const shortfall=rows.reduce((s,r)=>s+Math.max(0,-r.delta_micro_eur),0);
 const overage=rows.reduce((s,r)=>s+Math.max(0,r.delta_micro_eur),0);
 return Object.freeze({schema_version:"pgi-wholesale-reconciliation/1",provider_key:provider,period,currency:"EUR",
  expected_total_micro_eur:total("expected_micro_eur"),reported_total_micro_eur:total("reported_micro_eur"),
  gross_shortfall_micro_eur:shortfall,gross_overage_micro_eur:overage,net_delta_micro_eur:total("delta_micro_eur"),
  counts:Object.freeze(Object.fromEntries(["matched","missing","unexpected","shortfall","overage"].map(s=>[s,rows.filter(r=>r.status===s).length]))),
  digest:createHash("sha256").update(JSON.stringify({provider,period,rows})).digest("hex"),rows:Object.freeze(rows),
  sources_independently_verified:false,funds_collected_verified:false,ledger_write_authorized:false,payout_authorized:false});
}
