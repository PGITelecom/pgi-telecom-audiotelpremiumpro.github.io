import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {prioritizeAudiotelOperations} from "../backend/src/audiotel-operational-priorities.mjs";

const launch=(sections=[])=>({sections});
const assurance=(checks=[])=>({business_unit:"audiotel_platform",checks});
const checked=(key,status="blocked")=>({key,status});

test("missing authoritative snapshots result in a fail-closed human action",()=>{
  const data=prioritizeAudiotelOperations();
  assert.equal(data.business_unit,"audiotel_platform");
  assert.equal(data.actions[0].key,"database_snapshot");
  assert.equal(data.authorizes_number_assignment,false);
  assert.equal(data.authorizes_real_payment,false);
  assert.equal(data.authorizes_release,false);
  assert.equal(data.safe_for_automatic_payment,false);
});

test("commercial, legal and money blockers are prioritized deterministically",()=>{
  const p=prioritizeAudiotelOperations({
    launch:launch([{key:"security",status:"blocked"},{key:"billing",status:"action_required"},
      {key:"operator",status:"pending_external"},{key:"legal_identity",status:"action_required"}]),
    assurance:assurance([checked("external_operator_acceptance"),checked("number_stock_recorded"),
      checked("vat_configuration"),checked("fec_export_configuration"),
      checked("payment_provider_live"),checked("external_operator_acceptance")])
  });
  assert.equal(p.actions.filter(x=>x.key==="external_operator_acceptance").length,1);
  assert.ok(p.actions.find(x=>x.dependency==="internal"));
  assert.ok(p.actions.find(x=>x.dependency==="legal"));
  assert.ok(p.actions.find(x=>x.dependency==="stripe_deferred"));
  assert.ok(p.actions.find(x=>x.dependency==="accounting"));
  assert.equal(p.action_count,p.actions.length);
  assert.equal(p.actionable_without_external_approval,p.dependencies.internal);
  assert.equal(p.depends_on_external_approval,
    p.dependencies.external+p.dependencies.legal+p.dependencies.accounting+p.dependencies.stripe_deferred);
  const firstHigh=p.actions.findIndex(x=>x.priority==="high");
  const lastCritical=p.actions.map(x=>x.priority).lastIndexOf("critical");
  assert.ok(firstHigh>lastCritical);
});

test("observed evidence does not become authorization to transfer money",()=>{
  const p=prioritizeAudiotelOperations({
    launch:launch([{key:"operator",status:"ready"},{key:"security",status:"ready"}]),
    assurance:assurance([checked("legal_identity","observed")])
  });
  assert.equal(p.action_count,0);
  assert.equal(p.authorizes_real_payment,false);
  assert.equal(p.authorizes_release,false);
});

test("unknown or attacker-controlled keys cannot inject text into staff actions",()=>{
  const p=prioritizeAudiotelOperations({
    launch:launch([{key:'<img src=x onerror=alert(1)>',status:"blocked"}]),
    assurance:assurance([checked('<script>alert(1)</script>')])
  });
  assert.equal(p.action_count,0);
  assert.equal(JSON.stringify(p).includes("<script>"),false);
});

test("direct-distribution evidence is not accepted for Audiotel launch readiness",()=>{
  const p=prioritizeAudiotelOperations({
    launch:launch([]),
    assurance:{business_unit:"direct_sva",checks:[checked("external_operator_acceptance","observed")]}
  });
  assert.equal(p.actions[0].key,"database_snapshot");
});

test("staff route and cockpit consume the decision without money or operator commands",()=>{
  const server=fs.readFileSync(new URL("../backend/server.mjs",import.meta.url),"utf8");
  const ui=fs.readFileSync(new URL("../assets/launch-readiness.js",import.meta.url),"utf8");
  const route=server.split('pathname==="/api/v1/platform/launch-readiness"')[1]?.slice(0,1400);
  assert.ok(route);
  assert.match(route,/requireRole\(actor,\["admin","finance","readonly"\]\)/);
  assert.match(route,/prioritizeAudiotelOperations/);
  assert.match(route,/audiotel_operational_priorities/);
  assert.match(ui,/data\.audiotel_operational_priorities/);
  assert.match(ui,/Actions prioritaires Audiotel Premium Pro/);
  assert.match(ui,/esc\(x\.title\)/);
  assert.match(ui,/esc\(x\.action\)/);
  assert.doesNotMatch(ui,/transfer_authorized|charge\(|payout\.create|carrier\.assign/);
});

test("real payment backlog and exceptions become immediately actionable staff items",()=>{
 const p=prioritizeAudiotelOperations({
  launch:launch([]),
  assurance:assurance([
   checked("overdue_payouts_clear"),checked("payout_exceptions_clear"),
   checked("payout_proof_complete"),checked("payout_complaints_clear")])
 });
 assert.equal(p.action_count,4);
 assert.equal(p.dependencies.internal,4);
 assert.ok(p.actions.find(x=>x.key==="overdue_payouts_clear"));
 assert.ok(p.actions.find(x=>x.key==="payout_proof_complete"));
 assert.equal(p.authorizes_real_payment,false);
 assert.equal(p.actions.some(x=>x.action.includes("automatiquement")),true);
});
