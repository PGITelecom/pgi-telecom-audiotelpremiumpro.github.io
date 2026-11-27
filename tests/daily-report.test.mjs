import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {dailyReportScheduleState,buildDailyReportText,collectDailyWholesaleReport} from "../backend/src/daily-report.mjs";

const vercel=JSON.parse(fs.readFileSync(new URL("../vercel.json",import.meta.url),"utf8"));
const server=fs.readFileSync(new URL("../backend/server.mjs",import.meta.url),"utf8");
const resend=fs.readFileSync(new URL("../backend/src/resend-email.mjs",import.meta.url),"utf8");
const store=fs.readFileSync(new URL("../backend/src/store-postgres.mjs",import.meta.url),"utf8");

test("daily report schedule follows Europe Paris across summer and winter time",()=>{
  assert.deepEqual(dailyReportScheduleState(new Date("2026-10-08T18:00:00Z")),{date:"2026-10-08",hour:20,should_run:true,retry:false});
  assert.deepEqual(dailyReportScheduleState(new Date("2026-10-08T19:00:00Z")),{date:"2026-10-08",hour:21,should_run:true,retry:true});
  assert.equal(dailyReportScheduleState(new Date("2026-10-08T20:00:00Z")).should_run,false);
  assert.deepEqual(dailyReportScheduleState(new Date("2026-12-08T19:00:00Z")),{date:"2026-12-08",hour:20,should_run:true,retry:false});
  assert.deepEqual(dailyReportScheduleState(new Date("2026-12-08T20:00:00Z")),{date:"2026-12-08",hour:21,should_run:true,retry:true});
});

test("daily report is factual when external read APIs are unavailable",()=>{
  const report=buildDailyReportText("2026-10-08",{service:{created_today:2,open_now:1},mail:{delivered:3},system:{calls_total:4},categories:[{category:"billing",count:1}]});
  assert.match(report,/Bilan PGI Telecom \| 08\/10\/2026/);
  assert.match(report,/Google Search Console : non disponible côté serveur/);
  assert.match(report,/GA4 Data API : non disponible côté serveur/);
  assert.match(report,/Gmail : non disponible côté serveur/);
  assert.equal(report.includes(String.fromCharCode(8212)),false);
});

test("daily report backend uses protected cron and one native idempotency key",()=>{
  assert.ok(vercel.crons.some(x=>x.path==="/api/v1/internal/daily-report/run"&&x.schedule==="0 18,19,20 * * *"));
  assert.match(server,/authorizeCron\(req,config\)/);
  assert.match(server,/runDailyReportCron/);
  assert.match(resend,/idempotency-key/);
  assert.match(resend,/sendDailyReportEmail/);
  assert.match(store,/async dailyReportSnapshot/);
});


test("daily report audit filters use the real timestamp column for both day boundaries",()=>{
  const auditLog=fs.readFileSync(new URL("../database/schema.sql",import.meta.url),"utf8");
  const auditSchema=auditLog.match(/CREATE TABLE audit_log\s*\(([\s\S]*?)\n\);/)?.[1];
  assert.ok(auditSchema,"audit_log schema must be available");
  assert.match(auditSchema,/\boccurred_at\s+timestamptz\b/);
  assert.doesNotMatch(auditSchema,/\bcreated_at\b/);
  const filter=store.match(/FROM audit_log WHERE action='customer\.email\.inbound_resolved'[^\n]*?AS inbound_resolved/)?.[0];
  assert.ok(filter,"daily report audit count query must be present");
  assert.match(filter,/\boccurred_at>=/);
  assert.match(filter,/\boccurred_at</);
  assert.doesNotMatch(filter,/\bcreated_at\b/);
  assert.match(store,/AT TIME ZONE 'Europe\/Paris'/);
});

test("daily telecom monitoring observes existing records and isolates failures",async()=>{
 const sql={unsafe:async query=>{
  if(query.includes("logical_carrier_routes"))return [{active_carrier:"Carrier A",active_connection_state:"active",standby_carrier:null}];
  if(query.includes("direct_sva_number_blocks"))return [{recorded_current_grants:0,inventory_records:0,recorded_current_contracts:0}];
  return [{carrier_name:"Carrier A",expected_ht:"12.30",confirmed_ht:"10.00",recorded_paid_ht:"5.00",technical_cost_ht:"1.00"}];
 }};
 const wholesale=await collectDailyWholesaleReport({readSql:sql});
 assert.equal(wholesale.available,true);
 const report=buildDailyReportText("2026-11-27",{wholesale});
 assert.match(report,/Routes actives enregistrées : 1/);
 assert.match(report,/Routes sans opérateur de secours prêt : 1/);
 assert.match(report,/12\.30 EUR HT/);
 assert.match(report,/ne sont pas nécessairement des impayés échus/);
 const unavailable=await collectDailyWholesaleReport({readSql:{unsafe:async()=>{throw Error("unavailable");}}});
 assert.deepEqual(unavailable,{available:false});
 assert.match(buildDailyReportText("2026-11-27",{wholesale:unavailable}),/Indépendance télécom : données indisponibles/);
});
