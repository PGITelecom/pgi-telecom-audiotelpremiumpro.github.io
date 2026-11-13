import test from "node:test";
import assert from "node:assert/strict";
import {syncHubSpotCommercialLead} from "../backend/src/hubspot-crm.mjs";

const lead={
 account_type:"business",first_name:"Camille",last_name:"Martin",
 company_name:"Cabinet B",email:"camille@example.test",
 service_intent:"portability",processing_consent:true,
 dossier_ref:"APP-2026-22222222"
};
const validRef="APP-2026-22222222",otherRef="APP-2026-11111111";
const response=(status,body)=>({
 ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body)
});
function stub({deals=[],contactDossier=otherRef}={}){
 const requests=[];
 const fetchImpl=async(url,options={})=>{
  const method=options.method||"GET",body=options.body?JSON.parse(options.body):null;
  requests.push({url,method,body});
  if(url.endsWith("/crm/v3/objects/contacts/search"))
   return response(200,{results:[{id:"123",properties:{
    email:lead.email,statut_commercial_pgi:"Nouveau prospect",
    lifecyclestage:"lead",hubspot_owner_id:"99851906",
    pgi_dossier_ref:contactDossier,company:"Cabinet A"
   }}]});
  if(url.endsWith("/crm/v3/objects/contacts/123")&&method==="PATCH")
   return response(200,{id:"123",properties:body.properties});
  if(url.includes("/crm/v3/objects/contacts/123?associations=deals"))
   return response(200,{id:"123",associations:{deals:{
    results:deals.map(d=>({id:d.id}))
   }}});
  const m=url.match(/\/crm\/v3\/objects\/deals\/(\d+)\?/);
  if(m){
   const d=deals.find(x=>x.id===m[1]);
   if(!d)throw Error("Unknown deal");
   return response(200,{id:d.id,properties:{
    pipeline:"default",dealstage:"appointmentscheduled",
    pgi_dossier_ref:d.ref,hubspot_owner_id:"99851906",
    deal_currency_code:"EUR",dealname:"Existing deal"
   }});
  }
  if(url.endsWith("/crm/v3/objects/deals/902")&&method==="PATCH")
   return response(200,{id:"902",properties:body.properties});
  if(url.endsWith("/crm/v3/objects/deals")&&method==="POST")
   return response(201,{id:"999",properties:body.properties});
  if(url.endsWith("/crm/v4/associations/deals/contacts/labels"))
   return response(200,{results:[{category:"HUBSPOT_DEFINED",typeId:3,label:null}]});
  throw Error("Unexpected "+method+" "+url);
 };
 return {fetchImpl,requests};
}
const options=fetchImpl=>({token:"pat-fake-test-not-real",
 fetchImpl,commercialStatus:"Dossier en préparation"});
test("matches correct dossier instead of first unrelated open deal, and preserves contact original linkage",async()=>{
 const s=stub({deals:[{id:"901",ref:otherRef},{id:"902",ref:validRef}]});
 const result=await syncHubSpotCommercialLead(lead,options(s.fetchImpl));
 assert.equal(result.dealId,"902");
 assert.equal(result.dealCreated,false);
 const patch=s.requests.find(r=>r.url.endsWith("/contacts/123")&&r.method==="PATCH");
 assert.equal(patch.body.properties.pgi_dossier_ref,undefined);
 assert.equal(patch.body.properties.company,undefined);
 assert.equal(patch.body.properties.type_de_demande,undefined);
 assert.equal(s.requests.some(r=>r.url.endsWith("/deals/901")&&r.method==="PATCH"),false);
 assert.equal(s.requests.some(r=>r.url.endsWith("/objects/deals")&&r.method==="POST"),false);
});
test("creates a new dossier-specific deal instead of repurposing old deal",async()=>{
 const s=stub({deals:[{id:"901",ref:otherRef}]});
 const result=await syncHubSpotCommercialLead(lead,options(s.fetchImpl));
 assert.equal(result.dealId,"999");
 assert.equal(result.dealCreated,true);
 const created=s.requests.find(r=>r.url.endsWith("/objects/deals")&&r.method==="POST");
 assert.equal(created.body.properties.pgi_dossier_ref,validRef);
 assert.equal(s.requests.some(r=>r.url.endsWith("/deals/901")&&r.method==="PATCH"),false);
});
test("does not claim a legacy unlabeled opportunity for a newly referenced dossier",async()=>{
 const s=stub({deals:[{id:"901",ref:""}],contactDossier:""});
 const result=await syncHubSpotCommercialLead(lead,options(s.fetchImpl));
 assert.equal(result.dealCreated,true);
 assert.equal(s.requests.some(r=>r.url.endsWith("/deals/901")&&r.method==="PATCH"),false);
});
