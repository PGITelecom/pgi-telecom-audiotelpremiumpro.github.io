import test from "node:test";
import assert from "node:assert/strict";
import {evaluateAutonomyCosts,evaluateInterconnectionOwnershipCosts,evaluatePerCallContribution} from "../assets/autonomy-cost-engine.mjs";
const base={minutes:10000,retainedRevenuePerMinute:.2,options:[
 {variableCostPerMinute:.07,fixedCostMonthly:0},
 {variableCostPerMinute:.02,fixedCostMonthly:300}
]};
test("compare integrated and independent models without authorizing operations",()=>{
 const r=evaluateAutonomyCosts(base);
 assert.equal(r.monthlyRetainedRevenue,2000);
 assert.equal(r.options[0].monthlyCost,700);
 assert.equal(r.options[1].monthlyCost,500);
 assert.equal(r.options[1].monthlyContribution,1500);
 assert.equal(r.monthlyDifference,200);
 assert.equal(r.winner,"independent");
 assert.equal(r.breakEvenMinutes,6000);
 assert.equal(r.financialDecisionAuthorized,false);
 assert.equal(r.operatorActivationAuthorized,false);
 assert.equal(r.payoutAuthorized,false);
});
test("zero minutes is supported without division by zero",()=>{
 const r=evaluateAutonomyCosts({...base,minutes:0});
 assert.equal(r.options[0].effectiveCostPerMinute,null);
 assert.equal(r.options[1].monthlyCost,300);
 assert.equal(r.winner,"integrated");
});
test("empty and unsafe values do not silently become zero",()=>{
 assert.throws(()=>evaluateAutonomyCosts({...base,minutes:""}),/manquante/);
 assert.throws(()=>evaluateAutonomyCosts({...base,minutes:1.5}),/invalide/);
 assert.throws(()=>evaluateAutonomyCosts({...base,minutes:-1}),/invalide/);
 assert.throws(()=>evaluateAutonomyCosts({...base,retainedRevenuePerMinute:Infinity}),/invalide/);
 assert.throws(()=>evaluateAutonomyCosts({...base,options:[]}),/Deux modèles/);
});
test("equal options do not produce fictitious savings",()=>{
 const r=evaluateAutonomyCosts({...base,options:[base.options[0],base.options[0]]});
 assert.equal(r.monthlyDifference,0);
 assert.equal(r.winner,"equal");
 assert.equal(r.breakEvenMinutes,null);
});


const interconnect={
 minutesPerMonth:10000,scenarios:[
  {code:"integrated",fixedMonthlyEur:0,variableEurPerMinute:.09,operationsMonthlyEur:0,initialInvestmentEur:0,amortizationMonths:12},
  {code:"owned_sip_wholesale_collection",fixedMonthlyEur:200,variableEurPerMinute:.045,operationsMonthlyEur:100,initialInvestmentEur:0,amortizationMonths:12},
  {code:"direct_interconnection",fixedMonthlyEur:450,variableEurPerMinute:.01,operationsMonthlyEur:500,initialInvestmentEur:12000,amortizationMonths:24}
 ]};
test("compare three interconnection models including operation and amortized investment",()=>{
 const r=evaluateInterconnectionOwnershipCosts(interconnect);
 assert.equal(r.scenarios[0].monthlyCostEur,900);
 assert.equal(r.scenarios[1].monthlyCostEur,750);
 assert.equal(r.scenarios[2].monthlyCostEur,1550);
 assert.equal(r.lowest_cost_code_from_entered_figures,"owned_sip_wholesale_collection");
 assert.equal(r.direct_vs_wholesale_cost_difference_eur,800);
 assert.equal(r.direct_vs_wholesale_break_even_minutes,32858);
 assert.equal(r.commercial_or_technical_activation_authorized,false);
 assert.equal(r.direct_operator_agreements_verified,false);
});
test("no traffic, no divide-by-zero and no implicit business authorization",()=>{
 const r=evaluateInterconnectionOwnershipCosts({...interconnect,minutesPerMonth:0});
 assert.equal(r.scenarios[2].monthlyCostEur,1450);
 assert.equal(r.scenarios[2].effectiveEurPerMinute,null);
 assert.equal(r.settlement_and_payment_legality_verified,false);
});
test("strict numeric inputs reject coercion and maliciously shaped objects",()=>{
 for(const bad of [[],[0],{},false,true," ","0x2","Infinity","1e4","-1"]){
  assert.throws(()=>evaluateAutonomyCosts({...base,minutes:bad}),/invalide/);
  assert.throws(()=>evaluateInterconnectionOwnershipCosts({...interconnect,minutesPerMonth:bad}),/invalide/);
 }
 assert.throws(()=>evaluateInterconnectionOwnershipCosts({...interconnect,scenarios:interconnect.scenarios.slice(1)}),/Trois modèles/);
 assert.throws(()=>evaluateInterconnectionOwnershipCosts({
  ...interconnect,scenarios:interconnect.scenarios.map((s,i)=>i===1?{...s,fixedMonthlyEur:[]} : s)
 }),/invalide/);
 assert.throws(()=>evaluateInterconnectionOwnershipCosts({
  ...interconnect,scenarios:interconnect.scenarios.map((s,i)=>i===2?{...s,amortizationMonths:0} : s)
 }),/invalide/);
});


const exampleCall={
 billedServiceSeconds:180,contractServiceRevenueHT:1.5,editorShareHT:.9,
 operatorCollectionChargesHT:.2,platformVariableChargesHT:.05,
 prudentFraudAndUnpaidReserveHT:.05,
 monthlyAttributableFixedChargesHT:100,expectedMonthlyCalls:1000
};
test("per-call contribution deducts every contractual and forecast cost",()=>{
 const r=evaluatePerCallContribution(exampleCall);
 assert.equal(r.estimated_contribution_per_call_ht_eur,.2);
 assert.equal(r.estimated_contribution_per_billed_minute_ht_eur,.07);
 assert.equal(r.allocated_fixed_ht_eur,.1);
 assert.equal(r.economics,"positive");
 assert.equal(r.verified_cash_collection,false);
 assert.equal(r.legal_tariff_compliance_verified,false);
 assert.equal(r.per_call_payout_or_price_change_authorized,false);
});
test("per-call contribution preserves potential losses rather than hiding them",()=>{
 const r=evaluatePerCallContribution({...exampleCall,operatorCollectionChargesHT:1.2});
 assert.equal(r.estimated_contribution_per_call_ht_eur,-.8);
 assert.equal(r.economics,"loss");
});
test("per-call contribution refuses missing/ambiguous amounts and undefined volume",()=>{
 assert.throws(()=>evaluatePerCallContribution({...exampleCall,editorShareHT:[]}),/invalide/);
 assert.throws(()=>evaluatePerCallContribution({...exampleCall,operatorCollectionChargesHT:" "}),/invalide/);
 assert.throws(()=>evaluatePerCallContribution({...exampleCall,expectedMonthlyCalls:0}),/au moins un appel/);
 assert.throws(()=>evaluatePerCallContribution({...exampleCall,billedServiceSeconds:1.5}),/invalide/);
 assert.equal(evaluatePerCallContribution({...exampleCall,billedServiceSeconds:0}).estimated_contribution_per_billed_minute_ht_eur,null);
});
