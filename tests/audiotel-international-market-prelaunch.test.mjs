import test from "node:test";
import assert from "node:assert/strict";
import {
 APP_MARKET_PROFILES,APP_INTERNATIONAL_MARKET_ORDER,
 inspectAudiotelCandidateNumber,planAudiotelInternationalPortability,
 reviewAudiotelMarketContribution
} from "../backend/src/audiotel-international-market-prelaunch.mjs";

test("FR ES IT GB US regulatory authorities and local-currency boundaries",()=>{
 assert.deepEqual(APP_INTERNATIONAL_MARKET_ORDER,["FR","ES","IT","GB","US"]);
 assert.equal(APP_MARKET_PROFILES.FR.regulator,"ARCEP");
 assert.equal(APP_MARKET_PROFILES.ES.regulator,"CNMC");
 assert.equal(APP_MARKET_PROFILES.IT.regulator,"AGCOM");
 assert.equal(APP_MARKET_PROFILES.GB.regulator,"Ofcom");
 assert.equal(APP_MARKET_PROFILES.US.regulator,"FCC");
 assert.equal(APP_MARKET_PROFILES.GB.currency,"GBP");
 assert.equal(APP_MARKET_PROFILES.US.currency,"USD");
 for(const country of APP_INTERNATIONAL_MARKET_ORDER)
  assert.equal(APP_MARKET_PROFILES[country].source_urls.length>=1,true);
});
test("national premium prefixes are candidates only, never actual number or porting entitlement",()=>{
 for(const [country_code,number,prefix] of [
  ["FR","+33890123456","089"],
  ["ES","+34806123456","806"],
  ["IT","+39899123456","899"],
  ["GB","+449123456789","09"],
  ["US","+19002123456","900"]
 ]){
  const p=inspectAudiotelCandidateNumber({country_code,number});
  assert.equal(p.prefix,prefix);
  assert.equal(p.prefix_recognized_for_research,true);
  assert.equal(p.operator_verified,false);
  assert.equal(p.exists_in_number_inventory,false);
  assert.equal(p.portability_confirmed,false);
  assert.equal(p.actual_number_validity_confirmed,false);
 }
 for(const data of [
  {country_code:"FR",number:"+33800123456"},
  {country_code:"ES",number:"+44806123456"},
  {country_code:"GB",number:"+44800123456"},
  {country_code:"DE",number:"+49899123456"}
 ])assert.throws(()=>inspectAudiotelCandidateNumber(data));
});
test("country-specific portability plans stay draft even where a prefix looks correct",()=>{
 const a=planAudiotelInternationalPortability({
  business_unit:"audiotel_platform",country_code:"ES",
  number:"+34807123456",request_reference:"APP-PORT-ES-2026-0001",
  customer_holder_reference:"HOLDER-2026-ES-001",
  current_carrier_reference:"CARRIER-ES-0001"
 });
 assert.equal(a.number_e164,"+34807123456");
 assert.equal(a.national_regulatory_review_required,true);
 assert.equal(a.carrier_api_available,false);
 assert.equal(a.ported,false);
 assert.equal(a.carrier_request_sent,false);
 assert.equal(a.routing_enabled,false);
 assert.equal(a.can_submit,false);
 assert.ok(a.possible_stages.includes("cancelled"));
 assert.ok(a.possible_stages.includes("rejected"));
});
test("contribution margin is per local currency, never silently FX converted",()=>{
 for(const code of APP_INTERNATIONAL_MARKET_ORDER){
  const p=reviewAudiotelMarketContribution({
   business_unit:"audiotel_platform",country_code:code,
   operating_model:"partner_local_candidate",
   quotation_reference:"CARRIER-QUOTE-2026-001",
   validated_billable_seconds:600,
   carrier_collected_minor:1000,
   publisher_due_minor:650,
   interconnect_minor:40,carrier_fees_minor:40,
   payment_processing_minor:20,fraud_reserve_minor:10,
   fx_cost_minor:15,country_compliance_minor:25,
   setup_cost_minor:1000
  });
  assert.equal(p.contribution_before_fixed_setup_and_tax_minor,200);
  assert.equal(p.contribution_minor_per_minute_preview,20);
  assert.equal(p.currency,APP_MARKET_PROFILES[code].currency);
  assert.equal(p.recommended_market_activation,false);
  assert.equal(p.can_buy_foreign_numbers,false);
  assert.equal(p.fx_conversion_executed,false);
  assert.equal(p.portability_executable,false);
 }
});
test("quote cannot claim approved market and negative margins remain visible",()=>{
 const x={
  business_unit:"audiotel_platform",country_code:"GB",
  operating_model:"attributary_candidate",
  quotation_reference:"UK-QUOTE-2026-0001",
  validated_billable_seconds:60,carrier_collected_minor:100,
  publisher_due_minor:150,interconnect_minor:10,carrier_fees_minor:5,
  payment_processing_minor:5,fraud_reserve_minor:0,fx_cost_minor:0,
  country_compliance_minor:20,setup_cost_minor:100
 };
 const result=reviewAudiotelMarketContribution(x);
 assert.equal(result.contribution_before_fixed_setup_and_tax_minor,-90);
 assert.equal(result.contribution_minor_per_minute_preview,-90);
 assert.equal(result.number_rights_verified,false);
 assert.throws(()=>reviewAudiotelMarketContribution({...x,market_activated:true}),
  {code:"APP_INTL_CONTRIBUTION_INPUT_INVALID"});
 assert.throws(()=>reviewAudiotelMarketContribution({...x,country_code:"AU"}),
  {code:"APP_INTL_COUNTRY_NOT_APPROVED_FOR_RESEARCH"});
});
