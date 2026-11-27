import test from "node:test";
import assert from "node:assert/strict";
import {DIRECT_SVA_ROUTING_DEADLINE,planDirectSvaAutonomy,compareDirectSvaSupplierQuotes}
 from "../backend/src/direct-sva-independence.mjs";

test("the 2018 number-sharing ban and 2028 routing deadline are distinguished",()=>{
 const now=planDirectSvaAutonomy({as_of:"2026-11-27T00:00:00Z"});
 assert.equal(now.regulation_2018,"new_08_number_lending_between_operators_prohibited_since_2018");
 assert.equal(now.routing_prefix_deadline,DIRECT_SVA_ROUTING_DEADLINE);
 assert.equal(now.routing_prefix_required_now_for_ported_numbers,false);
 assert.equal(now.routing_prefix_required_in_future_for_ported_numbers,true);
 assert.equal(now.external_gates.find(x=>x.key==="own_2028_routing_prefix").mandatory_now,false);
 const later=planDirectSvaAutonomy({as_of:"2028-07-01T10:00:00Z"});
 assert.equal(later.external_gates.find(x=>x.key==="own_2028_routing_prefix").mandatory_now,true);
 assert.ok(later.missing_documentary_evidence.includes("own_2028_routing_prefix"));
 const noPortability=planDirectSvaAutonomy({as_of:"2030-07-01",ported_numbers:false});
 assert.equal(noPortability.routing_prefix_required_now_for_ported_numbers,false);
});
test("documentary claims never authorize live network or payout operations",()=>{
 const a=planDirectSvaAutonomy({as_of:"2028-07-03",evidence:{
  direct_arcep_allocation:{issuer:"arcep",status:"verified",reference:"ARCEP-12345",checked_at:"2028-07-01T00:00:00Z"}
 }});
 assert.equal(a.external_gates[0].documentary_evidence_claimed,true);
 assert.equal(a.external_gates[0].independent_verification_performed,false);
 assert.equal(a.activation_authorized,false);
 assert.equal(a.payout_execution_authorized,false);
 assert.equal(a.network_089_connected,false);
 assert.deepEqual(a.owned_operations.includes("cdr_reconciliation"),true);
});
test("quotes are ranked only when the full equivalent regulated 089 scope is priced",()=>{
 const eligible={name:"Direct contracts",quote_complete:true,same_service_scope:true,
  uses_own_arcep_089:true,collection_of_french_sva_confirmed:true,
  routes_ported_numbers_after_2028:true,regulated_publisher_settlement:true,
  direct_publisher_iban:true,separate_platform_commission:true,
  cdr_api_available:true,national_reach_confirmed:true,
  exclusivity:false,minimum_monthly_minutes:0,minimum_monthly_spend_cents:0,
  termination_fee_cents:0,monthly_fixed_cents:10000,one_time_setup_cents:12000,
  per_minute_micro_eur:10000,per_publisher_monthly_cents:0,
  per_payout_cents:0,setup_amortization_months:12,
  external_contractors:["carrier","regulated-psp"]};
 const r=compareDirectSvaSupplierQuotes({monthly_minutes:20000,publishers:20,monthly_payouts:20,offers:[
  {...eligible,name:"Extra intermediary",monthly_fixed_cents:20000,external_contractors:["reseller","carrier","regulated-psp"]},
  eligible,
  {...eligible,name:"SIP only",collection_of_french_sva_confirmed:false,per_minute_micro_eur:1},
  {...eligible,name:"Misleading partial",quote_complete:false,monthly_fixed_cents:0}
 ]});
 assert.equal(r.ranking.length,2);
 assert.equal(r.ranking[0].name,"Direct contracts");
 assert.equal(r.ranking[0].estimated_external_partner_count,2);
 assert.equal(r.ranking[0].monthly_external_cost_micro_eur,"310000000");
 assert.equal(r.excluded.length,2);
 assert.equal(r.supplier_selected,false);
 assert.equal(r.taxes_and_personal_net_included,false);
});
test("no invented zeros, minimums, exclusivity or upfront fees ignored",()=>{
 const r=compareDirectSvaSupplierQuotes({monthly_minutes:10000,publishers:2,monthly_payouts:2,offers:[
  {name:"SIP quote",per_minute_micro_eur:3000},
  {name:"Unspecified fixed costs",quote_complete:true}
 ]});
 assert.equal(r.ranking.length,0);
 assert.equal(r.excluded.length,2);
 assert.throws(()=>compareDirectSvaSupplierQuotes({monthly_minutes:-1,publishers:0,monthly_payouts:0,offers:[]}),TypeError);
});
