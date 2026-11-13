/**
 * Audiotel Premium Pro market-entry and portability PREPARATION ONLY.
 * Uses operating_markets and tenant_market_profiles already in the platform.
 * This module MUST NOT insert/enable a country, buy a number, port, sign an
 * agreement or infer a licensing entitlement from a country-code match.
 *
 * Sources are public authority documentation reviewed 2026-11-08.
 * Commercial rates and technical portability rights must still be verified.
 */
const UNIT="audiotel_platform";
const REF=/^[A-Za-z0-9_.:/-]{8,180}$/;
const err=code=>{throw Object.assign(new Error("APP_INTL_"+code),{code:"APP_INTL_"+code,status:422});};
const isObject=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const fee=(v,k)=>{if(!Number.isSafeInteger(v)||v<0||v>1e12)err("INVALID_"+k);return v;};
const required=(v,k)=>{if(typeof v!=="string"||!REF.test(v))err("INVALID_"+k);return v;};
const deep=x=>Object.freeze(x);
export const APP_MARKET_PROFILES=deep({
 FR:deep({
  regulator:"ARCEP",other_bodies:deep(["AF2M"]),currency:"EUR",
  calling_code:"33",premium_prefixes:deep(["081","082","089"]),
  numbers_display:"081 / 082 / 089",data_region:"EU",
  direct_number_rights:"arcep_attribution_requires_operator_eligibility",
  national_portability:"special_number_portability_legal_framework_must_be_confirmed_per_case",
  eligible_services:"premium_rate_specific_uses_and_tariffs",
  source_urls:deep(["https://www.arcep.fr/la-regulation/grands-dossiers-thematiques-transverses/la-numerotation.html",
   "https://www.arcep.fr/uploads/tx_gsavis/25-2215.pdf"])
 }),
 ES:deep({
  regulator:"CNMC",other_bodies:deep(["Secretaria de Estado de Telecomunicaciones"]),currency:"EUR",
  calling_code:"34",premium_prefixes:deep(["803","806","807","905"]),
  numbers_display:"803 / 806 / 807 / 905",data_region:"EU",
  direct_number_rights:"requires_spanish_operator_registration_and_number_assignment_review",
  national_portability:"premium_number_portability_not_confirmed",
  eligible_services:"code_specific_service_classes_and_rate_ceilings",
  source_urls:deep(["https://www.cnmc.es/ambitos-de-actuacion/telecomunicaciones/registros-sgda",
   "https://www.dsca.gob.es/es/consumo/preguntas-frecuentes/que-numeros-empiezan-llamadas-tarificacion-adicional"])
 }),
 IT:deep({
  regulator:"AGCOM",other_bodies:deep(["Ministero delle Imprese e del Made in Italy"]),currency:"EUR",
  calling_code:"39",premium_prefixes:deep(["892","899"]),
  numbers_display:"892 / 899 (candidate ranges, verify current plan)",data_region:"EU",
  direct_number_rights:"numbering_plan_AGCOM_assignment_procedure_MIMIT_to_verify",
  national_portability:"premium_number_specific_portability_not_confirmed",
  eligible_services:"verify_service_categories_and_price_caps_under_current_AGCOM_plan",
  source_urls:deep(["https://www.agcom.it/competenze/comunicazioni-elettroniche/reti/numerazione/piano-di-numerazione",
   "https://www.agcom.it/agcom-per-te/i-miei-diritti/recesso-dal-contratto-migrazione-e-portabilita-del-numero"])
 }),
 GB:deep({
  regulator:"Ofcom",other_bodies:deep([]),currency:"GBP",
  calling_code:"44",premium_prefixes:deep(["09"]),
  numbers_display:"09",data_region:"UK",
  direct_number_rights:"ofcom_communications_provider_number_allocation_application",
  national_portability:"premium_rate_portability_specific_process_not_verified",
  eligible_services:"PRS_registration_and_service_specific_rules_required",
  source_urls:deep(["https://www.ofcom.org.uk/phones-and-broadband/mobile-phones/operating-a-premium-rate-service",
   "https://www.ofcom.org.uk/phones-and-broadband/phone-numbers/number-cop-closed"])
 }),
 US:deep({
  regulator:"FCC",other_bodies:deep(["FTC","state_regulators"]),currency:"USD",
  calling_code:"1",premium_prefixes:deep(["900"]),
  numbers_display:"900 (NANP)",data_region:"US",
  direct_number_rights:"fcc_900_service_and_actual_carrier_access_must_be_verified",
  national_portability:"900_pay_per_call_number_portability_not_confirmed",
  eligible_services:"federal_and_state_900_pay_per_call_disclosure_and_billing_rules",
  source_urls:deep(["https://www.ecfr.gov/current/title-47/chapter-I/subchapter-B/part-64/subpart-O",
   "https://www.ftc.gov/business-guidance/resources/complying-900-number-rule"])
 })
});
export const APP_INTERNATIONAL_MARKET_ORDER=deep(["FR","ES","IT","GB","US"]);

