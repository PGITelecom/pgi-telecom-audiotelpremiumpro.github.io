/**
 * Cost-overlay audit for Audiotel Premium Pro, OFFLINE ONLY.
 *
 * Existing build-vs-buy inputs retain their existing charges; this module
 * adds only separately identified charges NOT represented there. It never
 * authenticates quotes, chooses a provider, orders a number or charges anyone.
 *
 * No names, contact information, bank accounts, private carrier contract text,
 * credentials or operator endpoints belong in these records.
 */
import {compareAudiotelBuildVsBuy} from "./build-vs-buy.mjs";

const REF=/^[A-Za-z0-9_.:/-]{3,100}$/;
const CATEGORIES=new Set([
 "account_opening","carrier_interconnect_setup","sip_trunk_setup",
 "batch_provisioning","manual_activation_admin","kyb_vendor",
 "reservation_admin","onboarding_support","exit_admin",
 "other_unclassified"
]);
const BASES=new Set([
 "per_project","per_number","per_new_number","per_ported_number",
 "per_batch","per_month","per_number_month","per_minute"
]);
const FEE_FIELDS=["reference","category","basis","amount_minor",
 "amount_micros_per_minute","batch_size"];
const SCHEDULE_FIELDS=["alternative_reference","completeness","fees"];
const INPUT_FIELDS=["business_unit","mode","base_input","fee_schedules"];
const MAX=1000000000;
function fail(key){throw Object.assign(new Error("APP_ACTIVATION_AUDIT_"+key),{
 code:"APP_ACTIVATION_AUDIT_"+key,status:422});}
