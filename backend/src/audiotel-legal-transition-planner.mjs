/**
 * Pure worklist for a change from individual/micro operations to a legal
 * entity, without doing any corporate filings, transfers or billing changes.
 * Existing carrier number rights and subscriber contracts do NOT automatically
 * travel to the new entity.
 */
const RIGHTS=Object.freeze([
 ["entity","legal_entity_formation_and_registration","legal_expert"],
 ["fiscal","new_tax_and_vat_registration","fiscal_expert"],
 ["fiscal","micro_exit_date_and_social_obligations","fiscal_expert"],
 ["contracts","customer_novation_or_legal_assignment_consent","legal_expert"],
 ["contracts","commercial_role_principal_or_mandat_verified","legal_expert"],
 ["telecom","arcep_operator_identity_and_number_rights","arcep"],
 ["telecom","carrier_contract_novation_acceptance","wholesale_partner"],
 ["telecom","all_premium_number_assignment_or_portability_rights","regulator_and_carrier"],
 ["telecom","interconnection_sip_and_route_owner_change","carrier_network"],
 ["finance","old_and_new_invoice_sequences_and_credit_notes","accountant"],
 ["finance","statement_reconciliation_of_historic_funds","accountant"],
 ["finance","beneficiary_funds_and_licensed_psp_model","regulated_provider"],
 ["finance","stripe_account_owner_and_connect_permissions","stripe"],
 ["finance","revolut_business_account_owner_and_mandates","revolut"],
 ["security","data_controller_change_and_privacy_notifications","data_protection_officer"],
 ["security","identity_kyb_and_signature_revalidation","compliance_officer"],
 ["operations","resend_sender_and_hubspot_records","operations_lead"],
 ["operations","domain_and_technical_access_migration","security_officer"],
 ["operations","incident_rollback_and_customer_continuity","operations_lead"]
].map(([domain,key,responsible])=>Object.freeze({domain,key,responsible})));

const LEGAL_FORMS=Object.freeze(["micro_ei","eurl_is","sasu_is","ei_real"]);
const fail=code=>{throw Object.assign(new Error("APP_TRANSITION_"+code),{code:"APP_TRANSITION_"+code,status:422});};

export function planAudiotelLegalTransition({from="micro_ei",to,proposal_reference}={}){
 if(!LEGAL_FORMS.includes(from)||!LEGAL_FORMS.includes(to)||from===to)
  fail("INVALID_LEGAL_FORMS");
 if(typeof proposal_reference!=="string"||
   !/^[A-Za-z0-9_.:/-]{8,180}$/.test(proposal_reference))
  fail("REFERENCE_INVALID");
 return Object.freeze({
  schema_version:"audiotel-legal-transition-prelaunch/1",
  business_unit:"audiotel_platform",from,to,proposal_reference,
  is_recommendation_only:true,
  worklist:Object.freeze(RIGHTS.map(x=>Object.freeze({
    ...x,state:"evidence_required",completed:false,
    can_execute_without_owner:false
  }))),
  worklist_count:RIGHTS.length,
  customer_contracts_transferred:false,
  phone_numbers_transferred:false,arcep_numbering_rights_transferred:false,
  operator_contracts_transferred:false,
  stripe_account_reassigned:false,revolut_account_reassigned:false,
  legal_entity_created:false,public_site_changed:false,
  banking_or_tax_filings_executed:false,
  data_ownership_migrated:false,
  go_live_authorized:false,automatic_legal_change_enabled:false,
  requires_independent_legal_fiscal_carrier_and_owner_signoff:true
 });
}
