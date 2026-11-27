import test from "node:test";
import assert from "node:assert/strict";
import {parseCarrierCsv,normalizeCarrierCsv,reconcileCarrierCsv} from "../backend/src/carrier-csv-import.mjs";
import {calculateTerminationCost,planEconomicRouting} from "../backend/src/economic-voice-routing.mjs";
const csv="id;start;stop;talk;bill;amount;note\r\ncall-a;2026-10-01T10:00:00Z;2026-10-01T10:01:00Z;60;60;0.500000;\"a;b\"" ;
const input={business_unit:"audiotel_platform",currency:"EUR",provider_key:"carrier-a",delimiter:";",csv,
 field_mapping:{id:"external_call_id",start:"started_at",stop:"ended_at",talk:"conversation_seconds",bill:"payout_eligible_seconds",amount:"confirmed_payout_ht"}};
test("internal CSV parser supports quoted delimiters and ignores unrelated fields",()=>{
 assert.equal(parseCarrierCsv(csv)[0].note,"a;b");
 const r=normalizeCarrierCsv(input);
 assert.equal(r.total_reported_payout_micro_eur,500000);
 assert.equal(r.rows[0].note,undefined);
 assert.match(r.raw_file_sha256,/^[a-f0-9]{64}$/);
 assert.throws(()=>parseCarrierCsv("id;id\na;b"),/HEADER/);
 assert.throws(()=>parseCarrierCsv("id;value\na;\"b"),/UNCLOSED/);
 assert.throws(()=>parseCarrierCsv("id;value\na;b;c"),/COLUMN_COUNT/);
 assert.throws(()=>parseCarrierCsv("id;value\na;\"b\"c"),/AFTER_QUOTE/);
});
test("CSV can be reconciled directly against PGI data without manual format conversion",async()=>{
 const store={sql:{unsafe:async q=>q.includes("FROM carriers")?[{id:7}]:[{external_call_id:"call-a",expected_ht:"0.600000"}]}};
 const p={...input,carrier_id:7,from_utc:"2026-10-01T00:00:00Z",to_utc:"2026-10-02T00:00:00Z"};
 const r=await reconcileCarrierCsv(store,p);
 assert.equal(r.gross_shortfall_micro_eur,100000);
 assert.equal(r.payout_authorized,false);
 await assert.rejects(reconcileCarrierCsv(store,{...p,from_utc:"2026-10-02T00:00:00Z",to_utc:"2026-10-03T00:00:00Z"}),/OUTSIDE/);
});
const quote={connected:true,duration_seconds:61,minimum_billable_seconds:60,billing_increment_seconds:30,rate_micro_eur_per_min:40000,connection_fee_micro_eur:1000};
test("exact termination charge accounts for minimums, rounding and connection fees",()=>{
 assert.deepEqual(calculateTerminationCost(quote),{duration_seconds:61,billed_seconds:90,estimated_cost_micro_eur:61000,rounding_policy:"round_duration_up_then_apply_minimum_round_micro_eur_up",scenario_only:true});
 assert.equal(calculateTerminationCost({...quote,connected:false,duration_seconds:0}).estimated_cost_micro_eur,0);
 assert.throws(()=>calculateTerminationCost({...quote,billing_increment_seconds:0}),/INCREMENT/);
});
test("least cost advice preserves tenant, number specificity, priority, capacity and consent",async()=>{
 const rows=[{id:1,sva_number_id:9,priority:1,eligible:true,destination_type:"pstn"},{id:2,sva_number_id:9,priority:1,eligible:true,destination_type:"sip"},{id:3,sva_number_id:null,priority:1,eligible:true,destination_type:"sip"},{id:4,sva_number_id:9,priority:2,eligible:true,destination_type:"sip"},{id:5,sva_number_id:9,priority:1,eligible:false,destination_type:"sip"}];
 const store={simulateTenantRouting:async(id,ctx)=>{assert.equal(id,"tenant-a");assert.equal(ctx.sva_number_id,9);return {selected:{id:1,priority:1},candidates:rows};}};
 const q=(id,rate)=>({...quote,destination_id:id,rate_micro_eur_per_min:rate,cost_verified:true,quality_verified:true,customer_consent_verified:true});
 const p={business_unit:"audiotel_platform",currency:"EUR",tenant_public_id:"tenant-a",sva_number_id:9,typical_call_seconds:60,quotes:[q(1,40000),q(2,5000),q(3,0),q(4,0),q(5,0)]};
 const r=await planEconomicRouting(store,p);
 assert.equal(r.candidate_destination_id,2);
 assert.equal(r.estimated_saving_per_call_micro_eur,35000);
 assert.equal(r.routing_change_authorized,false);
 assert.equal((await planEconomicRouting(store,{...p,quotes:[q(1,40000),{...q(2,5000),customer_consent_verified:false}]})).candidate_destination_id,null);
 await assert.rejects(planEconomicRouting(store,{...p,quotes:[q(99,0)]}),/OUTSIDE_TENANT/);
});
