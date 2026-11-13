/**
 * Audiotel Premium Pro: bulk number lifecycle control-plane preparation.
 * Pure OFFLINE planning. Generates NO provisioning API request and neither
 * assigns nor reserves an Arcep number. Does not open a socket, use credentials,
 * query a database, write a file or establish a real call.
 *
 * "ready_for_documentary_review" means the payload has sufficient references
 * to be reviewed. It NEVER means eligible for operator execution.
 */
import {createHash} from "node:crypto";

const REF=/^[A-Za-z0-9_.:/-]{4,120}$/;
const SVA=/^\+338(?:1|2|9)\d{7}$/;
const OPERATIONS=new Set([
 "prepare_new_number","prepare_portability","prepare_suspend",
 "prepare_resume","prepare_route_change"
]);
const KEYS=["operation_reference","professional_reference","action",
 "number_e164","destination_reference","kyb_evidence_reference",
 "mandate_evidence_reference","carrier_reference"];
const ROOT=["business_unit","mode","batch_reference","operations","batch_size"];
function fail(key){throw Object.assign(new Error("APP_BULK_PREP_"+key),{
 code:"APP_BULK_PREP_"+key,status:422});}
function exact(v,keys,name){
 if(!v||typeof v!=="object"||Array.isArray(v)||
  Object.keys(v).some(k=>!keys.includes(k))||
  keys.some(k=>!Object.hasOwn(v,k)))fail("INVALID_"+name);
}
function ref(v,key,required=true){
 if(v===null&&!required)return;
 if(typeof v!=="string"||!REF.test(v))fail("INVALID_"+key);
}
function allowedOperation(o){
 exact(o,KEYS,"OPERATION");
 ref(o.operation_reference,"OPERATION_REFERENCE");
 ref(o.professional_reference,"PROFESSIONAL_REFERENCE");
 if(!OPERATIONS.has(o.action))fail("ACTION");
 if(o.number_e164!==null&&
   (typeof o.number_e164!=="string"||!SVA.test(o.number_e164)))
  fail("NUMBER_FORMAT");
 ref(o.destination_reference,"DESTINATION_REFERENCE",false);
 ref(o.kyb_evidence_reference,"KYB_REFERENCE",false);
 ref(o.mandate_evidence_reference,"MANDATE_REFERENCE",false);
 ref(o.carrier_reference,"CARRIER_REFERENCE",false);
 if(o.action==="prepare_new_number"){
  if(o.number_e164!==null||o.destination_reference===null)
   fail("NEW_NUMBER_HAS_NO_RESOURCE_YET");
 }else if(o.number_e164===null)fail("MISSING_EXISTING_NUMBER");
 if(o.action==="prepare_route_change"&&o.destination_reference===null)
  fail("MISSING_DESTINATION");
 if(o.action==="prepare_suspend"||o.action==="prepare_resume"){
  if(o.destination_reference!==null)fail("UNEXPECTED_DESTINATION");
 }
}
function planEntry(operation,batchRef){
 const o=operation;
 const missing=[
  ...(o.kyb_evidence_reference?[]:["professional_kyb_evidence"]),
  ...(o.carrier_reference?[]:["contracted_carrier_reference"]),
  ...(o.action==="prepare_portability"&&!o.mandate_evidence_reference?
   ["portability_mandate_evidence"]:[])
 ];
 const evidenceReferencesPresent=missing.length===0;
 const referenceHash=createHash("sha256").update(
  JSON.stringify([batchRef,o.operation_reference,o.professional_reference,
   o.action,o.number_e164,o.destination_reference])
 ).digest("hex");
 return Object.freeze({
  operation_reference:o.operation_reference,
  professional_reference:o.professional_reference,
  action:o.action,number_e164:o.number_e164,
  destination_reference:o.destination_reference,
  draft_fingerprint:referenceHash,
  documentary_evidence_references_present:evidenceReferencesPresent,
  documentary_evidence_independently_verified:false,
  missing_documentary_references:Object.freeze(missing),
  state:evidenceReferencesPresent?
   "ready_for_documentary_review":"additional_documentary_references_needed",
  status:"PLANNED_ONLY_NOT_SUBMITTED",
  arcep_number_rights_verified:false,
  carrier_agreement_verified:false,
  number_current_owner_verified:false,
  portability_mandate_verified:false,
  client_identity_verified:false,
  network_operation_authorized:false,
  customer_funds_transfer_authorized:false
 });
}
export function planAudiotelBulkProvisioning(input={}){
 exact(input,ROOT,"INPUT");
 if(input.business_unit!=="audiotel_platform"||
  input.mode!=="offline_simulation")fail("OFFLINE_ONLY");
 ref(input.batch_reference,"BATCH_REFERENCE");
 if(!Number.isSafeInteger(input.batch_size)||
  input.batch_size<1||input.batch_size>1000)fail("BATCH_SIZE");
 if(!Array.isArray(input.operations)||input.operations.length>5000)
  fail("OPERATIONS_SIZE");
 const uniqueRefs=new Set(),numbers=new Set();
 const prepared=[];
 for(const op of input.operations){
  allowedOperation(op);
  if(uniqueRefs.has(op.operation_reference))fail("DUPLICATE_REFERENCE");
  uniqueRefs.add(op.operation_reference);
  // Multiple operations against the same live number in one batch would
  // create order-dependence and risk. Require a separate reviewed batch.
  if(op.number_e164!==null){
   if(numbers.has(op.number_e164))fail("CONFLICTING_NUMBER_OPERATIONS");
   numbers.add(op.number_e164);
  }
  prepared.push(planEntry(op,input.batch_reference));
 }
 // Bounded, O(n) chunks. Contents are frozen plan objects, not commands.
 const batches=[];
 for(let i=0;i<prepared.length;i+=input.batch_size){
  const entries=Object.freeze(prepared.slice(i,i+input.batch_size));
  batches.push(Object.freeze({
   batch_index:batches.length,
   operation_count:entries.length,
   entries,
   executable:false,external_dispatcher_configured:false,
   carrier_batch_request_created:false
  }));
 }
 return Object.freeze({
  business_unit:"audiotel_platform",mode:"offline_simulation",
  batch_reference:input.batch_reference,
  total_operations:prepared.length,
  chunk_count:batches.length,
  documentary_review_pending:prepared.filter(x=>
   x.documentary_evidence_references_present).length,
  missing_evidence_count:prepared.filter(x=>
   !x.documentary_evidence_references_present).length,
  chunks:Object.freeze(batches),
  idempotent_plan_only:true,no_number_ordered_or_ported:true,
  no_line_activated_suspended_or_resumed:true,
  no_route_update_or_real_api_call:true,
  no_external_operator_credentials_or_connections:true,
  no_real_arcep_resource_allocation:true,
  no_financial_transfer_or_billing:true,
  any_execution_approved:false,
  prelaunch_only:true
 });
}
