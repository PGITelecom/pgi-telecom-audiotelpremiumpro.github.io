/**
 * Audiotel Premium Pro: mandatory wholesale negotiation review.
 * Preparatory, read-only and fail-closed. Never signs a carrier agreement,
 * approves a payment flow or infers a micro-entreprise tax treatment.
 * No contact, IBAN, account number or external API belongs in this record.
 */
const BUSINESS_UNIT="audiotel_platform";
const REF=/^[A-Za-z0-9_.:/-]{8,180}$/;
const MODELS=new Set(["direct_carrier","regulated_payment_partner","audiotel_receives_third_party_funds"]);
const STATUS=new Set(["not_requested","under_negotiation","proposed","refused"]);
const OBJECT=val=>val!==null&&typeof val==="object"&&!Array.isArray(val);
const error=code=>{throw Object.assign(new Error("APP_DIRECT_PAYOUT_"+code),{code:"APP_DIRECT_PAYOUT_"+code,status:422});};
const reference=(v,key)=>{if(typeof v!=="string"||!REF.test(v))error("INVALID_"+key);return v;};
const cents=(v,key)=>{if(!Number.isSafeInteger(v)||v<0||v>1000000000000)error("INVALID_"+key);return v;};
const clean=(val,keys,key)=>{
 if(!OBJECT(val)||Object.keys(val).some(k=>!keys.includes(k)))error("UNEXPECTED_"+key+"_FIELD");
 return val;
};
export const DIRECT_PAYOUT_CLAUSE=Object.freeze({
 business_unit:BUSINESS_UNIT,
 version:"mandatory_direct_payout_negotiation/1",
 priority:"direct_carrier_first",
 professional_payout_to:"professional_bank_account_by_authorized_carrier_or_psp",
 audiotel_compensation:"separate_contractual_remuneration_only",
 professional_funds_transit_audiotel_bank:false,
 bank_details_stored_in_this_register:false,
 sales_relationship_retained_subject_to_contract:true,
 legal_accounting_tax_qualification_assumed:false,
 binding_agreement_requires_independent_owner_approval:true
});

/**
 * Negotiation record: ref-only artifacts and non-sensitive prices.
 * A refusal MUST include evidenced alternatives and cost comparisons;
 * any flow through Audiotel remains a special legal review, not a fallback.
 */
