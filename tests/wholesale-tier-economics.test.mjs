import test from "node:test";
import assert from "node:assert/strict";
import {evaluateWholesaleTiers} from "../backend/src/wholesale-tier-economics.mjs";
const input={business_unit:"audiotel_platform",currency:"EUR",billing_basis:"minute",category:"089",retail_service_micro_eur_per_min:600000,publisher_micro_eur_per_min:300000,other_variable_micro_eur_per_min:10000,target_contribution_micro_eur_per_min:50000,monthly_fixed_micro_eur:10000000,minimum_network_spend_micro_eur:30000000,one_off_micro_eur:12000000,horizon_months:12,low_monthly_minutes:500,base_monthly_minutes:1000,high_monthly_minutes:2000,tier_mode:"marginal",tiers:[{from_minutes:0,operator_net_micro_eur_per_min:500000,network_micro_eur_per_min:20000},{from_minutes:1000,operator_net_micro_eur_per_min:550000,network_micro_eur_per_min:10000}],evidence:Object.fromEntries(["signed_quote","costs_verified","publisher_terms_verified","tariff_verified","minimum_commitment_verified","tier_rules_verified"].map(x=>[x,true]))};
test("volume tiers apply only to minutes above marginal threshold and account for minimum spend without double counting",()=>{
 const r=evaluateWholesaleTiers(input);
 assert.equal(r.scenarios[0].minimum_commitment_topup_micro_eur,20000000);
 assert.equal(r.scenarios[1].operator_revenue_micro_eur,500000000);
 assert.equal(r.scenarios[2].operator_revenue_micro_eur,1050000000);
 assert.equal(r.scenarios[2].network_charge_micro_eur,30000000);
 assert.equal(r.scenarios[2].monthly_contribution_micro_eur,390000000);
 assert.equal(r.status,"candidate_for_independent_review");
 assert.equal(r.contract_authorized,false);
});
test("retroactive tiers differ from marginal tiers and missing evidence blocks recommendations",()=>{
 const r=evaluateWholesaleTiers({...input,tier_mode:"retroactive"});
 assert.equal(r.scenarios[2].operator_revenue_micro_eur,1100000000);
 assert.equal(r.scenarios[2].network_charge_micro_eur,20000000);
 assert.equal(r.scenarios[2].minimum_commitment_topup_micro_eur,10000000);
 assert.equal(evaluateWholesaleTiers({...input,evidence:{}}).status,"blocked");
 assert.equal(evaluateWholesaleTiers({...input,monthly_fixed_micro_eur:200000000}).status,"blocked");
 assert.throws(()=>evaluateWholesaleTiers({...input,tiers:[input.tiers[1]]}),/ORDER/);
 assert.throws(()=>evaluateWholesaleTiers({...input,minimum_network_spend_micro_eur:null}),/MINIMUM/);
});
