import test from "node:test";
import assert from "node:assert/strict";
import {planAudiotelBulkProvisioning} from "../telephony/prelaunch-not-active/bulk-provisioning-plan.mjs";
const base=(operations=[],batch_size=1000)=>({
 business_unit:"audiotel_platform",mode:"offline_simulation",
 batch_reference:"AUDIT-BATCH-2026",operations,batch_size
});
const op=(n,action="prepare_new_number",extra={})=>({
 operation_reference:"OP-"+n,professional_reference:"PRO-"+n,
 action,
 number_e164:action==="prepare_new_number"?null:"+33891234567",
 destination_reference:action==="prepare_new_number"?"DEST-"+n:
  action==="prepare_route_change"?"DEST-"+n:null,
 kyb_evidence_reference:null,mandate_evidence_reference:null,carrier_reference:null,
 ...extra
});
test("prepares exactly 5000 abstract onboarding operations without assigning a number",()=>{
 const input=base(Array.from({length:5000},(_,i)=>op(i)),1000);
 const r=planAudiotelBulkProvisioning(input);
 assert.equal(r.total_operations,5000);
 assert.equal(r.chunk_count,5);
 assert.ok(r.chunks.every(c=>c.operation_count===1000));
 assert.ok(r.chunks.every(c=>!c.executable&&!c.carrier_batch_request_created));
 assert.equal(r.missing_evidence_count,5000);
 assert.equal(r.no_number_ordered_or_ported,true);
 assert.equal(r.no_line_activated_suspended_or_resumed,true);
 assert.equal(r.any_execution_approved,false);
 assert.ok(r.chunks[0].entries[0].draft_fingerprint.length===64);
 assert.equal(r.chunks[0].entries[0].number_e164,null);
});
test("deterministic and idempotent manifest for same inputs",()=>{
 const a=planAudiotelBulkProvisioning(base([op(1),op(2)]));
 const b=planAudiotelBulkProvisioning(base([op(1),op(2)]));
 assert.deepEqual(a,b);
 assert.equal(a.chunks[0].entries[0].draft_fingerprint,
  b.chunks[0].entries[0].draft_fingerprint);
});
test("portability requires documentary evidence reference but not real operator permission",()=>{
 const p=op(1,"prepare_portability",{mandate_evidence_reference:"MANDATE-1",
  carrier_reference:"CARRIER-1",kyb_evidence_reference:"KYB-1"});
 const a=planAudiotelBulkProvisioning(base([p]));
 assert.equal(a.documentary_review_pending,1);
 assert.equal(a.chunks[0].entries[0].documentary_evidence_references_present,true);
 assert.equal(a.chunks[0].entries[0].documentary_evidence_independently_verified,false);
 assert.equal(a.chunks[0].entries[0].portability_mandate_verified,false);
 assert.equal(a.chunks[0].entries[0].network_operation_authorized,false);
});
test("rejects duplicate intents and competing operations on the same live number",()=>{
 assert.throws(()=>planAudiotelBulkProvisioning(base([op(1),op(1)])),{
  code:"APP_BULK_PREP_DUPLICATE_REFERENCE"});
 assert.throws(()=>planAudiotelBulkProvisioning(base([
  op(1,"prepare_suspend"),op(2,"prepare_resume")
 ])),{code:"APP_BULK_PREP_CONFLICTING_NUMBER_OPERATIONS"});
});
test("does not permit pretend Arcep allocation or invalid lifecycle operations",()=>{
 assert.throws(()=>planAudiotelBulkProvisioning({
  ...base([op(1)]),mode:"live"
 }),{code:"APP_BULK_PREP_OFFLINE_ONLY"});
 assert.throws(()=>planAudiotelBulkProvisioning(base([op(1,"prepare_new_number",{
  number_e164:"+33891234567"
 })])),{code:"APP_BULK_PREP_NEW_NUMBER_HAS_NO_RESOURCE_YET"});
 assert.throws(()=>planAudiotelBulkProvisioning(base([op(1,"prepare_portability",{
  number_e164:null
 })])),{code:"APP_BULK_PREP_MISSING_EXISTING_NUMBER"});
 assert.throws(()=>planAudiotelBulkProvisioning(base([op(1,"activate_number")])),{
  code:"APP_BULK_PREP_ACTION"});
 assert.throws(()=>planAudiotelBulkProvisioning(base([{
  ...op(1),iban:"FR761234567890"
 }])),{code:"APP_BULK_PREP_INVALID_OPERATION"});
});
test("number lifecycle remains one-to-one and batches are bounded",()=>{
 assert.throws(()=>planAudiotelBulkProvisioning(base([op(1)],1001)),{
  code:"APP_BULK_PREP_BATCH_SIZE"});
 const a=planAudiotelBulkProvisioning(base([op(1,"prepare_suspend")]));
 assert.equal(a.chunks[0].entries[0].action,"prepare_suspend");
 assert.equal(a.chunks[0].entries[0].status,"PLANNED_ONLY_NOT_SUBMITTED");
 assert.equal(a.no_route_update_or_real_api_call,true);
 assert.equal(a.no_financial_transfer_or_billing,true);
});
