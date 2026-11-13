import test from "node:test";
import assert from "node:assert/strict";
import {
 normalizeFrenchSvaNumber,normalizePreparedAppCase,fingerprintPreparedAppCase,
 prepareAppCaseDocument,assessPreparedCaseTransition,planPortabilityCutover,
 planPreparedCaseNotification,publicPreparedCaseView,APP_CASE_REQUIRED_PROOFS
} from "../backend/src/audiotel-onboarding-preparation.mjs";
import {
 preparePreclientServiceCase,advancePreclientServiceCase,
 attachPreclientDocumentReference,reviewPreclientDocument,readPreclientStaffQueue
} from "../backend/src/audiotel-onboarding-casework.mjs";

const actor={authenticated:true,business_unit:"audiotel_platform",role:"administrator",
 staff_casework_authorized:true,review_evidence_from_server:true,actor_fingerprint:"a".repeat(64)};
const intake={authenticated_source:true,business_unit:"audiotel_platform",
 secure_intake_authorized:true,secure_contact_ref:"CRM-OPAQUE-1234",
 actor_fingerprint:"b".repeat(64)};
const base={country_code:"FR",kind:"portability",category:"089",
 request_key:"case-portability-idem-2026-0001",
 number:"08 90 12 34 56",source_operator_label:"Déclaré par le demandeur"};
const brandNew={country_code:"FR",kind:"new_number",category:"082",
 request_key:"case-newnumber-idem-2026-000001"};
const reference="APP-CASE-abcdef0123456789";
const evidence=kind=>Object.fromEntries(APP_CASE_REQUIRED_PROOFS[kind].map(x=>[x,true]));

function fakeDb(){
 const cases=[],events=[],docs=[],notifications=[],calls=[];
 const db={
  sql:{begin:async fn=>fn({unsafe:txQuery})},
  readSql:{unsafe:async(sql,p)=>{calls.push([sql,p]);if(sql.includes("FROM app_prelaunch_service_cases"))
   return cases.map(c=>({public_reference:c.public_reference,request_kind:c.request_kind,
    number_category:c.number_category,requested_e164:c.requested_e164,stage:c.stage,
    created_at:"2026-11-08T00:00:00Z",updated_at:"2026-11-08T00:00:00Z"}));throw Error(sql);}}
 };
 async function txQuery(sql,p=[]){
  calls.push([sql,p]);
  if(sql.includes("pg_advisory_xact_lock"))return [];
  if(sql.startsWith("SELECT id,public_reference,request_fingerprint"))
    return cases.filter(c=>c.secure_contact_ref===p[0]&&c.request_key===p[1]);
  if(sql.startsWith("INSERT INTO app_prelaunch_service_cases")){
   const c={id:cases.length+1,public_reference:p[0],secure_contact_ref:p[1],
     request_key:p[2],request_fingerprint:p[3],request_kind:p[4],
     number_category:p[5],requested_e164:p[6],stage:"received"};
   if(c.requested_e164&&cases.some(x=>x.requested_e164===c.requested_e164))
     throw Object.assign(Error("unique violation"),{code:"23505"});
   cases.push(c);return [{id:c.id,stage:c.stage}];
  }
  if(sql.startsWith("SELECT c.id AS case_id"))
    return docs.filter(d=>cases.some(c=>c.id===d.case_id&&c.public_reference===p[0])&&d.id===p[1])
      .map(d=>({case_id:d.case_id,stage:cases.find(c=>c.id===d.case_id).stage,
        document_id:d.id,review_status:d.review_status||"unverified"}));
  if(sql.startsWith("UPDATE app_prelaunch_case_documents")){
    docs.find(d=>d.id===p[0]).review_status=p[1];return [];
  }
  if(sql.startsWith("SELECT id,request_kind,stage"))
    return cases.filter(c=>c.public_reference===p[0]);
  if(sql.startsWith("SELECT id,stage FROM app_prelaunch_service_cases"))
    return cases.filter(c=>c.public_reference===p[0]);
  if(sql.startsWith("SELECT id,stage_to FROM app_prelaunch_case_events"))
    return events.filter(e=>e.case_id===p[0]&&e.source_reference===p[1]);
  if(sql.startsWith("UPDATE app_prelaunch_service_cases")){
    const c=cases.find(c=>c.id===p[0]);c.stage=p[1];return [];
  }
  if(sql.startsWith("INSERT INTO app_prelaunch_case_events")){
    let e;
    if(sql.includes("'case_prepared'"))e={case_id:p[0],stage_to:"received",source_reference:p[2]};
    else if(sql.includes("'document_reference_added'"))e={case_id:p[0],stage_to:p[1],source_reference:p[3]};
    else if(sql.includes("'document_reviewed'"))e={case_id:p[0],stage_to:p[1],source_reference:p[3]};
    else e={case_id:p[0],stage_to:p[3],source_reference:p[5]};
    events.push(e);return [];
  }
  if(sql.startsWith("INSERT INTO app_prelaunch_notification_drafts")){
    notifications.push(p);return [];
  }
  if(sql.startsWith("INSERT INTO app_prelaunch_case_documents")){
    if(docs.some(d=>d.case_id===p[0]&&d.sha256===p[3]))return [];
    const d={id:docs.length+1,case_id:p[0],sha256:p[3]};docs.push(d);return[d];
  }
  throw Error("Unknown query "+sql);
 }
 return{db,cases,events,docs,notifications,calls};
}

