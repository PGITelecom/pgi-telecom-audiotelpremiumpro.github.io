/**
 * Audiotel pre-client case preparation, not wired to HTTP routes.
 * Prepared against database/prelaunch-not-applied/091... ONLY.
 *
 * Authenticated backend sources can create a dossier; no browser is trusted to
 * supply the contact ref, tenant, proof status, operator command or stage.
 * Every record remains non-activating at DB level.
 */
import {createHash,randomUUID} from "node:crypto";
import {
  normalizePreparedAppCase,normalizeFrenchSvaNumber,fingerprintPreparedAppCase,
  prepareAppCaseDocument,assessPreparedCaseTransition,planPreparedCaseNotification,
  publicPreparedCaseView
} from "./audiotel-onboarding-preparation.mjs";

const fail=(code,status=403)=>{throw Object.assign(new Error(code),{code,status});};
const KEY=/^[A-Za-z0-9_.:-]{16,180}$/;
const REF=/^[A-Za-z0-9_.:/-]{8,180}$/;
const HASH=/^[0-9a-f]{64}$/;
const allowedClient=new Set(["request_key","kind","category","country_code",
  "number","source_operator_label","source_operator_ref"]);

function contextForCase(context){
 if(!context||context.authenticated_source!==true||
    context.business_unit!=="audiotel_platform"||
    context.secure_intake_authorized!==true||
    typeof context.secure_contact_ref!=="string"||!REF.test(context.secure_contact_ref)||
    typeof context.actor_fingerprint!=="string"||!HASH.test(context.actor_fingerprint)||
    (context.linked_tenant_id!=null&&
     (!Number.isSafeInteger(context.linked_tenant_id)||context.linked_tenant_id<=0)))
    fail("APP_CASE_TRUSTED_INTAKE_REQUIRED");
 return context;
}

function requireTx(store){
 if(typeof store?.sql?.begin!=="function")fail("APP_CASE_TRANSACTION_REQUIRED",503);
 return store.sql.begin.bind(store.sql);
}

function clientRequest(request){
 if(!request||typeof request!=="object"||Array.isArray(request)||
    Object.keys(request).some(x=>!allowedClient.has(x)))
   fail("APP_CASE_UNTRUSTED_REQUEST_FIELD",400);
 return request;
}

/** Idempotent backend intake from a separately verified CRM/contact bridge.
 * No contact or document bytes stored, and no external mail/API.
 */
export async function preparePreclientServiceCase(store,{context,request}={}){
 const source=contextForCase(context);
 const input=clientRequest(request);
 const normalized=normalizePreparedAppCase({...input,secure_contact_ref:source.secure_contact_ref});
 const fingerprint=fingerprintPreparedAppCase(normalized);
 const begin=requireTx(store);
 return begin(async tx=>{
   await tx.unsafe("SELECT pg_advisory_xact_lock(hashtext($1))",
     ["app_case:"+normalized.secure_contact_ref+":"+normalized.request_key]);
   const rows=await tx.unsafe(
    "SELECT id,public_reference,request_fingerprint,stage,request_kind,requested_e164,tenant_id"+
    " FROM app_prelaunch_service_cases WHERE secure_contact_ref=$1 AND request_key=$2 FOR UPDATE",
    [normalized.secure_contact_ref,normalized.request_key]);
   if(rows.length>1)fail("APP_CASE_IDEMPOTENCY_INVARIANT_BROKEN",503);
   if(rows.length){
     const existing=rows[0];
     if(existing.request_fingerprint!==fingerprint||
         (source.linked_tenant_id!=null&&
           Number(existing.tenant_id)!==source.linked_tenant_id))
       fail("APP_CASE_IDEMPOTENCY_CONFLICT",409);
     return Object.freeze({
       case_reference:existing.public_reference,kind:existing.request_kind,
       requested_e164:existing.requested_e164,stage:existing.stage,
       created:false,number_assigned:false,portability_executed:false,
       client_account_created:false,notification_sent:false
     });
   }
   // UUID generated server-side; no direct email or subscriber PII in public ref.
   const publicReference="APP-CASE-"+randomUUID().replaceAll("-","");
   const inserted=await tx.unsafe(
    "INSERT INTO app_prelaunch_service_cases"+
    " (public_reference,secure_contact_ref,request_key,request_fingerprint,country_code,"+
    " request_kind,number_category,requested_e164,source_operator_label,source_operator_ref,tenant_id)"+
    " VALUES($1,$2,$3,$4,'FR',$5,$6,$7,$8,$9,$10) RETURNING id,stage",
    [publicReference,normalized.secure_contact_ref,normalized.request_key,
     fingerprint,normalized.kind,normalized.category,normalized.requested_e164,
     normalized.source_operator_label,normalized.source_operator_ref,
     source.linked_tenant_id??null]);
   if(inserted.length!==1)fail("APP_CASE_PERSISTENCE_FAILED",503);
   const caseId=inserted[0].id;
   const sourceReference="created:"+fingerprint.slice(0,32);
   await tx.unsafe(
    "INSERT INTO app_prelaunch_case_events"+
    " (case_id,event_key,stage_from,stage_to,actor_fingerprint,source_reference)"+
    " VALUES($1,'case_prepared',NULL,'received',$2,$3)",
    [caseId,source.actor_fingerprint,sourceReference]);
   const notification=planPreparedCaseNotification({
    case_reference:publicReference,kind:normalized.kind,stage:"received"
   });
   await tx.unsafe(
    "INSERT INTO app_prelaunch_notification_drafts"+
    " (case_id,event_key,template_key,source_reference) VALUES($1,$2,$3,$4)",
    [caseId,"case_prepared",notification.template_key,sourceReference]);
   return Object.freeze({
    case_reference:publicReference,kind:normalized.kind,
    requested_e164:normalized.requested_e164,stage:"received",
    created:true,number_assigned:false,portability_executed:false,
    client_account_created:false,notification_sent:false
   });
 });
}

