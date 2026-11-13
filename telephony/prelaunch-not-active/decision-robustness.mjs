/**
 * Offline sensitivity analysis for unverified carrier prices and operating costs.
 * Every scenario is an illustration: no contract, real-world tariff, tax estimate,
 * future purchase, SIP call or bank transfer can be inferred or triggered here.
 */
import {compareAudiotelBuildVsBuy} from "./build-vs-buy.mjs";
const RISK_KEYS=["reference","traffic_pct","commission_pct","variable_cost_pct",
 "fixed_cost_pct","one_off_overrun_minor"];
const REF=/^[A-Za-z0-9_.:/-]{3,100}$/;
function reject(k){throw Object.assign(new Error("APP_RISK_"+k),{code:"APP_RISK_"+k,status:422});}
function whole(v,k,max=100000000){
 if(!Number.isSafeInteger(v)||v<0||v>max)reject("INVALID_"+k);
 return v;
}
function scaled(v,percent,key){
 if(v===null)return null;
 const n=BigInt(v)*BigInt(percent)/100n;
 if(n>BigInt(Number.MAX_SAFE_INTEGER))reject("OVERFLOW_"+key);
 return Number(n);
}
function applyRisk(alternative,risk){
 const a=alternative, carrier={...a.operator},internal={...a.internal};
 const recurringCarrier=["fixed_monthly_minor","monthly_minor_per_number",
  "monthly_minimum_minor_per_professional","payout_minor_per_professional",
  "global_minimum_monthly_minor"];
 const recurringInternal=["hosting_monthly_minor","redundancy_monthly_minor",
  "maintenance_monthly_minor","support_monthly_minor",
  "security_compliance_monthly_minor","ops_monthly_minor"];
 for(const k of recurringCarrier)carrier[k]=scaled(carrier[k],risk.fixed_cost_pct,k);
 for(const k of recurringInternal)internal[k]=scaled(internal[k],risk.fixed_cost_pct,k);
 for(const k of ["minute_micros","psp_minute_micros"])
  carrier[k]=scaled(carrier[k],risk.variable_cost_pct,k);
 for(const k of ["media_minute_micros","network_minute_micros","fraud_minute_micros"])
  internal[k]=scaled(internal[k],risk.variable_cost_pct,k);
 // Overruns are front-loaded once, not repeated per month. This intentionally
 // avoids claiming a separate operator bill has already been received.
 internal.telecom_setup_minor+=risk.one_off_overrun_minor;
 return {
  ...a,commission_micros_per_min:scaled(a.commission_micros_per_min,
   risk.commission_pct,"COMMISSION"),
  operator:carrier,internal
 };
}
export function assessAudiotelFallbackRobustness(input={}){
 if(!input||typeof input!=="object"||Array.isArray(input)||
  Object.keys(input).some(k=>!["base_input","risk_cases"].includes(k))||
  !Object.hasOwn(input,"base_input")||!Object.hasOwn(input,"risk_cases"))
  reject("INPUT");
 if(!Array.isArray(input.risk_cases)||input.risk_cases.length<1||
  input.risk_cases.length>6)reject("CASES");
 const seen=new Set();
 for(const r of input.risk_cases){
  if(!r||typeof r!=="object"||Array.isArray(r)||
   Object.keys(r).some(k=>!RISK_KEYS.includes(k))||
   RISK_KEYS.some(k=>!Object.hasOwn(r,k)))reject("RISK_CASE");
  if(typeof r.reference!=="string"||!REF.test(r.reference)||seen.has(r.reference))
   reject("RISK_REFERENCE");
  seen.add(r.reference);
  whole(r.traffic_pct,"TRAFFIC_PCT",100);
  whole(r.commission_pct,"COMMISSION_PCT",100);
  whole(r.variable_cost_pct,"VARIABLE_PCT",300);
  whole(r.fixed_cost_pct,"FIXED_PCT",300);
  whole(r.one_off_overrun_minor,"OVERRUN",100000000);
  if(r.variable_cost_pct<100||r.fixed_cost_pct<100)
   reject("NON_CONSERVATIVE_COST_SHOCK");
 }
 // This validates the base model first and enforces its offline-only safeguards.
 const baseline=compareAudiotelBuildVsBuy(input.base_input);
 const variants=input.risk_cases.map(r=>{
  const scenarios=input.base_input.scenarios.map(s=>({
   ...s,minutes_per_professional_per_day:scaled(s.minutes_per_professional_per_day,
    r.traffic_pct,"TRAFFIC")
  }));
  const alternatives=input.base_input.alternatives.map(a=>applyRisk(a,r));
  const model=compareAudiotelBuildVsBuy({...input.base_input,scenarios,alternatives});
  const cases=model.cases.map(c=>{
   const rows=model.rows.filter(row=>row.scenario_reference===c.scenario_reference&&
    row.horizon_months===c.horizon_months);
   const financiallyKnown=rows.filter(row=>
    row.estimated_surplus_before_tax_minor!==null);
   financiallyKnown.sort((a,b)=>b.estimated_surplus_before_tax_minor-
     a.estimated_surplus_before_tax_minor||
     a.alternative_reference.localeCompare(b.alternative_reference));
   const commerciallyCompliant=financiallyKnown.filter(row=>
    row.all_stated_commercial_gates_met);
   return Object.freeze({
    scenario_reference:c.scenario_reference,
    horizon_months:c.horizon_months,
    cheapest_hypothetical_cost_reference:c.cheapest_assumed_cost_reference,
    highest_hypothetical_pretax_surplus_reference:
     financiallyKnown[0]?.alternative_reference??null,
    highest_hypothetical_compliant_pretax_surplus_reference:
     commerciallyCompliant[0]?.alternative_reference??null,
    all_commissions_present:financiallyKnown.length===rows.length,
    actual_after_tax_personal_winner_known:false,
    choice_authorized:false
   });
  });
  return Object.freeze({risk_reference:r.reference,assumptions:Object.freeze({...r}),
   rows:model.rows,cases:Object.freeze(cases)});
 });
 return Object.freeze({
  mode:"offline_sensitivity_only",business_unit:"audiotel_platform",
  source_quotes_verified:false,base_rows:baseline.rows,variants:Object.freeze(variants),
  scenarios_count:baseline.scenarios_count,alternatives_count:baseline.alternatives_count,
  no_real_personal_after_tax_margin:true,
  no_automated_business_decision:true,network_not_activated:true,
  no_orders_or_financial_transfers:true,
  recommendation:"KEEP_BACKUP_INACTIVE_PENDING_SIGNED_QUOTES_AND_APPROVED_ECONOMICS"
 });
}