/** Only checks a plausible prefix, never numbering legality or porting right. */
export function inspectAudiotelCandidateNumber({country_code,number}={}){
 const profile=APP_MARKET_PROFILES[country_code];
 if(!profile)err("COUNTRY_NOT_APPROVED_FOR_RESEARCH");
 if(typeof number!=="string"||number.length>32)err("NUMBER_INVALID");
 const normalized=number.trim().replace(/[ .()-]/g,"");
 if(!/^\+[1-9][0-9]{7,14}$/.test(normalized))err("E164_FORMAT_INVALID");
 const national=normalized.slice(1+profile.calling_code.length);
 if(!normalized.startsWith("+"+profile.calling_code)||national.length<6)
  err("COUNTRY_CODE_MISMATCH");
 let prefixMatched=profile.premium_prefixes.find(v=>national.startsWith(v));
 // UK national prefix is 09, whereas E.164 removes trunk 0.
 if(country_code==="GB")prefixMatched=national.startsWith("9")?"09":undefined;
 // Italy has no automatic trunk-zero removal; national 892/899 stays.
 if(country_code==="FR"){
  prefixMatched=/^\+338(?:1|2|9)[0-9]{7}$/.test(normalized)?
    "0"+national.slice(0,2):undefined;
 }
 if(!prefixMatched)err("NOT_A_RESEARCHED_PREMIUM_RANGE");
 return deep({
  country_code,number_e164:normalized,prefix:prefixMatched,
  prefix_recognized_for_research:true,
  exists_in_number_inventory:false,operator_verified:false,
  actual_number_validity_confirmed:false,
  tariff_eligibility_confirmed:false,portability_confirmed:false
 });
}

const PORT_STATES=deep(["draft","identity_pending","documents_pending",
 "regulatory_review","carrier_agreement_pending","preparing_route",
 "awaiting_operator_confirmation","on_hold","rejected","cancelled"]);
export function planAudiotelInternationalPortability(input={}){
 if(!isObject(input)||Object.keys(input).some(x=>![
   "business_unit","country_code","number","request_reference","current_carrier_reference",
   "customer_holder_reference"].includes(x)))err("PORTABILITY_INPUT_INVALID");
 if(input.business_unit!==UNIT)err("SCOPE_INVALID");
 const candidate=inspectAudiotelCandidateNumber(input);
 const request=required(input.request_reference,"PORTABILITY_REQUEST");
 const holder=required(input.customer_holder_reference,"HOLDER_REFERENCE");
 const carrier=input.current_carrier_reference==null?null:
  required(input.current_carrier_reference,"CARRIER_REFERENCE");
 return deep({
  schema_version:"app-international-portability-prelaunch/1",
  business_unit:UNIT,country_code:input.country_code,request_reference:request,
  number_e164:candidate.number_e164,holder_reference:holder,
  current_carrier_reference:carrier,possible_stages:PORT_STATES,
  current_stage:"draft",national_portability_framework:
    APP_MARKET_PROFILES[input.country_code].national_portability,
  national_regulatory_review_required:true,
  operator_contract_required:true,number_holder_mandate_required:true,
  acquisition_entitlement_verified:false,ported:false,
  carrier_api_available:false,carrier_request_sent:false,
  routing_enabled:false,customer_notified:false,can_submit:false
 });
}

