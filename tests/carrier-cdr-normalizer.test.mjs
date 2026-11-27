import test from "node:test";
import assert from "node:assert/strict";
import {previewCarrierCdrBatch} from "../backend/carriers/cdr-normalizer.mjs";

const profile={
 schemaVersion:1,carrier:{code:"CARRIER_A",displayName:"Carrier A"},
 capabilities:{cdr:true},
 cdr:{delivery:"api",fields:{
  identifier:"external_call_id",dn:"called_number",
  time_start:"started_at",time_end:"ended_at",
  answered:"conversation_seconds",billing:"payout_eligible_seconds",
  caller_cli:"unmapped_private_caller"
 }}
};
const row={
 identifier:"CALL-123456",dn:"+33890123456",
 time_start:"2026-11-27T10:00:00+01:00",
 time_end:"2026-11-27T10:02:00+01:00",
 answered:"120",billing:119,
 caller_cli:"+33612345678",
 bank_account:"FR7630006000011234567890189"
};
const run=(options={})=>previewCarrierCdrBatch({
 adapter:profile,rows:[row],authorizedNumbers:["+33890123456"],...options
});

test("canonical CDR is provider neutral, time normalized, caller data excluded",()=>{
 const result=run();
 assert.equal(result.canonical_rows.length,1);
 assert.deepEqual(result.canonical_rows[0],{
  external_call_id:"CALL-123456",called_number:"+33890123456",
  started_at:"2026-11-27T09:00:00.000Z",
  ended_at:"2026-11-27T09:02:00.000Z",
  conversation_seconds:120,payout_eligible_seconds:119,
  source_carrier_code:"CARRIER_A",unique_source_key:"CARRIER_A:CALL-123456"
 });
 assert.doesNotMatch(JSON.stringify(result),/33612345678|FR7630006|caller_cli/);
 assert.equal(result.production_import_authorized,false);
 assert.equal(result.payout_authorized,false);
 assert.equal(result.external_actions_executed,false);
});

test("mapping can be changed without changing the canonical output",()=>{
 const alternative=structuredClone(profile);
 alternative.carrier.code="CARRIER_B";
 alternative.cdr.fields={cdrId:"external_call_id",numberCalled:"called_number",
  callStart:"started_at",callStop:"ended_at",
  connected:"conversation_seconds",eligible:"payout_eligible_seconds"};
 const input={cdrId:row.identifier,numberCalled:row.dn,callStart:row.time_start,
  callStop:row.time_end,connected:row.answered,eligible:row.billing};
 const result=run({adapter:alternative,rows:[input]});
 assert.equal(result.canonical_rows[0].external_call_id,row.identifier);
 assert.equal(result.canonical_rows[0].called_number,row.dn);
 assert.equal(result.canonical_rows[0].source_carrier_code,"CARRIER_B");
 assert.equal(result.production_import_authorized,false);
});

test("batch fingerprint is independent from row ordering",()=>{
 const second={...row,identifier:"CALL-987654",time_start:"2026-11-27T10:03:00+01:00",time_end:"2026-11-27T10:05:00+01:00"};
 const first=run({rows:[row,second]}),reversed=run({rows:[second,row]});
 assert.equal(first.source_fingerprint,reversed.source_fingerprint);
 assert.deepEqual(first.canonical_rows,reversed.canonical_rows);
});

test("foreign or missing tenant number scope fails closed",()=>{
 assert.throws(()=>run({authorizedNumbers:[]}),/CDR_NUMBER_SCOPE_REQUIRED/);
 assert.throws(()=>run({authorizedNumbers:["+33890123457"]}),/CDR_NUMBER_OUTSIDE_AUTHORIZED_SCOPE/);
 assert.throws(()=>run({rows:[{...row,dn:"+33890123457"}]}),/CDR_NUMBER_OUTSIDE_AUTHORIZED_SCOPE/);
 assert.throws(()=>run({authorizedNumbers:["+33890123456","+33890123456"]}),/CDR_NUMBER_SCOPE_INVALID/);
});

test("duplicate, missing mapping, and invalid durations reject entire batch",()=>{
 assert.throws(()=>run({rows:[row,row]}),/CDR_DUPLICATE_EXTERNAL_ID/);
 assert.throws(()=>run({rows:[{...row,billing:121}]}),/CDR_BILLABLE_EXCEEDS_CONVERSATION/);
 assert.throws(()=>run({rows:[{...row,answered:300}]}),/CDR_DURATION_EXCEEDS_INTERVAL/);
 const bad=structuredClone(profile);
 delete bad.cdr.fields.dn;
 assert.throws(()=>run({adapter:bad}),/CDR_REQUIRED_FIELD_MISSING_called_number/);
 const ambiguous=structuredClone(profile);
 ambiguous.cdr.fields.other="called_number";
 assert.throws(()=>run({adapter:ambiguous}),/CDR_AMBIGUOUS_MAPPING/);
});

test("invalid time and empty batch are rejected without financial side effects",()=>{
 assert.throws(()=>run({rows:[]}),/CDR_BATCH_SIZE_INVALID/);
 assert.throws(()=>run({rows:[{...row,time_start:"2026-11-27 10:00"}]}),/CDR_TIMESTAMP_FORMAT_INVALID/);
 assert.throws(()=>run({rows:[{...row,time_start:"2026-11-27T10:09:00+01:00"}]}),/CDR_TIME_ORDER_INVALID/);
});
