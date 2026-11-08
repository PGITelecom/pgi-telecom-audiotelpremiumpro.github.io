import test from "node:test";
import assert from "node:assert/strict";
import {
 planAudiotelInboundAdapter,planAudiotelOutboundAdapter,
 AUDIOTEL_PAYMENT_CONNECTOR_POLICY
} from "../backend/src/audiotel-financial-provider-ports.mjs";

const inbound={
 business_unit:"audiotel_platform",feed_kind:"carrier_cdr",
 transport:"signed_sftp_file",provider_reference:"OPERATOR-FR-0001",
 source_reference:"CDR-FILE-20261108",document_sha256:"a".repeat(64),currency:"EUR"
};

test("operator CDR import is a signed-feed design contract, not a trusted live import",()=>{
 const p=planAudiotelInboundAdapter(inbound);
 assert.equal(p.signature_verified,false);
 assert.equal(p.source_authoritative,false);
 assert.equal(p.network_operation_enabled,false);
 assert.equal(p.finance_recognition_enabled,false);
 assert.equal(p.provider_called,false);
 assert.match(p.deduplication_fingerprint,/^[a-f0-9]{64}$/);
 assert.deepEqual(p,planAudiotelInboundAdapter(inbound));
});
test("untrusted bank CDR and verification claim are rejected before import",()=>{
 assert.throws(()=>planAudiotelInboundAdapter({...inbound,
   business_unit:"direct_sva"}),{code:"APP_ADAPTER_INVALID_FEED"});
 assert.throws(()=>planAudiotelInboundAdapter({...inbound,
   signature_verified:true}),{code:"APP_ADAPTER_INVALID_INPUT"});
 assert.throws(()=>planAudiotelInboundAdapter({...inbound,
   transport:"unsigned_csv"}),{code:"APP_ADAPTER_INVALID_FEED"});
});
test("Stripe Billing stays for own subscriptions, not automatically SVA third-party revenue",()=>{
 assert.equal(AUDIOTEL_PAYMENT_CONNECTOR_POLICY.stripe_billing.use_existing_module,
  "backend/src/stripe-billing.mjs");
 assert.equal(AUDIOTEL_PAYMENT_CONNECTOR_POLICY.stripe_billing.sva_minutes_as_stripe_invoices,false);
 assert.equal(AUDIOTEL_PAYMENT_CONNECTOR_POLICY.stripe_connect.current_publisher_payouts_enabled,false);
 assert.equal(AUDIOTEL_PAYMENT_CONNECTOR_POLICY.revolut_business.regulated_third_party_money_authorized,false);
});
test("Revolut Business and carrier payee ports never contain executable payment payloads",()=>{
 for(const provider of ["carrier_direct","regulated_psp","stripe_connect","revolut_own_funds"]){
  const p=planAudiotelOutboundAdapter({
    business_unit:"audiotel_platform",provider,
    settlement_reference:"STATEMENT-001",
    beneficiary_reference:"PUBLISHER-001",
    amount_minor:1194,idempotency_reference:"APP-CYCLE-RETRY-0001"
  });
  assert.equal(p.can_dispatch,false);
  assert.equal(p.payment_api_payload,null);
  assert.equal(p.request_url,null);
  assert.equal(p.bank_coordinates,null);
  assert.equal(p.provider_account_owner_verified,false);
  assert.equal(p.duplicate_execution_prevented_by_provider,false);
  assert.equal(p.external_adapter_connected,false);
 }
 assert.throws(()=>planAudiotelOutboundAdapter({
  business_unit:"audiotel_platform",provider:"revolut_own_funds",
  settlement_reference:"STATEMENT-001",beneficiary_reference:"PUBLISHER-001",
  amount_minor:1194,idempotency_reference:"APP-CYCLE-RETRY-0001",
  bank_iban:"FRXX"
 }),{code:"APP_ADAPTER_INVALID_OUTBOUND"});
});
