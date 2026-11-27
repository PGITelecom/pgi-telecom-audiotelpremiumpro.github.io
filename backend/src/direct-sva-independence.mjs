// Preparation and quote-comparison only. Does not route calls, allocate numbers,
// collect SVA revenue or authorize payments. No private commercial thresholds here.
export const DIRECT_SVA_ROUTING_DEADLINE="2028-07-01";
export const DIRECT_SVA_REFERENCE_URL="https://www.arcep.fr/mes-demarches-et-services/acteurs-regules/operateurs-telecoms/fiches-pratiques/operateurs-telecoms-affectation-des-numeros-de-telephone.html";

const OWNED=Object.freeze([
 "client_contracts","arcep_number_inventory","routing_rules_and_sip_control",
 "cdr_reconciliation","publisher_portal","commission_audit","customer_data"
]);
const EXTERNAL=Object.freeze([
 {key:"direct_arcep_allocation",issuer:"arcep",need:"Decision d attribution des propres numeros 089",category:"regulatory"},
 {key:"network_interconnection",issuer:"carrier",need:"Accords d interconnexion, collecte SVA, acheminement national et facturation",category:"network"},
 {key:"portability_apnf_rsva",issuer:"apnf",need:"Acces APNF/RSVA et procedure de portabilite",category:"regulatory"},
 {key:"sva_af2m",issuer:"af2m",need:"Exigences SVA, MGIT, signaletique et cadre contractuel",category:"regulatory"},
 {key:"payment_flow",issuer:"regulated_psp",need:"Paiements aux editeurs sous cadre autorise avec commission distincte",category:"financial"},
 {key:"own_2028_routing_prefix",issuer:"arcep",need:"Prefixe de routage attribue en propre pour exploiter des numeros portes des le 01/07/2028",category:"regulatory"}
]);

function safeDate(value){
 const t=value instanceof Date?value:new Date(value);
 if(!Number.isFinite(t.getTime()))throw new TypeError("Invalid as_of date");
 return t;
}
function claimedProof(record,issuer,asOf){
 return record&&typeof record==="object"&&!Array.isArray(record)&&
   record.status==="verified"&&record.issuer===issuer&&
   typeof record.reference==="string"&&record.reference.trim().length>=6&&
   typeof record.checked_at==="string"&&Number.isFinite(Date.parse(record.checked_at))&&
   Date.parse(record.checked_at)<=asOf.getTime();
}

/** Regulatory roadmap, never a production authorization or attestation of evidence. */
export function planDirectSvaAutonomy({as_of=new Date(),ported_numbers=true,evidence={}}={}){
 const at=safeDate(as_of),prefixDeadline=Date.parse(DIRECT_SVA_ROUTING_DEADLINE+"T00:00:00Z");
 const ported=ported_numbers!==false,deadlinePassed=at.getTime()>=prefixDeadline;
 const gates=EXTERNAL.map(spec=>{
   const mandatoryNow=spec.key!=="own_2028_routing_prefix"||(ported&&deadlinePassed);
   const proof=claimedProof(evidence?.[spec.key],spec.issuer,at);
   return Object.freeze({key:spec.key,category:spec.category,external_issuer:spec.issuer,
     requirement:spec.need,mandatory_now:mandatoryNow,
     mandatory_for_2028_portability:spec.key==="own_2028_routing_prefix"&&ported,
     documentary_evidence_claimed:Boolean(proof),independent_verification_performed:false,
     status:proof?"external_verification_still_required":"evidence_missing"});
 });
 return Object.freeze({
   schema_version:"pgi-sva-direct-autonomy/1",as_of:at.toISOString(),target:"own_arcep_089_and_own_customer_contracts",
   service_scope:"french_premium_rate_sva_089",
   owned_operations:OWNED,
   irreducible_dependencies:EXTERNAL.map(s=>Object.freeze({key:s.key,external_issuer:s.issuer})),
   regulation_2018:"new_08_number_lending_between_operators_prohibited_since_2018",
   legacy_number_lending_sunset_deadline:DIRECT_SVA_ROUTING_DEADLINE,
   legacy_number_lending_allowed_after_deadline:false,
   legacy_number_regularization_methods:Object.freeze(["arcep_transfer_of_complete_1000_number_subblocks","apnf_portability_for_individually_loaned_numbers"]),
   routing_prefix_deadline:DIRECT_SVA_ROUTING_DEADLINE,
   routing_prefix_required_now_for_ported_numbers:ported&&deadlinePassed,
   routing_prefix_required_in_future_for_ported_numbers:ported&&!deadlinePassed,
   delegate_technical_routing_possible:true,
   own_prefix_can_point_to_technical_delegate:true,
   payment_psp_or_independently_authorized_payment_model_required:true,
   reduce_unnecessary_reseller_layers:true,
   external_gates:Object.freeze(gates),
   missing_documentary_evidence:Object.freeze(gates.filter(x=>x.mandatory_now&&!x.documentary_evidence_claimed).map(x=>x.key)),
   evidence_independently_verified:false,network_089_connected:false,
   number_allocation_authorized:false,payout_execution_authorized:false,
   activation_authorized:false,production_configuration_changed:false
 });
}

