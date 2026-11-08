/**
 * Audiotel Premium Pro: evidence register for the entire operator chain.
 * PREPARATION-ONLY. No I/O, external API, database, SIP, Stripe or payouts.
 *
 * Even a fully populated snapshot is NOT an independent live verification and
 * NEVER permits number activation, payments, publishing or deployments.
 * This is deliberately separate from `direct_sva` and `evaluateAudiotelOrder`.
 */

export const TELECOM_CHAIN_GATE_SPEC=Object.freeze([
  ["regulatory","legal_operator_entity","legal_officer"],
  ["regulatory","arcep_ce_identity","arcep"],
  ["regulatory","arcep_numbering_rights","arcep"],
  ["regulatory","af2m_sva_compliance","af2m"],
  ["regulatory","payment_services_legal_model","legal_officer"],
  ["regulatory","publisher_eligibility_policy","compliance_officer"],
  ["wholesale","direct_professional_payout_negotiated","carrier_contract_registry"],
  ["wholesale","carrier_wholesale_agreement","carrier_contract_registry"],
  ["wholesale","network_opening_confirmed","carrier_network"],
  ["wholesale","tariff_and_collection_schedule","carrier_finance"],
  ["voice","sbc_primary_acceptance","network_officer"],
  ["voice","sbc_secondary_acceptance","network_officer"],
  ["voice","sip_rtp_end_to_end","carrier_network"],
  ["voice","mgit_and_tariff_message","compliance_officer"],
  ["voice","tenant_routing_isolation","security_officer"],
  ["voice","portability_procedure","carrier_regulatory"],
  ["data","freeswitch_cdr_integrity","technical_officer"],
  ["data","carrier_cdr_correlation","carrier_data"],
  ["data","monitoring_and_incidents","network_officer"],
  ["data","disaster_recovery","security_officer"],
  ["financial","operator_statement_verified","carrier_finance"],
  ["financial","bank_receipt_verified","bank_feed"],
  ["financial","publisher_terms_and_kyb","compliance_officer"],
  ["financial","direct_payout_or_refusal_alternatives_review","legal_officer"],
  ["financial","ledger_and_psp_controls","legal_officer"],
  ["commercial","customer_consent_and_isolation","security_officer"],
  ["commercial","independent_release_review","release_committee"]
].map(([group,key,issuer])=>Object.freeze({group,key,issuer})));

const BUSINESS_UNIT="audiotel_platform";
const REF=/^[A-Za-z0-9_.:/-]{8,180}$/;
const HEX=/^[0-9a-f]{64}$/i;
const allowedFields=new Set(["issuer","reference","verified_at","valid_until","document_sha256","review_status"]);
const isObject=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const dateValue=x=>{
  if(typeof x!=="string"||!/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(x))return NaN;
  return Date.parse(x);
};

function assessReference(spec,evidence,now){
  if(!isObject(evidence))return "missing_document_reference";
  if(Object.keys(evidence).some(key=>!allowedFields.has(key)))return "unexpected_evidence_field";
  if(evidence.review_status!=="documented")return "not_documented";
  if(evidence.issuer!==spec.issuer)return "wrong_issuer";
  if(typeof evidence.reference!=="string"||!REF.test(evidence.reference))return "invalid_reference";
  if(typeof evidence.document_sha256!=="string"||!HEX.test(evidence.document_sha256))
    return "missing_document_digest";
  const at=dateValue(evidence.verified_at);
  if(!Number.isFinite(at)||at>now)return "invalid_verification_date";
  if(evidence.valid_until!=null){
    const expires=dateValue(evidence.valid_until);
    if(!Number.isFinite(expires)||expires<=now)return "expired_document";
  }
  return null;
}

export function assessAudiotelTelecomChain(input={},at=new Date()){
  if(!isObject(input)||input.business_unit!==BUSINESS_UNIT){
    throw Object.assign(new Error("APP_CHAIN_WRONG_BUSINESS_UNIT"),{code:"APP_CHAIN_WRONG_BUSINESS_UNIT",status:422});
  }
  if(Object.keys(input).some(k=>!["business_unit","evidence"].includes(k))){
    throw Object.assign(new Error("APP_CHAIN_UNKNOWN_FIELD"),{code:"APP_CHAIN_UNKNOWN_FIELD",status:422});
  }
  const evidence=input.evidence??{};
  if(!isObject(evidence)){
    throw Object.assign(new Error("APP_CHAIN_INVALID_EVIDENCE"),{code:"APP_CHAIN_INVALID_EVIDENCE",status:422});
  }
  const known=new Set(TELECOM_CHAIN_GATE_SPEC.map(g=>g.key));
  if(Object.keys(evidence).some(k=>!known.has(k))){
    throw Object.assign(new Error("APP_CHAIN_UNKNOWN_GATE"),{code:"APP_CHAIN_UNKNOWN_GATE",status:422});
  }
  const when=at instanceof Date?at.getTime():dateValue(at);
  if(!Number.isFinite(when)){
    throw Object.assign(new Error("APP_CHAIN_INVALID_TIME"),{code:"APP_CHAIN_INVALID_TIME",status:422});
  }
  const gates=TELECOM_CHAIN_GATE_SPEC.map(spec=>{
    const reason=assessReference(spec,Object.hasOwn(evidence,spec.key)?evidence[spec.key]:null,when);
    return Object.freeze({group:spec.group,key:spec.key,
      status:reason?"pending":"reference_documented",reason});
  });
  const missing=gates.filter(x=>x.status!=="reference_documented");
  const groups=[...new Set(TELECOM_CHAIN_GATE_SPEC.map(x=>x.group))].map(group=>{
    const own=gates.filter(x=>x.group===group);
    return Object.freeze({group,documented:own.filter(x=>x.status==="reference_documented").length,
      required:own.length});
  });
  return Object.freeze({
    schema_version:"audiotel-telecom-chain-preparation/1",
    business_unit:BUSINESS_UNIT,source:"untrusted_document_reference_register",
    current_stage:missing.length?"evidence_collection":"independent_live_review_required",
    documented_count:gates.length-missing.length,required_count:gates.length,
    groups:Object.freeze(groups),gates:Object.freeze(gates),
    missing:Object.freeze(missing.map(x=>x.key)),
    // A locally documented ref/digest is NOT proof of real operating rights or live calls.
    external_sources_authenticated:false,
    actual_arcep_rights_verified:false,physical_sip_acceptance_verified:false,
    carrier_cdr_bank_reconciliation_verified:false,
    direct_payout_contract_approved:false,professional_iban_payout_enabled:false,
    operational_telecom_chain_ready:false,
    number_assignment_authorized:false,commercial_activation_authorized:false,
    bank_transfer_authorized:false,psp_payout_authorized:false,
    vercel_deployment_authorized:false,neon_migration_authorized:false,
    git_merge_authorized:false,external_purchase_authorized:false,
    next_action:missing[0]?.key||"obtain_independent_live_operator_acceptance_and_explicit_owner_release"
  });
}