function exact(value,fields,key){
 if(!value||typeof value!=="object"||Array.isArray(value)||
  Object.keys(value).some(x=>!fields.includes(x))||
  fields.some(x=>!Object.hasOwn(value,x)))fail("INVALID_"+key);
 return value;
}
function safeInt(n,key,max=MAX){
 if(!Number.isSafeInteger(n)||n<0||n>max)fail("INVALID_"+key);
 return n;
}
function safeNumber(n,key){
 if(n>BigInt(Number.MAX_SAFE_INTEGER)||n<BigInt(Number.MIN_SAFE_INTEGER))
  fail("OVERFLOW_"+key);
 return Number(n);
}
function ref(v,key){if(typeof v!=="string"||!REF.test(v))fail("INVALID_"+key);}
function ceilDiv(n,d){return (n+d-1n)/d;}
function sum(rows,field){
 return rows.reduce((acc,row)=>acc+BigInt(row[field]),0n);
}
function calculateFee(fee,s,baseRow){
 exact(fee,FEE_FIELDS,"FEE");
 ref(fee.reference,"FEE_REF");
 if(!CATEGORIES.has(fee.category))fail("FEE_CATEGORY");
 if(!BASES.has(fee.basis))fail("FEE_BASIS");
 const perMin=fee.basis==="per_minute";
 if(perMin){
  if(fee.amount_minor!==null||fee.batch_size!==null)
   fail("PER_MINUTE_SHAPE");
  safeInt(fee.amount_micros_per_minute,"MICRO_RATE",100000000);
 }else{
  if(fee.amount_micros_per_minute!==null)fail("MINOR_SHAPE");
  safeInt(fee.amount_minor,"FEE_AMOUNT");
  if(fee.basis==="per_batch")safeInt(fee.batch_size,"BATCH_SIZE",1000000);
  else if(fee.batch_size!==null)fail("NON_BATCH_SIZE");
 }
 if(fee.basis==="per_batch"&&fee.batch_size===0)fail("ZERO_BATCH_SIZE");
 const n=BigInt(s.professional_count),p=BigInt(s.ported_count),m=BigInt(baseRow.horizon_months);
 let units;
 switch(fee.basis){
  case "per_project":units=1n;break;
  case "per_number":units=n;break;
  case "per_new_number":units=n-p;break;
  case "per_ported_number":units=p;break;
  case "per_batch":units=ceilDiv(n,BigInt(fee.batch_size));break;
  case "per_month":units=m;break;
  case "per_number_month":units=n*m;break;
  case "per_minute":units=BigInt(baseRow.total_minutes_assumed);break;
  default:fail("UNKNOWN_BASIS");
 }
 const amount=perMin?
  ceilDiv(units*BigInt(fee.amount_micros_per_minute),10000n):
  units*BigInt(fee.amount_minor);
 const phase=fee.basis==="per_month"||fee.basis==="per_number_month"?
  "recurring":perMin?"usage":"upfront";
 return Object.freeze({
  fee_reference:fee.reference,category:fee.category,basis:fee.basis,phase,
  units:safeNumber(units,"UNITS"),total_minor:safeNumber(amount,"FEE_TOTAL"),
  contract_line_unauthenticated:true,
  needs_manual_classification:fee.category==="other_unclassified",
  counted_only_as_incremental_to_base:true
 });
}
function overlay(baseRow,scenario,alternative,schedule){
 const fees=schedule.fees.map(f=>calculateFee(f,scenario,baseRow));
 const extraUp=sum(fees.filter(f=>f.phase==="upfront"),"total_minor");
 const extraRecurring=sum(fees.filter(f=>f.phase==="recurring"),"total_minor");
 const extraUsage=sum(fees.filter(f=>f.phase==="usage"),"total_minor");
 const added=extraUp+extraRecurring+extraUsage;
 const full=BigInt(baseRow.total_cost_minor)+added;
 const minutes=BigInt(baseRow.total_minutes_assumed);
 const surplus=baseRow.estimated_surplus_before_tax_minor===null?
  null:BigInt(baseRow.estimated_surplus_before_tax_minor)-added;
 const n=BigInt(scenario.professional_count);
 const fixedActivation=
  n*BigInt(alternative.operator.activation_minor_per_number)+
  BigInt(scenario.ported_count)*BigInt(alternative.operator.portability_minor_per_number);
 const extraPerLine=fees.filter(f=>f.basis==="per_number_month"&&f.total_minor>0);
 const extraOnboarding=fees.filter(f=>f.phase==="upfront"&&f.total_minor>0);
 const unclassified=fees.filter(f=>f.needs_manual_classification);
 return Object.freeze({
  scenario_reference:baseRow.scenario_reference,
  alternative_reference:baseRow.alternative_reference,
  horizon_months:baseRow.horizon_months,
  base_total_cost_minor:baseRow.total_cost_minor,
  incremental_upfront_minor:safeNumber(extraUp,"EXTRA_UPFRONT"),
  incremental_recurring_minor:safeNumber(extraRecurring,"EXTRA_RECURRING"),
  incremental_variable_minor:safeNumber(extraUsage,"EXTRA_VARIABLE"),
  incremental_total_minor:safeNumber(added,"ADDED"),
  total_cost_with_incremental_fees_minor:safeNumber(full,"TOTAL"),
  upfront_carrier_fee_exposure_minor:safeNumber(fixedActivation+extraUp,"ACTIVATION_EXPOSURE"),
  carrier_setup_equivalent_per_number_minor:n===0n?null:
   safeNumber(ceilDiv(fixedActivation+extraUp,n),"EQUIVALENT"),
  effective_zero_onboarding_fees_assumed:fixedActivation+extraUp===0n,
  per_line_monthly_surcharge_detected:extraPerLine.length>0,
  unclassified_fees_detected:unclassified.length>0,
  violates_strict_zero_fee_goal:fixedActivation+extraUp>0n||extraPerLine.length>0,
  conditions_met_even_in_hypothesis:
   baseRow.all_stated_commercial_gates_met&&extraOnboarding.length===0&&
   extraPerLine.length===0&&unclassified.length===0,
  cost_per_minute_micros:minutes===0n?null:
   safeNumber(full*10000n/minutes,"COST_PER_MIN"),
  estimated_own_revenue_minor:baseRow.estimated_own_revenue_minor,
  estimated_surplus_before_tax_minor:surplus===null?null:
   safeNumber(surplus,"SURPLUS"),
  estimated_surplus_per_minute_before_tax_micros:
   surplus===null||minutes===0n?null:
   safeNumber(surplus*10000n/minutes,"MARGIN_PER_MIN"),
  personal_net_after_tax_per_minute_micros:null,
  quote_verified:false,pricing_complete_verified:false,
  contract_eligibility_verified:false,
  base_overlapping_fees_independently_reconciled:false,
  fee_schedule_completeness:schedule.completeness,
  classification_review_required:unclassified.length>0,
  no_contract_or_number_operation_authorized:true,
  fee_breakdown:Object.freeze(fees)
 });
}

