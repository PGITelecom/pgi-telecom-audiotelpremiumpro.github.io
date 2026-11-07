// APP customer and carrier incident playbooks, preparation only.
// No API call, refund, email, carrier change or client suspension is made.
const POLICIES=Object.freeze({
  subscription_payment_failed:{severity:"high",owner:"billing",evidence:["signed_payment_event","contract_grace_policy"],actions:["review_entitlement","confirm_retry_policy","draft_private_notice"]},
  carrier_number_unavailable:{severity:"high",owner:"operator",evidence:["authoritative_carrier_incident"],actions:["hold_order","review_alternative"]},
  duplicate_number_conflict:{severity:"critical",owner:"operator",evidence:["authoritative_assignment_register"],actions:["block_second_delivery","independent_reconciliation"]},
  sip_routing_failed:{severity:"critical",owner:"network",evidence:["sip_trace","carrier_acceptance_evidence"],actions:["block_activation","escalate_to_operator"]},
  suspected_fraud:{severity:"critical",owner:"compliance",evidence:["security_evidence","legal_review"],actions:["hold_unverified_amount","independent_investigation"]},
  operator_revenue_dispute:{severity:"high",owner:"accounting",evidence:["carrier_statement","cdr_batch_reference"],actions:["isolate_difference","open_reconciliation_case"]},
  subscription_chargeback:{severity:"high",owner:"billing",evidence:["signed_psp_dispute"],actions:["preserve_original_invoice","isolate_claim"]},
  client_termination:{severity:"medium",owner:"support",evidence:["customer_request","effective_contract_date"],actions:["acknowledge_request","review_portability_and_returns"]},
  data_subject_request:{severity:"medium",owner:"privacy",evidence:["identity_verification","retention_policy"],actions:["register_request","review_legal_retention"]}
});
const fail=code=>{throw Object.assign(new Error(code),{status:422,code});};
export function planAudiotelIncident(input={}){
  const rule=POLICIES[input.kind];
  if(input.business_unit!=="audiotel_platform"||!rule)fail("APP_INCIDENT_INVALID_SCOPE");
  if(!/^[A-Za-z0-9_.:/-]{8,140}$/.test(String(input.case_reference||"")))
    fail("APP_INCIDENT_INVALID_REFERENCE");
  const have=Array.isArray(input.evidence_received)?input.evidence_received:[];
  const missing=rule.evidence.filter(k=>!have.includes(k));
  return Object.freeze({
    schema_version:"audiotel-incident-review/1",business_unit:"audiotel_platform",
    case_reference:input.case_reference,kind:input.kind,severity:rule.severity,owner:rule.owner,
    missing_evidence:Object.freeze(missing),proposed_actions:Object.freeze([...rule.actions]),
    customer_notice_ready_for_review:missing.length===0&&input.communication_approved===true,
    customer_email_sent:false,number_deactivated:false,refund_executed:false,payout_executed:false
  });
}
export const AUDIOTEL_INCIDENT_TYPES=Object.freeze(Object.keys(POLICIES));