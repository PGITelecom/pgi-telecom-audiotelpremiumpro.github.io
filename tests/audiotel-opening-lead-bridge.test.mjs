import test from "node:test";
import assert from "node:assert/strict";
import {
 isPrelaunchCaseworkPreview,planOpeningLeadCase,prepareOpeningLeadCase
} from "../backend/src/audiotel-opening-lead-bridge.mjs";
import {
 normalizePreparedAppCase
} from "../backend/src/audiotel-onboarding-preparation.mjs";

const config={mode:"simulator",sessionSecret:"strong-session-secret-".repeat(3)};
const options={prelaunchCaseworkPreview:true};
const dossier={id:84,public_id:"8bd6e1b2-2332-487b-a530-b9de6fb2a301",status:"pending"};
const portability={processing_consent:true,service_intent:"portability",country_code:"FR"};
const number={processing_consent:true,service_intent:"new_number",country_code:"FR"};
function fakeStore(){
 const calls=[],cases=[],events=[],notifications=[];
 const tx={unsafe:async(sql,p=[])=>{
  calls.push({sql,p});
  if(sql.includes("pg_advisory_xact_lock"))return [];
  if(sql.startsWith("SELECT id,public_reference,request_fingerprint"))
    return cases.filter(c=>c.secure_contact_ref===p[0]&&c.request_key===p[1]);
  if(sql.startsWith("INSERT INTO app_prelaunch_service_cases")){
    const c={id:cases.length+1,public_reference:p[0],secure_contact_ref:p[1],
      request_key:p[2],request_fingerprint:p[3],request_kind:p[4],
      number_category:p[5],requested_e164:p[6],tenant_id:p[9],stage:"received"};
    cases.push(c);return [{id:c.id,stage:c.stage}];
  }
  if(sql.startsWith("INSERT INTO app_prelaunch_case_events")){events.push(p);return [];}
  if(sql.startsWith("INSERT INTO app_prelaunch_notification_drafts")){notifications.push(p);return [];}
  throw Error("Unexpected SQL: "+sql);
 }};
 return{store:{sql:{begin:async f=>f(tx)}},calls,cases,events,notifications};
}
test("opening bridge is hard disabled for any production environment",async()=>{
 assert.equal(isPrelaunchCaseworkPreview({mode:"production"},options),false);
 assert.equal(isPrelaunchCaseworkPreview(config,{}),false);
 assert.equal(isPrelaunchCaseworkPreview(config,options),true);
 const db=fakeStore();
 await assert.rejects(()=>prepareOpeningLeadCase(db.store,{
  config:{...config,mode:"production"},options,dossier,lead:portability
 }),{code:"APP_CASE_BRIDGE_PREVIEW_ONLY"});
 assert.equal(db.calls.length,0);
});
test("existing lead becomes a tenant-linked incomplete port-in dossier only in preview",async()=>{
 const db=fakeStore();
 const first=await prepareOpeningLeadCase(db.store,{config,options,dossier,lead:portability});
 const second=await prepareOpeningLeadCase(db.store,{config,options,dossier,lead:portability});
 assert.equal(first.prepared,true);
 assert.equal(first.created,true);
 assert.equal(first.kind,"portability");
 assert.equal(first.stage,"received");
 assert.equal(first.portability_executed,false);
 assert.equal(first.number_assigned,false);
 assert.equal(first.email_sent,false);
 assert.equal(first.operator_contacted,false);
 assert.equal(second.created,false);
 assert.equal(db.cases.length,1);
 assert.equal(db.cases[0].tenant_id,84);
 assert.equal(db.cases[0].requested_e164,null);
 assert.equal(db.cases[0].number_category,null);
 assert.equal(db.events.length,1);
 assert.equal(db.notifications.length,1);
 assert.ok(!db.calls.some(x=>/DELETE|UPDATE.*(?:sva_numbers|carrier)|stripe/i.test(x.sql)));
});
test("new-number lead is separate but cannot reserve, bill or invent a category",async()=>{
 const db=fakeStore();
 const first=await prepareOpeningLeadCase(db.store,{config,options,dossier,lead:number});
 assert.equal(first.kind,"new_number");
 assert.equal(db.cases[0].requested_e164,null);
 assert.equal(db.cases[0].number_category,null);
 assert.equal(first.number_assigned,false);
 assert.equal(first.portability_executed,false);
});
test("no consent, advice or active account never creates a case",async()=>{
 const db=fakeStore();
 for(const lead of [
   {...portability,processing_consent:false},
   {...portability,service_intent:"advice"},
   {...portability,country_code:"GB"},
 ]){
  const result=await prepareOpeningLeadCase(db.store,{config,options,dossier,lead});
  assert.equal(result.prepared,false);
 }
 const active=await prepareOpeningLeadCase(db.store,{
  config,options,dossier:{...dossier,status:"active"},lead:portability});
 assert.equal(active.prepared,false);
 assert.equal(db.cases.length,0);
});
test("lead cannot overwrite contact or tenant IDs, and missing-number case is valid",()=>{
 const plan=planOpeningLeadCase(dossier,portability,config.sessionSecret);
 assert.equal(plan.context.linked_tenant_id,84);
 assert.equal(plan.request.category,undefined);
 assert.equal(plan.request.number,undefined);
 assert.equal(normalizePreparedAppCase({
   ...plan.request,secure_contact_ref:plan.context.secure_contact_ref
 }).requested_e164,null);
 const altered=planOpeningLeadCase(dossier,{
  ...portability,secure_contact_ref:"attacker",tenant_id:900,
  category:"081",number:"+33811234567"
 },config.sessionSecret);
 assert.deepEqual(altered,plan);
});
