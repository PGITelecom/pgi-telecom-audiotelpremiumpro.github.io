/**
 * Audiotel Premium Pro: publisher SVA payout decision PREVIEW ONLY.
 * Upstream operator revenues are distinct from Stripe subscriptions/referrals.
 * Never sends money, creates a Stripe account, journals an entry or marks paid.
 * Final eligibility is subject to provider + legal + fiscal independent review.
 */
import {createHash} from "node:crypto";

const UNIT="audiotel_platform";
const MUST_VERIFY=Object.freeze([
  "operator_statement_verified",
  "operator_cash_received_in_bank",
  "cdr_reconciled",
  "contract_effective",
  "payout_terms_effective",
  "kyb_verified",
  "beneficiary_account_verified",
  "legal_payment_model_approved",
  "tax_and_accounting_approved",
  "ledger_reconciled",
  "sanctions_risk_clear",
  "disputes_resolved",
  "independent_release_approved"
]);
const digits=n=>Number.isSafeInteger(n)&&n>=0;
const keyPart=n=>typeof n==="string"&&/^[a-zA-Z0-9_:/.-]{4,120}$/.test(n);
const positiveId=n=>/^[1-9][0-9]*$/.test(String(n??""))&&Number.isSafeInteger(Number(n));
function fail(code){const error=new Error(code);error.code=code;throw error;}
function cash(n,name){if(!digits(n))fail("APP_PAYOUT_INVALID_"+name);return n;}
function sha(value){return createHash("sha256").update(value).digest("hex");}
function preview(status,reason,amount,ref,checks,channel){
  return Object.freeze({
    schema_version:"app-sva-payout-preview/1",business_unit:UNIT,
    status,reason,amount_minor:amount,currency:"EUR",
    settlement_fingerprint:ref,
    readiness_checks:Object.freeze(checks),
    route:channel,
    preview_only:true,transfer_authorized:false,external_request_sent:false,
    booking_authorized:false,payout_status:"not_paid"
  });
}
/** Each amount is integer euro cents; entitlement is already NET OF contract margin.
 * Provider routing is an explicit approved configuration, never inferred from Stripe subscription connectivity.
 */
export function assessAudiotelSvaPayout(input={},options={}){
  if(input?.business_unit!==UNIT)fail("APP_PAYOUT_WRONG_BUSINESS_UNIT");
  if(!positiveId(input.tenant_id)||!keyPart(input.settlement_reference)||!keyPart(input.period_reference))
    fail("APP_PAYOUT_INVALID_REFERENCE");
  if(input.currency!=="EUR")fail("APP_PAYOUT_CURRENCY_UNSUPPORTED");
  const owed=cash(input.publisher_entitlement_minor,"ENTITLEMENT");
  const held=cash(input.hold_minor,"HOLDS");
  const offset=cash(input.authorized_offset_minor,"OFFSETS");
  const prior=cash(input.already_paid_minor,"PRIOR_PAID");
  const bank=cash(input.verified_allocated_cash_minor,"BANK_ALLOCATION");
  const total=held+offset+prior;
  if(!Number.isSafeInteger(total)||total>owed)fail("APP_PAYOUT_INCONSISTENT_LEDGER");
  const amount=owed-total;
  const fingerprint=sha([UNIT,input.tenant_id,input.settlement_reference,input.period_reference,"EUR"].join("|"));
  const checks=MUST_VERIFY.map(name=>Object.freeze({key:name,verified:input.evidence?.[name]===true}));
  const missing=checks.filter(x=>!x.verified).map(x=>x.key);
  if(bank<amount)missing.push("cash_not_fully_available");
  if(input.overdue_chargeback===true||input.negative_balance===true||input.iban_changed_recently===true)
    missing.push("active_financial_risk");
  if(input.distribution_locked===true)missing.push("distribution_locked");
  const provider=String(options.provider||"none");
  if(!["none","stripe_connect","sepa_psp"].includes(provider))fail("APP_PAYOUT_PROVIDER_INVALID");
  if(provider==="none")missing.push("provider_not_chosen");
  if(provider==="stripe_connect"){
    // Operator receipts are not Stripe card-payment receipts.
    // France: external Stripe balance top-ups currently require confirmation/approval.
    if(options.stripe_operator_funding_approved!==true||
      options.stripe_balance_verified_funded!==true||
      options.connect_recipient_verified!==true)
      missing.push("stripe_external_funding_or_recipient_not_approved");
  }
  if(provider==="sepa_psp"&&options.sepa_payout_provider_authorized!==true)
    missing.push("sepa_provider_not_authorized");
  const route=provider==="none"?null:provider;
  if(amount===0)return preview("no_payout_due","zero_balance",0,fingerprint,checks,route);
  return preview(missing.length?"blocked":"ready_for_independent_execution_review",
    missing.length?missing.join(","):"eligible_preview_not_an_authorization",
    amount,fingerprint,checks,route);
}
/** Prevent duplicate settlements in a preview batch. Actual execution still requires a
 * DB-unique payout ledger, transaction claims, provider idempotency and webhooks.
 */
export function previewAudiotelSvaPayoutBatch(items=[],options={}){
  if(!Array.isArray(items)||items.length>1000)fail("APP_PAYOUT_BATCH_INVALID");
  const seen=new Set();
  return Object.freeze(items.map(item=>{
    const p=assessAudiotelSvaPayout(item,options);
    if(seen.has(p.settlement_fingerprint))
      return preview("blocked","duplicate_settlement_in_batch",p.amount_minor,p.settlement_fingerprint,p.readiness_checks,p.route);
    seen.add(p.settlement_fingerprint);
    return p;
  }));
}
export const APP_PAYOUT_REQUIRED_EVIDENCE=MUST_VERIFY;
