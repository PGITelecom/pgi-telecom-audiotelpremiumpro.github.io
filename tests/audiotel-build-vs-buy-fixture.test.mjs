import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
test("published illustrative report agrees with documented 12-month cost scenarios and stays offline",()=>{
 const raw=execFileSync(process.execPath,["scripts/audiotel-build-vs-buy-report.mjs"],{
  cwd:new URL("..",import.meta.url),encoding:"utf8",timeout:10000,maxBuffer:2*1024*1024
 });
 const report=JSON.parse(raw);
 assert.equal(report.quote_count_authenticated,0);
 assert.equal(report.rows.length,135);
 assert.equal(report.cases.length,45);
 assert.equal(report.after_tax_personal_margin_proven,false);
 assert.equal(report.production_changes_authorized,false);
 assert.equal(report.payouts_authorized,false);
 const price=(n,m,a)=>report.rows.find(r=>
  r.scenario_reference==="PROS-"+n+"-MIN-"+m&&r.horizon_months===12&&
  r.alternative_reference===a)?.total_cost_minor;
 assert.equal(price(150,60,"A-EXTERNAL-HYPOTHESIS"),9486000);
 assert.equal(price(150,60,"B-HYBRID-HYPOTHESIS"),6938000);
 assert.equal(price(150,60,"C-MORE-INTERNAL-HYPOTHESIS"),8958000);
 assert.equal(price(150,0,"A-EXTERNAL-HYPOTHESIS"),1710000);
 assert.equal(price(150,0,"B-HYBRID-HYPOTHESIS"),2402000);
 assert.equal(price(50,60,"A-EXTERNAL-HYPOTHESIS"),3682000);
 assert.equal(price(500,60,"C-MORE-INTERNAL-HYPOTHESIS"),15762000);
 assert.ok(report.rows.every(r=>r.quote_independently_authenticated===false));
 const hidden=report.illustrative_incremental_hidden_fees_only;
 assert.equal(hidden.authenticated_quotes,0);
 assert.equal(hidden.real_zero_activation_guaranteed,false);
 assert.equal(hidden.rows.length,3);
 const external=hidden.rows.find(x=>x.alternative_reference==="A-EXTERNAL-HYPOTHESIS");
 const hybrid=hidden.rows.find(x=>x.alternative_reference==="B-HYBRID-HYPOTHESIS");
 assert.equal(external.incremental_upfront_minor,10000);
 assert.equal(external.total_cost_with_incremental_fees_minor,9496000);
 assert.equal(hybrid.incremental_total_minor,0);
 assert.equal(hybrid.total_cost_with_incremental_fees_minor,6938000);
 assert.ok(hidden.rows.every(x=>x.quote_verified===false));

});
