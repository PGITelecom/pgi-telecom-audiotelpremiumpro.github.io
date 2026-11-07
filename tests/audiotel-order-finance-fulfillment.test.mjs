import test from "node:test";
import assert from "node:assert/strict";
import {APP_ORDER_STEPS,evaluateAudiotelOrder} from "../backend/src/audiotel-platform-order.mjs";
import {planAudiotelFulfillment,planAudiotelFailureRecovery} from "../backend/src/audiotel-platform-fulfillment.mjs";
import {evaluateAudiotelSettlement,classifyAudiotelMoneyEvent} from "../backend/src/audiotel-platform-economics.mjs";
import {planAudiotelIncident} from "../backend/src/audiotel-platform-incident-policy.mjs";
const at=new Date("2026-11-06T21:00:00Z");
function validOrder(){
 return {
  business_unit:"audiotel_platform",tenant_id:17,request_key:"ORDER-TEST-001",
  request_kind:"new_number",category:"089",price_version_id:3,
  identity:{authenticated:true,membership_verified:true,tenant_scope_verified:true,tenant_id:17},
  evidence:Object.fromEntries(APP_ORDER_STEPS.map(s=>[s.key,{
   state:"verified",backend_origin_verified:true,issuer:s.issuers[0],
   reference:"PROOF-"+s.key.replaceAll("_","-"),verified_at:"2026-11-01T00:00:00Z"
  }])),
  carrier:{assignor_confirmed_by_operator:true,operator_reference:"OPERATOR-ACK-001",
   number_assignment_tenant_id:17,e164:"+33891234567"}
 };
}
test("number order requires real tenant identity and APP business unit",()=>{
 assert.throws(()=>evaluateAudiotelOrder({...validOrder(),business_unit:"direct_sva"},at));
 assert.throws(()=>evaluateAudiotelOrder({...validOrder(),identity:{authenticated:true}},at));
});
test("all purported evidence can only trigger independent manual review, never number activation",()=>{
 const x=validOrder(),r=evaluateAudiotelOrder(x,at);
 assert.equal(r.prepared_for_independent_review,true);
 assert.equal(r.operator_assignment_authorized,false);
 assert.equal(r.number_visible_to_customer,false);
 assert.equal(r.payment_processed,false);
});
test("carrier tenant identity mismatch blocks number delivery",()=>{
 const x=validOrder();x.carrier.number_assignment_tenant_id=18;
 const r=evaluateAudiotelOrder(x,at);
 assert.equal(r.prepared_for_independent_review,false);
 assert.ok(r.missing.includes("carrier_number_identity_unverified"));
});
test("expired operator acceptance blocks progression",()=>{
 const x=validOrder();x.evidence.carrier_assignment.expires_at="2026-11-05T00:00:00Z";
 assert.ok(evaluateAudiotelOrder(x,at).missing.includes("carrier_assignment"));
});
test("portability cannot complete without operator porting proof",()=>{
 const x=validOrder();x.request_kind="portability";
 assert.ok(evaluateAudiotelOrder(x,at).missing.includes("portability_completion"));
});
test("provisioning protocol leaves stock, operator calls and customer number unchanged",()=>{
 const p=planAudiotelFulfillment({order:{
  business_unit:"audiotel_platform",request_key:"APP-ORDER-0001",category:"089",
  identity_verified:true,service_eligibility_verified:true,signed_contract_verified:true,
  subscription_entitlement_verified:true,destination_verified:true,tariff_notice_verified:true
 },carrier:{assignor_eligibility_verified:true,operator_reference:"OPERATOR-REF-0001",
  api_supported:true,idempotency_supported:true,inventory_fresh:true}});
 assert.equal(p.ready_for_manual_review,true);
 assert.equal(p.stages.length,7);
 assert.equal(p.visible_in_customer_portal,false);
 assert.ok(p.stages.every(x=>x.dispatch_authorized===false));
});
test("timeout is retried only before a number assignment exists",()=>{
 assert.equal(planAudiotelFailureRecovery({kind:"timeout",attempts:1,number_assigned:false}).next_action,"retry_same_idempotency_key");
 assert.equal(planAudiotelFailureRecovery({kind:"timeout",attempts:1,number_assigned:true}).next_action,"operator_reconciliation_required");
});
const evidence=issuer=>({issuer,reference:"PROOF-"+issuer,authoritative_source_verified:true});
const validFinance=()=>({
 business_unit:"audiotel_platform",currency:"EUR",period_reference:"PERIOD-202611",
 operator_statement_minor:10000,bank_received_minor:10000,publisher_contract_due_minor:7000,
 network_cost_minor:500,billable_seconds:6000,minimum_margin_minor_per_min:7,
 statement_evidence:evidence("carrier_statement"),bank_evidence:evidence("bank_feed"),
 publisher_contract_reference:"CONTRACT-123456",contract_model:"agent",
 accounting_policy_approved:true,kyb_verified:true,third_party_funds_compliance_approved:true
});
test("APP accounting preserves liability, margins and no payout authority",()=>{
 const r=evaluateAudiotelSettlement(validFinance());
 assert.equal(r.estimated_margin_before_tax_minor,2500);
 assert.equal(r.publisher_due_remaining_minor,7000);
 assert.equal(r.eligible_for_independent_accounting_review,true);
 assert.equal(r.payout_authorized,false);
 assert.equal(r.statutory_revenue_minor,null);
});
test("accounting rejects unmatched operator and bank sources",()=>{
 const x=validFinance();x.bank_received_minor=9000;
 assert.ok(evaluateAudiotelSettlement(x).blocked_reasons.includes("bank_vs_operator_mismatch"));
});
test("accounting never accepts another business unit nor forged event source",()=>{
 assert.throws(()=>evaluateAudiotelSettlement({...validFinance(),business_unit:"direct_sva"}));
 assert.throws(()=>classifyAudiotelMoneyEvent({business_unit:"audiotel_platform",source:"stripe",kind:"operator_statement",external_event_id:"EVENT-123456"}));
});
test("incident preparation cannot send messages, refund or deactivate numbers",()=>{
 const r=planAudiotelIncident({business_unit:"audiotel_platform",kind:"sip_routing_failed",case_reference:"CASE-20261106"});
 assert.equal(r.severity,"critical");
 assert.equal(r.customer_email_sent,false);
 assert.equal(r.refund_executed,false);
 assert.equal(r.number_deactivated,false);
 assert.throws(()=>planAudiotelIncident({business_unit:"direct_sva",kind:"sip_routing_failed",case_reference:"CASE-20261106"}));
});