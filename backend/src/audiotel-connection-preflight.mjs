/**
 * Audiotel Premium Pro: read-only carrier onboarding contract and CDR preview.
 * This unit is intentionally independent from the "direct_sva" distribution unit.
 * It never contacts a carrier, allocates numbering, records CDRs or moves money.
 *
 * A signed contract, authoritative operator acknowledgements, verified bank
 * evidence, legal approval and an independently accepted live adapter are required
 * before any dispatch route can be designed and enabled.
 */
import {createHash} from "node:crypto";

const BUSINESS_UNIT="audiotel_platform";
const isPlain=v=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&
  (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const ref=/^[A-Za-z0-9][A-Za-z0-9_.:/-]{7,119}$/;
const svanum=/^\+33(?:81|82|89)\d{7}$/;
const utc=/^20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/;
const statuses=new Set(["connected","abandoned","failed"]);
function error(code){const e=new Error(code);e.code=code;e.status=422;return e;}
function validInstant(v){
  if(typeof v!=="string"||!utc.test(v))return null;
  const n=Date.parse(v);
  if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==v.slice(0,10))return null;
  return n;
}
function safeSeconds(v){
  return Number.isSafeInteger(v)&&v>=0&&v<=86400?v:null;
}
function safeCount(v){
  const n=Number(v);
  return Number.isSafeInteger(n)&&n>=0?n:0;
}
const CONTRACT=Object.freeze([
  Object.freeze({key:"operator_contract",label:"Contrat de collecte et interconnexion",
    evidence:"contrat_signe_et_qualite_du_partenaire",dependency:"operator",fields:Object.freeze(["contract_reference","signatory","effective_date","support_sla","data_processing_terms"])}),
  Object.freeze({key:"numbering_rights",label:"Droits et affectation des numéros 08",
    evidence:"preuve_attribution_et_droit_affectation",dependency:"operator",fields:Object.freeze(["number_range","assignor","rights_reference","allocation_ack","reversal_policy"])}),
  Object.freeze({key:"portability",label:"Portabilité entrante et sortante",
    evidence:"mandat_et_accuses_operateurs",dependency:"operator",fields:Object.freeze(["mandate_reference","rio_if_applicable","current_operator","porting_window","acceptance_ack","rollback_procedure"])}),
  Object.freeze({key:"routing_sip",label:"Routage SIP, qualité et continuité",
    evidence:"recette_acheminement_reel",dependency:"network",fields:Object.freeze(["sip_peer","tls_policy","ip_acl","inbound_acceptance","incident_contacts","redundancy_plan"])}),
  Object.freeze({key:"cdr_ingestion",label:"CDR authentifiés et rapprochables",
    evidence:"flux_operateur_verifie_et_rapproche",dependency:"operator",fields:Object.freeze(["source_reference","authentication_spec","event_id","timestamp_utc","number_e164","billable_seconds","call_status","replay_window","duplicate_policy"])}),
  Object.freeze({key:"tariff_and_mgit",label:"Tarifs C+S, signalétique et information",
    evidence:"acceptation_reglementaire_documentee",dependency:"compliance",fields:Object.freeze(["tariff_version","service_rate","consumer_notice","mgit_acceptance","tariff_effective_date"])}),
  Object.freeze({key:"payouts_direct",label:"Reversements directs opérateur vers éditeurs",
    evidence:"contrat_bancaire_et_preuve_versement",dependency:"operator",fields:Object.freeze(["publisher_entitlement","iban_validation_via_approved_party","payout_calendar","payout_reference","rejection_events","carrier_bank_proof","platform_fee_separate"])}),
  Object.freeze({key:"stripe_invoices",label:"Abonnement, factures Stripe et avoirs",
    evidence:"compte_stripe_reel_et_numero_facture_verifies",dependency:"stripe",fields:Object.freeze(["issuer_identity","tax_regime","subscription_lookup_key","signed_webhooks","invoice_pdf","refund_policy","customer_portal"])}),
  Object.freeze({key:"accounting",label:"Comptabilité et rapprochement",
    evidence:"expert_comptable_et_traces_certifiees",dependency:"accounting",fields:Object.freeze(["siren","vat_regime","account_map","reconciliation_run","legal_invoice","fec_export"])}),
  Object.freeze({key:"data_security",label:"Protection des dossiers et résilience",
    evidence:"revue_technique_et_rgpd",dependency:"security",fields:Object.freeze(["tenant_isolation","least_privilege","supplier_dpa","retention_policy","encrypted_backups","restore_acceptance","incident_handling"])})
]);

export const APP_CARRIER_CONNECTION_CONTRACT=CONTRACT;

