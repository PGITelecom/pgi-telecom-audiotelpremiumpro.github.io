import test from "node:test";
import assert from "node:assert/strict";
import {
 DIRECT_PAYOUT_CLAUSE,reviewAudiotelDirectPayoutNegotiation
} from "../backend/src/audiotel-carrier-direct-payout-review.mjs";

const base=(overrides={})=>({
 business_unit:"audiotel_platform",
 carrier_reference:"CARRIER-2026-0001",proposal_reference:"OFFER-SVA-2026-0001",
 direct_payout_status:"not_requested",...overrides
});
const agreement=(overrides={})=>base({
 direct_payout_status:"proposed",
 carrier_written_response_reference:"CARRIER-WRITTEN-2026-0001",
 automated_payouts_confirmed:true,
 professional_iban_payment_supported:true,
 audiotel_separate_fee_supported:true,
 audiotel_primary_commercial_contact_supported:true,
 cdr_and_payout_reconciliation_supported:true,
 service_levels_documented:true,
 contractual_fees_documented:true,
 legal_review_reference:"COUNSEL-REVIEW-2026-001",
 ...overrides
});
const alt=(model="regulated_payment_partner")=>({
 model,offer_reference:"ALTERNATIVE-2026-0001",
 contractual_fee_minor:70,monthly_fixed_fee_minor:500,
 estimated_processing_cost_minor:15,
 cost_estimate_reference:"PRICING-2026-0001",
 legal_consequence_reference:"COUNSEL-ANALYSIS-2026-0001",
 financial_consequence_reference:"COST-ANALYSIS-2026-0001"
});
test("mandatory direct payout preference explicitly excludes transit through Audiotel",()=>{
 assert.equal(DIRECT_PAYOUT_CLAUSE.professional_funds_transit_audiotel_bank,false);
 assert.equal(DIRECT_PAYOUT_CLAUSE.legal_accounting_tax_qualification_assumed,false);
 assert.equal(DIRECT_PAYOUT_CLAUSE.binding_agreement_requires_independent_owner_approval,true);
 const x=reviewAudiotelDirectPayoutNegotiation(base());
 assert.equal(x.preliminary_next_step,"direct_payout_proposal_required");
 assert.equal(x.negotiation_review_complete,false);
 assert.equal(x.carrier_contract_approved,false);
 assert.equal(x.authorizes_signature,false);
 assert.equal(x.authorizes_operator_contact,false);
 assert.equal(x.authorizes_payout,false);
});
test("operator acceptance alone is not a legal or signing authorization",()=>{
 const report=reviewAudiotelDirectPayoutNegotiation(agreement());
 assert.equal(report.negotiation_review_complete,true);
 assert.equal(report.preliminary_next_step,"independent_contract_and_tax_review_required");
 assert.equal(report.legal_and_tax_qualification_verified,false);
 assert.equal(report.professional_iban_direct_settlement_confirmed_by_live_provider,false);
 assert.equal(report.owner_independent_decision_required,true);
 assert.equal(report.authorizes_contract_execution,false);
 assert.equal(report.authorizes_signature,false);
 assert.equal(report.authorizes_bank_transfer,false);
});
test("refusal requires alternative cost, legal, accounting impact and owner decision",()=>{
 let report=reviewAudiotelDirectPayoutNegotiation(base({
  direct_payout_status:"refused",
  carrier_written_response_reference:"REFUSAL-2026-0001"
 }));
 assert.equal(report.preliminary_next_step,"refusal_alternatives_required");
 assert.ok(report.missing_evidence.includes("documented_alternatives"));
 assert.ok(report.missing_evidence.includes("independent_legal_fiscal_review"));
 assert.equal(report.authorizes_signature,false);
 report=reviewAudiotelDirectPayoutNegotiation(base({
  direct_payout_status:"refused",
  carrier_written_response_reference:"REFUSAL-2026-0001",
  legal_review_reference:"COUNSEL-REVIEW-2026-001",
  alternatives:[alt()]
 }));
 assert.equal(report.preliminary_next_step,"owner_decision_required_after_refusal");
 assert.equal(report.estimated_alternatives.length,1);
 assert.equal(report.estimated_alternatives[0].monthly_fixed_fee_minor,500);
 assert.equal(report.recorded_alternative_is_fallback_approval,false);
 assert.equal(report.cannot_force_funds_through_audiotel,true);
 assert.equal(report.authorizes_signature,false);
});
test("fiscal and bank-credential assertions cannot be injected",()=>{
 for(const p of [
  {...agreement(),legal_and_tax_qualification_verified:true},
  {...agreement(),iban:"FR7630000000000000000000"},
  {...agreement(),owner_approved:true},
  {...agreement(),bank_transfer_authorized:true}
 ])assert.throws(()=>reviewAudiotelDirectPayoutNegotiation(p),
  {code:"APP_DIRECT_PAYOUT_UNEXPECTED_INPUT_FIELD"});
 assert.throws(()=>reviewAudiotelDirectPayoutNegotiation(base({
  business_unit:"direct_sva"
 })),{code:"APP_DIRECT_PAYOUT_BUSINESS_SCOPE"});
 assert.throws(()=>reviewAudiotelDirectPayoutNegotiation(base({
  direct_payout_status:"agreed"
 })),{code:"APP_DIRECT_PAYOUT_NEGOTIATION_STATUS"});
});
test("alternative funding via Audiotel bank account is not an automatic approval",()=>{
 const report=reviewAudiotelDirectPayoutNegotiation(base({
  direct_payout_status:"refused",
  carrier_written_response_reference:"CARRIER-REFUSAL-2026-1",
  legal_review_reference:"COUNSEL-REVIEW-2026-001",
  alternatives:[alt("audiotel_receives_third_party_funds")]
 }));
 assert.equal(report.estimated_alternatives[0].legal_risk_unverified,true);
 assert.equal(report.authorizes_signature,false);
 assert.equal(report.cannot_force_funds_through_audiotel,true);
 assert.equal(report.legal_and_tax_qualification_verified,false);
});
test("incomplete direct terms cannot be marked ready, even with written reply",()=>{
 const p=reviewAudiotelDirectPayoutNegotiation(agreement({
  professional_iban_payment_supported:false,
  contractual_fees_documented:false,
  legal_review_reference:null
 }));
 assert.equal(p.preliminary_next_step,"commercial_terms_incomplete");
 assert.ok(p.missing_evidence.includes("direct_to_professional_iban"));
 assert.ok(p.missing_evidence.includes("fees_and_payment_costs"));
 assert.equal(p.authorizes_signature,false);
});
