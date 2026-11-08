import test from "node:test";
import assert from "node:assert/strict";
import {
 planAudiotelArcepBlock,previewAudiotelNumberRequest
} from "../telephony/prelaunch-not-active/arcep-block-planner.mjs";

const draft=(assignments=[])=>({
 business_unit:"audiotel_platform",mode:"offline_simulation",
 block_start_e164:"+33890123000",block_reference:"BLOCK-ARCEP-CANDIDATE-001",
 assignments
});
const record=(n,status="simulated_reserved",tenant_reference="TENANT-0001")=>({
 number_e164:"+33890123"+String(n).padStart(3,"0"),
 status,tenant_reference:status==="released"?null:tenant_reference
});
test("1000-number direct-ARCEP block is only a planning candidate, zero activation",()=>{
 const plan=planAudiotelArcepBlock(draft());
 assert.equal(plan.block_capacity,1000);
 assert.equal(plan.available_candidate_count,1000);
 assert.equal(plan.candidate_for_next_allocation,"+33890123000");
 assert.equal(plan.annual_regulatory_fee_reference_minor,2000);
 assert.equal(plan.estimated_monthly_regulatory_amortization_minor,167);
 assert.equal(plan.arcep_attribution_verified,false);
 assert.equal(plan.number_activation_authorized,false);
 assert.equal(plan.numbering_resources_owned,false);
 assert.equal(plan.no_minimum_minutes_required_of_professionals,true);
 const picked=previewAudiotelNumberRequest([plan],{category:"089"});
 assert.equal(picked.number_e164,"+33890123000");
 assert.equal(picked.number_assigned,false);
 assert.equal(picked.order_submitted,false);
});
test("planning threshold 80 percent doesn't close clients or allocate numbers",()=>{
 const x=Array.from({length:800},(_,i)=>record(i));
 const plan=planAudiotelArcepBlock(draft(x));
 assert.equal(plan.usage_percent,80);
 assert.equal(plan.eighty_percent_planning_threshold_reached,true);
 assert.equal(plan.available_candidate_count,200);
 assert.equal(plan.candidate_for_next_allocation,"+33890123800");
 assert.equal(plan.next_subblock_regulatory_approval_verified,false);
});
test("empty and completely reserved blocks are distinguishable",()=>{
 const x=Array.from({length:1000},(_,i)=>record(i));
 const plan=planAudiotelArcepBlock(draft(x));
 assert.equal(plan.available_candidate_count,0);
 assert.equal(plan.candidate_for_next_allocation,null);
 assert.equal(previewAudiotelNumberRequest([plan],{category:"089"}).status,"no_candidate_available");
});
test("only truly released candidates become available again, no silent tenant ownership",()=>{
 const plan=planAudiotelArcepBlock(draft([
  record(0,"simulated_allocated"),record(1,"released"),record(2,"simulated_blocked")
 ]));
 assert.equal(plan.available_candidate_count,998);
 assert.equal(plan.candidate_for_next_allocation,"+33890123001");
 assert.equal(plan.simulated_allocated,1);
});
test("reject fake Arcep number blocks, number collisions and wrong e164",()=>{
 assert.throws(()=>planAudiotelArcepBlock({...draft(),mode:"production"}),{code:"APP_BLOCK_OFFLINE_ONLY"});
 assert.throws(()=>planAudiotelArcepBlock({...draft(),block_start_e164:"+33890123001"}),{code:"APP_BLOCK_INVALID_BLOCK_START"});
 assert.throws(()=>planAudiotelArcepBlock(draft([record(1),record(1)])),{code:"APP_BLOCK_DUPLICATE_NUMBER"});
 assert.throws(()=>planAudiotelArcepBlock(draft([{...record(1),number_e164:"+33880123001"}])),{code:"APP_BLOCK_NUMBER_OUTSIDE_BLOCK"});
 assert.throws(()=>planAudiotelArcepBlock(draft([{...record(2),tenant_reference:null}])),{code:"APP_BLOCK_MISSING_TENANT_REFERENCE"});
 assert.throws(()=>planAudiotelArcepBlock(draft([{...record(2,"released"),tenant_reference:"TENANT-0001"}])),{code:"APP_BLOCK_RELEASED_NUMBER_WITH_TENANT"});
});
test("forged block snapshots cannot authorize or influence number allocation",()=>{
 const trusted=planAudiotelArcepBlock(draft());
 const fake={...trusted,numbering_resources_owned:false,number_activation_authorized:false};
 assert.throws(()=>previewAudiotelNumberRequest([fake],{category:"089"}),{code:"APP_BLOCK_UNTRUSTED_BLOCK"});
 assert.equal(previewAudiotelNumberRequest([trusted],{category:"081"}).status,"no_candidate_available");
 assert.throws(()=>previewAudiotelNumberRequest([trusted],{category:"088"}),{code:"APP_BLOCK_INVALID_CATEGORY"});
});
