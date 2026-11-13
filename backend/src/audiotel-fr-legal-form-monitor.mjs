/**
 * Audiotel Premium Pro: monthly French legal-form scenario monitoring.
 * PREPARATION ONLY: calculation and recommendations for qualified review.
 * The tax/social figures are 2026 service-category *hypotheses*, not a
 * declaration, tax position, personal taxation, legal restructuring or filing.
 * No timers, cron registration, accounting mutations or external I/O.
 *
 * Official context at research cut-off 2026-11-08:
 * micro services BIC/BNC threshold 83_600 EUR (2026-28);
 * VAT service base 37_500 EUR, increased 41_250 EUR (check future reforms);
 * micro social 2026: BIC services 21.2%, nonregulated BNC 25.6%;
 * business classification and turnover base MUST be verified independently.
 */
const UNIT="audiotel_platform";
const EUR_LIMIT=10**12;
const CATEGORIES=Object.freeze({
 bic_services:{social_bps:2120,formation_bps:10},
 bnc_nonregulated:{social_bps:2560,formation_bps:20}
});
const ALLOWED_MODELS=new Set(["micro","eurl_is","sasu_is","ei_real"]);
const REF=/^[A-Za-z0-9_.:/-]{8,180}$/;
const DATE=/^20\d\d-(?:0[1-9]|1[0-2])$/;
const has=o=>o&&typeof o==="object"&&!Array.isArray(o);
const err=code=>{throw Object.assign(new Error("APP_LEGAL_"+code),{code:"APP_LEGAL_"+code,status:422});};
function strict(o,keys,code){if(!has(o)||Object.keys(o).some(k=>!keys.includes(k)))err(code);return o;}
function m(v,k){if(!Number.isSafeInteger(v)||v<0||v>EUR_LIMIT)err("INVALID_"+k);return v;}
function s(a,b){if(!Number.isSafeInteger(a+b)||a+b>EUR_LIMIT)err("SUM_OVERFLOW");return a+b;}
function roundedRate(minor,bps){
 const n=(BigInt(minor)*BigInt(bps)+5000n)/10000n;
 if(n>BigInt(EUR_LIMIT))err("SUM_OVERFLOW");
 return Number(n);
}
const EUROS=100;
export const AUDIOTEL_FR_2026_RULES=Object.freeze({
 version:"FR_SERVICE_2026-11-08_REFERENCE_REVIEW_REQUIRED",
 valid_from:"2026-01-01",review_after:"2026-12-31",
 micro_services_turnover_ceiling_minor:83600*EUROS,
 vat_services_standard_minor:37500*EUROS,
 vat_services_increased_minor:41250*EUROS,
 sources:Object.freeze([
  "https://www.impots.gouv.fr/professionnel/questions/pour-rester-micro-entrepreneur-quel-montant-de-chiffre-daffaires-ou-de",
  "https://www.impots.gouv.fr/professionnel/questions/en-tant-que-micro-entrepreneur-puis-je-etre-redevable-de-la-tva",
  "https://entreprendre.service-public.gouv.fr/vosdroits/F36232"
 ])
});