test("FR 081/082/089 number validation accepts national or E164, never an ordinary line",()=>{
 assert.equal(normalizeFrenchSvaNumber("0890123456"),"+33890123456");
 assert.equal(normalizeFrenchSvaNumber("+33 8 21 23 45 67"),"+33821234567");
 for(const n of ["0677123456","0800123456","+33123456789","089000", "089012345678",
  "0890\n123456","+33890887766; DROP TABLE","0123456789"])
  assert.throws(()=>normalizeFrenchSvaNumber(n),{code:"APP_CASE_NOT_FRENCH_PREMIUM_SVA"});
 const n=normalizePreparedAppCase({...base,secure_contact_ref:intake.secure_contact_ref});
 assert.equal(n.requested_e164,"+33890123456");
 assert.equal(n.business_unit,"audiotel_platform");
 assert.equal(fingerprintPreparedAppCase(n).length,64);
 assert.equal(normalizePreparedAppCase({...brandNew,secure_contact_ref:intake.secure_contact_ref}).requested_e164,null);
 for(const input of [
  {...base,secure_contact_ref:intake.secure_contact_ref,category:"082"},
  {...base,secure_contact_ref:intake.secure_contact_ref,country_code:"GB"},
  {...brandNew,secure_contact_ref:intake.secure_contact_ref,number:"0890123456"}
 ])assert.throws(()=>normalizePreparedAppCase(input));
});

test("document preparation stores only references, not bytes or raw RIO",()=>{
 const x=prepareAppCaseDocument({kind:"rio_reference",
  secure_object_ref:"SECURE-DOC-PORT-0001",sha256:"d".repeat(64),
  retention_until:"2027-05-01"});
 assert.equal(x.review_status,"unverified");
 assert.equal(x.download_url,null);
 assert.ok(!("rio" in x));
 for(const doc of [
  {kind:"rio_reference",secure_object_ref:"some-secure-ref",sha256:"d".repeat(64),
   retention_until:"2027-05-01",plaintext_rio:"SECRET"},
  {kind:"holder_mandate",secure_object_ref:"https://example.com/public-link",
   sha256:"d".repeat(64),retention_until:"2027-05-01",file_bytes:"secret"},
  {kind:"rio_reference",secure_object_ref:"test",sha256:"d".repeat(64),
   retention_until:"2027-05-01"},
  {kind:"rio_reference",secure_object_ref:"SECURE-DOC-PORT-0001",
   sha256:"d".repeat(64),retention_until:"2027-02-31"}
 ])assert.throws(()=>prepareAppCaseDocument(doc));
});

test("portability and new number stage gate never activate an operator",()=>{
 for(const kind of ["portability","new_number"]){
   const good=assessPreparedCaseTransition({
     kind,current_stage:"awaiting_operator_agreement",next_stage:"handoff_ready",
     proofs:evidence(kind),actor,external_acknowledgment:true
   });
   assert.equal(good.operator_handoff_preparation_complete,true);
   assert.equal(good.may_call_external_operator,false);
   assert.equal(good.may_assign_number,false);
   assert.equal(good.may_cutover_portability,false);
   assert.equal(good.may_create_client_login,false);
   assert.equal(good.may_send_email,false);
   assert.throws(()=>assessPreparedCaseTransition({
     kind,current_stage:"awaiting_operator_agreement",next_stage:"handoff_ready",
     proofs:evidence(kind),actor,external_acknowledgment:false
   }),{code:"APP_CASE_OPERATOR_HANDOFF_EVIDENCE_MISSING"});
 }
 assert.throws(()=>assessPreparedCaseTransition({
  kind:"portability",current_stage:"received",next_stage:"handoff_ready",
  proofs:evidence("portability"),actor,external_acknowledgment:true
 }),{code:"APP_CASE_TRANSITION_FORBIDDEN"});
 assert.throws(()=>assessPreparedCaseTransition({
  kind:"portability",current_stage:"received",next_stage:"awaiting_documents",
  actor:{...actor,staff_casework_authorized:false}
 }),{code:"APP_CASE_STAFF_AUTHORIZATION_REQUIRED"});
});

