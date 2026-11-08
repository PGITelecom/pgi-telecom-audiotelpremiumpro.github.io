import test from "node:test";
import assert from "node:assert/strict";
import {evaluateAudiotelUnitEconomics,estimateAudiotelSipCapacity} from "../telephony/prelaunch-not-active/economics-capacity.mjs";
const economics=(override={})=>({
 business_unit:"audiotel_platform",mode:"offline_simulation",
 model:"separate_audiotel_commission",
 monthly_minutes:10000,audiotel_fee_micros_per_min:140000,
 carrier_cost_micros_per_min:30000,media_cost_micros_per_min:10000,
 payment_cost_micros_per_min:5000,fraud_loss_provision_micros_per_min:5000,
 fixed_operating_cost_minor:30000,number_block_count:1,
 annual_arcep_fee_minor_per_block:2000,
 ...override
});
const capacity=(override={})=>({
 business_unit:"audiotel_platform",mode:"offline_simulation",
 peak_call_attempts_per_hour:100,average_call_holding_seconds:180,
 maximum_blocking_probability:0.01,sip_legs_per_call:2,
 redundant_media_nodes:2,...override
});
test("direct payout model: own fee only, never count editor funds twice",()=>{
 const x=evaluateAudiotelUnitEconomics(economics());
 assert.equal(x.audiotel_contribution_micros_per_min,90000);
 assert.equal(x.meets_seven_cent_reference,true);
 assert.equal(x.monthly_contribution_minor,90000);
 assert.equal(x.monthly_arcep_reference_reserve_minor,167);
 assert.equal(x.estimated_result_before_taxes_minor,59833);
 assert.equal(x.breakeven_minutes_per_month,3352);
 assert.equal(x.real_profit_after_taxes_minor,null);
 assert.equal(x.own_taxable_turnover_minor,null);
 assert.equal(x.external_money_transfers_enabled,false);
 assert.equal(x.professional_payouts_approved,false);
});
test("zero calls and zero usage never blocks a new eligible professional",()=>{
 const x=evaluateAudiotelUnitEconomics(economics({monthly_minutes:0}));
 assert.equal(x.monthly_contribution_minor,0);
 assert.equal(x.estimated_result_before_taxes_minor,-30167);
 assert.equal(x.monthly_minutes_assumed,0);
});
test("gross flow requires a distinct model and does not authorize legal handling",()=>{
 const base=economics();
 const x=evaluateAudiotelUnitEconomics({
  ...base,model:"platform_gross_hypothesis",
  audiotel_fee_micros_per_min:undefined,
  operator_gross_micros_per_min:300000,
  professional_due_micros_per_min:190000
 });
 assert.equal(x.audiotel_contribution_micros_per_min,60000);
 assert.equal(x.meets_seven_cent_reference,false);
 assert.equal(x.own_taxable_turnover_minor,null);
 assert.throws(()=>evaluateAudiotelUnitEconomics({
  ...base,professional_due_micros_per_min:190000
 }),{code:"APP_ECON_DOUBLE_COUNTED_PROFESSIONAL_FUNDS"});
 assert.throws(()=>evaluateAudiotelUnitEconomics({
  ...base,model:"platform_gross_hypothesis",
  operator_gross_micros_per_min:300000,
  professional_due_micros_per_min:190000
 }),{code:"APP_ECON_DOUBLE_COUNTED_COMMISSION"});
});
test("negative fractional cents are rounded conservatively, not hidden",()=>{
 const x=evaluateAudiotelUnitEconomics(economics({
  monthly_minutes:1,audiotel_fee_micros_per_min:0,
  carrier_cost_micros_per_min:1,media_cost_micros_per_min:0,
  payment_cost_micros_per_min:0,fraud_loss_provision_micros_per_min:0,
  fixed_operating_cost_minor:0,number_block_count:0
 }));
 assert.equal(x.monthly_contribution_minor,-1);
 assert.equal(x.estimated_result_before_taxes_minor,-1);
 assert.equal(x.breakeven_minutes_per_month,null);
});
test("untrusted, negative, floating or oversized financial inputs fail closed",()=>{
 assert.throws(()=>evaluateAudiotelUnitEconomics({...economics(),mode:"production"}),{code:"APP_ECON_OFFLINE_ONLY"});
 assert.throws(()=>evaluateAudiotelUnitEconomics({...economics(),monthly_minutes:-1}),{code:"APP_ECON_INVALID_MONTHLY_MINUTES"});
 assert.throws(()=>evaluateAudiotelUnitEconomics({...economics(),monthly_minutes:0.1}),{code:"APP_ECON_INVALID_MONTHLY_MINUTES"});
 assert.throws(()=>evaluateAudiotelUnitEconomics({...economics(),bank_transfer_enabled:true}),{code:"APP_ECON_INVALID_INPUT"});
});
test("SIP Erlang-B capacity is an assumption with N+1 reserve, no live SLA",()=>{
 const a=estimateAudiotelSipCapacity(capacity());
 assert.ok(a.offered_erlangs>0);
 assert.ok(a.theoretical_concurrent_calls>0);
 assert.equal(a.estimated_sip_legs_per_media_node,a.theoretical_concurrent_calls*2);
 assert.equal(a.total_provisioned_sip_legs_for_full_n_plus_one,
  a.theoretical_concurrent_calls*2*2);
 assert.equal(a.not_a_measured_capacity,true);
 assert.equal(a.live_voice_service_enabled,false);
});
test("no calls requires no channels but doesn't presume operator connectivity",()=>{
 const x=estimateAudiotelSipCapacity(capacity({peak_call_attempts_per_hour:0}));
 assert.equal(x.theoretical_concurrent_calls,0);
 assert.equal(x.carrier_cps_limit_not_verified,true);
 assert.equal(x.voice_quality_not_verified,true);
});
test("reject unsupported capacity and missing real call parameters",()=>{
 assert.throws(()=>estimateAudiotelSipCapacity({...capacity(),mode:"production"}),{code:"APP_ECON_OFFLINE_ONLY"});
 assert.throws(()=>estimateAudiotelSipCapacity(capacity({redundant_media_nodes:1})),{code:"APP_ECON_INVALID_NODES"});
 assert.throws(()=>estimateAudiotelSipCapacity(capacity({maximum_blocking_probability:0})),{code:"APP_ECON_BLOCKING_PROBABILITY"});
 assert.throws(()=>estimateAudiotelSipCapacity(capacity({peak_call_attempts_per_hour:100000,average_call_holding_seconds:3600})),{code:"APP_ECON_EXCEEDS_PLANNING_RANGE"});
});
