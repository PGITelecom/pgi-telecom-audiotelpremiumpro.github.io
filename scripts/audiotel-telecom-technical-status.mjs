/**
 * Audiotel Premium Pro: local-only implementation inventory and blockers.
 * Produces no credentials, no network requests and no release authorization.
 * It cannot assert that an operator, Arcep, a bank or production is connected.
 */
import {existsSync,readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
import {assessAudiotelTelecomChain} from "../backend/src/audiotel-telecom-chain-preflight.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const FILES=Object.freeze([
 ["existing_backend_router","backend/server.mjs"],
 ["existing_cdr_ingest","backend/src/cdr-freeswitch.mjs"],
 ["existing_operator_gate","backend/src/audiotel-telecom-chain-preflight.mjs"],
 ["arcep_block_planner","telephony/prelaunch-not-active/arcep-block-planner.mjs"],
 ["offline_traffic_router","telephony/prelaunch-not-active/network-core.mjs"],
 ["cdr_reconciliation","telephony/prelaunch-not-active/cdr-reconciliation.mjs"],
 ["traffic_and_margin_planner","telephony/prelaunch-not-active/economics-capacity.mjs"],
 ["wholesale_offer_evaluation","telephony/prelaunch-not-active/wholesale-comparison.mjs"],
 ["build_vs_buy_tco","telephony/prelaunch-not-active/build-vs-buy.mjs"],
 ["financial_robustness_stress","telephony/prelaunch-not-active/decision-robustness.mjs"],
 ["activation_and_hidden_fees_audit","telephony/prelaunch-not-active/activation-fee-audit.mjs"],
 ["inert_bulk_lifecycle_plans","telephony/prelaunch-not-active/bulk-provisioning-plan.mjs"],
 ["offline_financial_report","scripts/audiotel-build-vs-buy-report.mjs"],
 ["payment_direct_review","backend/src/audiotel-carrier-direct-payout-review.mjs"],
 ["kamailio_local_denial","telephony/prelaunch-not-active/kamailio.loopback-deny.cfg.example"],
 ["freeswitch_local_denial","telephony/prelaunch-not-active/freeswitch.deny-context.xml.example"],
 ["preclient_sql_draft","database/prelaunch-not-applied/091_audiotel_preclient_number_portability_cases.sql"],
 ["finance_sql_draft","database/prelaunch-not-applied/092_audiotel_financial_cycle_drafts.sql"],
 ["legal_sql_draft","database/prelaunch-not-applied/093_audiotel_legal_international_prelaunch.sql"]
]);
const REQUIRED_EXTERNAL=Object.freeze([
 "arcep_legal_eligibility_and_actual_numbering_decision",
 "wholesale_carrier_signed_contract_and_real_interconnect",
 "two_hardened_rtp_sip_nodes_and_carrier_security_acceptance",
 "voice_mgit_tariff_compliance_and_portability_proof",
 "authenticated_real_cdr_and_fraud_quality_monitoring",
 "carrier_or_psp_direct_professional_bank_payout_agreement",
 "independent_legal_tax_accounting_review",
 "owner_go_live_release_and_operator_acceptance"
]);
export function inspectAudiotelPreparedInfrastructure(){
 const available=FILES.map(([key,path])=>Object.freeze({
  key,path,source_present:existsSync(resolve(root,path)),
  is_connected_to_live_operator:false
 }));
 const routerFile=resolve(root,"backend/server.mjs");
 const router=existsSync(routerFile)?readFileSync(routerFile,"utf8"):"";
 const routerEndpoints=["/api/v1/internal/routing/next-destination",
  "/api/v1/internal/routing/next-destination/text",
  "/api/v1/ingest/freeswitch"];
 const endpointsPresent=routerEndpoints.every(path=>router.includes(path));
 const gates=assessAudiotelTelecomChain({business_unit:"audiotel_platform"});
 return Object.freeze({
  business_unit:"audiotel_platform",mode:"repository_inventory_only",
  code_inventory:Object.freeze(available),
  all_source_files_present:available.every(x=>x.source_present),
  expected_routing_endpoints_present:endpointsPresent,
  repository_telecom_chain_gate_count:gates.required_count,
  independent_external_evidence_documented_here:0,
  missing_external_evidence:Object.freeze([...REQUIRED_EXTERNAL]),
  operational_network_tested:false,actual_sip_calls_proven:false,
  arcep_resources_assigned:false,paid_minutes_reconciled:false,
  direct_professional_bank_payout_live:false,
  live_service_authorized:false,production_changes_authorized:false,
  // This is not a query to Vercel, Neon, Arcep or the partner network.
  remotely_verified:false,
  operator_ready:false,
  next_action:"confirm_arcep_eligibility_and_request_documentary_carrier_specs_without_committing"
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=inspectAudiotelPreparedInfrastructure();
 process.stdout.write(JSON.stringify(result,null,2)+"\n");
 process.exitCode=result.all_source_files_present&&
  result.expected_routing_endpoints_present?0:1;
}
