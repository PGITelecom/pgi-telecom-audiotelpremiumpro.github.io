import test from "node:test";
import assert from "node:assert/strict";
import {prepareCarrierSwitchPreview} from "../backend/carriers/switch-readiness.mjs";

const adapter={
 schemaVersion:1,
 carrier:{code:"SECOND_HOST"},
 capabilities:{directSip:true,cdr:true,settlements:true,portability:true},
 cdr:{delivery:"file",fields:{
  rowId:"external_call_id",dialed:"called_number",
  start:"started_at",stop:"ended_at",talk:"conversation_seconds",
  eligible:"payout_eligible_seconds"
 }}
};
const row={rowId:"CALL-20261127",dialed:"+33890123456",
 start:"2026-11-27T10:00:00+01:00",
 stop:"2026-11-27T10:01:00+01:00",talk:60,eligible:60};
const plan=(x={})=>prepareCarrierSwitchPreview({
 currentCarrierCode:"FIRST_HOST",candidateAdapter:adapter,
 swaNumbers:["+33890123456"],sampleCdrRows:[row],...x
});
test("replacement preserves all core identifiers and never operates on the network",()=>{
 const p=plan();
 assert.equal(p.current_carrier,"FIRST_HOST");
 assert.equal(p.proposed_carrier,"SECOND_HOST");
 assert.equal(p.core_replacement_required,false);
 assert.equal(p.customer_numbers_must_remain_unchanged,true);
 assert.equal(p.tenant_data_must_remain_unchanged,true);
 assert.equal(p.accounting_history_must_remain_unchanged,true);
 assert.equal(p.routing_switch_authorized,false);
 assert.equal(p.number_portability_authorized,false);
 assert.equal(p.financial_or_network_action_executed,false);
 assert.equal(p.external_evidence_gates.length,8);
 assert.equal(p.cdr_sample_count,1);
 assert.equal(p.missing_adapter_capabilities.length,0);
});
test("claimed capabilities never independently authorize a port or payout",()=>{
 const p=plan({candidateAdapter:{...adapter,capabilities:{...adapter.capabilities,portability:false}}});
 assert.deepEqual(p.missing_adapter_capabilities,["portabilite"]);
 assert.equal(p.routing_switch_authorized,false);
 assert.equal(p.payout_authorized,false);
 assert.equal(p.external_evidence_gates.every(x=>x.status==="independent_evidence_required"),true);
});
test("missing or foreign number scopes and invalid carrier identity fail closed",()=>{
 assert.throws(()=>plan({swaNumbers:[]}),/SWITCH_NUMBER_SCOPE_INVALID/);
 assert.throws(()=>plan({swaNumbers:["+33890123456","+33890123456"]}),/SWITCH_NUMBER_SCOPE_INVALID/);
 assert.throws(()=>plan({currentCarrierCode:"SECOND_HOST"}),/SWITCH_TARGET_INVALID/);
 assert.throws(()=>plan({sampleCdrRows:[{...row,dialed:"+33890123457"}]}),/CDR_NUMBER_OUTSIDE_AUTHORIZED_SCOPE/);
});
