import test from "node:test";
import assert from "node:assert/strict";
import {
 planAudiotelFinancialCycle,planAudiotelFinancialProviderAdapter,
 AUDIOTEL_FINANCIAL_PROVIDER_PORTS,AUDIOTEL_RECONCILIATION_REQUIREMENTS
} from "../backend/src/audiotel-financial-cycle-prelaunch.mjs";

const row=(changes={})=>({
 call_reference:"CALL-2026-00000001",tenant_reference:"TENANT-0001",
 sva_number:"+33890123456",eligible_seconds:60,
 operator_gross_minor:1000,carrier_fee_minor:100,processor_fee_minor:0,
 state:"operator_reported",rate_reference:"RATE-2026-0001",...changes
});
const contract=(changes={})=>({
 tenant_reference:"TENANT-0001",contract_reference:"CONTRACT-0001",
 version_reference:"VERSION-0001",fee_bps:1000,fee_minor_per_min:2,
 fixed_fee_minor_per_call:0,...changes
});
const draft=(changes={})=>({
 business_unit:"audiotel_platform",currency:"EUR",
 period_reference:"PERIOD-2026-10",
 contract_model:"commission_agent",settlement_route:"carrier_direct",
 statement:{operator_reference:"CARRIER-0001",statement_reference:"STATEMENT-0001",
  document_sha256:"a".repeat(64),declared_total_minor:1600,rows:[
   row(),row({call_reference:"CALL-2026-00000002",tenant_reference:"TENANT-0002",
    eligible_seconds:120,operator_gross_minor:600,carrier_fee_minor:50,processor_fee_minor:50,
    sva_number:"+33821123456",rate_reference:"RATE-2026-0002"})
  ]},
 contracts:[contract(),contract({tenant_reference:"TENANT-0002",
  contract_reference:"CONTRACT-0002",version_reference:"VERSION-0002",
  fee_bps:0,fee_minor_per_min:7})],
 holds:[{hold_reference:"HOLD-2026-0001",tenant_reference:"TENANT-0001",
  kind:"dispute",amount_minor:100}],
 app_receipt_minor:106,minimum_margin_minor_per_min:7,
 ...changes
});
const reject=(x,code)=>assert.throws(()=>planAudiotelFinancialCycle(x),
  e=>e.code==="APP_CYCLE_"+code);

test("two professionals: sums reconcile, costs and 7c target are separate",()=>{
 const r=planAudiotelFinancialCycle(draft());
 assert.equal(r.reported_operator_total_minor,1600);
 assert.equal(r.reported_audiotel_bank_receipt_minor,106);
 assert.equal(r.verified_audiotel_bank_receipt_minor,null);
 assert.equal(r.verified_carrier_direct_publisher_paid_minor,null);
 assert.equal(r.operator_reported_gross_preview_minor,1600);
 assert.equal(r.carrier_and_processing_cost_preview_minor,200);
 assert.equal(r.audiotel_fee_preview_minor,106);
 assert.equal(r.publisher_due_preview_minor,1294);
 assert.equal(r.publisher_hold_preview_minor,100);
 assert.equal(r.publisher_after_hold_preview_minor,1194);
 assert.equal(r.publishers[0].audiotel_fee_preview_minor,92);
 assert.equal(r.publishers[0].publisher_due_preview_minor,808);
 assert.equal(r.publishers[1].audiotel_fee_preview_minor,14);
 assert.equal(r.publishers[1].publisher_due_preview_minor,486);
 assert.equal(r.reported_seconds,180);
 assert.equal(r.operator_reported_eligible_seconds_preview,180);
 assert.deepEqual(r.potential_mismatches,["publisher_holds_present"]);
 assert.equal(r.statutory_revenue_minor,null);
 assert.equal(r.micro_enterprise_turnover_minor,null);
 assert.equal(r.payout_authorized,false);
 assert.equal(r.operator_api_called,false);
 assert.equal(r.bank_api_called,false);
 assert.equal(r.stripe_api_called,false);
 assert.equal(r.monetary_transfer_enabled,false);
 assert.equal(r.call_allocations.every(x=>x.payout_eligible===false),true);
 assert.ok(AUDIOTEL_RECONCILIATION_REQUIREMENTS.includes("carrier_statement_authenticated"));
});

test("reported calls are not automatically confirmed; disputed rows never fund payouts",()=>{
 const s=draft();
 const rows=s.statement.rows.map((v,i)=>i===1?{...v,state:"disputed"}:v);
 const r=planAudiotelFinancialCycle({...s,statement:{...s.statement,rows}});
 assert.equal(r.operator_reported_gross_preview_minor,1000);
 assert.equal(r.unconfirmed_operator_gross_minor,600);
 assert.equal(r.publisher_due_preview_minor,808);
 assert.equal(r.publisher_after_hold_preview_minor,708);
 assert.equal(r.disputed_or_excluded_calls,1);
 assert.equal(r.call_allocations[1].publisher_due_preview_minor,0);
 assert.equal(r.call_allocations[1].payout_eligible,false);
 assert.ok(r.potential_mismatches.includes("unconfirmed_or_disputed_calls_present"));
});

