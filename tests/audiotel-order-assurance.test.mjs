import test from "node:test";
import assert from "node:assert/strict";
import {evaluateAudiotelReadiness,inspectAudiotelReadiness} from "../backend/src/audiotel-order-assurance.mjs";
const good=()=>({
 inventory:{numbers:1,carrier_connections:1,upstream_assignments:1,customer_assignments:0,plan_versions:1,subscription_events:3},
 accounting:{legal_identity_configured:true,vat_regime_configured:true,vat_inclusive_known:true,account_map_configured:true,fec_enabled:true}
});
test("absence of database evidence is strictly non-activating",()=>{
 const r=evaluateAudiotelReadiness();
 assert.equal(r.observation_status,"unavailable");
 assert.equal(r.customer_number_delivery_authorized,false);
});
test("realistic empty prelaunch state fails closed without pretending stock",()=>{
 const r=evaluateAudiotelReadiness({inventory:{numbers:"0",carrier_connections:"0",upstream_assignments:"0",customer_assignments:"0",plan_versions:"1",subscription_events:"0"},accounting:{
 legal_identity_configured:false,vat_regime_configured:false,vat_inclusive_known:false,account_map_configured:false,fec_enabled:false
 }});
 assert.equal(r.business_unit,"audiotel_platform");
 assert.equal(r.observation_status,"blocked");
 assert.equal(r.checks.find(x=>x.key==="subscription_price_version").status,"observed");
 assert.equal(r.checks.find(x=>x.key==="number_stock_recorded").status,"blocked");
 assert.equal(r.checks.find(x=>x.key==="vat_configuration").status,"blocked");
});
test("even all internal readiness cannot prove external carrier, Stripe and accounting review",()=>{
 const r=evaluateAudiotelReadiness(good());
 assert.equal(r.observation_status,"blocked");
 assert.equal(r.customer_number_delivery_authorized,false);
 assert.equal(r.commercial_activation_authorized,false);
 assert.equal(r.payments_authorized,false);
 assert.equal(r.checks.find(x=>x.key==="external_operator_acceptance").status,"blocked");
});
test("invalid rows or unsafe counts are rejected, never represented as zero stock ready",()=>{
 for(const bad of [null,NaN,-1,1.5,Number.MAX_SAFE_INTEGER+1,"not_a_count"]){
  const q=good();q.inventory.numbers=bad;
  assert.equal(evaluateAudiotelReadiness(q).observation_status,"unavailable");
 }
});
test("reader executes only aggregate SELECT and never mutates customer or finance data",async()=>{
 const queries=[];
 const s={readSql:{unsafe:async sql=>{
  queries.push(sql);if(queries.length===1)return[good().inventory];
  return[good().accounting];
 }}};
 const r=await inspectAudiotelReadiness(s);
 assert.equal(queries.length,2);
 assert.ok(queries.every(q=>q.startsWith("SELECT ")));
 assert.ok(queries.every(q=>!/\b(?:INSERT|UPDATE|DELETE|CREATE|DROP|TRUNCATE)\s/i.test(q)));
 assert.equal(r.source,"read_only_authoritative_database_snapshot");
 assert.equal(r.customer_number_delivery_authorized,false);
});
test("database query errors are not disclosed to API callers",async()=>{
 const store={readSql:{unsafe:async()=>{throw Error("sensitive PostgreSQL diagnostics")}}};
 const r=await inspectAudiotelReadiness(store);
 assert.equal(r.observation_status,"unavailable");
 assert.doesNotMatch(JSON.stringify(r),/sensitive PostgreSQL diagnostics/);
});