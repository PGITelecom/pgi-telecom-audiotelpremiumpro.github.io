import test from "node:test";
import assert from "node:assert/strict";
import {inspectAudiotelPreparedInfrastructure}
 from "../scripts/audiotel-telecom-technical-status.mjs";

test("single technical inventory names existing modules without claiming live SVA",()=>{
 const x=inspectAudiotelPreparedInfrastructure();
 assert.equal(x.business_unit,"audiotel_platform");
 assert.equal(x.mode,"repository_inventory_only");
 assert.equal(x.all_source_files_present,true);
 assert.equal(x.expected_routing_endpoints_present,true);
 assert.ok(x.repository_telecom_chain_gate_count>=25);
 assert.ok(x.missing_external_evidence.includes(
  "arcep_legal_eligibility_and_actual_numbering_decision"));
 assert.equal(x.arcep_resources_assigned,false);
 assert.equal(x.actual_sip_calls_proven,false);
 assert.equal(x.operator_ready,false);
 assert.equal(x.live_service_authorized,false);
 assert.equal(x.production_changes_authorized,false);
 assert.equal(x.remotely_verified,false);
});
test("technical inventory cannot be confused with production verification",()=>{
 const x=inspectAudiotelPreparedInfrastructure();
 for(const row of x.code_inventory){
  assert.equal(row.source_present,true,row.path);
  assert.equal(row.is_connected_to_live_operator,false,row.path);
 }
 assert.equal(x.direct_professional_bank_payout_live,false);
 assert.equal(x.paid_minutes_reconciled,false);
});
