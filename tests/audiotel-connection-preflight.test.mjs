import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
 APP_CARRIER_CONNECTION_CONTRACT,audiotelConnectorReadiness,previewAudiotelCdrBatch
} from "../backend/src/audiotel-connection-preflight.mjs";

const pathText=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const GOOD={
 business_unit:"audiotel_platform",carrier_reference:"CARRIER_SAMPLE_001",
 records:[{
  event_id:"CDR_20261113_00000001",number_e164:"+33891234567",
  started_at:"2026-11-13T12:00:00.000Z",ended_at:"2026-11-13T12:03:30.000Z",
  billable_seconds:210,call_status:"connected",currency:"EUR"
 }]
};
const clone=x=>structuredClone(x);

test("carrier contract is provider-neutral, includes direct payout evidence and requires external approval",()=>{
 const keys=APP_CARRIER_CONNECTION_CONTRACT.map(x=>x.key);
 assert.equal(new Set(keys).size,keys.length);
 assert.ok(keys.length>=10);
 for(const required of ["operator_contract","numbering_rights","portability","routing_sip","cdr_ingestion","tariff_and_mgit","payouts_direct","stripe_invoices","accounting","data_security"]){
  assert.ok(keys.includes(required));
 }
 const payouts=APP_CARRIER_CONNECTION_CONTRACT.find(x=>x.key==="payouts_direct");
 assert.ok(payouts.fields.includes("platform_fee_separate"));
 assert.ok(payouts.fields.includes("carrier_bank_proof"));
});

test("even an observed backend carrier row does not certify a live contract or enable payments",()=>{
 const report=audiotelConnectorReadiness({
  business_unit:"audiotel_platform",
  counts:{registered_numbers:100,ready_or_active_carrier_connection_records:2,recorded_upstream_assignments:40},
  checks:[
   "subscription_price_version","legal_identity","vat_configuration",
   "account_mapping","fec_export_configuration"
  ].map(key=>({key,status:"observed"}))
 });
 assert.equal(report.registered_numbers,100);
 assert.equal(report.connections_count,2);
 assert.equal(report.verified_stages,0);
 assert.equal(report.production_connector_ready,false);
 assert.equal(report.commercial_activation_authorized,false);
 assert.equal(report.automatic_payout_enabled,false);
 assert.equal(report.carrier_ingestion_enabled,false);
 assert.ok(report.stages.every(x=>x.evidence_verified===false&&x.automatic_dispatch_permitted===false));
 assert.equal(report.stages.find(x=>x.key==="operator_contract").internal_indicator_observed,true);
});

test("an empty or invalid database snapshot is blocked and cannot be presented as ready",()=>{
 const r=audiotelConnectorReadiness();
 assert.equal(r.connections_count,0);
 assert.equal(r.registered_numbers,0);
 assert.equal(r.verified_stages,0);
 assert.equal(r.production_connector_ready,false);
 assert.deepEqual(r.stages.map(x=>x.status),Array(10).fill("external_evidence_required"));
});

test("operator-neutral CDR preview de-duplicates exact replay and exposes deterministic digests",()=>{
 const a=previewAudiotelCdrBatch(GOOD);
 assert.equal(a.unique_records,1);
 assert.equal(a.connected_records,1);
 assert.equal(a.total_billable_seconds,210);
 assert.match(a.canonical_records[0].content_digest,/^[a-f0-9]{64}$/);
 assert.equal(a.canonical_records[0].idempotency_digest,previewAudiotelCdrBatch(GOOD).canonical_records[0].idempotency_digest);
 assert.equal(a.source_signature_verified,false);
 assert.equal(a.database_write_permitted,false);
 assert.equal(a.customer_payout_permitted,false);
 assert.equal(a.tenant_number_assignment_verified,false);
 const repeat=previewAudiotelCdrBatch({...GOOD,records:[...GOOD.records,clone(GOOD.records[0])]});
 assert.equal(repeat.received_records,2);
 assert.equal(repeat.exact_duplicates,1);
 assert.equal(repeat.unique_records,1);
 assert.equal(repeat.total_billable_seconds,210);
});

