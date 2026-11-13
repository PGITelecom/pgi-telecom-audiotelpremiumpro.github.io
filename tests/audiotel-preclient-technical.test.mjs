import test from "node:test";
import assert from "node:assert/strict";
import {
 completePreclientTechnicalDetails,readCustomerPreclientCases
} from "../backend/src/audiotel-onboarding-casework.mjs";

const ref="APP-CASE-abcdef0123456789012345678901";
const customer=tenant=>({actor_type:"customer",authenticated:true,
 tenant_membership_verified:true,business_unit:"audiotel_platform",
 tenant_id:tenant,case_information_write_authorized:true,
 customer_case_access_verified:true,actor_fingerprint:"f".repeat(64)});
function fake(kind="portability",tenant=77){
 const row={id:7,tenant_id:tenant,public_reference:ref,
  request_kind:kind,requested_e164:null,number_category:null,stage:"received",
  created_at:"2026-11-08T00:00:00Z",updated_at:"2026-11-08T00:00:00Z",
  rio_secret:"raw credential",financial_margin:"internal"};
 const events=[],sqls=[];
 const tx={unsafe:async(sql,p=[])=>{
  sqls.push({sql,p});
  if(sql.startsWith("SELECT id,tenant_id,request_kind,requested_e164"))return[row];
  if(sql.startsWith("SELECT id FROM app_prelaunch_case_events"))
    return events.filter(e=>e.reference===p[1]).map((e,i)=>({id:i+1}));
  if(sql.startsWith("UPDATE app_prelaunch_service_cases")){
   row.requested_e164=p[1];row.number_category=p[2];return[];
  }
  if(sql.startsWith("INSERT INTO app_prelaunch_case_events")){
   events.push({reference:p[3]});return[];
  }
  throw Error("Unexpected SQL "+sql);
 }};
 const readSql={unsafe:async(sql,p=[])=>{
  sqls.push({sql,p});
  if(!sql.includes("FROM app_prelaunch_service_cases"))throw Error(sql);
  if(p[0]!==row.tenant_id)return [];
  return[{...row,kind:row.request_kind}];
 }};
 return {row,events,sqls,store:{sql:{begin:async fn=>fn(tx)},readSql}};
}
test("customer supplies a port-in number online without changing the live phone network",async()=>{
 const d=fake();
 const input={context:customer(77),case_reference:ref,number:"0890123456",category:"089",
 event_reference:"customer-technical-20261108-000001"};
 const first=await completePreclientTechnicalDetails(d.store,input);
 const again=await completePreclientTechnicalDetails(d.store,input);
 assert.equal(first.requested_e164,"+33890123456");
 assert.equal(first.eligibility_verified,false);
 assert.equal(first.operator_contacted,false);
 assert.equal(first.number_ported,false);
 assert.equal(first.number_assigned,false);
 assert.equal(first.routing_activated,false);
 assert.equal(again.changed,false);
 assert.equal(d.events.length,1);
 assert.equal(d.row.requested_e164,"+33890123456");
 assert.equal(d.sqls.filter(x=>/UPDATE app_prelaunch_service_cases/.test(x.sql)).length,1);
});
test("tenant scope cannot be circumvented by a submitted reference",async()=>{
 const d=fake();
 await assert.rejects(()=>completePreclientTechnicalDetails(d.store,{
  context:customer(999),case_reference:ref,category:"089",number:"0890123456",
  event_reference:"customer-technical-20261108-000001"
 }),{code:"APP_CASE_CUSTOMER_ACCESS_DENIED"});
 assert.equal(d.row.requested_e164,null);
 const own=await readCustomerPreclientCases(d.store,{context:customer(77)});
 assert.equal(own.cases.length,1);
 assert.equal(own.cases[0].number,null);
 assert.doesNotMatch(JSON.stringify(own),/raw credential|financial_margin|internal/);
 const other=await readCustomerPreclientCases(d.store,{context:customer(999)});
 assert.equal(other.cases.length,0);
});
test("immutable ported number and category cannot be overwritten by later requests",async()=>{
 const d=fake();
 const args={context:customer(77),case_reference:ref,
 category:"089",number:"0890123456",event_reference:"customer-technical-20261108-000001"};
 await completePreclientTechnicalDetails(d.store,args);
 await assert.rejects(()=>completePreclientTechnicalDetails(d.store,{
  ...args,number:"0890123457",event_reference:"customer-technical-20261108-000002"
 }),{code:"APP_CASE_NUMBER_ALREADY_RECORDED"});
 await assert.rejects(()=>completePreclientTechnicalDetails(d.store,{
  ...args,category:"081",event_reference:"customer-technical-20261108-000003"
 }),{code:"APP_CASE_CATEGORY_NUMBER_MISMATCH"});
 assert.equal(d.row.requested_e164,"+33890123456");
});
test("new-number candidate may specify a category but cannot assign its own number",async()=>{
 const d=fake("new_number");
 const ok=await completePreclientTechnicalDetails(d.store,{
  context:customer(77),case_reference:ref,category:"082",
  event_reference:"customer-technical-new-20261108-00001"
 });
 assert.equal(ok.requested_e164,null);
 assert.equal(ok.number_assigned,false);
 assert.equal(d.row.number_category,"082");
 await assert.rejects(()=>completePreclientTechnicalDetails(d.store,{
  context:customer(77),case_reference:ref,category:"082",
  number:"0820123456",event_reference:"customer-technical-new-20261108-00002"
 }),{code:"APP_CASE_NEW_NUMBER_CANNOT_PREASSIGN"});
});
