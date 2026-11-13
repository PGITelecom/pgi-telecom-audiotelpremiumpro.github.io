/**
 * Non-executable interface definitions for operator/CDR and finance adapters.
 * The existing Stripe Billing and Stripe Connect modules are REUSED after a
 * later, independently authorized release, rather than copied here.
 *
 * Never import a bank SDK, fetch URL, sign JWT, create credentials or send
 * operator/Stripe/Revolut requests from these preparation-only ports.
 */
import {createHash} from "node:crypto";
import {planAudiotelFinancialProviderAdapter} from "./audiotel-financial-cycle-prelaunch.mjs";

const UNIT="audiotel_platform";
const HEX=/^[0-9a-f]{64}$/;
const REF=/^[A-Za-z0-9_.:/-]{8,180}$/;
const allowedFeed=new Set(["carrier_cdr","carrier_statement","carrier_payment_advice",
 "operator_portability_status","partner_direct_payment_receipt","psp_payment_receipt",
 "bank_transaction","stripe_subscription","stripe_refund"]);
const allowedTransport=new Set(["signed_https_webhook","signed_sftp_file",
 "mutual_tls_api","verified_psp_api","stripe_verified_webhook"]);
const msg=(code)=>{throw Object.assign(new Error("APP_ADAPTER_"+code),{code:"APP_ADAPTER_"+code,status:422});};
const obj=v=>v&&typeof v==="object"&&!Array.isArray(v);
const digest=v=>createHash("sha256").update(JSON.stringify(v)).digest("hex");

/** Returns an ingestion envelope, NOT an authenticated CDR or ledger entry. */
export function planAudiotelInboundAdapter(input={}){
 if(!obj(input)||Object.keys(input).some(k=>![
  "business_unit","feed_kind","transport","provider_reference",
  "source_reference","document_sha256","currency"].includes(k)))
  msg("INVALID_INPUT");
 if(input.business_unit!==UNIT||!allowedFeed.has(input.feed_kind)||
    !allowedTransport.has(input.transport)||input.currency!=="EUR"||
    !REF.test(input.provider_reference)||!REF.test(input.source_reference)||
    !HEX.test(input.document_sha256))msg("INVALID_FEED");
 const key=digest([UNIT,input.feed_kind,input.provider_reference,
  input.source_reference,input.document_sha256]);
 return Object.freeze({
  business_unit:UNIT,feed_kind:input.feed_kind,transport:input.transport,
  provider_reference:input.provider_reference,
  source_reference:input.source_reference,
  document_sha256:input.document_sha256,
  deduplication_fingerprint:key,
  expected_credentials_in_secret_manager:true,
  real_authenticator_registered:false,signature_verified:false,
  source_authoritative:false,import_status:"disabled",
  network_operation_enabled:false,finance_recognition_enabled:false,
  queue_dispatch_enabled:false,provider_called:false
 });
}

export const AUDIOTEL_PAYMENT_CONNECTOR_POLICY=Object.freeze({
 stripe_billing:Object.freeze({
  use_existing_module:"backend/src/stripe-billing.mjs",
  allowed_future_scope:"Audiotel subscription invoices, refunds and card payments",
  sva_minutes_as_stripe_invoices:false,
  third_party_payouts_automatically_permitted:false
 }),
 stripe_connect:Object.freeze({
  use_existing_module:"backend/src/stripe-connect.mjs",
  allowed_future_scope:"Only a separately authorized Connect funds flow",
  requires_provider_contract_and_legal_review:true,
  current_publisher_payouts_enabled:false
 }),
 revolut_business:Object.freeze({
  use_existing_module:null,
  future_interface:"Business API counterparties, payment drafts, transaction read and signed webhooks",
  default_money_scope:"audiotel_own_funds_only",
  regulated_third_party_money_authorized:false,
  current_publisher_payouts_enabled:false
 }),
 carrier_direct:Object.freeze({
  use_existing_module:"backend/src/portability-automation.mjs",
  future_interface:"Carrier contract-specific payment statement, CDR and direct beneficiary advice",
  current_publisher_payouts_enabled:false,
  network_opening_enabled:false
 })
});

/** The output can be shown to staff but is NEVER a provider API request. */
export function planAudiotelOutboundAdapter(input={}){
 if(!obj(input)||Object.keys(input).some(k=>![
  "business_unit","provider","settlement_reference","beneficiary_reference",
  "amount_minor","idempotency_reference"].includes(k)))msg("INVALID_OUTBOUND");
 const result=planAudiotelFinancialProviderAdapter(input);
 return Object.freeze({
  ...result,
  // Never return JSON payload suitable for a real bank transfer.
  financial_model_legal_review_required:true,
  provider_account_owner_verified:false,
  account_permissions_verified:false,
  duplicate_execution_prevented_by_provider:false,
  bank_coordinates:null,payment_api_payload:null,
  request_method:null,request_url:null,authorization_header:null,
  internal_test_only:true,can_dispatch:false
 });
}
