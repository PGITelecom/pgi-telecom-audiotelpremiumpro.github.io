/**
 * Audiotel: deterministic, OFFLINE unit-economics + SIP concurrency estimation.
 * All money inputs are hypothetical micro-euros/minute (1 EUR = 1,000,000).
 * No tax determination, billing, operator quote, number assignment or payout.
 */
const isObject=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const MICRO_PER_CENT=10000n;
const MAX_MINUTES=1000000000;
const MAX_MICROS=100000000; // 100 EUR / minute, bounds all operations
function error(code){throw Object.assign(new Error("APP_ECON_"+code),{code:"APP_ECON_"+code,status:422});}
function exact(value,fields,name){
 if(!isObject(value)||Object.keys(value).some(k=>!fields.includes(k)))error("INVALID_"+name);
}
function integer(n,name,min,max){
 if(!Number.isSafeInteger(n)||n<min||n>max)error("INVALID_"+name);
 return n;
}
function minorFromMicros(value){
 const x=BigInt(value);
 // Preserve the sign for small losses, truncating fractions of one cent.
 return Number(x/MICRO_PER_CENT);
}
function monthlyFixed(input){
 const regulatory=BigInt(input.number_block_count)*BigInt(input.annual_arcep_fee_minor_per_block);
 return {
  regulatedMonthlyReserveMinor:Number((regulatory+11n)/12n),
  fixedBaseMinor:input.fixed_operating_cost_minor,
 };
}

export function evaluateAudiotelUnitEconomics(input={}){
 exact(input,["business_unit","mode","model","monthly_minutes",
  "audiotel_fee_micros_per_min","operator_gross_micros_per_min",
  "professional_due_micros_per_min","carrier_cost_micros_per_min",
  "media_cost_micros_per_min","payment_cost_micros_per_min",
  "fraud_loss_provision_micros_per_min","fixed_operating_cost_minor",
  "number_block_count","annual_arcep_fee_minor_per_block","target_margin_micros_per_min"],"INPUT");
 if(input.business_unit!=="audiotel_platform"||input.mode!=="offline_simulation")
  error("OFFLINE_ONLY");
 const models=["separate_audiotel_commission","platform_gross_hypothesis"];
 if(!models.includes(input.model))error("MODEL");
 const minutes=integer(input.monthly_minutes,"MONTHLY_MINUTES",0,MAX_MINUTES);
 const costs={};
 for(const k of ["carrier_cost_micros_per_min","media_cost_micros_per_min",
  "payment_cost_micros_per_min","fraud_loss_provision_micros_per_min"]){
  costs[k]=integer(input[k],"COST_"+k,0,MAX_MICROS);
 }
 const target=integer(input.target_margin_micros_per_min??70000,"TARGET",0,MAX_MICROS);
 const costsTotal=Object.values(costs).reduce((sum,x)=>sum+x,0);
 let platformRevenue=0,professionalDue=0;
 if(input.model==="separate_audiotel_commission"){
  platformRevenue=integer(input.audiotel_fee_micros_per_min,"OWN_FEE",0,MAX_MICROS);
  if(input.operator_gross_micros_per_min!=null||
     input.professional_due_micros_per_min!=null)error("DOUBLE_COUNTED_PROFESSIONAL_FUNDS");
 }else{
  platformRevenue=integer(input.operator_gross_micros_per_min,"OPERATOR_GROSS",0,MAX_MICROS);
  professionalDue=integer(input.professional_due_micros_per_min,"PROFESSIONAL_DUE",0,MAX_MICROS);
  if(input.audiotel_fee_micros_per_min!=null)error("DOUBLE_COUNTED_COMMISSION");
 }
 const margin=platformRevenue-professionalDue-costsTotal;
 const fixed=integer(input.fixed_operating_cost_minor,"FIXED_COST",0,100000000000);
 const blocks=integer(input.number_block_count,"NUMBER_BLOCK_COUNT",0,100000);
 const annual=integer(input.annual_arcep_fee_minor_per_block??2000,
  "ANNUAL_ARCEP_REFERENCE",0,1000000);
 const {regulatedMonthlyReserveMinor}=monthlyFixed({
  fixed_operating_cost_minor:fixed,number_block_count:blocks,
  annual_arcep_fee_minor_per_block:annual
 });
 const totalFixed=fixed+regulatedMonthlyReserveMinor;
 const contribution=BigInt(margin)*BigInt(minutes);
 const beforeTax=minorFromMicros(contribution)-totalFixed;
 const breakeven=margin>0?
  Number((BigInt(totalFixed)*MICRO_PER_CENT+BigInt(margin)-1n)/BigInt(margin)):null;
 const output={
  business_unit:"audiotel_platform",mode:"offline_simulation",
  model:input.model,assumptions_only:true,
  monthly_minutes_assumed:minutes,
  gross_platform_receipts_micros_per_min:platformRevenue,
  professional_funds_micros_per_min:professionalDue,
  variable_cost_micros_per_min:costsTotal,
  audiotel_contribution_micros_per_min:margin,
  meets_seven_cent_reference:margin>=70000,
  meets_target_margin:margin>=target,
  target_margin_micros_per_min:target,
  monthly_contribution_minor:minorFromMicros(contribution),
  monthly_arcep_reference_reserve_minor:regulatedMonthlyReserveMinor,
  other_monthly_fixed_minor:fixed,
  estimated_result_before_taxes_minor:beforeTax,
  breakeven_minutes_per_month:breakeven,
  // Never present a deterministic cash result as actual taxable turnover.
  applicable_tax_regime_verified:false,
  own_taxable_turnover_minor:null,
  social_contributions_minor:null,corporate_tax_minor:null,
  real_profit_after_taxes_minor:null,
  operator_statement_authenticated:false,
  professional_payouts_approved:false,
  external_money_transfers_enabled:false
 };
 return Object.freeze(output);
}