function staffContext(context){
 if(!context||context.authenticated!==true||
    context.staff_casework_authorized!==true||
    context.business_unit!=="audiotel_platform"||
    !["caseworker","administrator"].includes(context.role)||
    typeof context.actor_fingerprint!=="string"||!HASH.test(context.actor_fingerprint)||
    context.review_evidence_from_server!==true)
    fail("APP_CASE_STAFF_REVIEW_NOT_AUTHORIZED");
 return context;
}
const STAGE_EVENTS=Object.freeze({
 awaiting_documents:"documents_required",
 eligibility_review:"eligibility_checked",
 contract_review:"contract_reviewed",
 operator_packet_prepared:"operator_packet_prepared",
 awaiting_operator_agreement:"operator_agreement_pending",
 handoff_ready:"handoff_prepared",
 on_hold:"case_paused",
 rejected:"case_rejected",cancelled:"case_cancelled"
});

/** Staff-controlled audited stage advance. Proofs are a server-reviewed snapshot.
 * Even handoff_ready CANNOT call an operator or hand out a phone number.
 */
export async function advancePreclientServiceCase(store,{
 context,case_reference,next_stage,proofs={},external_acknowledgment=false,
 event_reference
}={}){
 const actor=staffContext(context);
 if(typeof case_reference!=="string"||!/^APP-CASE-[A-Za-z0-9_-]{12,90}$/.test(case_reference))
   fail("APP_CASE_REFERENCE_INVALID",422);
 if(typeof event_reference!=="string"||!KEY.test(event_reference))
   fail("APP_CASE_EVENT_KEY_INVALID",422);
 const begin=requireTx(store);
 return begin(async tx=>{
   const rows=await tx.unsafe(
     "SELECT id,request_kind,stage FROM app_prelaunch_service_cases"+
     " WHERE public_reference=$1 AND business_unit='audiotel_platform' FOR UPDATE",
     [case_reference]);
   if(rows.length!==1)fail("APP_CASE_NOT_FOUND",404);
   const row=rows[0];
   const event=await tx.unsafe(
     "SELECT id,stage_to FROM app_prelaunch_case_events"+
     " WHERE case_id=$1 AND source_reference=$2 LIMIT 1",
     [row.id,event_reference]);
   if(event.length){
     if(event[0].stage_to!==next_stage)
       fail("APP_CASE_EVENT_REPLAY_CONFLICT",409);
     return Object.freeze({case_reference,stage:next_stage,changed:false,
       number_assigned:false,portability_executed:false,notification_sent:false});
   }
   const plan=assessPreparedCaseTransition({
     kind:row.request_kind,current_stage:row.stage,next_stage,proofs,actor,
     external_acknowledgment
   });
   const eventName=STAGE_EVENTS[next_stage];
   if(!eventName)fail("APP_CASE_STAGE_EVENT_NOT_SUPPORTED",422);
   await tx.unsafe(
     "UPDATE app_prelaunch_service_cases SET stage=$2,updated_at=now() WHERE id=$1",
     [row.id,next_stage]);
   await tx.unsafe(
     "INSERT INTO app_prelaunch_case_events"+
     " (case_id,event_key,stage_from,stage_to,actor_fingerprint,source_reference)"+
     " VALUES($1,$2,$3,$4,$5,$6)",
     [row.id,eventName,row.stage,next_stage,actor.actor_fingerprint,event_reference]);
   const notification=planPreparedCaseNotification({
     case_reference,kind:row.request_kind,stage:next_stage
   });
   await tx.unsafe(
     "INSERT INTO app_prelaunch_notification_drafts"+
     " (case_id,event_key,template_key,source_reference) VALUES($1,$2,$3,$4)",
     [row.id,eventName,notification.template_key,event_reference]);
   return Object.freeze({
     case_reference,stage:next_stage,changed:true,
     operator_handoff_preparation_complete:plan.operator_handoff_preparation_complete,
     number_assigned:false,portability_executed:false,notification_sent:false,
     routing_activated:false,customer_account_created:false
   });
 });
}

