/**
 * Build-vs-buy planner, OFFLINE ONLY. Monetary inputs use integer euro cents
 * ("minor") and micro-euros ("micros") to prevent floating-point billing errors.
 * All carrier prices and commissions are user hypotheses, NOT authenticated quotes.
 * No network I/O, API credentials, calls, billing, numering or payment operations.
 */
const MODELS=new Set(["external_managed","hybrid_automated","self_managed_sip"]);
const REF=/^[a-zA-Z0-9_.:/-]{3,100}$/;
const TERMS=[
 "activation_minor_per_number","portability_minor_per_number",
 "deactivation_minor_per_number","reactivation_minor_per_number",
 "monthly_minor_per_number","monthly_minimum_minor_per_professional",
 "commitment_months","fixed_monthly_minor",
 "payout_minor_per_professional","minute_micros","psp_minute_micros",
 "global_minimum_monthly_minor","direct_payout_supported"
];
const OWN=[
 "development_minor","telecom_setup_minor","security_legal_setup_minor",
 "hosting_monthly_minor","redundancy_monthly_minor",
 "maintenance_monthly_minor","support_monthly_minor",
 "security_compliance_monthly_minor","ops_monthly_minor",
 "media_minute_micros","network_minute_micros","fraud_minute_micros"
];
const SCENARIO=[
 "reference","professional_count","minutes_per_professional_per_day",
 "days_per_month","ported_count","deactivation_count",
 "reactivation_count","payout_count_per_month","arcep_blocks_held"
];
function fail(key){throw Object.assign(new Error("APP_BUILD_BUY_"+key),{code:"APP_BUILD_BUY_"+key,status:422});}
function object(x,keys,key){
 if(!x||typeof x!=="object"||Array.isArray(x)||
    Object.keys(x).some(k=>!keys.includes(k))||
    keys.some(k=>!Object.hasOwn(x,k)))fail("INVALID_"+key);
}
function integer(n,name,max=1000000000){
 if(!Number.isSafeInteger(n)||n<0||n>max)fail("INVALID_"+name);
 return n;
}
function safe(n,key){
 if(n>BigInt(Number.MAX_SAFE_INTEGER)||n<BigInt(Number.MIN_SAFE_INTEGER))
  fail("OVERFLOW_"+key);
 return Number(n);
}
function microsCostToMinor(micros){
 const x=BigInt(micros);
 return (x+9999n)/10000n;
}
function microsRevenueToMinor(micros){return BigInt(micros)/10000n;}
function add(obj,keys){return keys.reduce((total,key)=>total+BigInt(obj[key]),0n);}
function checkRef(v,key){if(typeof v!=="string"||!REF.test(v))fail("INVALID_"+key);}
function checkAlternative(a){
 object(a,["reference","model","direct_arcep","quote_reference","commission_micros_per_min","operator","internal"],"ALTERNATIVE");
 checkRef(a.reference,"ALTERNATIVE_REF");
 if(!MODELS.has(a.model)||typeof a.direct_arcep!=="boolean")fail("MODEL");
 if(a.quote_reference!==null)checkRef(a.quote_reference,"QUOTE_REF");
 if(a.commission_micros_per_min!==null)
  integer(a.commission_micros_per_min,"COMMISSION",100000000);
 object(a.operator,TERMS,"OPERATOR_TERMS");
 object(a.internal,OWN,"INTERNAL_COSTS");
 for(const k of TERMS){
  if(k==="direct_payout_supported"){
   if(![true,false,null].includes(a.operator[k]))fail("DIRECT_PAYOUT");
  }else integer(a.operator[k],"OPERATOR_"+k,k.includes("micros")?100000000:1000000000);
 }
 for(const k of OWN)integer(a.internal[k],"OWN_"+k,k.includes("micros")?100000000:1000000000);
}
function checkScenario(s){
 object(s,SCENARIO,"SCENARIO");
 checkRef(s.reference,"SCENARIO_REF");
 integer(s.professional_count,"PROFESSIONALS",1000000);
 integer(s.minutes_per_professional_per_day,"MINUTES_DAY",1440);
 integer(s.days_per_month,"DAYS_MONTH",31);
 integer(s.ported_count,"PORTED",s.professional_count);
 integer(s.deactivation_count,"DEACTIVATIONS",s.professional_count);
 integer(s.reactivation_count,"REACTIVATIONS",s.professional_count);
 integer(s.payout_count_per_month,"PAYOUTS",1000000);
 integer(s.arcep_blocks_held,"ARCEP_BLOCKS",10000);
 if(s.days_per_month===0)fail("ZERO_DAYS");
}
function cost(a,s,months,annualArcep){
 const o=a.operator,i=a.internal,n=BigInt(s.professional_count),m=BigInt(months);
 const monthlyMinutes=n*BigInt(s.minutes_per_professional_per_day)*BigInt(s.days_per_month);
 const fullMinutes=monthlyMinutes*m;
 const setup=add(i,["development_minor","telecom_setup_minor","security_legal_setup_minor"])+
  n*BigInt(o.activation_minor_per_number)+
  BigInt(s.ported_count)*BigInt(o.portability_minor_per_number)+
  BigInt(s.deactivation_count)*BigInt(o.deactivation_minor_per_number)+
  BigInt(s.reactivation_count)*BigInt(o.reactivation_minor_per_number);
 // A wholesale minimum is normally a SPEND FLOOR, not an extra flat charge.
 // Only carrier fixed fees + carrier-minute spend are eligible here: PSP,
 // internal platform costs and payouts are excluded. Confirm eligible lines
 // against the signed carrier contract before replacing the simulation.
 const monthlyCarrierFixed=BigInt(o.fixed_monthly_minor)+n*BigInt(o.monthly_minor_per_number);
 const monthlyCarrierUsage=microsCostToMinor(monthlyMinutes*BigInt(o.minute_micros));
 const operatorMinimum=BigInt(o.global_minimum_monthly_minor);
 const minimumTopup=operatorMinimum>monthlyCarrierFixed+monthlyCarrierUsage?
  operatorMinimum-(monthlyCarrierFixed+monthlyCarrierUsage):0n;
 const monthlyFixed=add(i,["hosting_monthly_minor","redundancy_monthly_minor",
  "maintenance_monthly_minor","support_monthly_minor",
  "security_compliance_monthly_minor","ops_monthly_minor"])+
  monthlyCarrierFixed+minimumTopup+
  n*BigInt(o.monthly_minimum_minor_per_professional)+
  BigInt(s.payout_count_per_month)*BigInt(o.payout_minor_per_professional);
 const minuteCosts=add(o,["minute_micros","psp_minute_micros"])+
  add(i,["media_minute_micros","network_minute_micros","fraud_minute_micros"]);
 const variable=microsCostToMinor(minuteCosts*fullMinutes);
 const arcep=a.direct_arcep?
  BigInt(s.arcep_blocks_held)*BigInt(annualArcep)*BigInt(Math.ceil(months/12)):0n;
 const total=setup+monthlyFixed*m+variable+arcep;
 const revenue=a.commission_micros_per_min===null?
  null:microsRevenueToMinor(BigInt(a.commission_micros_per_min)*fullMinutes);
 const surplus=revenue===null?null:revenue-total;
 const hardGates={
  zero_activation:o.activation_minor_per_number===0,
  zero_portability:o.portability_minor_per_number===0,
  zero_deactivation:o.deactivation_minor_per_number===0,
  zero_reactivation:o.reactivation_minor_per_number===0,
  zero_per_number_monthly:o.monthly_minor_per_number===0,
  zero_professional_minimum:o.monthly_minimum_minor_per_professional===0,
  no_professional_commitment:o.commitment_months===0,
  direct_payout_proposed:o.direct_payout_supported===true
 };
 return Object.freeze({
  alternative_reference:a.reference,model:a.model,scenario_reference:s.reference,
  horizon_months:months,
  monthly_minutes_assumed:safe(monthlyMinutes,"MINUTES"),total_minutes_assumed:safe(fullMinutes,"TOTAL_MINUTES"),
  upfront_total_minor:safe(setup,"UPFRONT"),
  monthly_fixed_minor:safe(monthlyFixed,"MONTHLY_FIXED"),
  operator_global_minimum_floor_minor:o.global_minimum_monthly_minor,
  operator_global_minimum_topup_monthly_minor:safe(minimumTopup,"MINIMUM_TOPUP"),
  total_variable_minor:safe(variable,"VARIABLE"),
  arcep_reference_tax_minor:safe(arcep,"ARCEP"),
  total_cost_minor:safe(total,"COST"),
  cost_per_minute_micros:fullMinutes===0n?null:safe(total*10000n/fullMinutes,"COST_PER_MINUTE"),
  commission_hypothesis_micros_per_min:a.commission_micros_per_min,
  estimated_own_revenue_minor:revenue===null?null:safe(revenue,"REVENUE"),
  estimated_surplus_before_tax_minor:surplus===null?null:safe(surplus,"SURPLUS"),
  estimated_surplus_per_minute_before_tax_micros:surplus===null||fullMinutes===0n?
   null:safe(surplus*10000n/fullMinutes,"SURPLUS_PER_MINUTE"),
  actual_personal_net_per_minute_micros:null,
  social_fiscal_regime_validated:false,
  hard_gates:Object.freeze(hardGates),
  all_stated_commercial_gates_met:Object.values(hardGates).every(Boolean),
  pricing_source:"hypothetical_user_inputs_only",
  quote_independently_authenticated:false,
  activation_fees_may_remain_contractually_payable:true,
  approval_to_purchase_or_operate:false
 });
}
export function compareAudiotelBuildVsBuy(input={}){
 object(input,["business_unit","mode","annual_arcep_fee_per_block_minor",
  "scenarios","alternatives","horizons_months"],"INPUT");
 if(input.business_unit!=="audiotel_platform"||input.mode!=="offline_simulation")
  fail("OFFLINE_ONLY");
 integer(input.annual_arcep_fee_per_block_minor,"ANNUAL_ARCEP",1000000);
 if(!Array.isArray(input.scenarios)||!input.scenarios.length||input.scenarios.length>100)
  fail("SCENARIOS");
 if(!Array.isArray(input.alternatives)||!input.alternatives.length||input.alternatives.length>10)
  fail("ALTERNATIVES");
 if(!Array.isArray(input.horizons_months)||!input.horizons_months.length||
   input.horizons_months.length>10)fail("HORIZONS");
 const ids=new Set();
 for(const a of input.alternatives){
  checkAlternative(a);
  if(ids.has(a.reference))fail("DUPLICATE_ALTERNATIVE");
  ids.add(a.reference);
 }
 ids.clear();
 for(const s of input.scenarios){
  checkScenario(s);
  if(ids.has(s.reference))fail("DUPLICATE_SCENARIO");
  ids.add(s.reference);
 }
 for(const h of input.horizons_months){
  integer(h,"HORIZON",120);
  if(h===0||h%12!==0)fail("INVALID_HORIZON");
 }
 const rows=[];
 for(const s of input.scenarios)
  for(const h of input.horizons_months)
   for(const a of input.alternatives)
    rows.push(cost(a,s,h,input.annual_arcep_fee_per_block_minor));
 const cases=[];
 for(const s of input.scenarios)
  for(const h of input.horizons_months){
   const candidates=rows.filter(r=>r.scenario_reference===s.reference&&r.horizon_months===h);
   const ranked=[...candidates].sort((a,b)=>a.total_cost_minor-b.total_cost_minor||
    a.alternative_reference.localeCompare(b.alternative_reference));
   cases.push(Object.freeze({
    scenario_reference:s.reference,horizon_months:h,
    cheapest_assumed_cost_reference:ranked[0].alternative_reference,
    cheapest_assumed_cost_minor:ranked[0].total_cost_minor,
    worst_assumed_cost_minor:ranked.at(-1).total_cost_minor,
    decision:"NO_VERIFIED_CARRIER_OFFERS_OR_TAX_DATA",
    // Lower cost does not imply larger profit when contractual commissions differ.
    operator_choice_or_internal_activation_authorized:false
   }));
  }
 return Object.freeze({
  business_unit:"audiotel_platform",mode:"offline_simulation",
  scenarios_count:input.scenarios.length,alternatives_count:input.alternatives.length,
  rows:Object.freeze(rows),cases:Object.freeze(cases),
  carrier_quotes_authenticated:false,regulatory_approval_confirmed:false,
  after_tax_personal_margin_proven:false,
  production_changes_authorized:false,neon_migration_authorized:false,
  arcep_attribution_authorized:false,live_sip_calls_authorized:false,
  payouts_authorized:false,contract_or_spend_authorized:false,
  recommendation:"WAIT_FOR_AUTHENTICATED_QUOTES_AND_WRITTEN_ACTIVATION_TERMS"
 });
}
