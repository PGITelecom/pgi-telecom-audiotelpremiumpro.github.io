import test from "node:test";
import assert from "node:assert/strict";
import {compareAudiotelBuildVsBuy} from "../telephony/prelaunch-not-active/build-vs-buy.mjs";
const operator=(extra={})=>({
 activation_minor_per_number:0,portability_minor_per_number:0,
 deactivation_minor_per_number:0,reactivation_minor_per_number:0,
 monthly_minor_per_number:0,monthly_minimum_minor_per_professional:0,
 commitment_months:0,fixed_monthly_minor:20000,
 payout_minor_per_professional:0,minute_micros:7000,psp_minute_micros:2000,
 global_minimum_monthly_minor:0,direct_payout_supported:true,...extra
});
const internal=(extra={})=>({
 development_minor:500000,telecom_setup_minor:100000,security_legal_setup_minor:100000,
 hosting_monthly_minor:20000,redundancy_monthly_minor:10000,
 maintenance_monthly_minor:10000,support_monthly_minor:5000,
 security_compliance_monthly_minor:5000,ops_monthly_minor:5000,
 media_minute_micros:1000,network_minute_micros:1000,fraud_minute_micros:1000,...extra
});
const alternative=(reference,extra={})=>({
 reference,model:"hybrid_automated",direct_arcep:true,quote_reference:null,
 commission_micros_per_min:140000,operator:operator(),internal:internal(),...extra
});
const scenario=(count=150,min=15)=>({
 reference:"CASE-"+count+"-"+min,professional_count:count,
 minutes_per_professional_per_day:min,days_per_month:30,
 ported_count:count,deactivation_count:0,reactivation_count:0,
 payout_count_per_month:count,arcep_blocks_held:1
});
const input=(alts=[alternative("HYBRID")],scenarios=[scenario()],horizons=[12,24,36])=>({
 business_unit:"audiotel_platform",mode:"offline_simulation",
 annual_arcep_fee_per_block_minor:2000,
 scenarios,alternatives:alts,horizons_months:horizons
});
test("offline multi-case TCO has 12/24/36 months, fixed and minute costs",()=>{
 const out=compareAudiotelBuildVsBuy(input());
 assert.equal(out.rows.length,3);
 const [a,b,c]=out.rows;
 assert.equal(a.monthly_minutes_assumed,67500);
 assert.equal(a.arcep_reference_tax_minor,2000);
 assert.equal(b.arcep_reference_tax_minor,4000);
 assert.equal(c.arcep_reference_tax_minor,6000);
 assert.equal(a.total_minutes_assumed,810000);
 assert.ok(c.total_cost_minor>b.total_cost_minor);
 assert.equal(a.actual_personal_net_per_minute_micros,null);
 assert.equal(out.contract_or_spend_authorized,false);
 assert.equal(a.all_stated_commercial_gates_met,true);
});
test("50 EUR activation is counted 150 times and fails zero-fee goal",()=>{
 const expensive=alternative("OUTSIDE",{model:"external_managed",direct_arcep:false,
  operator:operator({activation_minor_per_number:5000})});
 const base=compareAudiotelBuildVsBuy(input([alternative("INTERNAL"),expensive],[scenario()], [12]));
 const e=base.rows.find(r=>r.alternative_reference==="OUTSIDE");
 const b=base.rows.find(r=>r.alternative_reference==="INTERNAL");
 assert.equal(e.upfront_total_minor-b.upfront_total_minor,750000);
 assert.equal(e.hard_gates.zero_activation,false);
 assert.equal(e.all_stated_commercial_gates_met,false);
 assert.equal(base.cases[0].operator_choice_or_internal_activation_authorized,false);
});
test("monthly minimum, term, per-number and bank payout restrictions block compliance",()=>{
 const a=alternative("CONFLICT",{operator:operator({
  commitment_months:24,monthly_minimum_minor_per_professional:3000,
  monthly_minor_per_number:100,portability_minor_per_number:1000,
  direct_payout_supported:false
 })});
 const out=compareAudiotelBuildVsBuy(input([a],[scenario(50,0)],[12]));
 const row=out.rows[0];
 assert.equal(row.monthly_minutes_assumed,0);
 assert.equal(row.cost_per_minute_micros,null);
 assert.equal(row.estimated_surplus_per_minute_before_tax_micros,null);
 assert.equal(row.hard_gates.direct_payout_proposed,false);
 assert.equal(row.hard_gates.no_professional_commitment,false);
 assert.equal(row.hard_gates.zero_professional_minimum,false);
 assert.equal(row.all_stated_commercial_gates_met,false);
 assert.ok(row.total_cost_minor>0);
});
test("differing commissions prevent inference of best profit from cheaper TCO",()=>{
 const low=alternative("LOW",{commission_micros_per_min:10000,operator:operator({fixed_monthly_minor:0})});
 const high=alternative("HIGH",{commission_micros_per_min:140000,operator:operator({fixed_monthly_minor:100000})});
 const out=compareAudiotelBuildVsBuy(input([low,high],[scenario(200,60)],[12]));
 const m=new Map(out.rows.map(r=>[r.alternative_reference,r]));
 assert.ok(m.get("LOW").total_cost_minor<m.get("HIGH").total_cost_minor);
 assert.ok(m.get("LOW").estimated_surplus_before_tax_minor<
           m.get("HIGH").estimated_surplus_before_tax_minor);
 assert.equal(out.cases[0].decision,"NO_VERIFIED_CARRIER_OFFERS_OR_TAX_DATA");
});
test("unknown commission remains unknown; no fabricated after-tax margin",()=>{
 const a=alternative("UNKNOWN",{commission_micros_per_min:null,
  operator:operator({direct_payout_supported:null})});
 const out=compareAudiotelBuildVsBuy(input([a],[scenario(50,60)],[12]));
 assert.equal(out.rows[0].estimated_own_revenue_minor,null);
 assert.equal(out.rows[0].estimated_surplus_before_tax_minor,null);
 assert.equal(out.after_tax_personal_margin_proven,false);
 assert.equal(out.rows[0].hard_gates.direct_payout_proposed,false);
});
test("reject live mode, unexpected sensitive data, negative prices and duplicates",()=>{
 assert.throws(()=>compareAudiotelBuildVsBuy({...input(),mode:"production"}),{code:"APP_BUILD_BUY_OFFLINE_ONLY"});
 assert.throws(()=>compareAudiotelBuildVsBuy(input([
  {...alternative("HACK"),iban:"FR761234567890"}
 ])),{code:"APP_BUILD_BUY_INVALID_ALTERNATIVE"});
 assert.throws(()=>compareAudiotelBuildVsBuy(input([
  alternative("BAD",{operator:operator({activation_minor_per_number:-1})})
 ])),{code:"APP_BUILD_BUY_INVALID_OPERATOR_activation_minor_per_number"});
 assert.throws(()=>compareAudiotelBuildVsBuy(input([
  alternative("DUP"),alternative("DUP")
 ])),{code:"APP_BUILD_BUY_DUPLICATE_ALTERNATIVE"});
});
test("unusual 0/50/150/200/500/1000 cases remain illustrative and safe",()=>{
 const scenarios=[50,150,200,500,1000].flatMap(n=>[0,15,60].map(min=>scenario(n,min)));
 const out=compareAudiotelBuildVsBuy(input([
  alternative("ALT-A"),alternative("ALT-B",{model:"self_managed_sip"})
 ],scenarios));
 assert.equal(out.rows.length,90);
 assert.equal(out.cases.length,45);
 assert.ok(out.rows.every(x=>x.approval_to_purchase_or_operate===false));
 assert.equal(out.recommendation,"WAIT_FOR_AUTHENTICATED_QUOTES_AND_WRITTEN_ACTIVATION_TERMS");
});