test("conflicting duplicated operator CDR cannot silently overwrite financial evidence",()=>{
 const changed=clone(GOOD.records[0]);changed.billable_seconds=208;
 assert.throws(()=>previewAudiotelCdrBatch({...GOOD,records:[GOOD.records[0],changed]}),{code:"APP_CDR_DUPLICATE_CONFLICT"});
});

test("cross-business, invalid number, duration, spoofed dates, and unknown statuses fail closed",()=>{
 assert.throws(()=>previewAudiotelCdrBatch({...GOOD,business_unit:"direct_sva"}),{code:"APP_CDR_UNIT_INVALID"});
 for(const number of ["+33123456789","+33801234567","0891234567","+33899","+338912345678"]){
  const b=clone(GOOD);b.records[0].number_e164=number;
  assert.throws(()=>previewAudiotelCdrBatch(b),{code:"APP_CDR_SVA_NUMBER_INVALID"});
 }
 const bad=[
  ["call_status","answered","APP_CDR_STATUS_INVALID"],
  ["billable_seconds",-1,"APP_CDR_BILLABLE_SECONDS_INVALID"],
  ["billable_seconds","210","APP_CDR_BILLABLE_SECONDS_INVALID"],
  ["billable_seconds",500,"APP_CDR_DURATION_CONFLICT"],
  ["started_at","2026-02-30T12:00:00Z","APP_CDR_TIME_INVALID"],
  ["ended_at","2026-11-13T11:00:00Z","APP_CDR_TIME_INVALID"],
  ["currency","USD","APP_CDR_CURRENCY_INVALID"],
  ["event_id","x","APP_CDR_EVENT_ID_INVALID"]
 ];
 for(const [key,value,code] of bad){
  const b=clone(GOOD);b.records[0][key]=value;
  assert.throws(()=>previewAudiotelCdrBatch(b),{code},key);
 }
 const dropped=clone(GOOD);
 dropped.records[0].call_status="failed";
 assert.throws(()=>previewAudiotelCdrBatch(dropped),{code:"APP_CDR_NONCONNECTED_BILLED"});
 dropped.records[0].billable_seconds=0;
 const ok=previewAudiotelCdrBatch(dropped);
 assert.equal(ok.total_billable_seconds,0);
});

test("oversize batch, untrusted payload types, and tenant claims are not accepted as financial authority",()=>{
 assert.throws(()=>previewAudiotelCdrBatch({...GOOD,records:Array(1001).fill(GOOD.records[0])}),{code:"APP_CDR_BATCH_LIMIT"});
 assert.throws(()=>previewAudiotelCdrBatch({...GOOD,records:null}),{code:"APP_CDR_BATCH_LIMIT"});
 const b=clone(GOOD);b.records[0].tenant_id=999;
 const report=previewAudiotelCdrBatch(b);
 assert.equal(report.canonical_records[0].tenant_id,undefined);
 assert.equal(report.billing_authorized,false);
 assert.equal(report.import_executed,false);
});

test("administrative launch endpoint integrates only a read-only evidence matrix",()=>{
 const server=pathText("backend/server.mjs");
 const ui=pathText("assets/launch-readiness.js");
 const part=server.split('if(method==="GET"&&pathname==="/api/v1/platform/launch-readiness"){')[1]?.split('if(method==="POST"&&pathname==="/api/v1/platform/performance-lab/runs"){')[0]||"";
 assert.match(part,/requireRole\(actor,\["admin","finance","readonly"\]\)/);
 assert.match(part,/audiotel_connector_preflight:audiotelConnectorReadiness\(audiotelOrderAssurance\)/);
 assert.match(ui,/Raccordements à préparer/);
 assert.match(ui,/external/i);
 assert.doesNotMatch(part,/external[_-]transfer|payment[_-]execution/i);
});
