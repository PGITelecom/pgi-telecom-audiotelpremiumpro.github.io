/**
 * Audit preparatoire en lecture seule : independance SVA et regles Arcep 2028.
 * Pas de route API, de migration, de routage SIP ou de mouvement de fonds.
 * Une preuve saisie dans ce module n'est JAMAIS une verification de son origine.
 */
export const DIRECT_SVA_2028_DATE = "2028-07-01";
const REQUIREMENTS = Object.freeze([
  ["legal_operator_role", "legal_reviewer", "Qualification et responsabilites de l'operateur contractuel"],
  ["customer_contract_control", "pgi", "Contrats clients conclus avec notre entite"],
  ["arcep_number_attribution", "arcep", "Attribution directe du bloc 089 par l'Arcep"],
  ["national_sva_collection", "carrier", "Interconnexion et collecte francaise SVA 089 sur notre bloc"],
  ["carrier_cdr_access", "carrier", "CDR detailles et exports/API reversibles"],
  ["carrier_exit_plan", "carrier", "Sortie contractuelle et bascule sans captivite"],
  ["portability_process", "apnf", "Portabilite et interconnexion reconnues par les instances competentes"],
  ["publisher_compliance", "pgi", "Identification editeurs, signaletique, MGIT et antifraude"],
  ["financial_legal_review", "legal_reviewer", "Qualification juridique du circuit financier"],
  ["regulated_payment_chain", "psp", "Paiements de tiers dans un cadre habilite"],
  ["publisher_direct_iban", "psp", "Reversement editeurs distinct de notre commission"],
  ["owner_data_export", "pgi", "Clients, donnees, factures et historique exportables"],
  ["security_review", "security_reviewer", "Securite, controle d'acces et reprise"],
  ["pricing_and_tax_review", "accountant", "Simulation de marge nette apres frais et fiscalite"]
]);
const dated=value=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&
  Number.isFinite(Date.parse(value+"T00:00:00Z"))&&
  new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value;
function verifyReference(proof,issuer,now){
  if(!proof||proof.status!=="verified"||proof.issuer!==issuer||
     typeof proof.reference!=="string"||!/^[A-Za-z0-9._:/-]{8,180}$/.test(proof.reference))return false;
  const when=Date.parse(proof.verified_at||"");
  if(!Number.isFinite(when)||when>now.getTime())return false;
  if(proof.expires_at!==undefined){
    const expiry=Date.parse(proof.expires_at);
    if(!Number.isFinite(expiry)||expiry<=now.getTime())return false;
  }
  return true;
}
export function assessDirectSvaIndependence2028(input={},at=new Date()){
  if(!input||typeof input!=="object"||Array.isArray(input))throw new TypeError("INVALID_INDEPENDENCE_INPUT");
  const now=at instanceof Date?at:new Date(at);
  if(!Number.isFinite(now.getTime()))throw new TypeError("INVALID_AUDIT_DATE");
  const target=input.target_launch_date;
  if(!dated(target))throw new TypeError("TARGET_LAUNCH_DATE_REQUIRED");
  const ported=input.plans_ported_numbers;
  if(typeof ported!=="boolean")throw new TypeError("PORTED_NUMBERS_SCOPE_REQUIRED");
  const evidence=input.evidence&&typeof input.evidence==="object"&&!Array.isArray(input.evidence)?input.evidence:{};
  const requirements=REQUIREMENTS.map(([key,issuer,label])=>Object.freeze({
    key,label,source_expected:issuer,
    status:verifyReference(evidence[key],issuer,now)?"document_declared":"missing_or_invalid"
  }));
  const blockers=requirements.filter(x=>x.status!=="document_declared").map(x=>x.key);
  // A 089 ported into our service need not originate in our own allocated block.
  // From 2028, the operator using ported numbers needs its own ARCEP routing prefix.
  const requiresOwnPrefix=ported&&target>=DIRECT_SVA_2028_DATE;
  if(requiresOwnPrefix&&!verifyReference(evidence.arcep_routing_prefix,"arcep",now))
    blockers.push("arcep_routing_prefix");
  const isLegacy=input.uses_pre2018_number_loan===true;
  // Existing pre-2018 loans may continue to 2028; new loans of 089 are prohibited.
  if(isLegacy&&target>=DIRECT_SVA_2028_DATE)blockers.push("legacy_number_loan_must_end");
  const warnings=[
    ...(isLegacy&&target<DIRECT_SVA_2028_DATE?["legacy_number_loan_to_migrate_before_2028"]:[]),
    ...(ported&&!requiresOwnPrefix?["prepare_own_routing_prefix_for_2028"]:[]),
    "declarations_and_document_references_are_not_independently_authenticated",
    "technical_and_regulatory_approval_required_before_go_live"
  ];
  return Object.freeze({
    schema_version:"audiotel-direct-sva-independence-2028/1",
    business_unit:"direct_sva",
    planned_launch_date:target,
    regulatory_deadline:DIRECT_SVA_2028_DATE,
    planned_portability:ported,
    own_routing_prefix_needed_for_target:requiresOwnPrefix,
    controls_to_keep_in_house:Object.freeze([
      "customer_contracts","arcep_resource_holding","commercial_tariffs","client_portal",
      "customer_database","svi_business_logic","cdr_ledger","commission_reconciliation",
      "audit_history","exports_and_provider_switching"
    ]),
    functions_to_contract_when_not_operated_internally:Object.freeze([
      "national_sva_interconnection_and_collection","regulated_payment_services",
      "external_portability_infrastructure"
    ]),
    verified_by_external_authority:false,
    documentary_review_candidate:blockers.length===0,
    blockers:Object.freeze(blockers),
    warnings:Object.freeze(warnings),
    provider_selected:false,
    arcep_allocation_granted_by_this_code:false,
    production_activation_allowed:false,
    call_routing_change_allowed:false,
    payment_execution_allowed:false,
    database_or_site_changed:false
  });
}
export const DIRECT_SVA_INDEPENDENCE_EVIDENCE_KEYS=Object.freeze(
  REQUIREMENTS.map(([key])=>key).concat(["arcep_routing_prefix"])
);
