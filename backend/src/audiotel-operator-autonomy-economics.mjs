/**
 * Audiotel Premium Pro | Comparaison contractuelle "revendeur vs exploitant".
 *
 * Prévision hors production, sans chiffres d'opérateur inventés.
 * Le chiffre "rémunération APP" représente exclusivement le montant dû à APP
 * APRÈS les reversements éditeurs et retenues opérateur selon le contrat.
 * Les fonds éditeurs ne sont JAMAIS considérés comme trésorerie APP.
 *
 * Un coefficient de conservation personnelle est une hypothèse financière et
 * non un taux fiscal, une projection garantie ou une écriture comptable.
 */
const UNIT="audiotel_platform";
const FAIL=key=>{const e=new Error("APP_OPERATOR_ECON_"+key);e.code=e.message;e.status=422;throw e;};
const isObj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
function integer(x,key,min,max){
 if(!Number.isSafeInteger(x)||x<min||x>max)FAIL(key);
 return x;
}
const rate=(x,key)=>integer(x,key,0,1000000);
const cent=(x,key)=>integer(x,key,0,1000000000000);
const positiveTaxBasisPoints=x=>integer(x,"PERSONAL_RETENTION_BPS",0,10000);
const toMoney=milli=>{
 const abs=milli<0n?-milli:milli;
 const cents=(abs+5n)/10n;
 return (milli<0n?-1:1)*Number(cents)/100;
};
function scenario(input,minutes,key,personalBps){
 if(!isObj(input))FAIL(key.toUpperCase()+"_INVALID");
 const appFee=rate(input.app_contractual_fee_millieur_per_min,key+"_FEE");
 const variable=rate(input.app_variable_cost_millieur_per_min,key+"_VARIABLE");
 const fixed=cent(input.app_fixed_monthly_cost_cents,key+"_FIXED");
 const oneOff=cent(input.one_off_setup_cost_cents??0,key+"_SETUP");
 // Monthly contribution is APP revenue only; NEVER a pass-through of editor payments.
 const revenue=BigInt(minutes)*BigInt(appFee);
 const variableCost=BigInt(minutes)*BigInt(variable);
 const fixedCost=BigInt(fixed)*10n;
 const operating=revenue-variableCost-fixedCost;
 const netPersonal=personalBps===null?null:
   (operating>0n?operating*BigInt(personalBps)/10000n:0n);
 return Object.freeze({
  app_contractual_fee_millieur_per_min:appFee,
  app_variable_cost_millieur_per_min:variable,
  contribution_millieur_per_min:appFee-variable,
  monthly_app_revenue_eur:toMoney(revenue),
  monthly_variable_cost_eur:toMoney(variableCost),
  monthly_fixed_cost_eur:fixed/100,
  monthly_operating_result_before_tax_eur:toMoney(operating),
  setup_one_off_eur:oneOff/100,
  personal_takehome_estimate_eur:netPersonal===null?null:toMoney(netPersonal),
  // The per-minute goal must be measured on all billable minutes, fixed costs included.
  personal_takehome_estimate_eur_per_min:personalBps===null||minutes===0?null:Number(netPersonal)/1000/minutes,
  monthly_result_milli:operating,
  setup_one_off_milli:BigInt(oneOff)*10n
 });
}
export const APP_OPERATOR_AUTONOMY_GATES=Object.freeze([
 Object.freeze({key:"contracting_operator",required:"contrat directement conclu par Audiotel avec l'éditeur SVA",owner:"legal"}),
 Object.freeze({key:"arcep_ce",required:"identifiant CE et identité juridique attribuée et vérifiée",owner:"arcep"}),
 Object.freeze({key:"numbering",required:"ressources 08 attribuées à Audiotel pour nouveaux numéros, droits applicables aux numéros portés",owner:"arcep"}),
 Object.freeze({key:"operator_wholesale",required:"contrat de collecte et interconnexion SIP signé avec responsabilité et SLA",owner:"carrier"}),
 Object.freeze({key:"ported_routing",required:"portabilité et préfixe de routage propre à anticiper au 1 juillet 2028",owner:"apnf"}),
 Object.freeze({key:"cdr_reconciliation",required:"API/SFTP authentifié, tarification et rapprochement de CDR",owner:"carrier"}),
 Object.freeze({key:"direct_publisher_payout",required:"accord de versement de l'opérateur au professionnel, IBAN et rémunération APP séparée",owner:"carrier_psp"}),
 Object.freeze({key:"payment_law",required:"validation du rôle d'encaissement, mandataire ou prestataire autorisé",owner:"acpr_legal"}),
 Object.freeze({key:"editor_compliance",required:"identité éditeur, service, tarifs, MGIT, réclamations et RGPD",owner:"legal"}),
 Object.freeze({key:"pricing_and_tax",required:"offres de gros comparables et simulation fiscale approuvée",owner:"finance"}),
 Object.freeze({key:"technical_acceptance",required:"recette réelle SIP, portage, CDR, anti-fraude et reprise",owner:"carrier"}),
 Object.freeze({key:"owner_release",required:"autorisation explicite et distincte d'exploiter après recette",owner:"owner"})
]);

