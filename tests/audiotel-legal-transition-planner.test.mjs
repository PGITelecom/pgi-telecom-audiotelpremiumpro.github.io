import test from "node:test";
import assert from "node:assert/strict";
import {
 planAudiotelLegalTransition
} from "../backend/src/audiotel-legal-transition-planner.mjs";

test("change micro to EURL or SASU enumerates essential transfers but executes none",()=>{
 for(const to of ["eurl_is","sasu_is","ei_real"]){
  const p=planAudiotelLegalTransition({
    from:"micro_ei",to,proposal_reference:"LEGAL-PROPOSAL-2026-001"
  });
  assert.equal(p.to,to);
  assert.ok(p.worklist_count>=15);
  assert.ok(p.worklist.some(x=>x.key==="arcep_operator_identity_and_number_rights"));
  assert.ok(p.worklist.some(x=>x.key==="customer_novation_or_legal_assignment_consent"));
  assert.ok(p.worklist.some(x=>x.key==="stripe_account_owner_and_connect_permissions"));
  assert.ok(p.worklist.some(x=>x.key==="revolut_business_account_owner_and_mandates"));
  assert.ok(p.worklist.every(x=>x.completed===false&&x.can_execute_without_owner===false));
  assert.equal(p.legal_entity_created,false);
  assert.equal(p.phone_numbers_transferred,false);
  assert.equal(p.customer_contracts_transferred,false);
  assert.equal(p.operator_contracts_transferred,false);
  assert.equal(p.arcep_numbering_rights_transferred,false);
  assert.equal(p.go_live_authorized,false);
  assert.equal(p.automatic_legal_change_enabled,false);
 }
});
test("reject same or unknown legal forms",()=>{
 assert.throws(()=>planAudiotelLegalTransition({
  from:"micro_ei",to:"micro_ei",proposal_reference:"LEGAL-PROPOSAL-2026-001"
 }),{code:"APP_TRANSITION_INVALID_LEGAL_FORMS"});
 assert.throws(()=>planAudiotelLegalTransition({
  from:"micro_ei",to:"offshore_shell",proposal_reference:"LEGAL-PROPOSAL-2026-001"
 }),{code:"APP_TRANSITION_INVALID_LEGAL_FORMS"});
});
