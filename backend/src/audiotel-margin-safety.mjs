/**
 * Audiotel Premium Pro: SVA per-minute precontract margin guard.
 * Arcep publishes max HT service tariff by category. Unit: 1/1000 EUR/min.
 * Check: https://www.arcep.fr/la-regulation/grands-dossiers-thematiques-transverses/la-numerotation.html
 * Regulated service price is not the operator's net cash paid to Audiotel.
 * Financial decision aid, NEVER a signed offer, a tariff change or a payout.
 */
const CAPS_MILLIEUR=Object.freeze({"081":50,"082":167,"089":667});
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
function amount(value,key){if(!Number.isSafeInteger(value)||value<0||value>1_000_000)fail("APP_MARGIN_INVALID_"+key);return value;}
export const APP_SVA_TARIFF_CAPS_MILLIEUR_PER_MIN=CAPS_MILLIEUR;
export function analyzeAudiotelTariffMargin(input={}){
  if(input?.business_unit!=="audiotel_platform"||input.currency!=="EUR"||input.billing_basis!=="minute")
    fail("APP_MARGIN_SCOPE_OR_TARIFF_TYPE_INVALID");
  const cap=CAPS_MILLIEUR[input.category];
  if(!cap)fail("APP_MARGIN_CATEGORY_UNSUPPORTED");
  const retail=amount(input.retail_service_millieur_per_min,"retail_service_rate");
  const operatorNet=amount(input.operator_net_millieur_per_min,"operator_net_rate");
  const publisher=amount(input.publisher_due_millieur_per_min,"publisher_due_rate");
  const network=amount(input.network_cost_millieur_per_min,"network_cost");
  const psp=amount(input.psp_cost_millieur_per_min,"psp_cost");
  const other=amount(input.other_variable_cost_millieur_per_min,"other_cost");
  const target=amount(input.target_margin_millieur_per_min??70,"target_margin");
  const costs=network+psp+other;
  if(!Number.isSafeInteger(costs))fail("APP_MARGIN_COST_OVERFLOW");
  const computed=operatorNet-publisher-costs;
  const reasons=[];
  if(retail>cap)reasons.push("arcep_service_tariff_cap_exceeded");
  if(operatorNet>retail)reasons.push("operator_net_exceeds_service_tariff");
  if(target>cap)reasons.push("margin_target_exceeds_regulatory_service_cap");
  if(computed<0)reasons.push("negative_contribution_margin");
  else if(computed<target)reasons.push("under_target_margin");
  if(input.operator_rate_verified!==true)reasons.push("operator_net_rate_not_verified");
  if(input.publisher_contract_verified!==true)reasons.push("publisher_remuneration_not_verified");
  if(input.costs_verified!==true)reasons.push("variable_costs_not_verified");
  return Object.freeze({
    schema_version:"audiotel-margin-safety/1",
    business_unit:"audiotel_platform",currency:"EUR",category:input.category,
    billing_basis:"minute",unit:"millieur_per_min",
    regulated_service_cap:cap,retail_service_rate:retail,operator_net_rate:operatorNet,
    publisher_due_rate:publisher,variable_costs:costs,
    estimated_contribution_margin_before_fixed_costs_and_tax:computed,
    minimum_margin_target:target,
    status:reasons.length?"blocked":"candidate_for_independent_finance_review",
    blocked_reasons:Object.freeze(reasons),
    verified_tariff_activation:false,
    number_assignment_authorized:false,offer_publish_authorized:false,
    customer_rate_change_authorized:false,payout_authorized:false
  });
}