test("port-in cutover is always disabled, even with every local check marked true",()=>{
 const all=Object.fromEntries([
 "operator_contract_signed","holder_authorization_verified",
 "rio_verified_using_current_arcep_rules","carrier_acceptance_authenticated",
 "portability_effective_confirmation","network_routing_confirmed",
 "test_calls_fixed_and_mobile_passed","cdr_mapping_confirmed",
 "tenant_isolation_verified","financial_and_compliance_release_approved"
 ].map(k=>[k,true]));
 const p=planPortabilityCutover({case_reference:reference,confirmed_checks:all});
 assert.deepEqual(p.missing_checks,[]);
 assert.equal(p.number_ported,false);
 assert.equal(p.network_cutover_authorized,false);
 assert.equal(p.client_activation_authorized,false);
 const note=planPreparedCaseNotification({case_reference:reference,
  kind:"portability",stage:"awaiting_documents"});
 assert.equal(note.template_key,"pieces_complementaires_requises");
 assert.equal(note.send_enabled,false);
 assert.equal(note.resend_called,false);
 assert.equal(note.marketing,false);
});

test("prospect port-in is idempotently recorded with an audit and dormant notification",async()=>{
 const d=fakeDb();
 const one=await preparePreclientServiceCase(d.db,{context:intake,request:base});
 const two=await preparePreclientServiceCase(d.db,{context:intake,request:base});
 assert.equal(one.created,true);assert.equal(two.created,false);
 assert.equal(one.case_reference,two.case_reference);
 assert.equal(one.requested_e164,"+33890123456");
 assert.equal(d.cases.length,1);
 assert.equal(d.events.length,1);
 assert.equal(d.notifications.length,1);
 assert.equal(d.calls.filter(x=>/INSERT INTO app_prelaunch_service_cases/.test(x[0])).length,1);
 assert.equal(d.calls.some(x=>/UPDATE (?:sva_numbers|logical_carrier_routes)|sendEmail|stripe/i.test(x[0])),false);
 assert.equal(one.number_assigned,false);assert.equal(one.portability_executed,false);
 await assert.rejects(()=>preparePreclientServiceCase(d.db,{
  context:intake,request:{...base,category:"081"}
 }));
 await assert.rejects(()=>preparePreclientServiceCase(d.db,{
  context:intake,request:{...base,request_key:base.request_key,number:"0890111111"}
 }),{code:"APP_CASE_IDEMPOTENCY_CONFLICT"});
 await assert.rejects(()=>preparePreclientServiceCase(d.db,{
  context:intake,request:{...base,tenant_id:123}
 }),{code:"APP_CASE_UNTRUSTED_REQUEST_FIELD"});
 await assert.rejects(()=>preparePreclientServiceCase(d.db,{
  context:{...intake,authenticated_source:false},request:base
 }),{code:"APP_CASE_TRUSTED_INTAKE_REQUIRED"});
});

test("new-number prospect is distinct and cannot self-select a reserved number",async()=>{
 const d=fakeDb();
 const r=await preparePreclientServiceCase(d.db,{context:intake,request:brandNew});
 assert.equal(r.kind,"new_number");assert.equal(r.requested_e164,null);
 assert.equal(d.cases[0].number_category,"082");
 await assert.rejects(()=>preparePreclientServiceCase(d.db,{
  context:intake,request:{...brandNew,number:"+33821234567"}
 }),{code:"APP_CASE_NEW_NUMBER_CANNOT_PREASSIGN"});
});

