/**
 * Audiotel Premium Pro: preparation for two incoming request types.
 * No route imports this module; it is a safe reusable domain policy.
 * Actual portability, numbering, billing, sending and onboarding are NOT enabled.
 * Reuse tenant_portability_requests, app_number_order_intents and existing portals
 * after an independent legal/carrier release, rather than re-implementing them.
 */
import {createHash} from "node:crypto";

export const APP_CASE_KINDS=Object.freeze(["portability","new_number"]);
export const APP_CASE_STAGES=Object.freeze([
  "received","awaiting_documents","eligibility_review","contract_review",
  "operator_packet_prepared","awaiting_operator_agreement","handoff_ready",
  "on_hold","rejected","cancelled"
]);
export const APP_CASE_REQUIRED_PROOFS=Object.freeze({
  portability:Object.freeze([
    "contact_verified","business_identity_verified","holder_or_mandate_verified",
    "existing_number_verified","sva_tariff_verified","rio_securely_verified",
    "service_contract_signed","carrier_portability_terms_verified",
    "route_configuration_prepared"
  ]),
  new_number:Object.freeze([
    "contact_verified","business_identity_verified","service_eligibility_verified",
    "service_contract_signed","arcep_numbering_rights_verified",
    "stock_reservability_verified","carrier_network_opening_verified",
    "route_configuration_prepared"
  ])
});
const TRANSITIONS=Object.freeze({
  received:["awaiting_documents","eligibility_review","on_hold","rejected","cancelled"],
  awaiting_documents:["eligibility_review","on_hold","rejected","cancelled"],
  eligibility_review:["awaiting_documents","contract_review","on_hold","rejected","cancelled"],
  contract_review:["awaiting_documents","operator_packet_prepared","on_hold","rejected","cancelled"],
  operator_packet_prepared:["awaiting_documents","awaiting_operator_agreement","on_hold","rejected","cancelled"],
  awaiting_operator_agreement:["awaiting_documents","handoff_ready","on_hold","rejected","cancelled"],
  handoff_ready:["on_hold","cancelled"],
  on_hold:["awaiting_documents","eligibility_review","rejected","cancelled"],
  rejected:[],cancelled:[]
});
const REF=/^[A-Za-z0-9_.:/-]{8,180}$/;
const KEY=/^[A-Za-z0-9_.:-]{16,180}$/;
const HEX=/^[0-9a-f]{64}$/;
const DOC_KINDS=Object.freeze([
  "business_registration","holder_mandate","existing_invoice",
  "rio_reference","contract","kyb_report","operator_ack",
  "tariff_evidence","route_acceptance","other_verified_reference"
]);
const DOC_TYPES=new Set(DOC_KINDS);
const ALLOWED_CASE_FIELDS=new Set(["request_key","kind","category","country_code",
  "number","secure_contact_ref","source_operator_label","source_operator_ref"]);
const ALLOWED_DOC_FIELDS=new Set(["kind","secure_object_ref","sha256","retention_until"]);
const isObject=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const error=(code,status=422)=>{throw Object.assign(new Error(code),{code,status});};
function validRef(value,code){
  const s=String(value??"").trim();
  if(!REF.test(s))error(code);
  return s;
}
function validKey(value){
  const s=String(value??"").trim();
  if(!KEY.test(s))error("APP_CASE_IDEMPOTENCY_KEY_INVALID");
  return s;
}
function dateOnly(value){
  if(typeof value!=="string"||!/^20\d\d-\d\d-\d\d$/.test(value))error("APP_CASE_RETENTION_DATE_INVALID");
  const dt=new Date(value+"T00:00:00Z");
  if(!Number.isFinite(dt.getTime())||dt.toISOString().slice(0,10)!==value)
    error("APP_CASE_RETENTION_DATE_INVALID");
  return value;
}

export function normalizeFrenchSvaNumber(value){
  const s=String(value??"").trim().replace(/[ .()-]/g,"");
  const e164=/^0(8[129]\d{7})$/.test(s)?"+33"+s.slice(1):s;
  if(!/^\+338[129]\d{7}$/.test(e164))error("APP_CASE_NOT_FRENCH_PREMIUM_SVA");
  return e164;
}

