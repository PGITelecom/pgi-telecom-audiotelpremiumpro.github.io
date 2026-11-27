import test from "node:test";
import assert from "node:assert/strict";
import {compareInternalizationTco} from "../backend/src/internalization-tco.mjs";
const proof=Object.fromEntries(["costs_verified","license_commercial_use_verified","capacity_verified","quality_verified","security_verified","continuity_verified","regulatory_verified","exit_plan_verified"].map(k=>[k,true]));
const option=(license,hosting,rate=0)=>({monthly_cost_micro_eur:{license,hosting,maintenance:0,security_backup:0,compliance:0,support:0,other:0},one_off_cost_micro_eur:{setup:0,migration:0,exit:0,parallel_run:0,hardware:0},included_monthly_units:1000,excess_unit_micro_eur:rate,verified_monthly_capacity:10000,internal_monthly_minutes:0,internal_hourly_cost_micro_eur:0,evidence:{...proof}});
const scenario=()=>({business_unit:"audiotel_platform",currency:"EUR",unit:"call",horizon_months:12,low_monthly_units:100,base_monthly_units:1000,high_monthly_units:2000,current:option(100000000,0),alternative:option(0,20000000)});
test("no subscription does not mean no operational cost; savings are compared across all volumes",()=>{
 const p=scenario();p.alternative.internal_monthly_minutes=60;p.alternative.internal_hourly_cost_micro_eur=30000000;p.alternative.one_off_cost_micro_eur.migration=120000000;
 const r=compareInternalizationTco(p);
 assert.equal(r.alternative.monthly_labour_micro_eur,30000000);
 assert.equal(r.scenarios[1].horizon_saving_micro_eur,480000000);
 assert.equal(r.status,"candidate_for_independent_review");
 assert.equal(r.provider_cancellation_authorized,false);
});
test("free tier overage, unknown costs, capacity or commercial license evidence block substitution",()=>{
 const p=scenario();p.alternative.excess_unit_micro_eur=100000;
 assert.equal(compareInternalizationTco(p).status,"blocked");
 const q=scenario();q.alternative.verified_monthly_capacity=1000;
 assert.ok(compareInternalizationTco(q).blocked_reasons.includes("capacity_not_sufficient"));
 const r=scenario();r.alternative.evidence.license_commercial_use_verified=false;
 assert.ok(compareInternalizationTco(r).blocked_reasons.includes("alternative_license_commercial_use_verified"));
 const s=scenario();delete s.alternative.monthly_cost_micro_eur.maintenance;
 assert.throws(()=>compareInternalizationTco(s),/TCO_INVALID_MAINTENANCE/);
});
