import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {PostgresStore} from "../backend/src/store-postgres.mjs";

function stubbedStore(){
 const queries=[],published=[];
 const sql={
  async unsafe(query,values){
   queries.push({query,values});
   if(query.startsWith("SELECT id,default_currency,created_at FROM tenants"))
    return [{id:7,default_currency:"EUR",created_at:"2026-01-01T00:00:00.000Z"}];
   return [];
  },
  async begin(fn){return fn(this);}
 };
 const store=new PostgresStore(sql,{}, {publish:(...args)=>published.push(args)},sql);
 store.withTenantReadContext=async (_tenant,fn)=>fn(sql);
 return {store,queries,published};
}

test("PostgresStore preserves eight existing public analytics methods",()=>{
 const names=["summary","liveFinancialSnapshot","customerJackpotSnapshot",
  "platformJackpotSnapshot","liveFinancialByTenant","dashboardAnalytics",
  "voiceIntelligence","scanVoiceIncidents"];
 for(const key of names)assert.equal(typeof PostgresStore.prototype[key],"function",key);
 const code=fs.readFileSync(new URL("../backend/src/store-postgres.mjs",import.meta.url),"utf8");
 const finance=fs.readFileSync(new URL("../backend/src/store-postgres-financial-insights.mjs",import.meta.url),"utf8");
 const network=fs.readFileSync(new URL("../backend/src/store-postgres-network-insights.mjs",import.meta.url),"utf8");
 assert.match(code,/financialInsights\.summary\.apply\(this,arguments\)/);
 assert.match(code,/networkInsights\.scanVoiceIncidents\.apply\(this,arguments\)/);
 assert.match(finance,/platform_rollups_hourly_sharded/);
 assert.match(network,/voice_carrier_health_hourly_sharded/);
});

test("read-only financial methods preserve result structure and SQL access",async()=>{
 const {store,queries}=stubbedStore();
 const live=await store.liveFinancialSnapshot();
 assert.equal(live.active_calls,0);
 assert.deepEqual(live.by_currency,[]);
 assert.equal(live.currency_count,0);
 assert.match(queries[0].query,/live_call_financial_sessions/);
 const byClient=await store.liveFinancialByTenant(1);
 assert.deepEqual(byClient.by_client,[]);
 const jackpot=await store.platformJackpotSnapshot();
 assert.equal(jackpot.accounting_impact,"none");
 const tenant=await store.customerJackpotSnapshot(7);
 assert.equal(tenant.default_currency,"EUR");
 assert.equal(tenant.estimate,true);
 assert.equal(tenant.accounting_impact,"none");
 const summary=await store.summary("2026-11-01T00:00:00Z","2026-11-02T00:00:00Z",null);
 assert.equal(summary.queue_depth,0);
 assert.equal(summary.asr_percent,0);
 assert.equal(summary.live_calls,0);
 assert.ok(queries.length>=7);
});

test("network analytics read paths, returned shapes and empty scans stay compatible",async()=>{
 const {store,queries,published}=stubbedStore();
 const dashboard=await store.dashboardAnalytics("2026-11-01T00:00:00Z","2026-11-02T00:00:00Z");
 assert.equal(dashboard.granularity,"hour");
 assert.deepEqual(dashboard.series,[]);
 assert.deepEqual(dashboard.carriers,[]);
 const voice=await store.voiceIntelligence("2026-11-01T00:00:00Z","2026-11-02T00:00:00Z");
 assert.deepEqual(voice.carriers,[]);
 assert.deepEqual(voice.sip_codes,[]);
 assert.deepEqual(voice.incidents,[]);
 const changes=await store.scanVoiceIncidents();
 assert.deepEqual(changes,[]);
 assert.deepEqual(published,[]);
 assert.ok(queries.some(x=>x.query.includes("FROM voice_carrier_health_hourly_sharded")));
 assert.ok(queries.some(x=>x.query.includes("FROM dashboard_dimension_rollups_daily")));
});
