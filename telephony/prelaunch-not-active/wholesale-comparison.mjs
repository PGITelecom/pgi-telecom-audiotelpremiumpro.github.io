/**
 * Offline wholesale operator evaluation for Audiotel Premium Pro.
 * Inputs are user-authored offer hypotheses, NOT a carrier database.
 * No network, negotiation, signing or payment. Quotes are unverified.
 */
import {evaluateAudiotelUnitEconomics} from "./economics-capacity.mjs";

const REF=/^[A-Za-z0-9_.:/-]{6,140}$/;
const REQUIRED=[
 "direct_arcep_attributaire_compatible",
 "wholesale_sip_interconnect",
 "operator_cdr_export",
 "sva_inbound_and_outbound_portability",
 "tenant_volume_pooling",
 "zero_minimum_per_professional",
 "no_professional_commitment",
 "operator_or_licensed_psp_direct_payout",
 "separate_audiotel_compensation",
 "finance_reconciliation_api_or_file",
 "operator_incident_sla",
 "rgpd_processing_agreement"
];
const PRICE_KEYS=[
 "carrier_fixed_monthly_minor","per_number_monthly_minor",
 "carrier_variable_micros_per_min","payment_variable_micros_per_min",
 "payout_fee_minor","global_minimum_minutes_per_month",
 "global_minimum_shortfall_fee_minor"
];
const obj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
function fail(code){throw Object.assign(new Error("APP_WHOLESALE_"+code),{code:"APP_WHOLESALE_"+code,status:422});}
function shape(value,keys,name){if(!obj(value)||Object.keys(value).some(k=>!keys.includes(k)))fail("INVALID_"+name);}
function num(v,name,max=100000000000){if(!Number.isSafeInteger(v)||v<0||v>max)fail("INVALID_"+name);return v;}

