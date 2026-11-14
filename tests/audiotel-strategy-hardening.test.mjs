import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
 calculateAudiotelStrategyFinance,euroFromMillieur,atLeastShareOfBest
} from "../backend/src/audiotel-strategy-finance.mjs";
import {planAudiotelMultiOperatorStrategy} from "../backend/src/audiotel-multi-operator-strategy.mjs";

const SERVICES=["collection","portability","sip_routing","cdr_reporting","publisher_payout","noc_support"];
const vendor=Object.fromEntries(SERVICES.map(s=>[s,"carrier"]));
const partiallyInternal={...vendor,cdr_reporting:"audiotel",noc_support:"audiotel"};
function plan(id,fee,assignments){
 return {
  id,label:id,assignments,
  cross_provider_reconciliation_documented:true,
  cross_provider_sip_interconnection_documented:true,
  financial_terms:{
   app_own_revenue_millieur_per_min:fee,
   app_variable_cost_millieur_per_min:0,
   monthly_fixed_cost_cents:0,
   one_off_setup_cost_cents:0
  }
 };
}
function scenario(){
 return {
  business_unit:"audiotel_platform",currency:"EUR",objective:"max_profit",
  billable_minutes_month:1,max_profit_sacrifice_bps:0,
  minimum_personal_net_millieur_per_min:0,
  personal_retention_basis_points:10000,
  providers:[{id:"carrier",label:"Carrier (hypothetical)",services:SERVICES}],
  plans:[plan("more_delegated",11,vendor),plan("more_profitable",14,partiallyInternal)]
 };
}

test("finance core retains millieur precision and handles sub-cent rounding symmetrically",()=>{
 const f=calculateAudiotelStrategyFinance({
  minutes:3,appOwnRevenueMillieurPerMin:13,
  appVariableCostMillieurPerMin:1,
  monthlyFixedCostCents:1,oneOffSetupCostCents:100,
  personalRetentionBps:8000,minimumPersonalNetMillieurPerMin:7
 });
 assert.equal(f.revenue_millieur,39n);
 assert.equal(f.variable_cost_millieur,3n);
 assert.equal(f.operating_millieur,26n);
 assert.equal(f.personal_millieur,20n);
 assert.equal(f.personal_floor_met,false);
 assert.equal(f.monthly_operating_before_tax_eur,0.03);
 assert.equal(f.estimated_personal_monthly_net_eur,0.02);
 assert.equal(euroFromMillieur(-5n),-0.01);
 assert.equal(euroFromMillieur(5n),0.01);
 assert.throws(()=>euroFromMillieur(1),TypeError);
});

test("profit ranking must use exact integer millieuros rather than cents-rounded display",()=>{
 const x=scenario();
 const r=planAudiotelMultiOperatorStrategy(x);
 assert.equal(r.plans[0].monthly_operating_before_tax_eur,0.01);
 assert.equal(r.plans[1].monthly_operating_before_tax_eur,0.01);
 assert.equal(r.plans[0].company_result_millieur_exact,"11");
 assert.equal(r.plans[1].company_result_millieur_exact,"14");
 assert.equal(r.baseline_max_profit_plan_id,"more_profitable");
 assert.equal(r.selected_preview_plan_id,"more_profitable");
});

test("profit-sacrifice boundary is checked before cent rounding",()=>{
 const x=scenario();x.objective="max_delegation";x.max_profit_sacrifice_bps=2000;
 assert.equal(planAudiotelMultiOperatorStrategy(x).selected_preview_plan_id,"more_profitable");
 x.max_profit_sacrifice_bps=2500;
 assert.equal(planAudiotelMultiOperatorStrategy(x).selected_preview_plan_id,"more_delegated");
 assert.equal(atLeastShareOfBest(11n,14n,2000),false);
 assert.equal(atLeastShareOfBest(11n,14n,2500),true);
});

test("unverified operator paperwork and even fully claimed evidence never allow launch",()=>{
 const x=scenario();
 x.plans[0].evidence={
  commercial_quote_verified:true,carrier_contract_verified:true,
  regulatory_rights_verified:true,direct_payout_contract_verified:true,
  technical_acceptance_verified:true,tax_adviser_reviewed:true
 };
 const r=planAudiotelMultiOperatorStrategy(x);
 assert.equal(r.preview_is_not_a_release_decision,true);
 assert.equal(r.owner_entered_evidence_not_independently_verified,true);
 assert.match(r.activation_approval_status,/blocked/);
 assert.equal(r.no_live_dispatch,true);
 assert.equal(r.external_request_sent,false);
 assert.equal(r.money_transfer_authorized,false);
 assert.equal(r.plans[0].evidence_is_owner_declared_only,true);
 assert.equal(r.plans[0].launch_readiness_independently_verified,false);
 assert.equal(r.plans[0].release_requires_separate_owner_authorization,true);
});

test("invalid and unsupported assignments remain fail-closed",()=>{
 const x=scenario();
 x.providers[0].id="__proto__";
 assert.throws(()=>planAudiotelMultiOperatorStrategy(x),{code:"APP_MULTI_OPERATOR_PROVIDER_ID_INVALID"});
 const y=scenario();
 y.plans[0].assignments.publisher_payout="audiotel";
 const r=planAudiotelMultiOperatorStrategy(y);
 assert.ok(r.plans[0].issues.includes("publisher_funds_must_not_transit_audiotel"));
 assert.equal(r.plans[0].compatible_for_scenario_selection,false);
 const z=scenario();
 z.personal_retention_basis_points=null;
 const report=planAudiotelMultiOperatorStrategy(z);
 assert.equal(report.plans[0].estimated_personal_floor_met,null);
 assert.ok(report.plans[0].issues.includes("personal_after_tax_net_unverified"));
 assert.equal(report.personal_net_verified,false);
});

test("backend contract preserves admin and CSRF checks and does not persist strategy",()=>{
 const source=fs.readFileSync(new URL("../backend/server.mjs",import.meta.url),"utf8");
 const start='if(method==="POST"&&pathname==="/api/v1/platform/audiotel/operator-strategy/preview"){';
 const block=source.split(start)[1]?.split('if(method==="POST"&&pathname==="/api/v1/platform/performance-lab/runs"){')[0]||"";
 assert.match(block,/requireRole\(actor,\["admin"\]\)/);
 assert.match(block,/requireCsrf\(req,actor,config\)/);
 assert.match(block,/readJson\(req,config.bodyLimitBytes\)/);
 assert.doesNotMatch(block,/store\.|fetch\(|stripe|neon|resend|payout/i);
});
