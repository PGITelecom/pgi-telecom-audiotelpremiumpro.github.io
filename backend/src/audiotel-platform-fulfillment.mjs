/**
 * APP fulfillment planning only. An operator API acknowledgement plus network
 * acceptance and independent release are mandatory before customer delivery.
 * Never provisions anything or changes a telephone route.
 */
const STAGES=Object.freeze([
 ["check_stock","trusted_carrier_inventory","bounded_retry"],
 ["reserve_intent","operator_reservation_reference","reconcile_idempotency"],
 ["confirm_assignment","authenticated_carrier_assignment","manual_review"],
 ["configure_route","routing_receipt","route_rollback"],
 ["verify_inbound_call","acceptance_call_receipt","block_activation"],
 ["release_to_customer","independent_release_review","keep_number_hidden"],
 ["enable_reporting","cdr_ingestion_heartbeat","incident_review"]
].map(([key,required_evidence,on_failure],i)=>Object.freeze({
 sequence:i+1,key,required_evidence,on_failure
})));
const fail=code=>{throw Object.assign(new Error(code),{code,status:422});};
const ref=s=>typeof s==="string"&&/^[A-Za-z0-9_.:/-]{8,180}$/.test(s);
export function planAudiotelFulfillment({order,carrier}={}){
 if(order?.business_unit!=="audiotel_platform"||!ref(order.request_key)||
    !["081","082","089"].includes(order.category))fail("APP_FULFILLMENT_ORDER_INVALID");
 const missing=[];
 if(carrier?.assignor_eligibility_verified!==true||!ref(carrier?.operator_reference))
   missing.push("authoritative_assignor");
 if(carrier?.api_supported!==true||carrier?.idempotency_supported!==true)
   missing.push("carrier_api_and_idempotency");
 if(carrier?.inventory_fresh!==true)missing.push("authoritative_number_stock");
 for(const [flag,key] of [
  ["identity_verified","kyb"],["service_eligibility_verified","service_eligibility"],
  ["signed_contract_verified","signed_contract"],["subscription_entitlement_verified","billing_entitlement"],
  ["destination_verified","destination"],["tariff_notice_verified","tariff_notice"]
 ])if(order[flag]!==true)missing.push(key);
 return Object.freeze({
  schema_version:"audiotel-fulfillment-plan/1",business_unit:"audiotel_platform",
  request_key:order.request_key,missing:Object.freeze(missing),
  stages:Object.freeze(STAGES.map(x=>Object.freeze({...x,dispatch_authorized:false,executed:false}))),
  ready_for_manual_review:missing.length===0,
  operator_call_executed:false,number_reserved:null,number_assigned:null,
  visible_in_customer_portal:false,active:false
 });
}
export function planAudiotelFailureRecovery(x={}){
 if(!["timeout","rate_limit","conflict","inventory_empty","operator_rejection",
       "fraud_hold","sip_failed","test_call_failed"].includes(x.kind))
    fail("APP_UNKNOWN_FAILURE_MODE");
 if(!Number.isSafeInteger(x.attempts)||x.attempts<0||x.attempts>1000)
    fail("APP_FAILURE_ATTEMPT_COUNT_INVALID");
 const reversible=["timeout","rate_limit"].includes(x.kind),assigned=x.number_assigned===true;
 const retry=reversible&&!assigned&&x.attempts<3&&x.carrier_state!=="disconnected";
 return Object.freeze({
  schema_version:"audiotel-failure-recovery/1",
  state:"blocked",reason:x.kind,
  next_action:retry?"retry_same_idempotency_key":"operator_reconciliation_required",
  route_compensation_required:x.route_active===true,
  assigned_number_requires_manual_reconciliation:assigned,
  number_visible_to_customer:false,automatic_refund_executed:false,
  automatic_payout_executed:false
 });
}