/** A missing external certificate never becomes READY because a database row exists. */
export function audiotelConnectorReadiness(assurance={}){
  const checks=Array.isArray(assurance?.checks)?assurance.checks:[];
  const byKey=new Map(checks.map(x=>[x.key,x.status]));
  const n=assurance?.counts||{};
  const stages=CONTRACT.map(item=>{
    const indicator={
      operator_contract:safeCount(n.ready_or_active_carrier_connection_records)>0,
      numbering_rights:safeCount(n.registered_numbers)>0&&safeCount(n.recorded_upstream_assignments)>0,
      portability:false,
      routing_sip:safeCount(n.ready_or_active_carrier_connection_records)>0,
      cdr_ingestion:false,
      tariff_and_mgit:false,
      payouts_direct:false,
      stripe_invoices:byKey.get("subscription_price_version")==="observed",
      accounting:["legal_identity","vat_configuration","account_mapping","fec_export_configuration"].every(k=>byKey.get(k)==="observed"),
      data_security:false
    }[item.key]===true;
    return Object.freeze({
      key:item.key,label:item.label,dependency:item.dependency,
      evidence_required:item.evidence,required_fields:item.fields,
      internal_indicator_observed:indicator,
      // No checked external evidence means no live connection.
      evidence_verified:false,status:"external_evidence_required",
      live_transport_approved:false,automatic_dispatch_permitted:false
    });
  });
  return Object.freeze({
    schema_version:"app-carrier-connection-preflight/1",
    business_unit:BUSINESS_UNIT,
    generated_at:new Date().toISOString(),
    source:"audiotel_order_assurance_database_snapshot_and_fixed_external_gates",
    required_stages:stages.length,
    verified_stages:0,
    stages:Object.freeze(stages),
    connections_count:safeCount(n.ready_or_active_carrier_connection_records),
    registered_numbers:safeCount(n.registered_numbers),
    automated_dispatch_enabled:false,
    carrier_ingestion_enabled:false,
    number_provisioning_enabled:false,
    automatic_payout_enabled:false,
    payouts_direction:"operator_to_publisher_iban_only_when_contractually_validated",
    platform_remuneration:"separate_contractual_flow",
    live_technical_acceptance_verified:false,
    commercial_activation_authorized:false,
    production_connector_ready:false
  });
}

/** Validate only a proposed provider-neutral sample, not an authenticated event.
 * Never derive tenant ID or money from a caller's submitted CDR.
 * The real importer must independently verify operator signature, source
 * credentials, tenant's active number assignment, tariff and bank evidence.
 */
export function previewAudiotelCdrBatch(batch={}){
  if(!isPlain(batch)||batch.business_unit!==BUSINESS_UNIT)throw error("APP_CDR_UNIT_INVALID");
  if(!ref.test(String(batch.carrier_reference||"")))throw error("APP_CDR_CARRIER_INVALID");
  const records=batch.records;
  if(!Array.isArray(records)||records.length>1000)throw error("APP_CDR_BATCH_LIMIT");
  const unique=new Map();
  let duplicates=0,billableSeconds=0,connected=0;
  for(const record of records){
    if(!isPlain(record)||!ref.test(String(record.event_id||"")))throw error("APP_CDR_EVENT_ID_INVALID");
    if(!svanum.test(String(record.number_e164||"")))throw error("APP_CDR_SVA_NUMBER_INVALID");
    if(!statuses.has(record.call_status))throw error("APP_CDR_STATUS_INVALID");
    const start=validInstant(record.started_at),end=validInstant(record.ended_at);
    if(start===null||end===null||end<start||end-start>86400000)throw error("APP_CDR_TIME_INVALID");
    const seconds=safeSeconds(record.billable_seconds);
    if(seconds===null)throw error("APP_CDR_BILLABLE_SECONDS_INVALID");
    if(record.call_status!=="connected"&&seconds!==0)throw error("APP_CDR_NONCONNECTED_BILLED");
    if(record.call_status==="connected"&&seconds>Math.ceil((end-start)/1000)+60)throw error("APP_CDR_DURATION_CONFLICT");
    if(record.currency!=="EUR")throw error("APP_CDR_CURRENCY_INVALID");
    const id=String(record.event_id),canonical=JSON.stringify([
      batch.carrier_reference,id,record.number_e164,record.started_at,record.ended_at,
      record.billable_seconds,record.call_status,record.currency
    ]);
    const digest=createHash("sha256").update(canonical).digest("hex");
    if(unique.has(id)){
      if(unique.get(id).content_digest!==digest)throw error("APP_CDR_DUPLICATE_CONFLICT");
      duplicates++;
      continue;
    }
    if(billableSeconds>Number.MAX_SAFE_INTEGER-seconds)throw error("APP_CDR_TOTAL_OVERFLOW");
    billableSeconds+=seconds;
    if(record.call_status==="connected")connected++;
    unique.set(id,Object.freeze({
      carrier_event_id:id,number_e164:record.number_e164,
      call_status:record.call_status,billable_seconds:seconds,
      started_at:record.started_at,ended_at:record.ended_at,currency:"EUR",
      content_digest:digest,
      idempotency_digest:createHash("sha256").update(BUSINESS_UNIT+"\n"+batch.carrier_reference+"\n"+id).digest("hex")
    }));
  }
  return Object.freeze({
    schema_version:"app-carrier-cdr-preview/1",business_unit:BUSINESS_UNIT,
    carrier_reference:batch.carrier_reference,received_records:records.length,
    unique_records:unique.size,exact_duplicates:duplicates,
    connected_records:connected,total_billable_seconds:billableSeconds,
    canonical_records:Object.freeze([...unique.values()]),
    source_signature_verified:false,
    source_transport_verified:false,
    operator_tariff_verified:false,
    tenant_number_assignment_verified:false,
    billing_authorized:false,
    database_write_permitted:false,
    number_activation_permitted:false,
    customer_payout_permitted:false,
    import_executed:false
  });
}