/** Private metadata-only reference; never puts document bytes in SQL. */
export async function attachPreclientDocumentReference(store,{
 context,case_reference,document,event_reference
}={}){
 const actor=staffContext(context);
 if(typeof case_reference!=="string"||!/^APP-CASE-[A-Za-z0-9_-]{12,90}$/.test(case_reference))
   fail("APP_CASE_REFERENCE_INVALID",422);
 if(typeof event_reference!=="string"||!KEY.test(event_reference))
   fail("APP_CASE_EVENT_KEY_INVALID",422);
 const prepared=prepareAppCaseDocument(document);
 const begin=requireTx(store);
 return begin(async tx=>{
   const rows=await tx.unsafe(
    "SELECT id,stage FROM app_prelaunch_service_cases WHERE public_reference=$1"+
    " AND business_unit='audiotel_platform' FOR UPDATE",[case_reference]);
   if(rows.length!==1)fail("APP_CASE_NOT_FOUND",404);
   if(["cancelled","rejected"].includes(rows[0].stage))fail("APP_CASE_TERMINAL_DOCUMENT_FORBIDDEN",409);
   const record=await tx.unsafe(
    "INSERT INTO app_prelaunch_case_documents"+
    " (case_id,document_kind,protected_object_ref,source_sha256,retention_until)"+
    " VALUES($1,$2,$3,$4,$5)"+
    " ON CONFLICT(case_id,document_kind,source_sha256) DO NOTHING RETURNING id",
    [rows[0].id,prepared.kind,prepared.secure_object_ref,
     prepared.sha256,prepared.retention_until]);
   if(record.length){
     await tx.unsafe(
      "INSERT INTO app_prelaunch_case_events"+
      " (case_id,event_key,stage_from,stage_to,actor_fingerprint,source_reference)"+
      " VALUES($1,'document_reference_added',$2,$2,$3,$4)",
      [rows[0].id,rows[0].stage,actor.actor_fingerprint,event_reference]);
   }
   return Object.freeze({case_reference,document_kind:prepared.kind,
     created:record.length===1,document_verified:false,
     document_bytes_stored:false,notification_sent:false});
 });
}

/** Read-only internal staff queue for future cockpit composition.
 * The current admin interface is not modified and no route is mounted.
 */
export async function readPreclientStaffQueue(store,{context,limit=50}={}){
 staffContext(context);
 if(typeof store?.readSql?.unsafe!=="function")fail("APP_CASE_READER_NOT_AVAILABLE",503);
 if(!Number.isInteger(limit)||limit<1||limit>100)fail("APP_CASE_QUEUE_LIMIT_INVALID",422);
 const rows=await store.readSql.unsafe(
   "SELECT public_reference,request_kind,number_category,requested_e164,stage,"+
   " created_at,updated_at FROM app_prelaunch_service_cases"+
   " WHERE business_unit='audiotel_platform'"+
   " ORDER BY created_at DESC,id DESC LIMIT $1",[limit]);
 return Object.freeze({
   business_unit:"audiotel_platform",queue_type:"prelaunch_casework",
   portability:rows.filter(x=>x.request_kind==="portability"),
   new_numbers:rows.filter(x=>x.request_kind==="new_number"),
   may_activate_numbers:false,may_trigger_portability:false,
   may_send_notifications:false
 });
}

