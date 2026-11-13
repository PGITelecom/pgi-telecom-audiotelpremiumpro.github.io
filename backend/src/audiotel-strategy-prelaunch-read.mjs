/**
 * Read-only administrative strategy snapshot, intended for the EXISTING
 * Audiotel cockpit, but accessible ONLY in explicit local simulator mode.
 * Uses 093 drafts, never edits operating_markets, tenant data or money.
 */
import {AUDIOTEL_FR_2026_RULES} from "./audiotel-fr-legal-form-monitor.mjs";
import {
 APP_INTERNATIONAL_MARKET_ORDER,APP_MARKET_PROFILES
} from "./audiotel-international-market-prelaunch.mjs";
const deny=(code,status=403)=>{throw Object.assign(new Error(code),{code,status});};
export async function readAudiotelStrategyPreview(store,context={}){
 if(context.authenticated!==true||
    context.business_unit!=="audiotel_platform"||
    context.staff_strategy_read_authorized!==true||
    context.role!=="administrator")
   deny("APP_STRATEGY_ACCESS_DENIED");
 if(typeof store?.readSql?.unsafe!=="function")
   deny("APP_STRATEGY_READONLY_STORE_REQUIRED",503);
 const sql=store.readSql.unsafe.bind(store.readSql);
 const rows=await sql("SELECT "+
  "(SELECT count(*)::int FROM app_legal_monthly_monitor_drafts) AS monthly_drafts,"+
  "(SELECT count(*)::int FROM app_legal_form_scenario_drafts) AS form_scenarios,"+
  "(SELECT count(*)::int FROM app_legal_entity_transition_drafts) AS transition_proposals,"+
  "(SELECT count(*)::int FROM app_international_market_entry_drafts) AS market_research_drafts,"+
  "(SELECT count(*)::int FROM app_international_portability_drafts) AS portability_drafts,"+
  "(SELECT count(*)::int FROM app_international_quote_drafts) AS market_quotes");
 const x=rows[0]||{};
 return Object.freeze({
  schema_version:"app-strategy-readonly-prelaunch/1",
  business_unit:"audiotel_platform",status:"preparation_only",
  recorded_monthly_drafts:Number(x.monthly_drafts||0),
  recorded_form_scenarios:Number(x.form_scenarios||0),
  recorded_transition_proposals:Number(x.transition_proposals||0),
  recorded_market_research_drafts:Number(x.market_research_drafts||0),
  recorded_international_portability_drafts:Number(x.portability_drafts||0),
  recorded_market_quotes:Number(x.market_quotes||0),
  domestic_ruleset:AUDIOTEL_FR_2026_RULES.version,
  monthly_schedule_proposal:"05 day each month, 09:00 Europe/Paris, not registered",
  micro_services_ceiling_2026_minor:AUDIOTEL_FR_2026_RULES.micro_services_turnover_ceiling_minor,
  vat_services_standard_2026_minor:AUDIOTEL_FR_2026_RULES.vat_services_standard_minor,
  vat_services_increased_2026_minor:AUDIOTEL_FR_2026_RULES.vat_services_increased_minor,
  research_markets:Object.freeze(APP_INTERNATIONAL_MARKET_ORDER.map(country_code=>
    Object.freeze({country_code,regulator:APP_MARKET_PROFILES[country_code].regulator,
      currency:APP_MARKET_PROFILES[country_code].currency,
      number_families:APP_MARKET_PROFILES[country_code].numbers_display,
      status:"research_only",direct_assignment_confirmed:false,
      premium_portability_confirmed:false,foreign_service_active:false})
  )),
  current_statutory_turnover_minor:null,
  current_legal_optimization_rank:null,
  fiscal_change_authorized:false,
  foreign_number_request_authorized:false,
  live_country_registration_authorized:false,
  monthly_job_registered:false,
  international_products_publicly_advertised:false,
  no_external_calls:true
 });
}