/**
 * Simulate two independently negotiated financial structures. Units:
 * - billable_minutes_month: integer minutes
 * - app_contractual_fee_millieur_per_min: APP's own fee, €0.001
 * - app_variable_cost_millieur_per_min: additional APP cost, €0.001
 * - *_cost_cents: €0.01
 * - personal_retention_basis_points: 1/10000 share of positive pre-tax result
 *
 * The personal retention factor MUST be checked by an independent fiscal expert
 * for the user's real structure, deductibility and remuneration method.
 */
export function compareAudiotelOperatorModels(input={}){
 if(!isObj(input)||input.business_unit!==UNIT||input.currency!=="EUR")
   FAIL("SCOPE_INVALID");
 const minutes=integer(input.billable_minutes_month,"MINUTES",0,50000000);
 let personalBps=null;
 if(input.personal_retention_basis_points!==undefined&&input.personal_retention_basis_points!==null){
  personalBps=positiveTaxBasisPoints(input.personal_retention_basis_points);
 }
 const reseller=scenario(input.reseller,minutes,"reseller",personalBps);
 const direct=scenario(input.direct_operator,minutes,"direct",personalBps);
 const incremental=direct.monthly_result_milli-reseller.monthly_result_milli;
 // Pure integer comparison on contractual rates, no invented market commission.
 const incrementalContribution=direct.contribution_millieur_per_min-reseller.contribution_millieur_per_min;
 const extraFixed=BigInt(input.direct_operator.app_fixed_monthly_cost_cents)-BigInt(input.reseller.app_fixed_monthly_cost_cents);
 const breakEven=incrementalContribution<=0?
  null:extraFixed<=0n?0:Number((extraFixed*10n+BigInt(incrementalContribution)-1n)/BigInt(incrementalContribution));
 const quoteEvidence=input.evidence||{};
 const flags=Object.freeze({
  reseller_written_quote_verified:quoteEvidence.reseller_written_quote_verified===true,
  direct_written_quote_verified:quoteEvidence.direct_written_quote_verified===true,
  legal_operator_structure_verified:quoteEvidence.legal_operator_structure_verified===true,
  direct_publisher_payout_contract_verified:quoteEvidence.direct_publisher_payout_contract_verified===true,
  payment_legal_model_verified:quoteEvidence.payment_legal_model_verified===true,
  personal_tax_simulation_verified:quoteEvidence.personal_tax_simulation_verified===true
 });
 const reasons=[];
 if(!flags.reseller_written_quote_verified)reasons.push("reseller_quote_missing");
 if(!flags.direct_written_quote_verified)reasons.push("direct_wholesale_quote_missing");
 if(!flags.legal_operator_structure_verified)reasons.push("operator_legal_rights_missing");
 if(!flags.direct_publisher_payout_contract_verified)reasons.push("operator_direct_payout_contract_missing");
 if(!flags.payment_legal_model_verified)reasons.push("psp_or_direct_payment_legal_clearance_missing");
 if(personalBps===null||!flags.personal_tax_simulation_verified)reasons.push("personal_after_tax_result_not_verified");
 if(minutes===0)reasons.push("no_traffic");
 if(direct.contribution_millieur_per_min<=0)reasons.push("operator_variable_contribution_not_positive");
 const target=integer(input.target_personal_net_millieur_per_min??70,"TARGET_PERSONAL",0,1000000);
 const personalEurPerMin=direct.personal_takehome_estimate_eur_per_min;
 const goalProjected=personalEurPerMin===null?null:personalEurPerMin+1e-12>=target/1000;
 const gain=toMoney(incremental);
 // Deliberate distinction: plausible financial hypothesis != operator clearance.
 return Object.freeze({
  schema_version:"audiotel-operator-autonomy-economics/1",
  business_unit:UNIT,currency:"EUR",billable_minutes_month:minutes,
  model:"operator_contracts_publisher_wholesale_carrier_handles_telecom",
  publisher_receipts_booked_as_app_revenue:false,
  third_party_funds_pass_through_app_account:false,
  target_personal_net_eur_per_min:target/1000,
  reseller:Object.freeze(Object.fromEntries(Object.entries(reseller).filter(([k])=>!k.endsWith("_milli")))),
  direct_operator:Object.freeze(Object.fromEntries(Object.entries(direct).filter(([k])=>!k.endsWith("_milli")))),
  improvement:Object.freeze({
   incremental_contribution_eur_per_min:incrementalContribution/1000,
   additional_monthly_company_result_before_tax_eur:gain,
   break_even_minutes_month_for_extra_fixed_cost:breakEven,
   one_off_setup_cost_difference_eur:direct.setup_one_off_eur-reseller.setup_one_off_eur,
   personal_takehome_gain_estimate_eur:personalBps===null?null:
      direct.personal_takehome_estimate_eur-reseller.personal_takehome_estimate_eur
  }),
  personal_retention_factor_is_illustrative:true,
  personal_goal_projected_only:goalProjected,
  personal_goal_fiscally_verified:goalProjected===true&&flags.personal_tax_simulation_verified,
  evidence:flags,
  missing_external_evidence:Object.freeze(reasons),
  financial_comparison_provisional:reasons.length>0,
  operator_contract_executed:false,
  arcep_numbering_obtained:false,
  carrier_connection_active:false,
  automatic_financial_transfer_authorized:false,
  commercial_operation_authorized:false,
  production_deployment_permitted:false
 });
}
