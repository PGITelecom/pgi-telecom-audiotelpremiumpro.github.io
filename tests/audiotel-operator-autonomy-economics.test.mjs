import test from "node:test";
import assert from "node:assert/strict";
import {
  compareAudiotelOperatorModels,
  APP_OPERATOR_AUTONOMY_GATES
} from "../backend/src/audiotel-operator-autonomy-economics.mjs";

const example=()=>({
  business_unit:"audiotel_platform",currency:"EUR",billable_minutes_month:198000,
  personal_retention_basis_points:7000,
  reseller:{
    app_contractual_fee_millieur_per_min:100,app_variable_cost_millieur_per_min:20,
    app_fixed_monthly_cost_cents:100000
  },
  direct_operator:{
    app_contractual_fee_millieur_per_min:155,app_variable_cost_millieur_per_min:25,
    app_fixed_monthly_cost_cents:200000
  }
});
const copy=v=>structuredClone(v);

test("direct operator opportunity is only potential: before-tax improvement, fixed costs and personal net stay separate",()=>{
 const r=compareAudiotelOperatorModels(example());
 assert.equal(r.schema_version,"audiotel-operator-autonomy-economics/1");
 assert.equal(r.billable_minutes_month,198000);
 assert.equal(r.reseller.monthly_operating_result_before_tax_eur,14840);
 assert.equal(r.direct_operator.monthly_operating_result_before_tax_eur,23740);
 assert.equal(r.improvement.additional_monthly_company_result_before_tax_eur,8900);
 assert.equal(r.improvement.incremental_contribution_eur_per_min,0.05);
 assert.equal(r.improvement.break_even_minutes_month_for_extra_fixed_cost,20000);
 assert.equal(r.direct_operator.personal_takehome_estimate_eur,16618);
 assert.equal(r.improvement.personal_takehome_gain_estimate_eur,6230);
 assert.equal(r.target_personal_net_eur_per_min,0.07);
 assert.equal(r.personal_goal_projected_only,true);
 assert.equal(r.personal_goal_fiscally_verified,false);
 assert.equal(r.financial_comparison_provisional,true);
 assert.equal(r.commercial_operation_authorized,false);
 assert.equal(r.carrier_connection_active,false);
 assert.equal(r.third_party_funds_pass_through_app_account,false);
 assert.equal(r.publisher_receipts_booked_as_app_revenue,false);
});

test("absence of actual fiscal evidence never generates verified personal take-home",()=>{
 const x=example();delete x.personal_retention_basis_points;
 const r=compareAudiotelOperatorModels(x);
 assert.equal(r.direct_operator.personal_takehome_estimate_eur,null);
 assert.equal(r.personal_goal_projected_only,null);
 assert.ok(r.missing_external_evidence.includes("personal_after_tax_result_not_verified"));
});

test("even purportedly complete evidence cannot authorize a number, live connection or payment",()=>{
 const x=example();
 x.evidence={
  reseller_written_quote_verified:true,direct_written_quote_verified:true,
  legal_operator_structure_verified:true,direct_publisher_payout_contract_verified:true,
  payment_legal_model_verified:true,personal_tax_simulation_verified:true
 };
 const r=compareAudiotelOperatorModels(x);
 assert.equal(r.financial_comparison_provisional,false);
 assert.equal(r.personal_goal_fiscally_verified,true);
 assert.equal(r.operator_contract_executed,false);
 assert.equal(r.arcep_numbering_obtained,false);
 assert.equal(r.automatic_financial_transfer_authorized,false);
 assert.equal(r.production_deployment_permitted,false);
});

test("no traffic and negative direct contribution cannot claim economic viability",()=>{
 const x=example();x.billable_minutes_month=0;
 let r=compareAudiotelOperatorModels(x);
 assert.equal(r.direct_operator.personal_takehome_estimate_eur,0);
 assert.equal(r.direct_operator.personal_takehome_estimate_eur_per_min,null);
 assert.equal(r.personal_goal_projected_only,null);
 assert.ok(r.missing_external_evidence.includes("no_traffic"));
 const y=example();
 y.direct_operator.app_contractual_fee_millieur_per_min=10;
 y.direct_operator.app_variable_cost_millieur_per_min=30;
 r=compareAudiotelOperatorModels(y);
 assert.ok(r.missing_external_evidence.includes("operator_variable_contribution_not_positive"));
 assert.equal(r.improvement.break_even_minutes_month_for_extra_fixed_cost,null);
});

test("strict EUR, business separation, retention coefficient and integer rate input",()=>{
 const base=example();
 const trials=[
  [{...base,business_unit:"direct_sva"},"APP_OPERATOR_ECON_SCOPE_INVALID"],
  [{...base,currency:"USD"},"APP_OPERATOR_ECON_SCOPE_INVALID"],
  [{...base,billable_minutes_month:-1},"APP_OPERATOR_ECON_MINUTES"],
  [{...base,billable_minutes_month:3.14},"APP_OPERATOR_ECON_MINUTES"],
  [{...base,personal_retention_basis_points:10001},"APP_OPERATOR_ECON_PERSONAL_RETENTION_BPS"],
  [{...base,personal_retention_basis_points:1.1},"APP_OPERATOR_ECON_PERSONAL_RETENTION_BPS"]
 ];
 for(const [input,code] of trials)assert.throws(()=>compareAudiotelOperatorModels(input),{code});
 const bad=copy(base);
 bad.direct_operator.app_variable_cost_millieur_per_min="50";
 assert.throws(()=>compareAudiotelOperatorModels(bad),{code:"APP_OPERATOR_ECON_direct_VARIABLE"});
});

test("direct provider with lower monthly costs breaks even immediately if per-minute economics improve",()=>{
 const x=example();
 x.direct_operator.app_fixed_monthly_cost_cents=50000;
 const r=compareAudiotelOperatorModels(x);
 assert.equal(r.improvement.break_even_minutes_month_for_extra_fixed_cost,0);
});

test("contracting operator must have regulatory, network, direct-pay, accounting and owner gates",()=>{
 const keys=APP_OPERATOR_AUTONOMY_GATES.map(x=>x.key);
 assert.equal(new Set(keys).size,keys.length);
 for(const name of ["contracting_operator","arcep_ce","numbering","operator_wholesale","ported_routing","cdr_reconciliation","direct_publisher_payout","payment_law","editor_compliance","pricing_and_tax","technical_acceptance","owner_release"]){
  assert.ok(keys.includes(name),name);
 }
});