export function normalizePreparedAppCase(input={}){
  if(!isObject(input)||Object.keys(input).some(k=>!ALLOWED_CASE_FIELDS.has(k)))
    error("APP_CASE_INPUT_NOT_ALLOWED");
  const kind=String(input.kind??"");
  if(!APP_CASE_KINDS.includes(kind))error("APP_CASE_KIND_INVALID");
  if(input.country_code!=="FR")error("APP_CASE_FR_ONLY");
  // The existing public form records intent only. Neither SVA number nor
  // tariff category is supplied before the secure subsequent step.
  const category=input.category==null||input.category===""?null:String(input.category);
  if(category!==null&&!["081","082","089"].includes(category))error("APP_CASE_CATEGORY_INVALID");
  const request_key=validKey(input.request_key);
  const secure_contact_ref=validRef(input.secure_contact_ref,"APP_CASE_CONTACT_REF_INVALID");
  let requested_e164=null;
  if(kind==="portability"&&input.number!==undefined&&input.number!==null&&input.number!==""){
    requested_e164=normalizeFrenchSvaNumber(input.number);
    if(category!==null&&"0"+requested_e164.slice(3,5)!==category)
      error("APP_CASE_CATEGORY_NUMBER_MISMATCH");
  }else if(kind==="new_number"&&input.number!==undefined&&input.number!==null&&input.number!==""){
    error("APP_CASE_NEW_NUMBER_CANNOT_PREASSIGN");
  }
  // Operator name is unverified applicant data: never infer rights from it.
  const source_operator_label=String(input.source_operator_label??"").trim();
  if(source_operator_label.length>90||/[<>\x00-\x1f]/.test(source_operator_label))
    error("APP_CASE_OPERATOR_LABEL_INVALID");
  const source_operator_ref=input.source_operator_ref==null?null:
    validRef(input.source_operator_ref,"APP_CASE_OPERATOR_REF_INVALID");
  return Object.freeze({
    business_unit:"audiotel_platform",country_code:"FR",kind,category,
    request_key,requested_e164,secure_contact_ref,source_operator_label,source_operator_ref
  });
}

export function fingerprintPreparedAppCase(normalized){
  if(!isObject(normalized)||normalized.business_unit!=="audiotel_platform")
    error("APP_CASE_INVALID_NORMALIZED_SCOPE");
  return createHash("sha256").update(JSON.stringify([
    normalized.business_unit,normalized.country_code,normalized.kind,
    normalized.category,normalized.request_key,normalized.requested_e164,
    normalized.secure_contact_ref
  ])).digest("hex");
}

export function prepareAppCaseDocument(input={}){
  if(!isObject(input)||Object.keys(input).some(x=>!ALLOWED_DOC_FIELDS.has(x)))
    error("APP_CASE_DOCUMENT_UNEXPECTED_FIELD");
  if(!DOC_TYPES.has(input.kind))error("APP_CASE_DOCUMENT_KIND_INVALID");
  const secure_object_ref=validRef(input.secure_object_ref,"APP_CASE_DOCUMENT_REF_INVALID");
  const sha256=String(input.sha256||"").toLowerCase();
  if(!HEX.test(sha256))error("APP_CASE_DOCUMENT_SHA_INVALID");
  const retention_until=dateOnly(input.retention_until);
  return Object.freeze({
    kind:input.kind,secure_object_ref,sha256,retention_until,
    // Never include document bytes, raw RIO, secrets, identity scans or phone contacts.
    review_status:"unverified",download_url:null
  });
}

export function assessPreparedCaseTransition({kind,current_stage,next_stage,proofs={},
  actor,external_acknowledgment=false}={}){
  if(!APP_CASE_KINDS.includes(kind)||!APP_CASE_STAGES.includes(current_stage)||
    !APP_CASE_STAGES.includes(next_stage))error("APP_CASE_STAGE_INVALID");
  if(!isObject(actor)||actor.authenticated!==true||
    actor.business_unit!=="audiotel_platform"||
    actor.staff_casework_authorized!==true||
    !["caseworker","administrator"].includes(actor.role))
    error("APP_CASE_STAFF_AUTHORIZATION_REQUIRED",403);
  if(!TRANSITIONS[current_stage].includes(next_stage))
    error("APP_CASE_TRANSITION_FORBIDDEN",409);
  if(!isObject(proofs))error("APP_CASE_PROOFS_INVALID");
  const allowed=APP_CASE_REQUIRED_PROOFS[kind];
  if(Object.keys(proofs).some(x=>!allowed.includes(x)))error("APP_CASE_UNKNOWN_PROOF");
  const completed=allowed.filter(x=>proofs[x]===true);
  const missing=allowed.filter(x=>proofs[x]!==true);
  // Applicant-input flags never authorize network operations.
  const completionPending=next_stage==="handoff_ready";
  const canMarkHandoff=completionPending&&missing.length===0&&
    external_acknowledgment===true;
  if(completionPending&&!canMarkHandoff)
    error("APP_CASE_OPERATOR_HANDOFF_EVIDENCE_MISSING",409);
  return Object.freeze({
    business_unit:"audiotel_platform",kind,
    previous_stage:current_stage,next_stage,
    documented_proofs:Object.freeze(completed),pending_proofs:Object.freeze(missing),
    operator_handoff_preparation_complete:canMarkHandoff,
    may_call_external_operator:false,may_assign_number:false,may_cutover_portability:false,
    may_enable_routing:false,may_create_client_login:false,may_bill:false,
    may_send_email:false,requires_owner_go_live_authorization:true
  });
}

