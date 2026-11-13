import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
 APP_MULTI_OPERATOR_WORKSTREAMS,APP_MULTI_OPERATOR_OBJECTIVES,
 planAudiotelMultiOperatorStrategy
} from "../backend/src/audiotel-multi-operator-strategy.mjs";

const same=["collection","portability","sip_routing","cdr_reporting","publisher_payout","noc_support"];
const external=()=>Object.fromEntries(same.map(s=>[s,"operateur_a"]));
const mixed=()=>({...external(),cdr_reporting:"audiotel",noc_support:"audiotel"});
const input=()=>({
 business_unit:"audiotel_platform",currency:"EUR",objective:"max_profit",
 billable_minutes_month:100000,max_profit_sacrifice_bps:0,
 minimum_personal_net_millieur_per_min:40,
 personal_retention_basis_points:7000,
 providers:[{id:"operateur_a",label:"Partenaire hypothétique A",services:same}],
 plans:[
  {id:"maitrise",label:"Gérer davantage en interne",
   assignments:mixed(),cross_provider_reconciliation_documented:true,
   financial_terms:{app_own_revenue_millieur_per_min:120,
    app_variable_cost_millieur_per_min:20,monthly_fixed_cost_cents:100000}},
  {id:"delegation",label:"Délégation NOC et CDR",
   assignments:external(),
   financial_terms:{app_own_revenue_millieur_per_min:110,
    app_variable_cost_millieur_per_min:30,monthly_fixed_cost_cents:150000}}
 ]
});
const clone=x=>structuredClone(x);
function fails(x,code){assert.throws(()=>planAudiotelMultiOperatorStrategy(x),{code:"APP_MULTI_OPERATOR_"+code});}

test("optimizer chooses the highest APP monthly result with 0% profit sacrifice",()=>{
 const r=planAudiotelMultiOperatorStrategy(input());
 assert.equal(r.selected_preview_plan_id,"maitrise");
 assert.equal(r.baseline_max_profit_plan_id,"maitrise");
 assert.equal(r.plans[0].delegation_percent,67);
 assert.equal(r.plans[0].monthly_operating_before_tax_eur,9000);
 assert.equal(r.plans[1].monthly_operating_before_tax_eur,6500);
 assert.equal(r.plans[0].estimated_personal_monthly_net_eur,6300);
 assert.equal(r.selected_preview_reason,"highest_delegation_within_owners_profit_limit");
 assert.equal(r.monthly_company_result_sacrifice_eur,0);
 assert.equal(r.personal_net_verified,false);
 assert.equal(r.application_changes_persisted,false);
 assert.equal(r.no_live_dispatch,true);
 assert.equal(r.money_transfer_authorized,false);
 assert.equal(r.number_assignment_authorized,false);
 assert.equal(r.live_operator_selected,false);
 assert.equal(r.plans[0].preview_contractual_quote_present,false);
});

test("delegation can win when the owner explicitly tolerates a bounded profit loss",()=>{
 const x=input();x.objective="max_delegation";x.max_profit_sacrifice_bps=3000;
 const r=planAudiotelMultiOperatorStrategy(x);
 assert.equal(r.selected_preview_plan_id,"delegation");
 assert.equal(r.monthly_company_result_sacrifice_eur,2500);
 assert.equal(r.plans[1].delegation_percent,100);
 assert.ok(r.plans[1].issues.includes("single_provider_concentration"));
 x.max_profit_sacrifice_bps=2000;
 assert.equal(planAudiotelMultiOperatorStrategy(x).selected_preview_plan_id,"maitrise");
});

test("balanced mode respects owner's chosen sacrifice limit instead of hardcoding hypothetical gains",()=>{
 const x=input();x.objective="balanced";x.max_profit_sacrifice_bps=2800;
 assert.equal(planAudiotelMultiOperatorStrategy(x).selected_preview_plan_id,"delegation");
 x.max_profit_sacrifice_bps=2000;
 assert.equal(planAudiotelMultiOperatorStrategy(x).selected_preview_plan_id,"maitrise");
});