export function assessAudiotelWholesaleDrafts(input={}){
 shape(input,["business_unit","mode","scenario","offers"],"INPUT");
 if(input.business_unit!=="audiotel_platform"||input.mode!=="offline_simulation")
  fail("OFFLINE_ONLY");
 shape(input.scenario,["monthly_minutes","professional_numbers","monthly_professional_payouts",
  "own_fee_micros_per_min","media_micros_per_min","fraud_provision_micros_per_min",
  "fixed_platform_monthly_minor","arcep_block_count","arcep_annual_fee_per_block_minor"],"SCENARIO");
 const s=input.scenario;
 num(s.monthly_minutes,"MINUTES",1000000000);
 num(s.professional_numbers,"NUMBERS",1000000);
 num(s.monthly_professional_payouts,"PAYOUTS",10000000);
 num(s.own_fee_micros_per_min,"OWN_REVENUE",100000000);
 num(s.media_micros_per_min,"MEDIA",100000000);
 num(s.fraud_provision_micros_per_min,"FRAUD",100000000);
 num(s.fixed_platform_monthly_minor,"FIXED_PLATFORM",1000000000);
 num(s.arcep_block_count,"BLOCKS",100000);
 num(s.arcep_annual_fee_per_block_minor,"ANNUAL_ARCEP",1000000);
 if(!Array.isArray(input.offers)||input.offers.length>100)fail("INVALID_OFFERS");
 const refs=new Set();
 const assessed=input.offers.map(offer=>{
  shape(offer,["provider_reference","proposal_reference","evidence_reference",
   "capabilities","price"],"OFFER");
  for(const key of ["provider_reference","proposal_reference"]){
   if(typeof offer[key]!=="string"||!REF.test(offer[key]))fail("INVALID_"+key.toUpperCase());
  }
  if(offer.evidence_reference!=null&&
     (typeof offer.evidence_reference!=="string"||!REF.test(offer.evidence_reference)))
   fail("INVALID_EVIDENCE_REFERENCE");
  if(refs.has(offer.proposal_reference))fail("DUPLICATE_OFFER");
  refs.add(offer.proposal_reference);
  shape(offer.capabilities,REQUIRED,"CAPABILITIES");
  for(const v of Object.values(offer.capabilities))
   if(v!==true&&v!==false&&v!==null)fail("INVALID_CAPABILITY_VALUE");
  shape(offer.price,PRICE_KEYS,"PRICE");
  for(const [k,v] of Object.entries(offer.price)){
   if(v!=null)num(v,k,k.includes("micros")?100000000:1000000000);
  }
  const gaps=REQUIRED.filter(key=>offer.capabilities[key]!==true);
  const refused=REQUIRED.filter(key=>offer.capabilities[key]===false);
  const unknown=REQUIRED.filter(key=>offer.capabilities[key]==null);
  const missingPrice=PRICE_KEYS.filter(key=>offer.price[key]==null);
  const payoutRefusal=offer.capabilities.operator_or_licensed_psp_direct_payout===false;
  const noIndividualMinimum=offer.capabilities.zero_minimum_per_professional===true;
  const noIndividualCommitment=offer.capabilities.no_professional_commitment===true;
  let economics=null;
  if(missingPrice.length===0){
   const p=offer.price;
   const fixed=s.fixed_platform_monthly_minor+p.carrier_fixed_monthly_minor+
    s.professional_numbers*p.per_number_monthly_minor+
    s.monthly_professional_payouts*p.payout_fee_minor+
    (s.monthly_minutes<p.global_minimum_minutes_per_month?
     p.global_minimum_shortfall_fee_minor:0);
   if(!Number.isSafeInteger(fixed)||fixed>100000000000)fail("FIXED_TOTAL_OVERFLOW");
   economics=evaluateAudiotelUnitEconomics({
    business_unit:"audiotel_platform",mode:"offline_simulation",
    model:"separate_audiotel_commission",
    monthly_minutes:s.monthly_minutes,
    audiotel_fee_micros_per_min:s.own_fee_micros_per_min,
    carrier_cost_micros_per_min:p.carrier_variable_micros_per_min,
    media_cost_micros_per_min:s.media_micros_per_min,
    payment_cost_micros_per_min:p.payment_variable_micros_per_min,
    fraud_loss_provision_micros_per_min:s.fraud_provision_micros_per_min,
    fixed_operating_cost_minor:fixed,number_block_count:s.arcep_block_count,
    annual_arcep_fee_minor_per_block:s.arcep_annual_fee_per_block_minor
   });
  }
  const status=gaps.length===0&&economics?
   "commercially_comparable_unverified":
   payoutRefusal?"direct_payout_refusal_owner_review_required":
   !noIndividualMinimum||!noIndividualCommitment?
   "individual_minimum_or_commitment_conflict":"incomplete_terms";
  return Object.freeze({
   provider_reference:offer.provider_reference,
   proposal_reference:offer.proposal_reference,
   evidence_reference:offer.evidence_reference??null,
   status,missing_capabilities:Object.freeze(gaps),
   refusals:Object.freeze(refused),unknown_capabilities:Object.freeze(unknown),
   missing_prices:Object.freeze(missingPrice),
   operator_global_minimum_reported_minor:null,
   global_minimum_minutes_per_month:offer.price.global_minimum_minutes_per_month??null,
   projected_economics:economics,
   written_offer_authenticated:false,carrier_accepted_in_reality:false,
   legal_and_tax_review_completed:false,
   direct_payout_provider_verified:false,
   engagement_authorized:false,operator_contact_authorized:false,
   professional_funds_transit_authorized:false
  });
 });
 const sorted=assessed.filter(x=>x.status==="commercially_comparable_unverified"&&
  x.projected_economics)
  .sort((a,b)=>b.projected_economics.estimated_result_before_taxes_minor-
                   a.projected_economics.estimated_result_before_taxes_minor||
       a.provider_reference.localeCompare(b.provider_reference));
 return Object.freeze({
  business_unit:"audiotel_platform",mode:"offline_simulation",
  offer_count:assessed.length,required_capabilities:Object.freeze([...REQUIRED]),
  assessments:Object.freeze(assessed),
  economically_ranked_unverified_proposal_refs:Object.freeze(sorted.map(x=>x.proposal_reference)),
  contract_selection_finalized:false,operator_contract_signed:false,
  regulatory_operator_role_confirmed:false,direct_payout_legally_enabled:false,
  independent_human_validation_required:true
 });
}
