import test from "node:test";
import assert from "node:assert/strict";
import {assessAudiotelFallbackRobustness} from "../telephony/prelaunch-not-active/decision-robustness.mjs";
const operator=()=>({
 activation_minor_per_number:0,portability_minor_per_number:0,
 deactivation_minor_per_number:0,reactivation_minor_per_number:0,
 monthly_minor_per_number:0,monthly_minimum_minor_per_professional:0,
 commitment_months:0,fixed_monthly_minor:25000,
 payout_minor_per_professional:0,minute_micros:8000,psp_minute_micros:2000,
 global_minimum_monthly_minor:0,direct_payout_supported:true
});
const internal=()=>({
 development_minor:800000,telecom_setup_minor:150000,security_legal_setup_minor:250000,
 hosting_monthly_minor:15000,redundancy_monthly_minor:10000,
 maintenance_monthly_minor:25000,support_monthly_minor:10000,
 security_compliance_monthly_minor:10000,ops_monthly_minor:5000,
 media_minute_micros:2000,network_minute_micros:1000,fraud_minute_micros:1000
});
const base=()=>({
 business_unit:"audiotel_platform",mode:"offline_simulation",
 annual_arcep_fee_per_block_minor:2000,
 scenarios:[{reference:"PROS-150",professional_count:150,minutes_per_professional_per_day:60,
  days_per_month:30,ported_count:150,deactivation_count:0,reactivation_count:0,
  payout_count_per_month:150,arcep_blocks_held:1}],
 alternatives:[{
  reference:"HYBRID",model:"hybrid_automated",direct_arcep:true,quote_reference:null,
  commission_micros_per_min:100000,operator:operator(),internal:internal()
 }],
 horizons_months:[12,24,36]
});
const risk=(ref,values={})=>({
 reference:ref,traffic_pct:100,commission_pct:100,
 variable_cost_pct:100,fixed_cost_pct:100,one_off_overrun_minor:0,...values
});
test("risk baseline reproduces original cost and never proves personal net",()=>{
 const out=assessAudiotelFallbackRobustness({base_input:base(),risk_cases:[risk("BASELINE")]});
 assert.equal(out.base_rows.length,3);
 assert.equal(out.variants[0].rows[0].total_cost_minor,6938000);
 assert.equal(out.variants[0].rows[0].total_cost_minor,out.base_rows[0].total_cost_minor);
 assert.equal(out.variants[0].cases[0].highest_hypothetical_compliant_pretax_surplus_reference,"HYBRID");
 assert.equal(out.no_real_personal_after_tax_margin,true);
 assert.equal(out.no_orders_or_financial_transfers,true);
 assert.equal(out.network_not_activated,true);
});
test("adverse traffic, commission, fixed, variable and unplanned expense reduce profitability",()=>{
 const x=assessAudiotelFallbackRobustness({base_input:base(),
  risk_cases:[risk("BASELINE"),risk("ADVERSE",{
   traffic_pct:25,commission_pct:80,variable_cost_pct:150,
   fixed_cost_pct:125,one_off_overrun_minor:2000000
  })]});
 const baseline=x.variants[0].rows[0],down=x.variants[1].rows[0];
 assert.equal(down.monthly_minutes_assumed,67500);
 assert.ok(down.total_cost_minor<baseline.total_cost_minor+2000000);
 assert.ok(down.estimated_surplus_before_tax_minor<baseline.estimated_surplus_before_tax_minor);
 assert.equal(down.actual_personal_net_per_minute_micros,null);
 assert.equal(x.variants[1].cases[0].choice_authorized,false);
});
test("missing commission blocks a hypothetical surplus leader and never implies approved rates",()=>{
 const b=base();b.alternatives[0].commission_micros_per_min=null;
 const x=assessAudiotelFallbackRobustness({base_input:b,risk_cases:[risk("BASELINE")]});
 assert.equal(x.variants[0].cases[0].all_commissions_present,false);
 assert.equal(x.variants[0].cases[0].highest_hypothetical_pretax_surplus_reference,null);
 assert.equal(x.source_quotes_verified,false);
});
test("reject external side effects, fictional negative costs and overoptimistic shocks",()=>{
 assert.throws(()=>assessAudiotelFallbackRobustness({base_input:{...base(),mode:"production"},
  risk_cases:[risk("BASELINE")]}),{code:"APP_BUILD_BUY_OFFLINE_ONLY"});
 assert.throws(()=>assessAudiotelFallbackRobustness({base_input:base(),
  risk_cases:[risk("HACK",{webhook_url:"https://example.com"})]}),{code:"APP_RISK_RISK_CASE"});
 assert.throws(()=>assessAudiotelFallbackRobustness({base_input:base(),
  risk_cases:[risk("CHEAP",{variable_cost_pct:80})]}),{code:"APP_RISK_NON_CONSERVATIVE_COST_SHOCK"});
 assert.throws(()=>assessAudiotelFallbackRobustness({base_input:base(),
  risk_cases:[risk("BASELINE"),risk("BASELINE")]}),{code:"APP_RISK_RISK_REFERENCE"});
});
