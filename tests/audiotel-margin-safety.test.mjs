import test from "node:test";
import assert from "node:assert/strict";
import {analyzeAudiotelTariffMargin,APP_SVA_TARIFF_CAPS_MILLIEUR_PER_MIN} from "../backend/src/audiotel-margin-safety.mjs";
const candidate=(changes={})=>({
  business_unit:"audiotel_platform",currency:"EUR",category:"089",billing_basis:"minute",
  retail_service_millieur_per_min:600,operator_net_millieur_per_min:440,
  publisher_due_millieur_per_min:270,network_cost_millieur_per_min:20,
  psp_cost_millieur_per_min:10,other_variable_cost_millieur_per_min:0,
  target_margin_millieur_per_min:70,operator_rate_verified:true,
  publisher_contract_verified:true,costs_verified:true,...changes
});
test("known SVA category ceilings are expressed in thousandths of EUR per minute",()=>{
 assert.equal(APP_SVA_TARIFF_CAPS_MILLIEUR_PER_MIN["081"],50);
 assert.equal(APP_SVA_TARIFF_CAPS_MILLIEUR_PER_MIN["082"],167);
 assert.equal(APP_SVA_TARIFF_CAPS_MILLIEUR_PER_MIN["089"],667);
});
test("a 7-cent per-minute net margin is mathematically impossible on regulated 081 service component",()=>{
 const r=analyzeAudiotelTariffMargin(candidate({category:"081",
  retail_service_millieur_per_min:50,operator_net_millieur_per_min:50,
  publisher_due_millieur_per_min:0,network_cost_millieur_per_min:0,psp_cost_millieur_per_min:0}));
 assert.equal(r.status,"blocked");
 assert.ok(r.blocked_reasons.includes("margin_target_exceeds_regulatory_service_cap"));
 assert.equal(r.number_assignment_authorized,false);
});
test("no tariff beyond 089 and 082 regulated price caps may be recommended",()=>{
 for(const [cat,cap] of [["089",667],["082",167]]){
  const r=analyzeAudiotelTariffMargin(candidate({
   category:cat,retail_service_millieur_per_min:cap+1,operator_net_millieur_per_min:cap
  }));
  assert.ok(r.blocked_reasons.includes("arcep_service_tariff_cap_exceeded"));
 }
});
test("commercial contribution can clear target but never auto-activate customer rates",()=>{
 const r=analyzeAudiotelTariffMargin(candidate());
 assert.equal(r.estimated_contribution_margin_before_fixed_costs_and_tax,140);
 assert.equal(r.status,"candidate_for_independent_finance_review");
 assert.equal(r.offer_publish_authorized,false);
 assert.equal(r.customer_rate_change_authorized,false);
 assert.equal(r.payout_authorized,false);
});
test("negative, below target and unverifiable economics are blocked",()=>{
 const scenarios=[
  {publisher_due_millieur_per_min:650},
  {publisher_due_millieur_per_min:390},
  {operator_rate_verified:false},
  {publisher_contract_verified:false},
  {costs_verified:false}
 ];
 for(const changes of scenarios){
  const r=analyzeAudiotelTariffMargin(candidate(changes));
  assert.equal(r.status,"blocked",JSON.stringify(changes));
 }
});
test("untrusted unit, per-call basis, invented currency or unbounded inputs cannot pass",()=>{
 const inputs=[
  {business_unit:"direct_sva"},{billing_basis:"per_call"},{currency:"USD"},
  {category:"0800"},{retail_service_millieur_per_min:0.1},
  {network_cost_millieur_per_min:-10},{operator_net_millieur_per_min:Infinity},
 ];
 for(const x of inputs)assert.throws(()=>analyzeAudiotelTariffMargin(candidate(x)));
});
