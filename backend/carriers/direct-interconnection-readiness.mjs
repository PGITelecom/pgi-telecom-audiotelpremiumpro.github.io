// Direct 089 interconnection feasibility preview. Does not place calls,
// configure a carrier, confirm Arcep rights or initiate a financial transfer.
// A declared peer is NOT proof of public reachability or a signed agreement.
const PEER=/^[A-Z][A-Z0-9_-]{1,31}$/;
const MODES=new Set(["bilateral_direct","wholesale_bridge"]);
const GATES=Object.freeze([
 ["legal_entity","Identite et capacite contractuelle de la societe","corporate"],
 ["numbering_authority","Attribution ou droit reel d'exploitation du 089","regulatory"],
 ["routing_prefix","Prefixe et obligations de routage si applicables","regulatory"],
 ["counterparty_agreements","Accords d'interconnexion ecrits et applicables","contract"],
 ["origin_reachability","Accessibilite effective depuis les reseaux d'origine","network"],
 ["sva_tariff_information","Tarification SVA et information consommateur conformes","consumer"],
 ["fraud_controls","Lutte anti-fraude appels, numerotation et partage de revenus","security"],
 ["sip_peer_security","SBC, filtrage, authentification et cloisonnement SIP","security"],
 ["availability","Supervision, capacite et continuite de service","operations"],
 ["cdr_reconciliation","CDR opposables et rapprochement multi-sources","financial"],
 ["collection_and_settlement","Collecte des revenus et reversements conformes","financial"],
 ["economic_evidence","Devis complets, cout d'exploitation et marge nette","commercial"],
 ["incident_and_exit","Gestion des incidents, sauvegardes et reversibilite","operations"]
]);
function fail(code){const e=new Error(code);e.code=code;e.status=422;throw e;}
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const isPlain=x=>x!==null&&typeof x==="object"&&
 !Array.isArray(x)&&(Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);

/**
 * Intentionally not an authorizer. Confirmed legal/technical rights can only
 * be evaluated by a separately authenticated, evidence-based control plane.
 * No URLs, secret values, IPs or operator commercial prices are accepted.
 */
export function prepareDirectInterconnectionPreview(input={}){
 if(!isPlain(input))fail("DIRECT_INTERCONNECT_INVALID_INPUT");
 const permitted=["mode","peerCodes"];
 if(Object.keys(input).some(k=>!permitted.includes(k)))fail("DIRECT_INTERCONNECT_UNEXPECTED_FIELD");
 const {mode,peerCodes}=input;
 if(!MODES.has(mode))fail("DIRECT_INTERCONNECT_INVALID_MODE");
 if(!Array.isArray(peerCodes)||peerCodes.length>12||
    peerCodes.some(x=>typeof x!=="string"||!PEER.test(x))||
    new Set(peerCodes).size!==peerCodes.length)
  fail("DIRECT_INTERCONNECT_INVALID_PEERS");
 const gates=GATES.map(([key,description,domain])=>Object.freeze({
  key,description,domain,status:"independent_evidence_required"
 }));
 return Object.freeze({
  schema_version:"audiotel-direct-interconnection-preview/1",
  mode,
  declared_counterparty_count:peerCodes.length,
  declared_peer_codes:Object.freeze([...peerCodes]),
  proposed_architecture:"Audiotel-owned SIP/SBC and voice services; independently contracted originating networks or wholesale bridge",
  missing_independent_evidence:Object.freeze(gates),
  requires_operator_agreements:true,
  requires_public_089_reachability:true,
  requires_lawful_collection_and_settlement:true,
  zero_external_network_cost_assumed:false,
  legal_entity_verified:false,
  arcep_allocation_verified:false,
  tenant_scope_verified:false,
  operator_contracts_verified:false,
  payment_permissions_verified:false,
  tariff_compliance_verified:false,
  cybersecurity_controls_verified:false,
  financial_margin_verified:false,
  ready_to_interconnect:false,
  live_routes_created:false,
  production_changes_authorized:false,
  payout_authorized:false,
  external_actions_executed:false
 });
}
