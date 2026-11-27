// Read-only telecom cost comparison. No operator price or authorization is assumed.
const bounded=(value,max,name,integer=false)=>{
 if(value===""||value===null||value===undefined||typeof value==="boolean")throw new RangeError(name+" : valeur manquante");
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