/** Human review of a private document, without exposing or moving its bytes.
 * No customer is activated and no operator receives an API call.
 */
export async function reviewPreclientDocument(store,{
 context,case_reference,document_id,decision,review_reference,event_reference
}={}){
 const actor=staffContext(context);
 if(actor.secure_document_review_completed!==true)
   fail("APP_CASE_DOCUMENT_REVIEW_EVIDENCE_REQUIRED",403);
 if(typeof case_reference!=="string"||!/^APP-CASE-[A-Za-z0-9_-]{12,90}$/.test(case_reference)||
    !Number.isSafeInteger(document_id)||document_id<1||
    !["verified","rejected"].includes(decision)||
    typeof review_reference!=="string"||!REF.test(review_reference)||
    typeof event_reference!=="string"||!KEY.test(event_reference))
   fail("APP_CASE_DOCUMENT_REVIEW_INVALID",422);
 const begin=requireTx(store);
 return begin(async tx=>{
   const rows=await tx.unsafe(
     "SELECT c.id AS case_id,c.stage,d.id AS document_id,d.review_status"+
     " FROM app_prelaunch_case_documents d"+
     " JOIN app_prelaunch_service_cases c ON c.id=d.case_id"+
     " WHERE c.public_reference=$1 AND c.business_unit='audiotel_platform'"+
     " AND d.id=$2 FOR UPDATE OF c,d",[case_reference,document_id]);
   if(rows.length!==1)fail("APP_CASE_DOCUMENT_NOT_FOUND",404);
   const row=rows[0];
   if(["cancelled","rejected"].includes(row.stage))fail("APP_CASE_TERMINAL_DOCUMENT_FORBIDDEN",409);
   if(row.review_status===decision)return Object.freeze({
     case_reference,document_id,review_status:decision,changed:false,
     activated:false,notification_sent:false
   });
   if(row.review_status!=="unverified")
     fail("APP_CASE_DOCUMENT_REVIEW_CONFLICT",409);
   await tx.unsafe(
     "UPDATE app_prelaunch_case_documents"+
     " SET review_status=$2,reviewed_at=now(),review_reference=$3 WHERE id=$1",
     [document_id,decision,review_reference]);
   await tx.unsafe(
     "INSERT INTO app_prelaunch_case_events"+
     " (case_id,event_key,stage_from,stage_to,actor_fingerprint,source_reference)"+
     " VALUES($1,'document_reviewed',$2,$2,$3,$4)",
     [row.case_id,row.stage,actor.actor_fingerprint,event_reference]);
   return Object.freeze({
     case_reference,document_id,review_status:decision,changed:true,
     activated:false,network_call_executed:false,notification_sent:false
   });
 });
}

/**
 * After the initial public lead, the professional can supply a number via an
 * authenticated, tenant-scoped private operation. Admin can also prepare a
 * draft after verifying the requester. No carrier call and no customer creation.
 */
