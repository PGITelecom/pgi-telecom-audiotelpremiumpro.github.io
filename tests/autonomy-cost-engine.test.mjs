import test from "node:test";
import assert from "node:assert/strict";
import {evaluateAutonomyCosts} from "../assets/autonomy-cost-engine.mjs";
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
