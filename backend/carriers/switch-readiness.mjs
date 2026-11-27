// Carrier replacement planning only. Nothing here routes a call or writes a CDR.
// The stable PGI number, tenant, business routing and accounting identifiers
// remain unchanged. Carrier assertions are not independent legal/network proof.
import {previewCarrierCdrBatch} from "./cdr-normalizer.mjs";
function fail(code){const error=new Error(code);error.code=code;throw error;}
const id=/^[A-Z0-9_-]{2,32}$/;
const number=/^\+3389\d{7}$/;
const CHECKS=Object.freeze([
 {key:"arcep_rights",label:"Droits de numerotation et attribution confirmes",type:"regulatory"},
 {key:"carrier_contract",label:"Accord ecrit de collecte SVA 089",type:"contract"},
 {key:"interconnection",label:"Accessibilite depuis les reseaux appelants",type:"network"},
 {key:"portability",label:"Accord de portabilite et calendrier sans perte du numero",type:"network"},
 {key:"sip_acceptance",label:"SIP / DNIS / CLI / DTMF, securite et secours valides",type:"technical"},
 {key:"cdr_reconciliation",label:"CDR compares aux releves contractuels",type:"technical"},
 {key:"payment_model",label:"Reglement et prestataire de paiement conformes",type:"financial"},
 {key:"rollback",label:"Route de secours et reprise testees",type:"technical"}
]);

export function prepareCarrierSwitchPreview({
 currentCarrierCode,
 candidateAdapter,
 swaNumbers,
 sampleCdrRows
}={}){
 if(typeof currentCarrierCode!=="string"||!id.test(currentCarrierCode))
  fail("SWITCH_ORIGIN_INVALID");
 const candidateCode=candidateAdapter?.carrier?.code;
 if(typeof candidateCode!=="string"||!id.test(candidateCode)||
    candidateCode===currentCarrierCode)fail("SWITCH_TARGET_INVALID");
 if(!Array.isArray(swaNumbers)||swaNumbers.length<1||swaNumbers.length>10000||
    swaNumbers.some(n=>typeof n!=="string"||!number.test(n))||
    new Set(swaNumbers).size!==swaNumbers.length)fail("SWITCH_NUMBER_SCOPE_INVALID");
 const preview=previewCarrierCdrBatch({
  adapter:candidateAdapter,
  rows:sampleCdrRows,
  authorizedNumbers:swaNumbers
 });
 const c=candidateAdapter.capabilities;
 const missingCapabilities=[
  ["directSip","SIP direct"],["cdr","CDR"],["settlements","releves de reglement"],
  ["portability","portabilite"]
 ].filter(([key])=>c[key]!==true).map(([,label])=>label);
 return Object.freeze({
  schema_version:"audiotel-carrier-switch-plan/1",
  business_unit:"direct_sva",
  current_carrier:currentCarrierCode,
  proposed_carrier:candidateCode,
  number_count:swaNumbers.length,
  cdr_sample_count:preview.record_count,
  cdr_sample_fingerprint:preview.source_fingerprint,
  core_replacement_required:false,
  customer_numbers_must_remain_unchanged:true,
  tenant_data_must_remain_unchanged:true,
  accounting_history_must_remain_unchanged:true,
  media_server_must_remain_owned_by_audiotel:true,
  missing_adapter_capabilities:Object.freeze(missingCapabilities),
  external_evidence_gates:Object.freeze(CHECKS.map(item=>Object.freeze({
   ...item,status:"independent_evidence_required"
  }))),
  current_carrier_must_remain_available_for_rollback:true,
  routing_switch_authorized:false,
  number_portability_authorized:false,
  payout_authorized:false,
  operational_customer_change_authorized:false,
  financial_or_network_action_executed:false,
  next_step:"Contrats, droits de numerotation, habilitations de paiement et recette independante avant tout basculement"
 });
}
