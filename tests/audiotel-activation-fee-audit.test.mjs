import test from "node:test";
import assert from "node:assert/strict";
import {auditAudiotelActivationOverlays} from "../telephony/prelaunch-not-active/activation-fee-audit.mjs";

const operator=(changes={})=>({
 activation_minor_per_number:0,portability_minor_per_number:0,
 deactivation_minor_per_number:0,reactivation_minor_per_number:0,
 monthly_minor_per_number:0,monthly_minimum_minor_per_professional:0,
 commitment_months:0,fixed_monthly_minor:0,payout_minor_per_professional:0,
 minute_micros:0,psp_minute_micros:0,global_minimum_monthly_minor:0,
 direct_payout_supported:true,...changes
});
const internal=()=>({
 development_minor:0,telecom_setup_minor:0,security_legal_setup_minor:0,
 hosting_monthly_minor:0,redundancy_monthly_minor:0,
 maintenance_monthly_minor:0,support_monthly_minor:0,
 security_compliance_monthly_minor:0,ops_monthly_minor:0,
 media_minute_micros:0,network_minute_micros:0,fraud_minute_micros:0
});
const base=(n=150,min=60,ported=100)=>({
 business_unit:"audiotel_platform",mode:"offline_simulation",
 annual_arcep_fee_per_block_minor:2000,
 alternatives:[{reference:"HYBRID",model:"hybrid_automated",direct_arcep:false,
  quote_reference:null,commission_micros_per_min:100000,
  operator:operator(),internal:internal()}],
 scenarios:[{reference:"CASE-1",professional_count:n,ported_count:ported,
  minutes_per_professional_per_day:min,days_per_month:30,
  deactivation_count:0,reactivation_count:0,
  payout_count_per_month:n,arcep_blocks_held:1}],
 horizons_months:[12,24,36]
});
const fee=(reference,category,basis,amount_minor,{batch_size=null,amount_micros_per_minute=null}={})=>({
 reference,category,basis,amount_minor,amount_micros_per_minute,batch_size
});
const audit=(input=base(),fees=[])=>auditAudiotelActivationOverlays({
 business_unit:"audiotel_platform",mode:"offline_simulation",base_input:input,
 fee_schedules:[{alternative_reference:"HYBRID",
  completeness:"hypothetical",fees}]
});
test("detects disguised costs per batch, new number, per month and per minute without double counting",()=>{
 const a=audit(base(),[
  fee("INSTALL-LOT","batch_provisioning","per_batch",10000,{batch_size:50}),
  fee("PER-NEW","manual_activation_admin","per_new_number",1000),
  fee("LEASE","reservation_admin","per_number_month",100),
  fee("NETWORK-MIN","carrier_interconnect_setup","per_minute",null,{
   amount_micros_per_minute:5000
  })
 ]);
 const row=a.rows[0];
 assert.equal(row.incremental_upfront_minor,80000);
 assert.equal(row.incremental_recurring_minor,180000);
 assert.equal(row.incremental_variable_minor,1620000);
 assert.equal(row.incremental_total_minor,1880000);
 assert.equal(row.total_cost_with_incremental_fees_minor,1880000);
 assert.equal(row.upfront_carrier_fee_exposure_minor,80000);
 assert.equal(row.carrier_setup_equivalent_per_number_minor,534);
 assert.equal(row.effective_zero_onboarding_fees_assumed,false);
 assert.equal(row.violates_strict_zero_fee_goal,true);
 assert.equal(row.per_line_monthly_surcharge_detected,true);
 assert.equal(row.personal_net_after_tax_per_minute_micros,null);
 assert.equal(a.can_assert_real_zero_activation_cost,false);
 assert.equal(a.purchase_or_provision_authorized,false);
});
test("zero assumed fees are NEVER authenticated as carrier zero-price promises",()=>{
 const a=audit(base(50,0,0),[]);
 assert.equal(a.rows[0].total_cost_with_incremental_fees_minor,0);
 assert.equal(a.rows[0].cost_per_minute_micros,null);
 assert.equal(a.rows[0].effective_zero_onboarding_fees_assumed,true);
 assert.equal(a.rows[0].quote_verified,false);
 assert.equal(a.rows[0].personal_net_after_tax_per_minute_micros,null);
 assert.equal(a.comparisons[0].verified_real_price_winner,null);
});
test("unclassified operator charges block a compliant verdict",()=>{
 const a=audit(base(1,0,0),[fee("MYSTERY","other_unclassified","per_project",1)]);
 assert.equal(a.rows[0].unclassified_fees_detected,true);
 assert.equal(a.rows[0].conditions_met_even_in_hypothesis,false);
 assert.equal(a.rows[0].classification_review_required,true);
 assert.equal(a.rows[0].estimated_surplus_before_tax_minor,-1);
});
test("per-ported number and per-new number differ correctly",()=>{
 const a=audit(base(10,0,8),[
  fee("PORT-HIDDEN","onboarding_support","per_ported_number",300),
  fee("NEW-HIDDEN","onboarding_support","per_new_number",500)
 ]);
 assert.equal(a.rows[0].incremental_upfront_minor,3400);
 assert.equal(a.rows[0].carrier_setup_equivalent_per_number_minor,340);
});
test("base model fee is counted only once; extra 0 is zero",()=>{
 const a=base(10,0,8);
 a.alternatives[0].operator.activation_minor_per_number=5000;
 const out=audit(a,[fee("ZERO-EXTRA","batch_provisioning","per_project",0)]);
 assert.equal(out.rows[0].base_total_cost_minor,50000);
 assert.equal(out.rows[0].total_cost_with_incremental_fees_minor,50000);
 assert.equal(out.rows[0].effective_zero_onboarding_fees_assumed,false);
});
test("reject undocumented schedules, malformed charges, false production mode",()=>{
 assert.throws(()=>auditAudiotelActivationOverlays({
  business_unit:"audiotel_platform",mode:"offline_simulation",
  base_input:base(),fee_schedules:[]
 }),{code:"APP_ACTIVATION_AUDIT_INCOMPLETE_SCHEDULES"});
 const input=base();
 assert.throws(()=>auditAudiotelActivationOverlays({
  business_unit:"audiotel_platform",mode:"production",base_input:input,
  fee_schedules:[{alternative_reference:"HYBRID",completeness:"hypothetical",fees:[]}]
 }),{code:"APP_ACTIVATION_AUDIT_OFFLINE_ONLY"});
 assert.throws(()=>audit(input,[fee("BAD-BATCH","batch_provisioning","per_batch",100,{
  batch_size:0})]),{code:"APP_ACTIVATION_AUDIT_ZERO_BATCH_SIZE"});
 assert.throws(()=>audit(input,[fee("UNKNOWN-CATEGORY","unknown","per_project",100)]),{
  code:"APP_ACTIVATION_AUDIT_FEE_CATEGORY"
 });
 assert.throws(()=>audit(input,[fee("SECRET","account_opening","per_project",1,{
  amount_micros_per_minute:100
 })]),{code:"APP_ACTIVATION_AUDIT_MINOR_SHAPE"});
});
test("small single professional and five-thousand-professional comparisons remain bounded",()=>{
 for(const n of [1,10,50,150,500,1000,5000]){
  const a=audit(base(n,0,0),[fee("BATCH","batch_provisioning","per_batch",1000,{
   batch_size:250
  })]);
  const expected=Math.ceil(n/250)*1000;
  assert.equal(a.rows[0].incremental_upfront_minor,expected);
  assert.equal(a.rows[0].fee_breakdown[0].units,Math.ceil(n/250));
 }
});