test("the provider list is open; independently assign CDR and SIP after acknowledging interop requirements",()=>{
 const x=input();
 x.providers.push({id:"operateur_b",label:"Partenaire B",services:["sip_routing","cdr_reporting","noc_support"]});
 const option=clone(x.plans[1]);
 option.id="multi";option.label="Mix des meilleurs opérateurs";
 option.assignments.sip_routing="operateur_b";option.assignments.cdr_reporting="operateur_b";
 option.assignments.noc_support="operateur_b";
 option.financial_terms.app_own_revenue_millieur_per_min=200;
 x.plans.push(option);
 let r=planAudiotelMultiOperatorStrategy(x);
 assert.equal(r.selected_preview_plan_id,"maitrise");
 assert.ok(r.plans[2].issues.includes("sip_cross_provider_interconnection_not_documented"));
 assert.ok(r.plans[2].issues.includes("cdr_cross_provider_reconciliation_not_documented"));
 assert.equal(r.plans[2].compatible_for_scenario_selection,false);
 option.cross_provider_sip_interconnection_documented=true;
 option.cross_provider_reconciliation_documented=true;
 r=planAudiotelMultiOperatorStrategy(x);
 assert.equal(r.selected_preview_plan_id,"multi");
 assert.equal(r.plans[2].external_provider_count,2);
 assert.equal(r.plans[2].delegation_percent,100);
 assert.equal(r.external_operator_contract_verified,false);
});

test("money to publishers may never be routed through APP by an operator strategy",()=>{
 const x=input();x.plans[0].assignments.publisher_payout="audiotel";
 const r=planAudiotelMultiOperatorStrategy(x);
 assert.ok(r.plans[0].issues.includes("publisher_funds_must_not_transit_audiotel"));
 assert.equal(r.plans[0].compatible_for_scenario_selection,false);
 assert.equal(r.selected_preview_plan_id,"delegation");
 assert.equal(r.plans[0].bank_or_carrier_api_calls_permitted,false);
});

test("unsupported capability, duplicate supplier, bad financial terms and cross-business scopes are rejected",()=>{
 for(const [edit,code] of [
  [x=>x.business_unit="direct_sva","SCOPE_INVALID"],
  [x=>x.currency="USD","SCOPE_INVALID"],
  [x=>x.objective="open_network","OBJECTIVE_INVALID"],
  [x=>x.max_profit_sacrifice_bps=10001,"SACRIFICE_INVALID"],
  [x=>x.billable_minutes_month=-1,"MINUTES_INVALID"],
  [x=>x.personal_retention_basis_points=-1,"RETENTION_INVALID"],
  [x=>x.providers.push(clone(x.providers[0])),"PROVIDER_DUPLICATE"],
  [x=>x.providers[0].services=["sip_routing"],"PROVIDER_NOT_CAPABLE_COLLECTION"],
  [x=>x.plans[0].financial_terms.app_own_revenue_millieur_per_min="120","APP_REVENUE_INVALID"],
  [x=>x.plans[0].financial_terms.monthly_fixed_cost_cents=-1,"FIXED_COST_INVALID"],
  [x=>delete x.plans[0].assignments.cdr_reporting,"ASSIGNMENTS_INCOMPLETE"],
  [x=>x.plans[1].id="maitrise","PLAN_DUPLICATES"]
 ]){
  const x=input();edit(x);fails(x,code);
 }
});

test("no billable traffic or loss-making scenarios cannot be recommended for activation",()=>{
 const x=input();x.billable_minutes_month=0;
 let r=planAudiotelMultiOperatorStrategy(x);
 assert.equal(r.selected_preview_plan_id,null);
 assert.equal(r.plans[0].estimated_personal_net_eur_per_min,null);
 x.billable_minutes_month=100000;
 x.plans.forEach(x=>x.financial_terms.app_own_revenue_millieur_per_min=0);
 r=planAudiotelMultiOperatorStrategy(x);
 assert.equal(r.selected_preview_plan_id,null);
 assert.ok(r.plans.every(x=>x.issues.includes("operating_result_not_positive")));
});

