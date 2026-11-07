import test from "node:test";
import assert from "node:assert/strict";
import {assessAudiotelSvaPayout,previewAudiotelSvaPayoutBatch,APP_PAYOUT_REQUIRED_EVIDENCE} from "../backend/src/audiotel-sva-payout-preview.mjs";
const evidence=()=>Object.fromEntries(APP_PAYOUT_REQUIRED_EVIDENCE.map(k=>[k,true]));
const candidate=(extra={})=>({
  business_unit:"audiotel_platform",tenant_id:12,
  settlement_reference:"operator_nov_2026",
  period_reference:"2026-11",
  currency:"EUR",publisher_entitlement_minor:15000,
  hold_minor:0,authorized_offset_minor:0,already_paid_minor:0,
  verified_allocated_cash_minor:15000,evidence:evidence(),
  ...extra
});
const sepa={provider:"sepa_psp",sepa_payout_provider_authorized:true};
const stripe={provider:"stripe_connect",stripe_operator_funding_approved:true,
  stripe_balance_verified_funded:true,connect_recipient_verified:true};

test("default preview blocks any payout despite valid accounting evidence",()=>{
 const p=assessAudiotelSvaPayout(candidate());
 assert.equal(p.status,"blocked");
 assert.match(p.reason,/provider_not_chosen/);
 assert.equal(p.transfer_authorized,false);
 assert.equal(p.booking_authorized,false);
 assert.equal(p.payout_status,"not_paid");
});
test("an independently approved PSP only makes the preview eligible for final review",()=>{
 const p=assessAudiotelSvaPayout(candidate(),sepa);
 assert.equal(p.status,"ready_for_independent_execution_review");
 assert.equal(p.amount_minor,15000);
 assert.equal(p.preview_only,true);
 assert.equal(p.external_request_sent,false);
});
test("Stripe balance must demonstrably support operator-funded payouts",()=>{
 const blocked=assessAudiotelSvaPayout(candidate(),{provider:"stripe_connect",connect_recipient_verified:true});
 assert.equal(blocked.status,"blocked");
 assert.match(blocked.reason,/stripe_external_funding_or_recipient_not_approved/);
 const permitted=assessAudiotelSvaPayout(candidate(),stripe);
 assert.equal(permitted.status,"ready_for_independent_execution_review");
 assert.equal(permitted.transfer_authorized,false);
});
test("missing bank receipt or accounting confirmation blocks despite a computed entitlement",()=>{
 const i=candidate({evidence:{...evidence(),operator_cash_received_in_bank:false},verified_allocated_cash_minor:0});
 const p=assessAudiotelSvaPayout(i,sepa);
 assert.equal(p.status,"blocked");
 assert.match(p.reason,/operator_cash_received_in_bank/);
 assert.match(p.reason,/cash_not_fully_available/);
});
test("holds and prior payments are deducted once with exact integer-cents arithmetic",()=>{
 const p=assessAudiotelSvaPayout(candidate({
  publisher_entitlement_minor:17854,hold_minor:2250,authorized_offset_minor:301,
  already_paid_minor:5000,verified_allocated_cash_minor:10303
 }),sepa);
 assert.equal(p.amount_minor,10303);
 assert.equal(p.status,"ready_for_independent_execution_review");
});
test("amounts cannot be negative, fractional, greater than entitlement or unsafe",()=>{
 for(const x of [
  {hold_minor:-1},{already_paid_minor:0.4},{publisher_entitlement_minor:Number.MAX_SAFE_INTEGER+1},
  {publisher_entitlement_minor:100,hold_minor:101},
  {publisher_entitlement_minor:100,already_paid_minor:101},
  {publisher_entitlement_minor:0,hold_minor:Number.MAX_SAFE_INTEGER,authorized_offset_minor:1}
 ])assert.throws(()=>assessAudiotelSvaPayout(candidate(x),sepa));
});
test("recent destination change and risk flags block",()=>{
 for(const flag of ["iban_changed_recently","overdue_chargeback","negative_balance","distribution_locked"]){
  const p=assessAudiotelSvaPayout(candidate({[flag]:true}),sepa);
  assert.equal(p.status,"blocked",flag);
 }
});
test("cross-business data, unsupported currencies and absent IDs fail closed",()=>{
 for(const x of [
  {business_unit:"direct_sva"},{currency:"USD"},{tenant_id:"other"},
  {settlement_reference:"?"},{period_reference:""}, {evidence:null}
 ]){
  if("evidence" in x){const p=assessAudiotelSvaPayout(candidate(x),sepa);assert.equal(p.status,"blocked");}
  else assert.throws(()=>assessAudiotelSvaPayout(candidate(x),sepa));
 }
});
test("zero liability never generates a transfer",()=>{
 const p=assessAudiotelSvaPayout(candidate({
  publisher_entitlement_minor:5000,already_paid_minor:5000,verified_allocated_cash_minor:0
 }),sepa);
 assert.equal(p.amount_minor,0);
 assert.equal(p.status,"no_payout_due");
 assert.equal(p.transfer_authorized,false);
});
test("batch fingerprints detect duplicate liabilities, not just repeated provider calls",()=>{
 const a=candidate(),b=candidate({publisher_entitlement_minor:14000});
 const batch=previewAudiotelSvaPayoutBatch([a,b],sepa);
 assert.equal(batch[0].status,"ready_for_independent_execution_review");
 assert.equal(batch[1].status,"blocked");
 assert.equal(batch[1].reason,"duplicate_settlement_in_batch");
 assert.equal(batch[0].settlement_fingerprint,batch[1].settlement_fingerprint);
});
test("no undocumented provider can activate money movement",()=>{
 assert.throws(()=>assessAudiotelSvaPayout(candidate(),{provider:"unknown"}));
 assert.throws(()=>previewAudiotelSvaPayoutBatch(Array.from({length:1001},()=>candidate()),sepa));
});