export function reviewAudiotelMarketContribution(input={}){
 if(!isObject(input)||Object.keys(input).some(x=>![
  "business_unit","country_code","operating_model","quotation_reference",
  "validated_billable_seconds","carrier_collected_minor","publisher_due_minor",
  "interconnect_minor","carrier_fees_minor","payment_processing_minor",
  "fraud_reserve_minor","fx_cost_minor","country_compliance_minor",
  "setup_cost_minor"].includes(x)))err("CONTRIBUTION_INPUT_INVALID");
 if(input.business_unit!==UNIT)err("SCOPE_INVALID");
 const profile=APP_MARKET_PROFILES[input.country_code];
 if(!profile)err("COUNTRY_NOT_APPROVED_FOR_RESEARCH");
 if(!["attributary_candidate","partner_local_candidate"].includes(input.operating_model))
  err("OPERATING_MODEL_INVALID");
 required(input.quotation_reference,"QUOTE_REFERENCE");
 const seconds=fee(input.validated_billable_seconds,"SECONDS");
 const gross=fee(input.carrier_collected_minor,"CARRIER_GROSS");
 const publisher=fee(input.publisher_due_minor,"PUBLISHER_DUE");
 const costs=[
 "interconnect_minor","carrier_fees_minor","payment_processing_minor",
 "fraud_reserve_minor","fx_cost_minor","country_compliance_minor"
 ].map(k=>fee(input[k],"COST_"+k));
 const setup=fee(input.setup_cost_minor,"SETUP_COST");
 const total=costs.reduce((a,b)=>a+b,0);
 if(!Number.isSafeInteger(total)||total>1e12)err("COST_OVERFLOW");
 const margin=gross-publisher-total;
 const milliPerMinute=seconds>0?
  ((BigInt(margin)<0n?-1n:1n)*
   ((BigInt(Math.abs(margin))*60000n+BigInt(Math.floor(seconds/2)))/BigInt(seconds))):null;
 if(milliPerMinute!==null&&
   (milliPerMinute>BigInt(Number.MAX_SAFE_INTEGER)||milliPerMinute<BigInt(-Number.MAX_SAFE_INTEGER)))
   err("MARGIN_PER_MINUTE_OVERFLOW");
 const marginPerMinute=milliPerMinute===null?null:Number(milliPerMinute)/1000;
 return deep({
  schema_version:"app-market-profitability-prelaunch/1",
  business_unit:UNIT,country_code:input.country_code,currency:profile.currency,
  operating_model:input.operating_model,quotation_reference:input.quotation_reference,
  eligible_seconds_reported:seconds,reported_carrier_collected_minor:gross,
  reported_publisher_due_minor:publisher,reported_variable_cost_minor:total,
  reported_one_time_setup_cost_minor:setup,
  contribution_before_fixed_setup_and_tax_minor:margin,
  contribution_minor_per_minute_preview:marginPerMinute,
  comparison_validated_by_carrier:false,number_rights_verified:false,
  tariff_accepted:false,market_tax_policy_verified:false,
  fx_conversion_executed:false,legal_funds_flow_approved:false,
  foreign_market_activated:false,portability_executable:false,
  recommended_market_activation:false,
  external_spend_authorized:false,external_carrier_called:false,
  can_buy_foreign_numbers:false
 });
}