test("duplicate operator call and statement mismatch are rejected",()=>{
 const s=draft();
 reject({...s,statement:{...s.statement,declared_total_minor:1599}},"STATEMENT_TOTAL_MISMATCH");
 reject({...s,statement:{...s.statement,
  rows:[s.statement.rows[0],{...s.statement.rows[1],call_reference:"CALL-2026-00000001"}]}},"DUPLICATE_CDR");
});
test("tenant contract must exist and money cannot become negative or overdrawn",()=>{
 const s=draft();
 reject({...s,contracts:[s.contracts[0]]},"CDR_CONTRACT_MISSING");
 reject({...s,statement:{...s.statement,rows:[
  {...s.statement.rows[0],carrier_fee_minor:1001},s.statement.rows[1]]}},"CDR_FEES_EXCEED_GROSS");
 reject({...s,statement:{...s.statement,rows:[
  {...s.statement.rows[0],operator_gross_minor:-1},s.statement.rows[1]]}},"INVALID_OPERATOR_GROSS");
 reject({...s,contracts:[s.contracts[0],{...s.contracts[0],tenant_reference:"TENANT-0001"}]},"DUPLICATE_TENANT_CONTRACT");
 reject({...s,holds:[{...s.holds[0],amount_minor:10000}]},"HOLDS_EXCEED_PUBLISHER_DUE");
});
test("no forged validation, bank approval, IBAN, payouts or input toggles",()=>{
 const s=draft();
 reject({...s,operator_statement_authenticated:true},"INVALID_INPUT");
 reject({...s,app_receipt_minor:106,transfer_authorized:true},"INVALID_INPUT");
 reject({...s,statement:{...s.statement,signature_verified:true}},"INVALID_STATEMENT");
 reject({...s,statement:{...s.statement,rows:[
  {...s.statement.rows[0],bank_account:"FR123456789"},s.statement.rows[1]]}},"INVALID_CDR");
 reject({...s,contracts:[{...s.contracts[0],tax_model_approved:true},s.contracts[1]]},"INVALID_CONTRACT");
});

test("no contract model automatically decides French micro tax status",()=>{
 for(const contract_model of ["commission_agent","professional_services","direct_operator"]){
  const r=planAudiotelFinancialCycle(draft({contract_model}));
  assert.equal(r.contract_model,contract_model);
  assert.equal(r.statutory_revenue_minor,null);
  assert.equal(r.legally_excluded_third_party_funds_minor,null);
  assert.equal(r.accounting_posting_authorized,false);
  assert.equal(r.could_be_paid_directly_by_carrier,false);
 }
 reject(draft({business_unit:"direct_sva"}),"SCOPE_INVALID");
 reject(draft({currency:"USD"}),"SCOPE_INVALID");
 reject(draft({contract_model:"agent_exempt"}),"MODEL_INVALID");
});

test("idempotent provider drafts are adapter neutral and cannot execute payments",()=>{
 const providers=["carrier_direct","regulated_psp","stripe_connect","revolut_own_funds"];
 assert.deepEqual(AUDIOTEL_FINANCIAL_PROVIDER_PORTS.map(x=>x.key),providers);
 for(const provider of providers){
  const a=planAudiotelFinancialProviderAdapter({
   business_unit:"audiotel_platform",provider,
   settlement_reference:"STATEMENT-0001",
   beneficiary_reference:"BENEFICIARY-0001",
   amount_minor:808,idempotency_reference:"PAYOUT-20261108-00001"
  });
  assert.match(a.idempotency_fingerprint,/^[a-f0-9]{64}$/);
  assert.equal(a.currency,"EUR");
  assert.equal(a.dispatch_status,"not_authorized");
  assert.equal(a.can_dispatch,false);
  assert.equal(a.payout_executed,false);
  assert.equal(a.provider_request,null);
  assert.equal(a.external_adapter_connected,false);
  assert.equal(a.transfers_third_party_funds_authorized,false);
  assert.deepEqual(a,planAudiotelFinancialProviderAdapter({
   business_unit:"audiotel_platform",provider,settlement_reference:"STATEMENT-0001",
   beneficiary_reference:"BENEFICIARY-0001",amount_minor:808,
   idempotency_reference:"PAYOUT-20261108-00001"
  }));
 }
});
test("reject raw banking information and unsafe adapter calls",()=>{
 const a={business_unit:"audiotel_platform",provider:"revolut_own_funds",
   settlement_reference:"STATEMENT-0001",beneficiary_reference:"BENEFICIARY-0001",
   amount_minor:808,idempotency_reference:"PAYOUT-20261108-00001"};
 assert.throws(()=>planAudiotelFinancialProviderAdapter({...a,iban:"FR76XX"}),
  {code:"APP_CYCLE_INVALID_ADAPTER"});
 assert.throws(()=>planAudiotelFinancialProviderAdapter({...a,execution_approved:true}),
  {code:"APP_CYCLE_INVALID_ADAPTER"});
 assert.throws(()=>planAudiotelFinancialProviderAdapter({...a,amount_minor:0}),
  {code:"APP_CYCLE_PAYOUT_ZERO"});
});
test("reordering rows and contracts cannot change the statement fingerprint",()=>{
 const base=draft();
 const first=planAudiotelFinancialCycle(base).source_digest;
 const alternative=planAudiotelFinancialCycle({...base,statement:{...base.statement,
  rows:[...base.statement.rows].reverse()},contracts:[...base.contracts].reverse()});
 assert.equal(first,alternative.source_digest);
});

test("carrier pays publishers directly: Audiotel receipt is compared to commission, not whole call revenue",()=>{
 const direct=planAudiotelFinancialCycle(draft());
 assert.equal(direct.reported_operator_total_minor,1600);
 assert.equal(direct.expected_audiotel_gross_fee_preview_minor,106);
 assert.equal(direct.reported_audiotel_bank_receipt_minor,106);
 assert.ok(!direct.potential_mismatches.includes(
   "reported_audiotel_receipt_vs_contract_fee_difference"));
 const mismatch=planAudiotelFinancialCycle(draft({app_receipt_minor:1600}));
 assert.ok(mismatch.potential_mismatches.includes(
   "reported_audiotel_receipt_vs_contract_fee_difference"));
 assert.equal(mismatch.statutory_revenue_minor,null);
 assert.equal(mismatch.payout_authorized,false);
});