const NOTIFICATION_TEMPLATES=Object.freeze({
  received:"dossier_recu",
  awaiting_documents:"pieces_complementaires_requises",
  eligibility_review:"etude_eligibilite",
  contract_review:"validation_contractuelle",
  operator_packet_prepared:"dossier_technique_prepare",
  awaiting_operator_agreement:"accord_operateur_attendu",
  handoff_ready:"dossier_pret_examen_final",
  on_hold:"dossier_suspendu",
  rejected:"dossier_refuse",
  cancelled:"demande_annulee"
});

export function planPreparedCaseNotification({case_reference,kind,stage}={}){
  validRef(case_reference,"APP_CASE_REFERENCE_INVALID");
  if(!APP_CASE_KINDS.includes(kind)||!APP_CASE_STAGES.includes(stage))
    error("APP_CASE_NOTIFICATION_STAGE_INVALID");
  return Object.freeze({
    case_reference,business_unit:"audiotel_platform",kind,template_key:NOTIFICATION_TEMPLATES[stage],
    // Recipient is resolved only by an authenticated contact provider in the future.
    recipient:null,dispatch_state:"not_authorized",send_enabled:false,
    transactional_only:true,marketing:false,
    resend_called:false,hubspot_called:false,external_event_dispatched:false
  });
}

export function publicPreparedCaseView(row={},context={}){
  if(!isObject(row)||!isObject(context)||
    context.authenticated!==true||
    context.business_unit!=="audiotel_platform"||
    (context.tenant_id==null||String(context.tenant_id)!==String(row.tenant_id))||
    context.customer_case_access_verified!==true)
    error("APP_CASE_TENANT_ACCESS_DENIED",403);
  return Object.freeze({
    case_reference:row.public_reference,
    kind:row.kind,status:row.stage,
    number:row.requested_e164??null,
    missing_documents:Array.isArray(row.missing_document_kinds)
      ?row.missing_document_kinds.filter(x=>DOC_TYPES.has(x)):[],
    created_at:row.created_at,
    updated_at:row.updated_at,
    activation_status:"not_activated",
    financial_status:"no_real_revenue",
    routing_status:"not_activated",
    // Never expose raw RIO, document storage location, contacts, carrier secrets,
    // financial margins or records belonging to other tenants.
  });
}

export const APP_PORTABILITY_CUTOVER_GUARDS=Object.freeze([
  "operator_contract_signed","holder_authorization_verified",
  "rio_verified_using_current_arcep_rules","carrier_acceptance_authenticated",
  "portability_effective_confirmation","network_routing_confirmed",
  "test_calls_fixed_and_mobile_passed","cdr_mapping_confirmed",
  "tenant_isolation_verified","financial_and_compliance_release_approved"
]);

export function planPortabilityCutover({case_reference,confirmed_checks={}}={}){
  validRef(case_reference,"APP_CASE_REFERENCE_INVALID");
  if(!isObject(confirmed_checks)||Object.keys(confirmed_checks).some(
    x=>!APP_PORTABILITY_CUTOVER_GUARDS.includes(x)))error("APP_CUTOVER_CHECK_INVALID");
  const pending=APP_PORTABILITY_CUTOVER_GUARDS.filter(x=>confirmed_checks[x]!==true);
  return Object.freeze({
    case_reference,missing_checks:Object.freeze(pending),
    human_review_required:true,
    evidence_from_untrusted_local_state:true,
    network_cutover_authorized:false,
    number_ported:false,
    number_assignment_executed:false,
    client_activation_authorized:false,
    next_action:pending[0]||"independent_network_acceptance_and_explicit_go"
  });
}
