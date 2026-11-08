/**
 * Connection of the existing public opening intent to the APP prelaunch
 * dossier. This never replaces ensureLeadTenant(), the existing client
 * invitation flow, customer portability or the operator worker.
 *
 * HARD OFF in real environments: only a simulator backend, explicitly
 * constructed for CI preview with a disposable PostgreSQL store, may call it.
 */
import {createHash,createHmac} from "node:crypto";
import {preparePreclientServiceCase} from "./audiotel-onboarding-casework.mjs";

function fail(code){throw Object.assign(new Error(code),{code,status:403});}
function id(value){return Number.isSafeInteger(value)&&value>0;}
const ALLOWED_KINDS=new Set(["portability","new_number"]);
const SHAPE=/^[A-Za-z0-9_.:/-]{8,180}$/;

export function isPrelaunchCaseworkPreview(config={},options={}){
  return config.mode==="simulator"&&options.prelaunchCaseworkPreview===true;
}

/** The signed/verified contact is NOT implied by receipt of a public form.
 * The created tenant is still pending, and no customer password is created.
 */
export function planOpeningLeadCase(dossier={},input={},secret=""){
  if(!dossier||!id(dossier.id)||!SHAPE.test(String(dossier.public_id||""))||
     String(dossier.status)!=="pending")return null;
  if(input.processing_consent!==true||String(input.country_code||"FR")!=="FR")return null;
  const kind=String(input.service_intent||"");
  if(!ALLOWED_KINDS.has(kind))return null;
  if(typeof secret!=="string"||secret.length<32)fail("APP_CASE_BRIDGE_SECRET_MISSING");
  // No customer input is permitted to choose the case UUID, linked tenant,
  // contact reference, category, number or gate status.
  const digest=createHmac("sha256",secret)
    .update("audiotel:opening-case:v1:"+dossier.public_id+":"+kind).digest("hex");
  return Object.freeze({
    context:Object.freeze({
      authenticated_source:true,business_unit:"audiotel_platform",
      secure_intake_authorized:true,
      secure_contact_ref:"tenant:"+dossier.public_id,
      linked_tenant_id:dossier.id,
      actor_fingerprint:createHash("sha256").update("audiotel:public-lead-bridge").digest("hex")
    }),
    request:Object.freeze({
      request_key:"opening-"+digest,
      kind,country_code:"FR"
      // Number and category are only collected in a secure subsequent step.
    })
  });
}

export async function prepareOpeningLeadCase(store,{
  config={},options={},dossier,lead
}={}){
  if(!isPrelaunchCaseworkPreview(config,options))
    fail("APP_CASE_BRIDGE_PREVIEW_ONLY");
  if(typeof store?.sql?.begin!=="function")
    fail("APP_CASE_BRIDGE_TRANSACTION_MISSING");
  const plan=planOpeningLeadCase(dossier,lead,
    config.sessionSecret||config.callerHashKey||"");
  if(!plan)return Object.freeze({prepared:false,reason:"no_eligible_pending_lead"});
  const result=await preparePreclientServiceCase(store,plan);
  return Object.freeze({
    prepared:true,case_reference:result.case_reference,created:result.created,
    kind:result.kind,stage:result.stage,
    number_assigned:false,portability_executed:false,
    email_sent:false,operator_contacted:false
  });
}
