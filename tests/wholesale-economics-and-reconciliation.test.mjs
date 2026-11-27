import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {reconcileWholesalePreview,reconcileWholesaleLedger} from "../backend/src/wholesale-reconciliation-preview.mjs";
import {compareVoiceReception,wholesaleIndependenceSnapshot} from "../backend/src/wholesale-independence.mjs";
const reconciliation={business_unit:"audiotel_platform",currency:"EUR",provider_key:"carrier-a",period:"2026-11",
 expected_rows:[{external_call_id:"a",expected_micro_eur:100000},{external_call_id:"b",expected_micro_eur:200000},{external_call_id:"c",expected_micro_eur:300000}],
 reported_rows:[{external_call_id:"a",reported_micro_eur:80000},{external_call_id:"c",reported_micro_eur:350000},{external_call_id:"d",reported_micro_eur:40000}]};
test("wholesale reconciliation exposes gross losses even when overages partially offset them",()=>{
 const r=reconcileWholesalePreview(reconciliation);
 assert.equal(r.gross_shortfall_micro_eur,220000);
 assert.equal(r.gross_overage_micro_eur,90000);
 assert.equal(r.net_delta_micro_eur,-130000);
 assert.deepEqual(r.counts,{matched:0,missing:1,unexpected:1,shortfall:1,overage:1});
 assert.equal(r.payout_authorized,false);
 assert.equal(r.digest,reconcileWholesalePreview({...reconciliation,expected_rows:[...reconciliation.expected_rows].reverse()}).digest);
});
test("duplicate calls and noninteger or negative amounts cannot enter reconciliation",()=>{
 assert.throws(()=>reconcileWholesalePreview({...reconciliation,expected_rows:[reconciliation.expected_rows[0],reconciliation.expected_rows[0]]}),/DUPLICATE/);
 assert.throws(()=>reconcileWholesalePreview({...reconciliation,reported_rows:[{external_call_id:"a",reported_micro_eur:-1}]}),/AMOUNT/);
 assert.throws(()=>reconcileWholesalePreview({...reconciliation,period:"2026-13"}),/PERIOD/);
});
const voice={business_unit:"audiotel_platform",currency:"EUR",monthly_minutes:100000,webrtc_adoption_bps:5000,fallback_bps:1000,horizon_months:12,pstn_cost_micro_eur_per_min:40000,webrtc_cost_micro_eur_per_min:5000,monthly_fixed_cost_micro_eur:300000000,setup_cost_micro_eur:1250000000,evidence:Object.fromEntries(["costs_verified","sip_interconnection_verified","media_quality_verified","fallback_tested","security_reviewed"].map(k=>[k,true]))};
test("WebRTC savings account for fallback, fixed costs and initial investment",()=>{
 const r=compareVoiceReception(voice);
 assert.equal(r.pstn_minutes_avoided,45000);
 assert.equal(r.monthly_saving_micro_eur,1250000000);
 assert.equal(r.horizon_saving_micro_eur,13750000000);
 assert.equal(r.payback_months,1);
 assert.equal(r.network_activation_authorized,false);
 assert.equal(r.status,"candidate_for_independent_review");
 assert.equal(compareVoiceReception({...voice,fallback_bps:10000}).status,"blocked");
 assert.equal(compareVoiceReception({...voice,evidence:{}}).status,"blocked");
 assert.throws(()=>compareVoiceReception({...voice,monthly_fixed_cost_micro_eur:undefined}),/FIXED/);
});
test("independence snapshot uses read-only aggregate queries and never grants authority",async()=>{
 const statements=[];
 const store={readSql:{unsafe:async query=>{statements.push(query);return query.includes("direct_sva_number_blocks")?[{recorded_current_grants:0}]:[];}}};
 const r=await wholesaleIndependenceSnapshot(store);
 assert.equal(statements.length,3);
 assert.ok(statements.every(q=>q.startsWith("SELECT ")));
 assert.equal(r.resource_records.recorded_current_grants,0);
 assert.equal(r.payout_authorized,false);
 assert.equal(r.number_assignment_authorized,false);
 await assert.rejects(wholesaleIndependenceSnapshot({}),/POSTGRES_REQUIRED/);
});

test("stored CDR reconciliation binds carrier and time parameters, ignores supplied expected rows",async()=>{
 const statements=[];
 const store={sql:{unsafe:async(q,args)=>{statements.push({q,args});return q.includes("FROM carriers")?[{id:7}]:[{external_call_id:"a",expected_ht:"0.100000"}];}}};
 const input={business_unit:"audiotel_platform",currency:"EUR",carrier_id:7,from_utc:"2026-10-01T00:00:00Z",to_utc:"2026-10-02T00:00:00Z",expected_rows:[],reported_rows:[{external_call_id:"a",reported_micro_eur:80000}]};
 const r=await reconcileWholesaleLedger(store,input);
 assert.equal(r.gross_shortfall_micro_eur,20000);
 assert.equal(r.expected_source,"pgi_stored_connected_call_expectations");
 assert.deepEqual(statements[1].args,[7,"2026-10-01T00:00:00.000Z","2026-10-02T00:00:00.000Z"]);
 assert.equal(r.report_coverage_verified,false);
 await assert.rejects(reconcileWholesaleLedger(store,{...input,from_utc:"2026-09-31T00:00:00Z"}),/UTC_WINDOW/);
 const tooLarge={sql:{unsafe:async q=>q.includes("FROM carriers")?[{id:7}]:Array(1001).fill({})}};
 await assert.rejects(reconcileWholesaleLedger(tooLarge,input),/SPLIT_WINDOW_REQUIRED/);
});

test("wholesale cockpit module is packaged, lazy-loaded and every preview is admin protected",()=>{
 const server=fs.readFileSync("backend/server.mjs","utf8");
 const cockpit=fs.readFileSync("assets/platform-admin-tools.js","utf8");
 const build=fs.readFileSync("scripts/build-static.mjs","utf8");
 assert.match(cockpit,/await import\("\.\/wholesale-admin\.js"\)/);
 assert.match(build,/"assets\/wholesale-admin\.js"/);
 for(const name of ["compare","normalize-export","reconcile","reconcile-ledger","voice-cost"]){
  const marker='if(method==="POST"&&pathname==="/api/v1/platform/wholesale/'+name+'"){';
  const offset=server.indexOf(marker);assert.ok(offset>=0);
  assert.match(server.slice(offset,offset+240),/requireRole\(actor,\["admin"\]\);requireCsrf\(req,actor,config\);/);
 }
 const marker='if(method==="GET"&&pathname==="/api/v1/platform/wholesale/independence"){';
 const offset=server.indexOf(marker);assert.ok(offset>=0);
 assert.match(server.slice(offset,offset+200),/requireRole\(actor,\["admin"\]\)/);
});