/**
 * Requires one additional-fee schedule for every alternative. Empty list is
 * allowed but does NOT certify an absence of hidden fees in any real offer.
 * Only use incremental, non-duplicated lines; cross-check against the base
 * model and the signed offer before any commercial reliance.
 */
export function auditAudiotelActivationOverlays(input={}){
 exact(input,INPUT_FIELDS,"INPUT");
 if(input.business_unit!=="audiotel_platform"||input.mode!=="offline_simulation")
  fail("OFFLINE_ONLY");
 const base=compareAudiotelBuildVsBuy(input.base_input);
 if(!Array.isArray(input.fee_schedules)||
    input.fee_schedules.length!==input.base_input.alternatives.length)
  fail("INCOMPLETE_SCHEDULES");
 const schedules=new Map();
 for(const schedule of input.fee_schedules){
  exact(schedule,SCHEDULE_FIELDS,"SCHEDULE");
  ref(schedule.alternative_reference,"ALTERNATIVE_REF");
  if(schedules.has(schedule.alternative_reference))fail("DUPLICATE_SCHEDULE");
  if(!["hypothetical","self_declared_complete"].includes(schedule.completeness))
   fail("SCHEDULE_COMPLETENESS");
  if(!Array.isArray(schedule.fees)||schedule.fees.length>100)
   fail("SCHEDULE_FEES");
  const refs=new Set();
  for(const f of schedule.fees){
   exact(f,FEE_FIELDS,"FEE");
   ref(f.reference,"FEE_REF");
   if(refs.has(f.reference))fail("DUPLICATE_FEE");
   refs.add(f.reference);
  }
  schedules.set(schedule.alternative_reference,schedule);
 }
 const alternatives=new Map(input.base_input.alternatives.map(a=>[a.reference,a]));
 if([...schedules.keys()].some(id=>!alternatives.has(id)))fail("UNKNOWN_ALTERNATIVE");
 const scenarios=new Map(input.base_input.scenarios.map(s=>[s.reference,s]));
 const rows=base.rows.map(r=>overlay(r,scenarios.get(r.scenario_reference),
  alternatives.get(r.alternative_reference),
  schedules.get(r.alternative_reference)));
 const comparisons=[];
 for(const s of input.base_input.scenarios)
  for(const months of input.base_input.horizons_months){
   const choices=rows.filter(x=>x.scenario_reference===s.reference&&
    x.horizon_months===months);
   const cheapest=[...choices].sort((a,b)=>
    a.total_cost_with_incremental_fees_minor-b.total_cost_with_incremental_fees_minor);
   const margins=choices.filter(x=>x.estimated_surplus_before_tax_minor!==null)
    .sort((a,b)=>b.estimated_surplus_before_tax_minor-a.estimated_surplus_before_tax_minor);
   const compliant=margins.filter(x=>x.conditions_met_even_in_hypothesis);
   comparisons.push(Object.freeze({
    scenario_reference:s.reference,horizon_months:months,
    cheapest_hypothetical_option:cheapest[0]?.alternative_reference??null,
    best_hypothetical_pretax_option:margins[0]?.alternative_reference??null,
    best_hypothetical_compliant_pretax_option:
      compliant[0]?.alternative_reference??null,
    after_tax_personal_best_option:null,
    verified_real_price_winner:null,
    supplier_or_internal_deployment_authorized:false
   }));
  }
 return Object.freeze({
  business_unit:"audiotel_platform",mode:"offline_simulation",
  total_case_rows:rows.length,
  rows:Object.freeze(rows),comparisons:Object.freeze(comparisons),
  user_supplied_schedule_only:true,source_quotes_authenticated:false,
  personal_after_tax_margin_verified:false,
  can_assert_real_zero_activation_cost:false,
  cannot_infer_carrier_fee_waiver_from_automation:true,
  requires_contractual_confirmation:true,
  requires_independent_double_count_review:true,
  software_or_live_number_activation_authorized:false,
  purchase_or_provision_authorized:false,
  recommendation:"NO_REAL_DECISION_UNTIL_SIGNED_WHOLESALE_TERMS_AND_TAX_REVIEW"
 });
}