export async function completePreclientTechnicalDetails(store,{
  context,case_reference,number,category,event_reference
}={}){
 if(typeof case_reference!=="string"||!/^APP-CASE-[A-Za-z0-9_-]{12,90}$/.test(case_reference)||
    typeof event_reference!=="string"||!KEY.test(event_reference))
   fail("APP_CASE_TECHNICAL_REFERENCE_INVALID",422);
 const isCustomer=context?.actor_type==="customer";
 if(isCustomer){
   if(context.authenticated!==true||
      context.tenant_membership_verified!==true||
      context.business_unit!=="audiotel_platform"||
      !Number.isSafeInteger(context.tenant_id)||context.tenant_id<1||
      context.case_information_write_authorized!==true||
      typeof context.actor_fingerprint!=="string"||!HASH.test(context.actor_fingerprint))
     fail("APP_CASE_CUSTOMER_ACCESS_DENIED");
 }else staffContext(context);
 if(!["081","082","089"].includes(category))
   fail("APP_CASE_TECHNICAL_CATEGORY_INVALID",422);
 const begin=requireTx(store);
 return begin(async tx=>{
   const rows=await tx.unsafe(
     "SELECT id,tenant_id,request_kind,requested_e164,number_category,stage"+
     " FROM app_prelaunch_service_cases WHERE public_reference=$1"+
     " AND business_unit='audiotel_platform' FOR UPDATE",[case_reference]);
   if(rows.length!==1)fail("APP_CASE_NOT_FOUND",404);
   const row=rows[0];
   if(isCustomer&&String(row.tenant_id)!==String(context.tenant_id))
     fail("APP_CASE_CUSTOMER_ACCESS_DENIED");
   if(!["received","awaiting_documents","on_hold"].includes(row.stage))
     fail("APP_CASE_TECHNICAL_DETAILS_LOCKED",409);
   const e164=row.request_kind==="portability"?normalizeFrenchSvaNumber(number):null;
   if(row.request_kind==="portability"){
     if("0"+e164.slice(3,5)!==category)
       fail("APP_CASE_CATEGORY_NUMBER_MISMATCH",422);
   }else if(number!=null&&String(number).trim()!==""){
     fail("APP_CASE_NEW_NUMBER_CANNOT_PREASSIGN",422);
   }
   if(row.requested_e164!=null&&row.requested_e164!==e164)
     fail("APP_CASE_NUMBER_ALREADY_RECORDED",409);
   if(row.number_category!=null&&row.number_category!==category)
     fail("APP_CASE_CATEGORY_ALREADY_RECORDED",409);
   const replay=await tx.unsafe(
     "SELECT id FROM app_prelaunch_case_events WHERE case_id=$1"+
     " AND source_reference=$2 LIMIT 1",[row.id,event_reference]);
   const changed=row.requested_e164!==e164||row.number_category!==category;
   if(replay.length){
     if(changed)fail("APP_CASE_EVENT_REPLAY_CONFLICT",409);
     return Object.freeze({case_reference,changed:false,requested_e164:e164,
       category,number_ported:false,number_assigned:false});
   }
   if(changed){
     await tx.unsafe(
       "UPDATE app_prelaunch_service_cases"+
       " SET requested_e164=$2,number_category=$3,updated_at=now() WHERE id=$1",
       [row.id,e164,category]);
   }
   await tx.unsafe(
     "INSERT INTO app_prelaunch_case_events"+
     " (case_id,event_key,stage_from,stage_to,actor_fingerprint,source_reference)"+
     " VALUES($1,'technical_details_recorded',$2,$2,$3,$4)",
     [row.id,row.stage,context.actor_fingerprint,event_reference]);
   return Object.freeze({case_reference,changed,requested_e164:e164,category,
     eligibility_verified:false,number_ported:false,number_assigned:false,
     routing_activated:false,operator_contacted:false});
 });
}

/**
 * Existing customer session scoped to one tenant. No client registration
 * happens here. The raw SQL rows never leave the server.
 */
export async function readCustomerPreclientCases(store,{context,limit=50}={}){
 if(!context||context.authenticated!==true||
    context.business_unit!=="audiotel_platform"||
    context.customer_case_access_verified!==true||
    !Number.isSafeInteger(context.tenant_id)||context.tenant_id<=0)
   fail("APP_CASE_TENANT_ACCESS_DENIED",403);
 if(typeof store?.readSql?.unsafe!=="function")
   fail("APP_CASE_READER_NOT_AVAILABLE",503);
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)
   fail("APP_CASE_QUEUE_LIMIT_INVALID",422);
 const rows=await store.readSql.unsafe(
   "SELECT public_reference,tenant_id,request_kind AS kind,stage,"+
   " requested_e164,created_at,updated_at"+
   " FROM app_prelaunch_service_cases"+
   " WHERE business_unit='audiotel_platform' AND tenant_id=$1"+
   " ORDER BY created_at DESC,id DESC LIMIT $2",[context.tenant_id,limit]);
 return Object.freeze({
   business_unit:"audiotel_platform",
   cases:rows.map(row=>publicPreparedCaseView(row,context)),
   may_cutover_portability:false,may_assign_number:false,
   financial_data_unverified:true
 });
}
