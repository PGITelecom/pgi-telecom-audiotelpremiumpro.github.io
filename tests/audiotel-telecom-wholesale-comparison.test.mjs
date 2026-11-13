import test from "node:test";
import assert from "node:assert/strict";
import {assessAudiotelWholesaleDrafts} from "../telephony/prelaunch-not-active/wholesale-comparison.mjs";

const capabilities=()=>({
 direct_arcep_attributaire_compatible:true,
 wholesale_sip_interconnect:true,operator_cdr_export:true,
 sva_inbound_and_outbound_portability:true,tenant_volume_pooling:true,
 zero_minimum_per_professional:true,no_professional_commitment:true,
 operator_or_licensed_psp_direct_payout:true,
 separate_audiotel_compensation:true,
 finance_reconciliation_api_or_file:true,
 operator_incident_sla:true,rgpd_processing_agreement:true
});
const fee=(mod={})=>({
 carrier_fixed_monthly_minor:2000,per_number_monthly_minor:1,
 carrier_variable_micros_per_min:20000,payment_variable_micros_per_min:3000,
 payout_fee_minor:0,global_minimum_minutes_per_month:0,
 global_minimum_shortfall_fee_minor:0,...mod
});
const offer=(id="A",mod={})=>({
 provider_reference:"CARRIER-REFERENCE-"+id,
 proposal_reference:"OFFER-REFERENCE-"+id,
 evidence_reference:"UNVERIFIED-QUOTE-"+id,
 capabilities:capabilities(),price:fee(),...mod
});
const input=(offers=[offer()])=>({
 business_unit:"audiotel_platform",mode:"offline_simulation",
 scenario:{
  monthly_minutes:20000,professional_numbers:150,
  monthly_professional_payouts:150,
  own_fee_micros_per_min:140000,
  media_micros_per_min:15000,fraud_provision_micros_per_min:5000,
  fixed_platform_monthly_minor:30000,arcep_block_count:1,
  arcep_annual_fee_per_block_minor:2000
 },offers
});
test("full operator offer is compared but cannot sign or operate",()=>{
 const report=assessAudiotelWholesaleDrafts(input());
 assert.equal(report.offer_count,1);
 assert.deepEqual(report.economically_ranked_unverified_proposal_refs,["OFFER-REFERENCE-A"]);
 const first=report.assessments[0];
 assert.equal(first.status,"commercially_comparable_unverified");
 assert.ok(first.projected_economics.estimated_result_before_taxes_minor>0);
 assert.equal(first.projected_economics.meets_seven_cent_reference,true);
 assert.equal(first.carrier_accepted_in_reality,false);
 assert.equal(first.written_offer_authenticated,false);
 assert.equal(first.engagement_authorized,false);
 assert.equal(report.operator_contract_signed,false);
});
test("refused direct settlement requires documented alternative and owner review",()=>{
 const a=offer("B");
 a.capabilities.operator_or_licensed_psp_direct_payout=false;
 const result=assessAudiotelWholesaleDrafts(input([a]));
 assert.equal(result.assessments[0].status,"direct_payout_refusal_owner_review_required");
 assert.equal(result.assessments[0].engagement_authorized,false);
 assert.deepEqual(result.economically_ranked_unverified_proposal_refs,[]);
});
test("no professional minimum or commitment is a hard commercial conflict",()=>{
 const a=offer("C");
 a.capabilities.zero_minimum_per_professional=false;
 const report=assessAudiotelWholesaleDrafts(input([a]));
 assert.equal(report.assessments[0].status,"individual_minimum_or_commitment_conflict");
 assert.deepEqual(report.economically_ranked_unverified_proposal_refs,[]);
});
test("rank on all-in projected contribution after fixed fees, not headline rate",()=>{
 const premium=offer("EXPENSIVE",{price:fee({carrier_fixed_monthly_minor:200000})});
 const lean=offer("LEAN",{price:fee({carrier_fixed_monthly_minor:2000})});
 const report=assessAudiotelWholesaleDrafts(input([premium,lean]));
 assert.deepEqual(report.economically_ranked_unverified_proposal_refs,
  ["OFFER-REFERENCE-LEAN","OFFER-REFERENCE-EXPENSIVE"]);
 assert.ok(report.assessments[0].projected_economics.estimated_result_before_taxes_minor<
  report.assessments[1].projected_economics.estimated_result_before_taxes_minor);
});
test("operator-level minimum is reported and shortfall is provisioned, not hidden",()=>{
 const a=offer("MIN",{price:fee({
  global_minimum_minutes_per_month:50000,global_minimum_shortfall_fee_minor:20000
 })});
 const report=assessAudiotelWholesaleDrafts(input([a]));
 assert.equal(report.assessments[0].global_minimum_minutes_per_month,50000);
 const withMinimum=report.assessments[0].projected_economics;
 const without=assessAudiotelWholesaleDrafts(input([offer()])).assessments[0].projected_economics;
 assert.equal(without.estimated_result_before_taxes_minor-
  withMinimum.estimated_result_before_taxes_minor,20000);
 assert.equal(report.assessments[0].engagement_authorized,false);
});
test("unknown prices cannot result in comparison or synthetic operator promise",()=>{
 const a=offer("MISSING");
 delete a.price.payment_variable_micros_per_min;
 const report=assessAudiotelWholesaleDrafts(input([a]));
 assert.equal(report.assessments[0].status,"incomplete_terms");
 assert.equal(report.assessments[0].projected_economics,null);
 assert.deepEqual(report.economically_ranked_unverified_proposal_refs,[]);
});
test("no offers means no vendor invention",()=>{
 const report=assessAudiotelWholesaleDrafts(input([]));
 assert.deepEqual(report.assessments,[]);
 assert.deepEqual(report.economically_ranked_unverified_proposal_refs,[]);
});
test("sensitive fields, duplicate offer and live mode cannot be smuggled",()=>{
 assert.throws(()=>assessAudiotelWholesaleDrafts({...input(),mode:"production"}),
 {code:"APP_WHOLESALE_OFFLINE_ONLY"});
 assert.throws(()=>assessAudiotelWholesaleDrafts(input([offer("A"),offer("A")])),
 {code:"APP_WHOLESALE_DUPLICATE_OFFER"});
 assert.throws(()=>assessAudiotelWholesaleDrafts(input([
  {...offer(),bank_iban:"FR7630000000000000000000"}
 ])),{code:"APP_WHOLESALE_INVALID_OFFER"});
 const a=offer("P");a.price.carrier_fixed_monthly_minor=-1;
 assert.throws(()=>assessAudiotelWholesaleDrafts(input([a])),
 {code:"APP_WHOLESALE_INVALID_carrier_fixed_monthly_minor"});
});
