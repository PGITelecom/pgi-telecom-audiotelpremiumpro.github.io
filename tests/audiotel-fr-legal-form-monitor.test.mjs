import test from "node:test";
import assert from "node:assert/strict";
import {
 reviewAudiotelMonthlyStructure,AUDIOTEL_FR_2026_RULES
} from "../backend/src/audiotel-fr-legal-form-monitor.mjs";

const record=(month,changes={})=>({
 month,audiotel_own_receipts_minor:1000000,
 operator_sva_collections_minor:2000000,
 publisher_payouts_by_partner_minor:1500000,
 operating_variable_cost_minor:30000,operating_fixed_cost_minor:15000,
 ...changes
});
const base=(other={})=>({
 business_unit:"audiotel_platform",country_code:"FR",
 report_month:"2026-03",service_category:"bic_services",
 records:[record("2026-01"),record("2026-02"),record("2026-03")],
 ...other
});
test("2026 micro and VAT thresholds are distinct; monitor only estimates without legal qualification",()=>{
 const x=reviewAudiotelMonthlyStructure(base());
 assert.equal(AUDIOTEL_FR_2026_RULES.micro_services_turnover_ceiling_minor,8360000);
 assert.equal(x.micro_threshold_minor,8360000);
 assert.equal(x.vat_standard_threshold_minor,3750000);
 assert.equal(x.vat_increased_threshold_minor,4125000);
 assert.equal(x.own_receipts_reported_minor,3000000);
 assert.equal(x.operator_collection_reported_minor,6000000);
 assert.equal(x.partner_payouts_reported_minor,4500000);
 assert.equal(x.possible_turnover_basis_minor.commission_hypothesis_minor,3000000);
 assert.equal(x.possible_turnover_basis_minor.principal_hypothesis_minor,9000000);
 assert.equal(x.social_charge_2026_hypothesis_minor.commission_hypothesis_minor,636000);
 assert.equal(x.social_charge_2026_hypothesis_minor.principal_hypothesis_minor,1908000);
 assert.equal(x.monthly_ytd_annualized_hypotheses_minor.commission,12000000);
 assert.equal(x.monthly_ytd_annualized_hypotheses_minor.principal,36000000);
 assert.ok(x.alerts.includes("potential_micro_ceiling_exceeded_under_principal_hypothesis"));
 assert.ok(x.alerts.includes("possible_vat_increased_threshold_crossed"));
 assert.equal(x.micro_eligibility_legally_verified,false);
 assert.equal(x.vat_franchise_currently_applicable,null);
 assert.equal(x.statutory_turnover_minor,null);
 assert.equal(x.recommended_legal_change,null);
 assert.equal(x.legal_change_authorized,false);
 assert.equal(x.scheduler_registered,false);
 assert.equal(x.automatic_filing_enabled,false);
});
test("BNC rates differ and accounting data gap is explicitly signaled",()=>{
 const x=reviewAudiotelMonthlyStructure(base({
  report_month:"2026-04",records:[record("2026-01"),record("2026-04")],
  service_category:"bnc_nonregulated"
 }));
 assert.deepEqual(x.missing_months,["2026-02","2026-03"]);
 assert.ok(x.alerts.includes("monthly_data_missing"));
 assert.equal(x.social_charge_2026_hypothesis_minor.commission_hypothesis_minor,512000);
});
test("simulated EURL SASU EI returns tentative ranking, never creates company",()=>{
 const y=reviewAudiotelMonthlyStructure(base({company_scenarios:[
  {legal_form:"eurl_is",net_personal_available_minor:2000000,
   setup_cost_minor:50000,annual_compliance_cost_minor:120000,
   assumption_reference:"ACCOUNTANT-QUOTE-2026-EURL",adviser_approved:true},
  {legal_form:"sasu_is",net_personal_available_minor:1900000,
   setup_cost_minor:50000,annual_compliance_cost_minor:160000,
   assumption_reference:"ACCOUNTANT-QUOTE-2026-SASU",adviser_approved:true},
  {legal_form:"micro",net_personal_available_minor:1500000,
   setup_cost_minor:0,annual_compliance_cost_minor:10000,
   assumption_reference:"ACCOUNTANT-QUOTE-2026-MICRO",adviser_approved:true}
 ]}));
 assert.equal(y.projected_structure_with_best_documented_financial_result,"eurl_is");
 assert.equal(y.ranked_unverified_scenarios[0].reliable_for_tax_decision,false);
 assert.equal(y.ranked_unverified_scenarios[0].adviser_approved,false);
 assert.equal(y.recommended_legal_change,null);
 assert.equal(y.incorporation_initiated,false);
 assert.equal(y.contracts_transferred,false);
 assert.equal(y.bank_or_stripe_account_migrated,false);
});
test("year not explicitly verified and attack flags never accepted",()=>{
 const x=base();
 for(const input of [
 {...x,report_month:"2027-03"},
 {...x,business_unit:"direct_sva"},
 {...x,legal_change_authorized:true},
 {...x,service_category:"consultant"},
 {...x,records:[...x.records,x.records[0]]}
 ])assert.throws(()=>reviewAudiotelMonthlyStructure(input));
});
test("contractual revenue cannot be inferred merely because a bank paid the commission",()=>{
 const x=reviewAudiotelMonthlyStructure(base({records:[record("2026-01",{
   audiotel_own_receipts_minor:250000,operator_sva_collections_minor:12000000,
   publisher_payouts_by_partner_minor:11000000
  })],report_month:"2026-01"}));
 assert.equal(x.possible_turnover_basis_minor.commission_hypothesis_minor,250000);
 assert.equal(x.possible_turnover_basis_minor.principal_hypothesis_minor,12250000);
 assert.equal(x.statutory_turnover_minor,null);
 assert.equal(x.legal_status_verified,false);
 assert.ok(x.missing_independent_approvals.includes("principal_vs_agent_contractual_substance"));
});