const FLAG_FIELDS=Object.freeze([
 "uses_own_arcep_089","collection_of_french_sva_confirmed","routes_ported_numbers_after_2028",
 "regulated_publisher_settlement","direct_publisher_iban","separate_platform_commission",
 "cdr_api_available","national_reach_confirmed"
]);
const MONEY_FIELDS=Object.freeze([
 "monthly_fixed_cents","one_time_setup_cents","per_minute_micro_eur",
 "per_publisher_monthly_cents","per_payout_cents"
]);
function unsigned(value,max=1000000000000){
 return Number.isSafeInteger(value)&&value>=0&&value<=max;
}
function nonempty(s){return typeof s==="string"&&s.trim().length>0;}
function ceilDiv(x,y){return (x+y-1n)/y;}
/**
 * Deterministic comparable-cost shortlist; requires complete ALL-IN quotes.
 * All prices must include every external service supplier (collection, voice,
 * licensed PSP, any platform reseller). Prices are ex VAT, in EUR.
 * This ranks external costs, NOT personal after-tax profits.
 */
export function compareDirectSvaSupplierQuotes(input={}){
 const minutes=input.monthly_minutes,publishers=input.publishers,payouts=input.monthly_payouts;
 if(!unsigned(minutes,1000000000)||minutes===0||!unsigned(publishers,1000000)||
    !unsigned(payouts,10000000)||!Array.isArray(input.offers)||input.offers.length>100)
   throw new TypeError("Invalid comparison scenario");
 const results=input.offers.map((offer,index)=>{
   const failures=[];
   if(!offer||typeof offer!=="object"||Array.isArray(offer))return {index,eligible:false,blockers:["invalid_offer"]};
   const name=nonempty(offer.name)?offer.name.trim().slice(0,120):"Offer "+(index+1);
   if(offer.quote_complete!==true)failures.push("complete_binding_quote_missing");
   if(offer.same_service_scope!==true)failures.push("not_equivalent_089_scope");
   for(const flag of FLAG_FIELDS)if(offer[flag]!==true)failures.push(flag+"_not_confirmed");
   if(offer.exclusivity!==false)failures.push("exclusivity_not_ruled_out");
   if(offer.minimum_monthly_minutes!==0)failures.push("minimum_monthly_minutes_not_zero");
   if(offer.minimum_monthly_spend_cents!==0)failures.push("minimum_spend_not_zero");
   if(offer.termination_fee_cents!==0)failures.push("termination_fee_not_zero");
   for(const field of MONEY_FIELDS)if(!unsigned(offer[field]))failures.push(field+"_missing_or_invalid");
   if(!unsigned(offer.setup_amortization_months,120)||offer.setup_amortization_months<1)
    failures.push("amortization_period_invalid");
   if(!Array.isArray(offer.external_contractors)||offer.external_contractors.length===0||
     offer.external_contractors.length>12||
     offer.external_contractors.some(x=>!nonempty(x)||x.trim()==="internal"))
     failures.push("external_contractors_not_identified");
   if(failures.length)return Object.freeze({index,name,eligible:false,blockers:Object.freeze(failures)});
   const cost=BigInt(minutes)*BigInt(offer.per_minute_micro_eur)+
     10000n*(BigInt(offer.monthly_fixed_cents)+
     BigInt(publishers)*BigInt(offer.per_publisher_monthly_cents)+
     BigInt(payouts)*BigInt(offer.per_payout_cents))+
     ceilDiv(10000n*BigInt(offer.one_time_setup_cents),BigInt(offer.setup_amortization_months));
   return Object.freeze({index,name,eligible:true,monthly_external_cost_micro_eur:cost.toString(),
     estimated_external_partner_count:new Set(offer.external_contractors.map(x=>x.trim().toLowerCase())).size,
     claim_validation:"supplier_quote_data_only_not_independently_verified",
     blockers:Object.freeze([])});
 });
 const qualified=results.filter(x=>x.eligible).sort((a,b)=>{
   const ac=BigInt(a.monthly_external_cost_micro_eur),bc=BigInt(b.monthly_external_cost_micro_eur);
   return ac<bc?-1:ac>bc?1:a.estimated_external_partner_count-b.estimated_external_partner_count||a.index-b.index;
 });
 return Object.freeze({schema_version:"pgi-sva-direct-cost-comparison/1",
   scope:"same_revenue_089_service_only",monthly_minutes:minutes,publishers,monthly_payouts:payouts,
   ranking:Object.freeze(qualified),excluded:Object.freeze(results.filter(x=>!x.eligible)),
   taxes_and_personal_net_included:false,contractual_evidence_independently_verified:false,
   supplier_selected:false,any_real_number_or_payout_activated:false});
}