test("the owner's non-negotiable 0.07 EUR personal floor is enforced when tax is estimated",()=>{
 const x=input();delete x.minimum_personal_net_millieur_per_min;
 let r=planAudiotelMultiOperatorStrategy(x);
 assert.equal(r.minimum_personal_net_eur_per_min,0.07);
 assert.equal(r.selected_preview_plan_id,null);
 assert.ok(r.plans.every(p=>p.estimated_personal_floor_met===false));
 assert.ok(r.plans.every(p=>p.issues.includes("personal_net_below_minimum_target")));
 x.personal_retention_basis_points=10000;
 r=planAudiotelMultiOperatorStrategy(x);
 assert.equal(r.selected_preview_plan_id,"maitrise");
 assert.equal(r.plans[0].estimated_personal_floor_met,true);
 assert.equal(r.plans[1].estimated_personal_floor_met,false);
});

test("missing personal tax assumptions never become verified personal net",()=>{
 const x=input();delete x.personal_retention_basis_points;
 const r=planAudiotelMultiOperatorStrategy(x);
 assert.equal(r.plans[0].estimated_personal_monthly_net_eur,null);
 assert.equal(r.plans[0].estimated_personal_net_eur_per_min,null);
 assert.equal(r.personal_net_verified,false);
});

test("even all self-declared evidence never switches operator traffic, payments or production",()=>{
 const x=input();
 for(const p of x.plans)p.evidence={
  commercial_quote_verified:true,carrier_contract_verified:true,
  regulatory_rights_verified:true,direct_payout_contract_verified:true,
  technical_acceptance_verified:true,tax_adviser_reviewed:true
 };
 const r=planAudiotelMultiOperatorStrategy(x);
 assert.equal(r.external_operator_contract_verified,false);
 assert.equal(r.arcep_authorization_verified,false);
 assert.equal(r.direct_payout_live_verified,false);
 assert.equal(r.external_request_sent,false);
 assert.equal(r.no_live_dispatch,true);
 assert.equal(r.commercial_operation_authorized,undefined);
});

test("new UI and API are staff-only and bundled, do not change checkout or customer-facing routes",()=>{
 const server=fs.readFileSync(new URL("../backend/server.mjs",import.meta.url),"utf8");
 const part=server.split('if(method==="POST"&&pathname==="/api/v1/platform/audiotel/operator-strategy/preview"){')[1]?.split('if(method==="POST"&&pathname==="/api/v1/platform/performance-lab/runs"){')[0]||"";
 assert.match(part,/requireRole\(actor,\["admin"\]\)/);
 assert.match(part,/requireCsrf\(req,actor,config\)/);
 assert.match(part,/planAudiotelMultiOperatorStrategy\(body\)/);
 assert.doesNotMatch(part,/store\.[a-zA-Z_]+\(/);
 const cockpit=fs.readFileSync(new URL("../assets/control-tower.js",import.meta.url),"utf8");
 const js=fs.readFileSync(new URL("../assets/audiotel-operator-strategy.js",import.meta.url),"utf8");
 const build=fs.readFileSync(new URL("../scripts/build-static.mjs",import.meta.url),"utf8");
 assert.match(cockpit,/audiotel-operator-strategy\.js/);
 assert.match(js,/data-as-objective/);
 assert.match(js,/max_profit/);
 assert.match(js,/max_delegation/);
 assert.match(js,/publisher_payout/);
 assert.match(js,/Exporter ce rapport JSON/);
 assert.match(build,/"assets\/audiotel-operator-strategy.js"/);
 assert.ok(APP_MULTI_OPERATOR_WORKSTREAMS.length>=6);
 assert.ok(APP_MULTI_OPERATOR_OBJECTIVES.includes("balanced"));
});
