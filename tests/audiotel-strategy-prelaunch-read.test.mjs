import test from "node:test";
import assert from "node:assert/strict";
import {readAudiotelStrategyPreview} from "../backend/src/audiotel-strategy-prelaunch-read.mjs";

const context={authenticated:true,business_unit:"audiotel_platform",
 role:"administrator",staff_strategy_read_authorized:true};
test("cockpit strategy is read-only, five markets inactive and fiscal data unverified",async()=>{
 const calls=[];
 const store={readSql:{unsafe:async(sql)=>{
  calls.push(sql);return[{
   monthly_drafts:3,form_scenarios:4,transition_proposals:1,
   market_research_drafts:5,portability_drafts:0,market_quotes:2
  }];
 }}};
 const data=await readAudiotelStrategyPreview(store,context);
 assert.deepEqual(data.research_markets.map(x=>x.country_code),
  ["FR","ES","IT","GB","US"]);
 assert.ok(data.research_markets.every(x=>x.status==="research_only"&&
  x.direct_assignment_confirmed===false&&
  x.premium_portability_confirmed===false));
 assert.equal(data.recorded_monthly_drafts,3);
 assert.equal(data.recorded_form_scenarios,4);
 assert.equal(data.recorded_transition_proposals,1);
 assert.equal(data.current_statutory_turnover_minor,null);
 assert.equal(data.monthly_job_registered,false);
 assert.equal(data.fiscal_change_authorized,false);
 assert.equal(data.foreign_number_request_authorized,false);
 assert.equal(data.no_external_calls,true);
 assert.equal(calls.length,1);
 assert.ok(calls[0].startsWith("SELECT "));
});
test("strategy preview rejects non-staff and wrong unit before querying SQL",async()=>{
 const store={readSql:{unsafe:()=>{throw Error("SQL unexpectedly run");}}};
 for(const actor of [
  {...context,business_unit:"direct_sva"},
  {...context,role:"readonly"},
  {...context,authenticated:false},
  {...context,staff_strategy_read_authorized:false}
 ])await assert.rejects(()=>readAudiotelStrategyPreview(store,actor),
  {code:"APP_STRATEGY_ACCESS_DENIED"});
});