/** Erlang-B forecast for offered call traffic, not a measured SIP SLA. */
export function estimateAudiotelSipCapacity(input={}){
 exact(input,["business_unit","mode","peak_call_attempts_per_hour",
  "average_call_holding_seconds","maximum_blocking_probability",
  "sip_legs_per_call","redundant_media_nodes"],"INPUT");
 if(input.business_unit!=="audiotel_platform"||input.mode!=="offline_simulation")
  error("OFFLINE_ONLY");
 const arrivals=integer(input.peak_call_attempts_per_hour,"ARRIVALS",0,100000);
 const holding=integer(input.average_call_holding_seconds,"HOLDING",1,14400);
 const blocking=input.maximum_blocking_probability??0.01;
 if(typeof blocking!=="number"||!Number.isFinite(blocking)||
    blocking<=0||blocking>0.2)error("BLOCKING_PROBABILITY");
 const legs=integer(input.sip_legs_per_call??2,"LEGS",1,4);
 const nodes=integer(input.redundant_media_nodes??2,"NODES",2,10);
 const offered=arrivals*holding/3600;
 if(offered>18000)error("EXCEEDS_PLANNING_RANGE");
 let b=1,channels=0;
 if(arrivals>0){
  for(let n=1;n<=20000;n++){
   b=offered*b/(n+offered*b);
   if(b<=blocking){channels=n;break;}
  }
  if(!channels)error("EXCEEDS_PLANNING_RANGE");
 }
 return Object.freeze({
  business_unit:"audiotel_platform",mode:"offline_simulation",
  offered_erlangs:Math.round(offered*1000)/1000,
  requested_blocking_probability:blocking,
  theoretical_concurrent_calls:channels,
  estimated_sip_legs_per_media_node:channels*legs,
  n_plus_one_required_media_node_count:nodes,
  // In N+1, each of the two nodes must independently carry full peak load.
  capacity_per_surviving_node_calls:channels,
  total_provisioned_sip_legs_for_full_n_plus_one:channels*legs*nodes,
  not_a_measured_capacity:true,carrier_cps_limit_not_verified:true,
  regulatory_tariff_message_impact_not_measured:true,
  rtp_bitrate_cost_not_measured:true,voice_quality_not_verified:true,
  live_voice_service_enabled:false
 });
}
