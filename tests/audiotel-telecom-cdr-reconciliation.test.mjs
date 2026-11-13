import test from "node:test";
import assert from "node:assert/strict";
import {reconcileAudiotelCdrOffline} from "../telephony/prelaunch-not-active/cdr-reconciliation.mjs";
const base=()=>({
 business_unit:"audiotel_platform",mode:"offline_simulation",
 freeswitch:[{call_reference:"FS-20261108-001",carrier_reference:"OPERATOR-1",
  tenant_id:"tenant_one",sva_e164:"+33890123456",eligible_seconds:90,status:"confirmed"}],
 operator:[{call_reference:"FS-20261108-001",carrier_reference:"OPERATOR-1",
  tenant_id:"tenant_one",sva_e164:"+33890123456",eligible_seconds:90,status:"confirmed"}]
});
test("identical CDRs produce no differences but never approve real payouts",()=>{
 const out=reconcileAudiotelCdrOffline(base());
 assert.equal(out.matching_completed,true);
 assert.equal(out.exact_match_count,1);
 assert.equal(out.discrepancy_count,0);
 assert.equal(out.operator_source_authenticated,false);
 assert.equal(out.actual_bank_receipts_reconciled,false);
 assert.equal(out.payout_eligible_seconds_contract_verified,false);
 assert.equal(out.payments_authorized,false);
});
test("mismatched tenant, DNIS, payable seconds and status trigger explicit investigation",()=>{
 const t=base();
 t.operator[0].tenant_id="tenant_two";
 t.operator[0].sva_e164="+33890123457";
 t.operator[0].eligible_seconds=50;
 t.operator[0].status="preliminary";
 const out=reconcileAudiotelCdrOffline(t);
 assert.equal(out.matching_completed,false);
 assert.equal(out.discrepancy_count,1);
 assert.deepEqual(out.discrepancies[0].reasons,[
  "tenant_mismatch","dnis_mismatch","eligible_duration_mismatch","unconfirmed_ledger"
 ]);
});
test("missing operator calls and local-only calls stay unmatched",()=>{
 const t=base();t.operator[0].call_reference="FS-20261108-002";
 const out=reconcileAudiotelCdrOffline(t);
 assert.equal(out.unmatched_local_call_references.length,1);
 assert.equal(out.unmatched_operator_call_references.length,1);
 assert.equal(out.discrepancy_count,2);
});
test("duplicates prevent accidental double-counting and payment",()=>{
 const t=base();t.operator.push({...t.operator[0]});
 const out=reconcileAudiotelCdrOffline(t);
 assert.equal(out.exact_match_count,0);
 assert.equal(out.duplicate_call_references.length,1);
 assert.equal(out.matching_completed,false);
 assert.equal(out.payments_authorized,false);
});
test("no caller PII, undocumented revenue or cross business unit injection",()=>{
 const t=base();
 assert.throws(()=>reconcileAudiotelCdrOffline({...t,mode:"live"}),{code:"APP_CDR_PRELAUNCH_ONLY"});
 assert.throws(()=>reconcileAudiotelCdrOffline({...t,business_unit:"direct_sva"}),{code:"APP_CDR_PRELAUNCH_ONLY"});
 t.freeswitch[0].caller_ani="+33612345678";
 assert.throws(()=>reconcileAudiotelCdrOffline(t),{code:"APP_CDR_UNEXPECTED_FREESWITCH_FIELD"});
});
