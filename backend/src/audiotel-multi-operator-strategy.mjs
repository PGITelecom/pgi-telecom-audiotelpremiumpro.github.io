/**
 * Audiotel Premium Pro - neutral multi-operator strategy planner.
 *
 * This is an OFFLINE/STAFF-ONLY DECISION AID. It does not configure carrier
 * routes, allocate numbers, run porting, record CDRs, or move third-party funds.
 * Scenarios are provided by the owner. No imaginary wholesale prices.
 *
 * All money is calculated in BigInt millieuros (EUR 0.001) and cents.
 * APP's rate is the contractually DUE APP revenue after publishers' shares,
 * operator retention and any upstream deductions, not retail call revenue.
 */
const UNIT="audiotel_platform";
const SERVICES=Object.freeze([
 "collection","portability","sip_routing","cdr_reporting","publisher_payout","noc_support"
]);
const OPT=Object.freeze(["max_profit","balanced","max_delegation"]);
const ID=/^[a-z][a-z0-9_-]{1,39}$/;
const fail=k=>{const e=new Error("APP_MULTI_OPERATOR_"+k);e.status=422;e.code=e.message;throw e;};
const plain=v=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&
 (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
function int(v,k,max,min=0){
 if(!Number.isSafeInteger(v)||v<min||v>max)fail(k);
 return v;
}
function validId(id,k){if(typeof id!=="string"||!ID.test(id))fail(k);return id;}
function currency(milli){
 const abs=milli<0n?-milli:milli;
 const cents=(abs+5n)/10n;
 return Number(milli<0n?-cents:cents)/100;
}
const isValidService=x=>SERVICES.includes(x);
const compare=(a,b)=>a>b?1:a<b?-1:0;
export const APP_MULTI_OPERATOR_WORKSTREAMS=SERVICES;
export const APP_MULTI_OPERATOR_OBJECTIVES=OPT;

function providers(input){
 if(!Array.isArray(input)||input.length<1||input.length>20)fail("PROVIDERS_INVALID");
 const result=[],seen=new Set();
 for(const p of input){
  if(!plain(p))fail("PROVIDER_INVALID");
  const id=validId(p.id,"PROVIDER_ID_INVALID");
  if(id==="audiotel"||seen.has(id))fail("PROVIDER_DUPLICATE");
  seen.add(id);
  if(typeof p.label!=="string"||!p.label.trim()||p.label.trim().length>80)fail("PROVIDER_LABEL_INVALID");
  if(!Array.isArray(p.services)||p.services.length<1||p.services.length>SERVICES.length||
      new Set(p.services).size!==p.services.length||!p.services.every(isValidService))
    fail("PROVIDER_SERVICES_INVALID");
  result.push(Object.freeze({id,label:p.label.trim(),services:Object.freeze([...p.services])}));
 }
 return Object.freeze(result);
}
function plan(input,roster,minutes,retentionBps){
 if(!plain(input))fail("PLAN_INVALID");
 const id=validId(input.id,"PLAN_ID_INVALID");
 if(typeof input.label!=="string"||!input.label.trim()||input.label.length>100)fail("PLAN_LABEL_INVALID");
 if(!plain(input.assignments))fail("ASSIGNMENTS_INVALID");
 if(Object.keys(input.assignments).length!==SERVICES.length)fail("ASSIGNMENTS_INCOMPLETE");
 const byId=new Map(roster.map(p=>[p.id,p]));
 const assignments={},providersUsed=new Set(),issues=[];
 for(const service of SERVICES){
  const providerId=input.assignments[service];
  if(providerId!=="audiotel"){
   if(!byId.has(providerId)||!byId.get(providerId).services.includes(service))
     fail("PROVIDER_NOT_CAPABLE_"+service.toUpperCase());
   providersUsed.add(providerId);
  }
  if(typeof providerId!=="string"||(providerId!=="audiotel"&&!ID.test(providerId)))
   fail("ASSIGNMENT_INVALID");
  assignments[service]=providerId;
 }
 // The owner explicitly requires direct carrier/authorized PSP payout to editors.
 if(assignments.publisher_payout==="audiotel")issues.push("publisher_funds_must_not_transit_audiotel");
 // Carrier/source CDR must have a documented data transport between vendors.
 if(assignments.collection!==assignments.cdr_reporting&&
    input.cross_provider_reconciliation_documented!==true)
   issues.push("cdr_cross_provider_reconciliation_not_documented");
 if(assignments.collection!==assignments.sip_routing&&
    input.cross_provider_sip_interconnection_documented!==true)
   issues.push("sip_cross_provider_interconnection_not_documented");
 // These flags are owner claims for a preview, NOT independently verified certificates.
 const q=input.financial_terms;
 if(!plain(q))fail("FINANCIAL_TERMS_MISSING");
 const ownRevenue=int(q.app_own_revenue_millieur_per_min,"APP_REVENUE_INVALID",1000000);
 const variable=int(q.app_variable_cost_millieur_per_min,"APP_VARIABLE_COST_INVALID",1000000);
 const fixed=int(q.monthly_fixed_cost_cents,"FIXED_COST_INVALID",1000000000000);
 const setup=int(q.one_off_setup_cost_cents??0,"SETUP_COST_INVALID",1000000000000);
 const revenue=BigInt(minutes)*BigInt(ownRevenue);
 const variableCost=BigInt(minutes)*BigInt(variable);
 const fixedCost=BigInt(fixed)*10n;
 const operating=revenue-variableCost-fixedCost;
 const personal=retentionBps===null?null:(operating>0n?operating*BigInt(retentionBps)/10000n:0n);
 const delegated=SERVICES.filter(s=>assignments[s]!=="audiotel");
 const internally=SERVICES.filter(s=>assignments[s]==="audiotel");
 const evidence=plain(input.evidence)?input.evidence:{};
 const flags=Object.freeze({
  commercial_quote_verified:evidence.commercial_quote_verified===true,
  carrier_contract_verified:evidence.carrier_contract_verified===true,
  regulatory_rights_verified:evidence.regulatory_rights_verified===true,
  direct_payout_contract_verified:evidence.direct_payout_contract_verified===true,
  technical_acceptance_verified:evidence.technical_acceptance_verified===true,
  tax_adviser_reviewed:evidence.tax_adviser_reviewed===true
 });
 if(!flags.commercial_quote_verified)issues.push("commercial_quote_unverified");
 if(!flags.carrier_contract_verified)issues.push("carrier_contract_unverified");
 if(!flags.regulatory_rights_verified)issues.push("numbering_rights_unverified");
 if(!flags.direct_payout_contract_verified)issues.push("direct_payout_contract_unverified");
 if(!flags.technical_acceptance_verified)issues.push("technical_acceptance_unverified");
 if(!flags.tax_adviser_reviewed||retentionBps===null)issues.push("personal_after_tax_net_unverified");
 if(operating<=0n)issues.push("operating_result_not_positive");
 if(delegated.length===SERVICES.length&&providersUsed.size===1)issues.push("single_provider_concentration");
 // No proof is ever independently established from user-provided booleans.
 return Object.freeze({
  id,label:input.label.trim(),assignments:Object.freeze(assignments),
  external_provider_ids:Object.freeze([...providersUsed].sort()),
  external_provider_count:providersUsed.size,
  delegated_services:Object.freeze(delegated),
  internally_managed_services:Object.freeze(internally),
  delegation_percent:Math.round(100*delegated.length/SERVICES.length),
  monthly_app_own_revenue_eur:currency(revenue),
  monthly_app_variable_costs_eur:currency(variableCost),
  monthly_app_fixed_costs_eur:fixed/100,
  monthly_operating_before_tax_eur:currency(operating),
  one_off_setup_eur:setup/100,
  estimated_personal_monthly_net_eur:personal===null?null:currency(personal),
  estimated_personal_net_eur_per_min:personal===null||minutes===0?null:Number(personal)/1000/minutes,
  app_contribution_eur_per_min:(ownRevenue-variable)/1000,
  issues:Object.freeze([...new Set(issues)]),
  preview_contractual_quote_present:flags.commercial_quote_verified,
  // A validated quote and contract are separate from acceptance and release.
  preview_has_all_owner_claimed_evidence:
   Object.values(flags).every(Boolean)&&issues.length===0,
  compatible_for_scenario_selection:!issues.some(k=>[
   "publisher_funds_must_not_transit_audiotel",
   "cdr_cross_provider_reconciliation_not_documented",
   "sip_cross_provider_interconnection_not_documented",
   "operating_result_not_positive"
  ].includes(k)),
  bank_or_carrier_api_calls_permitted:false
 });
}

/**
 * Picks a financially viable, technically coherent planning option.
 * For balanced/delegation, the OWNER declares tolerated loss of positive
 * operating contribution versus the maximum-profit viable option.
 * No live selection, contract amendment or dispatch happens.
 */
export function planAudiotelMultiOperatorStrategy(input={}){
 if(!plain(input)||input.business_unit!==UNIT||input.currency!=="EUR")fail("SCOPE_INVALID");
 if(!OPT.includes(input.objective))fail("OBJECTIVE_INVALID");
 const minutes=int(input.billable_minutes_month,"MINUTES_INVALID",50000000);
 const lossBps=int(input.max_profit_sacrifice_bps??0,"SACRIFICE_INVALID",10000);
 let retentionBps=null;
 if(input.personal_retention_basis_points!==null&&input.personal_retention_basis_points!==undefined)
  retentionBps=int(input.personal_retention_basis_points,"RETENTION_INVALID",10000);
 const roster=providers(input.providers);
 if(!Array.isArray(input.plans)||input.plans.length<1||input.plans.length>30)fail("PLANS_INVALID");
 const list=input.plans.map(p=>plan(p,roster,minutes,retentionBps));
 if(new Set(list.map(p=>p.id)).size!==list.length)fail("PLAN_DUPLICATES");
 const compatible=list.filter(p=>p.compatible_for_scenario_selection);
 const ordered=[...compatible].sort((a,b)=>
  b.monthly_operating_before_tax_eur-a.monthly_operating_before_tax_eur||
  b.delegation_percent-a.delegation_percent||
  a.external_provider_count-b.external_provider_count||a.id.localeCompare(b.id));
 const best=ordered[0]||null;
 let eligible=[];
 if(best&&best.monthly_operating_before_tax_eur>0){
  const max=BigInt(Math.round(best.monthly_operating_before_tax_eur*100));
  const allowed= input.objective==="max_profit"?0:lossBps;
  const lowerBound=max*BigInt(10000-allowed)/10000n;
  eligible=ordered.filter(p=>BigInt(Math.round(p.monthly_operating_before_tax_eur*100))>=lowerBound);
 }
 // Preference for fewer suppliers at equal delegation and financial outcome:
 // it reduces handover complexity without forcing single-carrier lock-in.
 const chosen=(input.objective==="max_profit"?ordered:eligible.sort((a,b)=>
  b.delegation_percent-a.delegation_percent||
  b.monthly_operating_before_tax_eur-a.monthly_operating_before_tax_eur||
  a.external_provider_count-b.external_provider_count||
  a.id.localeCompare(b.id)))[0]||null;
 const validSelected=chosen&&chosen.monthly_operating_before_tax_eur>0?chosen:null;
 const other=best&&validSelected?best.monthly_operating_before_tax_eur-validSelected.monthly_operating_before_tax_eur:null;
 return Object.freeze({
  schema_version:"app-multi-operator-strategy/1",business_unit:UNIT,currency:"EUR",
  objective:input.objective,billable_minutes_month:minutes,
  max_profit_sacrifice_bps:lossBps,
  personal_retention_assumption_bps:retentionBps,
  providers:roster,plans:Object.freeze(list),
  baseline_max_profit_plan_id:best&&best.monthly_operating_before_tax_eur>0?best.id:null,
  selected_preview_plan_id:validSelected?.id||null,
  selected_preview_reason:validSelected?"highest_delegation_within_owners_profit_limit":"no_viable_or_compatible_offer",
  monthly_company_result_sacrifice_eur:other,
  personal_net_verified:false,
  external_operator_contract_verified:false,
  arcep_authorization_verified:false,
  direct_payout_live_verified:false,
  application_changes_persisted:false,
  live_operator_selected:false,
  number_assignment_authorized:false,
  external_request_sent:false,
  money_transfer_authorized:false,
  no_live_dispatch:true
 });
}
