/**
 * Audiotel Premium Pro only: fail-closed operator number order assessment.
 * This module NEVER calls carriers, SIP, Stripe, Neon or a payout provider.
 * A number can only be assigned by the legally authorized assigning operator.
 */
import {createHash} from "node:crypto";
export const APP_ORDER_STEPS=Object.freeze([
 ["customer_identity",["kyb_provider","compliance_officer"]],
 ["service_eligibility",["compliance_officer"]],
 ["commercial_contract",["signature_provider","contract_officer"]],
 ["regulatory_assignor",["carrier_regulatory"]],
 ["operator_contract",["carrier_contract_registry"]],
 ["service_tariff_mgit",["carrier_regulatory","compliance_officer"]],
 ["subscription_entitlement",["verified_billing_journal"]],
 ["destination_approved",["technical_officer"]],
 ["carrier_assignment",["signed_carrier_ack"]],
 ["routing_acceptance",["network_acceptance"]],
 ["independent_release",["release_committee"]]
].map(([key,issuers])=>Object.freeze({key,issuers:Object.freeze(issuers)})));
const fail=code=>{throw Object.assign(new Error(code),{code,status:422});};
const ref=/^[A-Za-z0-9_.:/-]{8,180}$/;
const isObj=x=>x&&typeof x==="object"&&!Array.isArray(x);
const isTenant=x=>/^[1-9][0-9]*$/.test(String(x??""))&&Number.isSafeInteger(Number(x));
function timestamp(x){const t=Date.parse(x);return Number.isFinite(t)?t:NaN;}
function validEvidence(spec,x,now){
  return isObj(x)&&x.state==="verified"&&x.backend_origin_verified===true&&
    spec.issuers.includes(x.issuer)&&ref.test(String(x.reference||""))&&
    Number.isFinite(timestamp(x.verified_at))&&timestamp(x.verified_at)<=now&&
    (x.expires_at==null||(Number.isFinite(timestamp(x.expires_at))&&timestamp(x.expires_at)>now));
}
export function audiotelOrderFingerprint(x={}){
  if(!isTenant(x.tenant_id)||!ref.test(String(x.request_key||""))||
     !["new_number","portability"].includes(x.request_kind)||
     !["081","082","089"].includes(x.category)||
     !isTenant(x.price_version_id))fail("APP_ORDER_INVALID_CONTEXT");
  return createHash("sha256").update(JSON.stringify({
    unit:"audiotel_platform",tenant_id:Number(x.tenant_id),request_key:x.request_key,
    request_kind:x.request_kind,category:x.category,price_version_id:Number(x.price_version_id)
  })).digest("hex");
}
export function evaluateAudiotelOrder(input={},at=new Date()){
  if(!isObj(input)||input.business_unit!=="audiotel_platform")fail("APP_ORDER_WRONG_BUSINESS_UNIT");
  const fingerprint=audiotelOrderFingerprint(input);
  if(input.identity?.authenticated!==true||input.identity?.membership_verified!==true||
     input.identity?.tenant_scope_verified!==true||
     String(input.identity?.tenant_id)!==String(input.tenant_id))fail("APP_ORDER_TENANT_SCOPE_UNVERIFIED");
  const now=at instanceof Date?at.getTime():timestamp(at);
  if(!Number.isFinite(now))fail("APP_ORDER_TIME_INVALID");
  const gates=APP_ORDER_STEPS.map(spec=>Object.freeze({
    key:spec.key,verified:validEvidence(spec,input.evidence?.[spec.key],now)
  }));
  const missing=gates.filter(x=>!x.verified).map(x=>x.key);
  const c=input.carrier,number=String(c?.e164||"");
  const carrierAligned=isObj(c)&&c.assignor_confirmed_by_operator===true&&
    ref.test(String(c.operator_reference||""))&&
    String(c.number_assignment_tenant_id)===String(input.tenant_id)&&
    /^\+33(?:81|82|89)\d{7}$/.test(number)&&("0"+number.slice(3,5))===input.category;
  if(!carrierAligned)missing.push("carrier_number_identity_unverified");
  if(input.request_kind==="portability"&&!(input.portability?.current_operator_consent_verified===true&&
     input.portability?.porting_completed_by_operator===true))missing.push("portability_completion");
  const cancelled=input.cancelled===true||input.rejected===true;
  const onHold=input.fraud_hold===true||input.regulatory_hold===true||input.billing_dispute===true;
  const status=cancelled?"closed":onHold?"on_hold":missing.length?"awaiting_evidence":"independent_release_review";
  return Object.freeze({
    schema_version:"audiotel-order-checklist/1",business_unit:"audiotel_platform",
    request_key:input.request_key,request_fingerprint:fingerprint,
    status,missing:Object.freeze(missing),gates:Object.freeze(gates),
    next_action:cancelled?"closure_review":onHold?"risk_review":missing[0]||"independent_release_review",
    operator_assignment_authorized:false,number_visible_to_customer:false,
    routing_activated:false,payment_processed:false,legal_release_approved:false,
    prepared_for_independent_review:!cancelled&&!onHold&&missing.length===0
  });
}
export const APP_ORDER_EXECUTION_PLAN=Object.freeze([
 ["verify_signed_contract","signature_provider"],["verify_subscription","verified_billing_journal"],
 ["request_carrier_assignment","operator_api_with_idempotency"],
 ["reconcile_carrier_ack","signed_carrier_ack"],["configure_destination","routing_api"],
 ["confirm_inbound_call","network_acceptance"],["approve_publication","independent_release"],
 ["start_cdr_reporting","verified_operator_cdr"]
].map(([key,dependency],index)=>Object.freeze({
  sequence:index+1,key,dependency,execution_enabled:false
})));