export function reviewAudiotelDirectPayoutNegotiation(input={}){
 clean(input,["business_unit","carrier_reference","proposal_reference","direct_payout_status",
  "carrier_written_response_reference","automated_payouts_confirmed",
  "professional_iban_payment_supported","audiotel_separate_fee_supported",
  "audiotel_primary_commercial_contact_supported",
  "cdr_and_payout_reconciliation_supported","service_levels_documented",
  "contractual_fees_documented","alternatives","legal_review_reference"],"INPUT");
 if(input.business_unit!==BUSINESS_UNIT)error("BUSINESS_SCOPE");
 const carrier=reference(input.carrier_reference,"CARRIER");
 const proposal=reference(input.proposal_reference,"PROPOSAL");
 if(!STATUS.has(input.direct_payout_status))error("NEGOTIATION_STATUS");
 if(input.carrier_written_response_reference!=null)
  reference(input.carrier_written_response_reference,"CARRIER_RESPONSE");
 if(input.legal_review_reference!=null)reference(input.legal_review_reference,"LEGAL_REVIEW");
 for(const key of ["automated_payouts_confirmed","professional_iban_payment_supported",
 "audiotel_separate_fee_supported","audiotel_primary_commercial_contact_supported",
 "cdr_and_payout_reconciliation_supported","service_levels_documented",
 "contractual_fees_documented"])
  if(input[key]!=null&&typeof input[key]!=="boolean")error("INVALID_"+key);
 const alternatives=input.alternatives??[];
 if(!Array.isArray(alternatives)||alternatives.length>10)error("ALTERNATIVES");
 const alternativesOutput=alternatives.map(item=>{
  clean(item,["model","offer_reference","contractual_fee_minor","monthly_fixed_fee_minor",
   "estimated_processing_cost_minor","cost_estimate_reference",
   "legal_consequence_reference","financial_consequence_reference"],"ALTERNATIVE");
  if(!MODELS.has(item.model))error("ALTERNATIVE_MODEL");
  return Object.freeze({
   model:item.model,
   offer_reference:reference(item.offer_reference,"ALTERNATIVE_OFFER"),
   contractual_fee_minor:cents(item.contractual_fee_minor,"CONTRACTUAL_FEE"),
   monthly_fixed_fee_minor:cents(item.monthly_fixed_fee_minor,"MONTHLY_FEE"),
   estimated_processing_cost_minor:cents(item.estimated_processing_cost_minor,"PROCESSING_COST"),
   cost_estimate_reference:reference(item.cost_estimate_reference,"COST_ESTIMATE"),
   legal_consequence_reference:reference(item.legal_consequence_reference,"LEGAL_CONSEQUENCE"),
   financial_consequence_reference:reference(item.financial_consequence_reference,"FINANCIAL_CONSEQUENCE"),
   legal_risk_unverified:true,
   operator_acceptance_unverified:true
  });
 });
 const requested=input.direct_payout_status!=="not_requested";
 const written=Boolean(input.carrier_written_response_reference);
 const proposed=input.direct_payout_status==="proposed";
 const refused=input.direct_payout_status==="refused";
 const negotiationComplete=requested&&written&&(proposed||refused);
 const flags=[
  ["carrier_written_response",written],
  ["direct_payout_explored",requested],
  ["automatic_payouts",input.automated_payouts_confirmed===true],
  ["direct_to_professional_iban",input.professional_iban_payment_supported===true],
  ["audiotel_separate_compensation",input.audiotel_separate_fee_supported===true],
  ["audiotel_main_commercial_contact",input.audiotel_primary_commercial_contact_supported===true],
  ["cdr_payout_financial_reconciliation",input.cdr_and_payout_reconciliation_supported===true],
  ["service_levels_and_incidents",input.service_levels_documented===true],
  ["fees_and_payment_costs",input.contractual_fees_documented===true]
 ];
 const refusalsMissing=refused?[
  ...(alternativesOutput.length?[]:["documented_alternatives"]),
  ...(input.legal_review_reference?[]:["independent_legal_fiscal_review"])
 ]:[];
 const providerModelValid=proposed&&flags.every(([,ok])=>ok)&&
  Boolean(input.legal_review_reference);
 const missing=[
  ...flags.filter(([,ok])=>!ok).map(([name])=>name),
  ...refusalsMissing
 ];
 const preliminary=refused?
  (refusalsMissing.length?"refusal_alternatives_required":"owner_decision_required_after_refusal"):
  (!requested?"direct_payout_proposal_required":
  (!negotiationComplete?"negotiation_evidence_required":
  (providerModelValid?"independent_contract_and_tax_review_required":"commercial_terms_incomplete")));
 return Object.freeze({
  business_unit:BUSINESS_UNIT,carrier_reference:carrier,proposal_reference:proposal,
  direct_payout_status:input.direct_payout_status,
  carrier_response_documented:written,negotiation_review_complete:negotiationComplete,
  professional_iban_direct_settlement_confirmed_by_live_provider:false,
  estimated_alternatives:Object.freeze(alternativesOutput),
  missing_evidence:Object.freeze([...new Set(missing)]),
  preliminary_next_step:preliminary,
  legal_and_tax_qualification_verified:false,
  carrier_contract_approved:false,
  owner_independent_decision_required:true,
  authorizes_signature:false,authorizes_contract_execution:false,
  authorizes_bank_transfer:false,authorizes_payout:false,
  authorizes_operator_contact:false,authorizes_change_of_legal_status:false,
  recorded_alternative_is_fallback_approval:false,
  // A carrier's refusal triggers an owner decision, never implicit acceptance.
  alternative_financial_consequences_require_review:refused,
  cannot_force_funds_through_audiotel:true
 });
}
