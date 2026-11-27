// Read-only telecom cost comparison. No operator price or authorization is assumed.
const bounded=(value,max,name,integer=false)=>{
 if(value===null||value===undefined||value==="")throw new RangeError(name+" : valeur manquante");
 // Fail closed: Number([]), Number("  ") and Number([0]) silently become zero.
 if(typeof value!=="number"&&typeof value!=="string")throw new RangeError(name+" : valeur invalide");
 if(typeof value==="string"&&!/^(?:0|[1-9]\\d*)(?:\\.\\d+)?$/.test(value))
  throw new RangeError(name+" : valeur invalide");
 const n=Number(value);
 if(!Number.isFinite(n)||n<0||n>max||(integer&&!Number.isSafeInteger(n)))throw new RangeError(name+" : valeur invalide");
 return n;
};
const cents=n=>Math.round((n+Number.EPSILON)*100)/100;
export function evaluateAutonomyCosts({minutes,retainedRevenuePerMinute,options}){
 const volume=bounded(minutes,10000000,"minutes",true);
 const revenue=bounded(retainedRevenuePerMinute,1000,"revenu/minute");
 if(!Array.isArray(options)||options.length!==2)throw new RangeError("Deux modèles requis");
 const calculated=options.map((item,i)=>{
  const variable=bounded(item?.variableCostPerMinute,1000,"coût variable "+i);
  const fixed=bounded(item?.fixedCostMonthly,100000000,"coût fixe "+i);
  const cost=volume*variable+fixed;
  return Object.freeze({
   code:i===0?"integrated":"independent",variableCostPerMinute:variable,
   fixedCostMonthly:fixed,monthlyCost:cents(cost),
   monthlyContribution:cents(volume*revenue-cost),
   effectiveCostPerMinute:volume>0?cost/volume:null
  });
 });
 const difference=cents(calculated[1].monthlyContribution-calculated[0].monthlyContribution);
 const savedVariable=calculated[0].variableCostPerMinute-calculated[1].variableCostPerMinute;
 const extraFixed=calculated[1].fixedCostMonthly-calculated[0].fixedCostMonthly;
 return Object.freeze({
  minutes:volume,monthlyRetainedRevenue:cents(volume*revenue),
  options:Object.freeze(calculated),monthlyDifference:difference,
  winner:difference>0?"independent":difference<0?"integrated":"equal",
  breakEvenMinutes:savedVariable>0&&extraFixed>0?Math.ceil(extraFixed/savedVariable):null,
  resultKind:"indicative_pre_tax_cost_comparison_only",
  financialDecisionAuthorized:false,operatorActivationAuthorized:false,payoutAuthorized:false
 });
}


// Optional 3-way interconnection cost comparison for a future admin preview.
// This does NOT presume rights to direct interconnection or access to callers.
// All inputs must come from real quotes, documented costs or explicit hypotheses.
const MODEL_CODES=Object.freeze(["integrated","owned_sip_wholesale_collection","direct_interconnection"]);
export function evaluateInterconnectionOwnershipCosts({minutesPerMonth,scenarios}={}){
 const minutes=bounded(minutesPerMonth,10000000,"minutes mensuelles",true);
 if(!Array.isArray(scenarios)||scenarios.length!==3||
    scenarios.some((s,i)=>s?.code!==MODEL_CODES[i]))
  throw new RangeError("Trois modèles ordonnés et distincts requis");
 const results=scenarios.map((s,i)=>{
  const fixed=bounded(s.fixedMonthlyEur,50000000,"frais mensuels "+i);
  const variable=bounded(s.variableEurPerMinute,1000,"prix variable "+i);
  const operations=bounded(s.operationsMonthlyEur,50000000,"exploitation "+i);
  const initial=bounded(s.initialInvestmentEur,100000000,"investissement "+i);
  const months=bounded(s.amortizationMonths,240,"durée d'amortissement "+i,true);
  if(months<1)throw new RangeError("Durée d'amortissement invalide");
  const fixedAll=fixed+operations+initial/months;
  const cost=fixedAll+minutes*variable;
  return Object.freeze({code:s.code,monthlyCostEur:cents(cost),
    fixedEffectiveMonthlyEur:cents(fixedAll),variableEurPerMinute:variable,
    effectiveEurPerMinute:minutes>0?cost/minutes:null});
 });
 const best=results.reduce((a,b)=>a.monthlyCostEur<=b.monthlyCostEur?a:b);
 const direct=results[2],wholesale=results[1];
 const perMinuteSaving=wholesale.variableEurPerMinute-direct.variableEurPerMinute;
 const additionalFixed=direct.fixedEffectiveMonthlyEur-wholesale.fixedEffectiveMonthlyEur;
 const breakEvenMinutes=perMinuteSaving>0&&additionalFixed>0?
   Math.ceil(additionalFixed/perMinuteSaving):null;
 return Object.freeze({
  minutes_per_month:minutes,
  scenarios:Object.freeze(results),
  lowest_cost_code_from_entered_figures:best.code,
  direct_vs_wholesale_cost_difference_eur:cents(direct.monthlyCostEur-wholesale.monthlyCostEur),
  direct_vs_wholesale_break_even_minutes:breakEvenMinutes,
  quote_authenticity_verified:false,
  direct_operator_agreements_verified:false,
  access_to_all_089_origin_networks_verified:false,
  settlement_and_payment_legality_verified:false,
  numbering_and_routing_rights_verified:false,
  commercial_or_technical_activation_authorized:false,
  production_system_modified:false,
  interpretation:"Pure cost estimate before tax and compliance validation; never a proof of feasibility."
 });
}