test("staff can prepare status transitions and document refs with strict evidence isolation",async()=>{
 const d=fakeDb(),start=await preparePreclientServiceCase(d.db,{context:intake,request:base});
 const note=await advancePreclientServiceCase(d.db,{
  context:actor,case_reference:start.case_reference,next_stage:"awaiting_documents",
  event_reference:"evt-2026-docs-000001"
 });
 assert.equal(note.changed,true);assert.equal(note.notification_sent,false);
 const replay=await advancePreclientServiceCase(d.db,{
  context:actor,case_reference:start.case_reference,next_stage:"awaiting_documents",
  event_reference:"evt-2026-docs-000001"
 });
 assert.equal(replay.changed,false);
 assert.equal(d.events.length,2);assert.equal(d.notifications.length,2);
 await assert.rejects(()=>advancePreclientServiceCase(d.db,{
  context:actor,case_reference:start.case_reference,next_stage:"handoff_ready",
  event_reference:"evt-2026-cutover-0001"
 }),{code:"APP_CASE_TRANSITION_FORBIDDEN"});
 const doc=await attachPreclientDocumentReference(d.db,{
  context:actor,case_reference:start.case_reference,event_reference:"evt-2026-doc-ref-0001",
  document:{kind:"holder_mandate",secure_object_ref:"PRIVATE-BLOB-000001",
   sha256:"d".repeat(64),retention_until:"2027-12-31"}
 });
 assert.equal(doc.created,true);assert.equal(doc.document_verified,false);
 assert.equal(d.docs.length,1);
 const queue=await readPreclientStaffQueue(d.db,{context:actor});
 assert.equal(queue.portability.length,1);
 assert.equal(queue.new_numbers.length,0);
 assert.equal(queue.may_trigger_portability,false);
});

test("customer projection omits PII, raw RIO and unrelated tenant records",()=>{
 const row={tenant_id:7,public_reference:reference,kind:"portability",
  stage:"awaiting_documents",requested_e164:"+33890123456",
  missing_document_kinds:["holder_mandate","untrusted_data"],
  created_at:"2026-11-08",updated_at:"2026-11-08",rio:"secret",
  private_contact:"hidden",carrier_margin:"private"};
 assert.throws(()=>publicPreparedCaseView(row,{
  authenticated:true,business_unit:"audiotel_platform",
  tenant_id:8,customer_case_access_verified:true
 }),{code:"APP_CASE_TENANT_ACCESS_DENIED"});
 const view=publicPreparedCaseView(row,{
  authenticated:true,business_unit:"audiotel_platform",
  tenant_id:7,customer_case_access_verified:true
 });
 assert.deepEqual(view.missing_documents,["holder_mandate"]);
 assert.equal(view.number,"+33890123456");
 assert.equal(view.activation_status,"not_activated");
 assert.doesNotMatch(JSON.stringify(view),/secret|private|margin|rio/);
});

test("authorized document review is audited and never activates numbers or calls",async()=>{
 const d=fakeDb();
 const p=await preparePreclientServiceCase(d.db,{context:intake,request:base});
 const doc=await attachPreclientDocumentReference(d.db,{
  context:actor,case_reference:p.case_reference,event_reference:"evt-document-attach-2026",
  document:{kind:"holder_mandate",secure_object_ref:"PRIVATE-DOCUMENT-2026",
   sha256:"e".repeat(64),retention_until:"2027-09-30"}
 });
 assert.equal(doc.created,true);
 await assert.rejects(()=>reviewPreclientDocument(d.db,{
  context:actor,case_reference:p.case_reference,document_id:1,
  decision:"verified",review_reference:"TRUSTED-REVIEW-2026",
  event_reference:"evt-document-review-2026"
 }),{code:"APP_CASE_DOCUMENT_REVIEW_EVIDENCE_REQUIRED"});
 const reviewed=await reviewPreclientDocument(d.db,{
  context:{...actor,secure_document_review_completed:true},
  case_reference:p.case_reference,document_id:1,
  decision:"verified",review_reference:"TRUSTED-REVIEW-2026",
  event_reference:"evt-document-review-2026"
 });
 assert.equal(reviewed.changed,true);assert.equal(reviewed.activated,false);
 assert.equal(d.docs[0].review_status,"verified");
 assert.equal(d.events.at(-1).source_reference,"evt-document-review-2026");
 assert.equal(d.notifications.length,1);
 await assert.rejects(()=>reviewPreclientDocument(d.db,{
  context:{...actor,secure_document_review_completed:true},
  case_reference:p.case_reference,document_id:1,
  decision:"rejected",review_reference:"TRUSTED-REVIEW-2026",
  event_reference:"evt-document-conflict-2026"
 }),{code:"APP_CASE_DOCUMENT_REVIEW_CONFLICT"});
});
