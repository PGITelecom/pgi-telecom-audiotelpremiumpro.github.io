import test from "node:test";
import assert from "node:assert/strict";
import {
  TELECOM_CHAIN_GATE_SPEC,assessAudiotelTelecomChain
} from "../backend/src/audiotel-telecom-chain-preflight.mjs";

const business_unit="audiotel_platform";
const at=new Date("2026-11-08T12:00:00Z");
const doc=spec=>({
  issuer:spec.issuer,review_status:"documented",
  reference:"DOC-2026-000001",verified_at:"2026-11-07T10:00:00Z",
  document_sha256:"a".repeat(64)
});

test("empty telecom chain is blocked and cannot release a number, money or software",()=>{
 const result=assessAudiotelTelecomChain({business_unit},at);
 assert.equal(result.documented_count,0);
 assert.equal(result.required_count,TELECOM_CHAIN_GATE_SPEC.length);
 assert.equal(result.current_stage,"evidence_collection");
 assert.equal(result.operational_telecom_chain_ready,false);
 for(const key of [
   "number_assignment_authorized","commercial_activation_authorized",
   "bank_transfer_authorized","psp_payout_authorized","vercel_deployment_authorized",
   "neon_migration_authorized","git_merge_authorized","external_purchase_authorized"
 ])assert.equal(result[key],false,key);
 assert.ok(result.missing.includes("arcep_numbering_rights"));
 assert.ok(result.missing.includes("carrier_cdr_correlation"));
 assert.ok(result.missing.includes("bank_receipt_verified"));
 assert.ok(result.missing.includes("direct_professional_payout_negotiated"));
 assert.ok(result.missing.includes("direct_payout_or_refusal_alternatives_review"));
 assert.equal(result.direct_payout_contract_approved,false);
 assert.equal(result.professional_iban_payout_enabled,false);
 assert.equal(result.business_unit,"audiotel_platform");
});

test("other business unit and unexpected activation hints are rejected",()=>{
 assert.throws(()=>assessAudiotelTelecomChain({business_unit:"direct_sva"},at),
   {code:"APP_CHAIN_WRONG_BUSINESS_UNIT"});
 assert.throws(()=>assessAudiotelTelecomChain({business_unit,commercial_active:true},at),
   {code:"APP_CHAIN_UNKNOWN_FIELD"});
 assert.throws(()=>assessAudiotelTelecomChain({business_unit,evidence:{payment_live:true}},at),
   {code:"APP_CHAIN_UNKNOWN_GATE"});
});

test("wrong issuer, missing hash, future timestamp or expiry cannot satisfy a gate",()=>{
 const spec=TELECOM_CHAIN_GATE_SPEC.find(s=>s.key==="arcep_numbering_rights");
 for(const override of [
  {issuer:"customer"},
  {document_sha256:"not_a_digest"},
  {verified_at:"2028-01-01T00:00:00Z"},
  {valid_until:"2026-11-08T10:00:00Z"},
  {review_status:"verified"}
 ]){
   const report=assessAudiotelTelecomChain({
     business_unit,evidence:{arcep_numbering_rights:{...doc(spec),...override}}
   },at);
   const gate=report.gates.find(x=>x.key==="arcep_numbering_rights");
   assert.equal(gate.status,"pending",JSON.stringify(override));
   assert.equal(report.operational_telecom_chain_ready,false);
 }
});

test("synthetically documented every gate still never becomes authorized",()=>{
 const evidence=Object.fromEntries(TELECOM_CHAIN_GATE_SPEC.map(spec=>[spec.key,doc(spec)]));
 const report=assessAudiotelTelecomChain({business_unit,evidence},at);
 assert.equal(report.documented_count,TELECOM_CHAIN_GATE_SPEC.length);
 assert.equal(report.missing.length,0);
 assert.equal(report.current_stage,"independent_live_review_required");
 assert.equal(report.external_sources_authenticated,false);
 assert.equal(report.actual_arcep_rights_verified,false);
 assert.equal(report.physical_sip_acceptance_verified,false);
 assert.equal(report.carrier_cdr_bank_reconciliation_verified,false);
 assert.equal(report.operational_telecom_chain_ready,false);
 assert.equal(report.commercial_activation_authorized,false);
 assert.equal(report.number_assignment_authorized,false);
 assert.equal(report.psp_payout_authorized,false);
 assert.equal(report.git_merge_authorized,false);
 assert.equal(report.vercel_deployment_authorized,false);
 assert.equal(report.neon_migration_authorized,false);
 assert.equal(report.external_purchase_authorized,false);
});

test("document payloads cannot smuggle arbitrary fields or secrets",()=>{
 const spec=TELECOM_CHAIN_GATE_SPEC[0];
 const report=assessAudiotelTelecomChain({
  business_unit,evidence:{[spec.key]:{...doc(spec),password:"secret"}}
 },at);
 assert.equal(report.gates[0].status,"pending");
 assert.equal(report.gates[0].reason,"unexpected_evidence_field");
 assert.doesNotMatch(JSON.stringify(report),/secret/);
 assert.equal(report.bank_transfer_authorized,false);
});

test("duplicate gate keys and unexpected timestamps remain fail-closed",()=>{
 assert.equal(TELECOM_CHAIN_GATE_SPEC.length,
   new Set(TELECOM_CHAIN_GATE_SPEC.map(x=>x.key)).size);
 assert.throws(()=>assessAudiotelTelecomChain({business_unit},"bad date"),
   {code:"APP_CHAIN_INVALID_TIME"});
});