export function reviewAudiotelMonthlyStructure(input={}){
 strict(input,["business_unit","country_code","report_month","service_category",
  "records","creation_date","company_scenarios"],"INPUT");
 if(input.business_unit!==UNIT||input.country_code!=="FR")err("SCOPE_INVALID");
 if(!DATE.test(input.report_month))err("REPORT_MONTH_INVALID");
 if(!Object.hasOwn(CATEGORIES,input.service_category))err("CATEGORY_UNRECOGNIZED");
 const year=Number(input.report_month.slice(0,4));
 if(year!==2026)err("FISCAL_RULESET_NOT_VERIFIED_FOR_YEAR");
 const records=input.records;
 if(!Array.isArray(records)||records.length===0||records.length>12)
  err("RECORDS_INVALID");
 const unique=new Set();
 let own=0,carrier=0,publishers=0,operating=0,fixed=0;
 let last=null;
 for(const item of records){
  strict(item,["month","audiotel_own_receipts_minor",
   "operator_sva_collections_minor","publisher_payouts_by_partner_minor",
   "operating_variable_cost_minor","operating_fixed_cost_minor"],"RECORD");
  if(typeof item.month!=="string"||!DATE.test(item.month)||
    item.month.slice(0,4)!==String(year)||item.month>input.report_month)
    err("RECORD_PERIOD_INVALID");
  if(unique.has(item.month))err("DUPLICATE_MONTH");unique.add(item.month);
  const mine=m(item.audiotel_own_receipts_minor,"OWN_RECEIPTS");
  const gross=m(item.operator_sva_collections_minor,"OPERATOR_COLLECTIONS");
  const payout=m(item.publisher_payouts_by_partner_minor,"PARTNER_PAYOUTS");
  if(payout>gross)err("PAYOUTS_EXCEED_OPERATOR_COLLECTIONS");
  const variable=m(item.operating_variable_cost_minor,"VARIABLE_COST");
  const cost=m(item.operating_fixed_cost_minor,"FIXED_COST");
  own=s(own,mine);carrier=s(carrier,gross);publishers=s(publishers,payout);
  operating=s(operating,variable);fixed=s(fixed,cost);
  if(last===null||item.month>last)last=item.month;
 }
 const numberOfMonths=Number(input.report_month.slice(5,7));
 const chronological=records.map(x=>x.month).sort();
 const missingMonths=Array.from({length:numberOfMonths},(_,i)=>
  String(year)+"-"+String(i+1).padStart(2,"0")).filter(x=>!unique.has(x));
 const possibleBase={commission_hypothesis_minor:own,
  principal_hypothesis_minor:s(own,carrier)};
 const low=possibleBase.commission_hypothesis_minor;
 const high=possibleBase.principal_hypothesis_minor;
 const vat=AUDIOTEL_FR_2026_RULES.vat_services_standard_minor;
 const raised=AUDIOTEL_FR_2026_RULES.vat_services_increased_minor;
 const micro=AUDIOTEL_FR_2026_RULES.micro_services_turnover_ceiling_minor;
 const cat=CATEGORIES[input.service_category];
 const possibleMicroSocialRange=Object.freeze({
  commission_hypothesis_minor:roundedRate(low,cat.social_bps),
  principal_hypothesis_minor:roundedRate(high,cat.social_bps),
  education_levy_not_necessarily_inclusive:true,
  indicative_formation_charge_commission_minor:roundedRate(low,cat.formation_bps),
  indicative_formation_charge_principal_minor:roundedRate(high,cat.formation_bps)
 });
 const annualized=(base)=>Number((BigInt(base)*12n+BigInt(numberOfMonths)/2n)/BigInt(numberOfMonths));
 const alertList=[];
 if(high>=micro)alertList.push("potential_micro_ceiling_exceeded_under_principal_hypothesis");
 else if(high*10>=micro*8)alertList.push("potential_micro_ceiling_approaching");
 if(low>=micro)alertList.push("micro_ceiling_exceeded_even_under_commission_hypothesis");
 if(high>=raised)alertList.push("possible_vat_increased_threshold_crossed");
 else if(high>=vat)alertList.push("possible_vat_standard_threshold_crossed");
 if(low>=raised)alertList.push("vat_increased_threshold_crossed_even_under_commission_hypothesis");
 if(missingMonths.length)alertList.push("monthly_data_missing");
 if(input.creation_date!=null){
  const v=String(input.creation_date);
  if(!/^2026-\d\d-\d\d$/.test(v)||!Number.isFinite(Date.parse(v+"T00:00:00Z")))
   err("CREATION_DATE_INVALID");
  alertList.push("first_year_and_prorating_require_independent_review");
 }
 const scenarios=input.company_scenarios??[];
 if(!Array.isArray(scenarios)||scenarios.length>4)err("SCENARIOS_INVALID");
 const seen=new Set(),prepared=[];
 for(const item of scenarios){
  strict(item,["legal_form","net_personal_available_minor","setup_cost_minor",
   "annual_compliance_cost_minor","assumption_reference",
   "adviser_approved"],"SCENARIO");
  if(!ALLOWED_MODELS.has(item.legal_form)||seen.has(item.legal_form))
   err("SCENARIO_FORM_DUPLICATE_OR_UNKNOWN");
  seen.add(item.legal_form);
  if(typeof item.assumption_reference!=="string"||!REF.test(item.assumption_reference))
   err("SCENARIO_REFERENCE_INVALID");
  const net=m(item.net_personal_available_minor,"NET_PERSONAL");
  const setup=m(item.setup_cost_minor,"SETUP_COST");
  const yearly=m(item.annual_compliance_cost_minor,"ANNUAL_COST");
  prepared.push(Object.freeze({legal_form:item.legal_form,
   assumed_net_personal_available_minor:net,
   setup_cost_minor:setup,annual_compliance_cost_minor:yearly,
   net_after_stated_costs_minor:net-setup-yearly,
   assumption_reference:item.assumption_reference,
   adviser_approved:false,
   claimed_adviser_approved_from_input:item.adviser_approved===true,
   reliable_for_tax_decision:false
  }));
 }
 const ranked=prepared.slice().sort((a,b)=>
  b.net_after_stated_costs_minor-a.net_after_stated_costs_minor);
 const output=Object.freeze({
  schema_version:"audiotel-fr-legal-monitor-prelaunch/1",business_unit:UNIT,
  country_code:"FR",report_month:input.report_month,
  service_category_hypothesis:input.service_category,
  ruleset_version:AUDIOTEL_FR_2026_RULES.version,
  record_count:records.length,missing_months:Object.freeze(missingMonths),
  own_receipts_reported_minor:own,operator_collection_reported_minor:carrier,
  partner_payouts_reported_minor:publishers,
  total_variable_cost_reported_minor:operating,total_fixed_cost_reported_minor:fixed,
  possible_turnover_basis_minor:Object.freeze(possibleBase),
  monthly_ytd_annualized_hypotheses_minor:Object.freeze({
   commission:annualized(low),principal:annualized(high)
  }),
  micro_threshold_minor:micro,vat_standard_threshold_minor:vat,
  vat_increased_threshold_minor:raised,
  social_charge_2026_hypothesis_minor:possibleMicroSocialRange,
  estimated_cash_before_income_tax_hypothesis_minor:Object.freeze({
   commission:low-operating-fixed-possibleMicroSocialRange.commission_hypothesis_minor,
   principal:high-operating-fixed-possibleMicroSocialRange.principal_hypothesis_minor
  }),
  advisory_scenarios:Object.freeze(prepared),
  ranked_unverified_scenarios:Object.freeze(ranked),
  projected_structure_with_best_documented_financial_result:ranked[0]?.legal_form??null,
  alerts:Object.freeze([...new Set(alertList)]),
  // Unauthenticated inputs cannot establish the real principal/agent legal
  // status, VAT category, tax outcome or accounting accuracy.
  statutory_turnover_minor:null,
  fiscal_result_verified:false,legal_status_verified:false,
  vat_franchise_currently_applicable:null,micro_eligibility_legally_verified:false,
  recommended_legal_change:null,legal_change_authorized:false,
  incorporation_initiated:false,contracts_transferred:false,
  bank_or_stripe_account_migrated:false,notification_sent:false,
  scheduler_registered:false,automatic_filing_enabled:false,
  missing_independent_approvals:Object.freeze([
   "source_accounting_and_bank_data_authentication",
   "principal_vs_agent_contractual_substance",
   "business_activity_BIC_or_BNC_classification",
   "VAT_liability_and_prorata_review",
   "prior_year_micro_and_VAT_history",
   "personal_income_tax_and_household_situation",
   "EURL_TNS_and_SASU_assimile_salarie_social_scenarios",
   "IS_dividends_and_10pct_EURL_base_review",
   "legal_entity_switch_and_contract_novations",
   "explicit_owner_approval_before_any_change"
  ])
 });
 return output;
}
