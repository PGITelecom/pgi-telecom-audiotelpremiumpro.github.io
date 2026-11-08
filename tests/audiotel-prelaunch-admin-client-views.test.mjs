import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 buildPrelaunchCaseAdminMarkup,buildPrelaunchAccountingMarkup
} from "../assets/prelaunch-admin-views.js";
import {
 buildPrelaunchClientMarkup
} from "../assets/client-prelaunch-preview.js";

const read=(file)=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const caseRow=(kind,status="received")=>({
 kind,case_reference:"APP-CASE-abcdefgh1234567890",public_reference:"APP-CASE-abcdefgh1234567890",
 stage:status,status,number:null,requested_e164:null,number_category:null,
 created_at:"2026-11-08T00:00:00Z"
});
test("admin summary uses existing card styles and prioritizes incoming porting",()=>{
 const html=buildPrelaunchCaseAdminMarkup({
  business_unit:"audiotel_platform",
  portability:[caseRow("portability","awaiting_documents")],
  new_numbers:[caseRow("new_number")]
 });
 assert.match(html,/Portabilités \(1\)/);
 assert.match(html,/Nouveaux numéros \(1\)/);
 assert.ok(html.indexOf("Portabilités")<html.indexOf("Nouveaux numéros"));
 assert.match(html,/Pièces à compléter/);
 assert.match(html,/Aucune opération télécom exécutée/);
 assert.match(html,/class="ca-card-head"/);
 assert.equal(buildPrelaunchCaseAdminMarkup({
  business_unit:"direct_sva",portability:[],new_numbers:[]
 }),null);
});
test("all user-supplied references and labels are escaped, never interpreted as HTML",()=>{
 const attack='<img src=x onerror=alert(1)>';
 const admin=buildPrelaunchCaseAdminMarkup({
  business_unit:"audiotel_platform",
  portability:[{...caseRow("portability"),public_reference:attack,
   requested_e164:attack,number_category:attack}],
  new_numbers:[]
 });
 assert.doesNotMatch(admin,/<img\b/);
 assert.match(admin,/&lt;img/);
 const client=buildPrelaunchClientMarkup({
  business_unit:"audiotel_platform",cases:[{
   ...caseRow("portability"),case_reference:attack,number:attack,
   number_category:attack
  }]
 },{canEdit:false});
 assert.doesNotMatch(client.port,/<img\b/);
 assert.match(client.port,/&lt;img/);
});
test("client can complete a preliminary porting request only while permitted",()=>{
 const records={business_unit:"audiotel_platform",cases:[
  caseRow("portability","received"),caseRow("new_number","received")
 ],finance:{business_unit:"audiotel_platform",status:"financial_service_not_active",
  unverified_draft_call_count:2,verified_earnings_minor:null}};
 const editable=buildPrelaunchClientMarkup(records,{canEdit:true});
 assert.match(editable.port,/name="number"/);
 assert.match(editable.port,/name="category"/);
 assert.match(editable.new_numbers,/name="category"/);
 assert.doesNotMatch(editable.new_numbers,/name="number"/);
 assert.match(editable.finance,/2 ligne\(s\) CDR préparatoire/);
 assert.match(editable.finance,/Aucun montant de reversement confirmé/);
 const readonly=buildPrelaunchClientMarkup(records,{canEdit:false});
 assert.doesNotMatch(readonly.port,/<form/);
 assert.doesNotMatch(readonly.new_numbers,/<form/);
 const waiting=buildPrelaunchClientMarkup({
  ...records,cases:[caseRow("portability","eligibility_review")]
 },{canEdit:true});
 assert.doesNotMatch(waiting.port,/<form/);
});
test("client preview refuses other business units or invalid financial contexts",()=>{
 assert.equal(buildPrelaunchClientMarkup({
  business_unit:"direct_sva",cases:[caseRow("portability")]
 }),null);
 const view=buildPrelaunchClientMarkup({
  business_unit:"audiotel_platform",cases:[],
  finance:{business_unit:"direct_sva",status:"financial_service_not_active",
   unverified_draft_call_count:99}
 });
 assert.equal(view.finance,"");
});
test("financial admin preview never presents draft amounts as fiscal revenue",()=>{
 const f={business_unit:"audiotel_platform",status:"prelaunch_unverified",
  statement_drafts:4,contract_drafts:2,payout_instruction_drafts:1,
  reconciliation_drafts:3,statutory_revenue_minor:null};
 const s={business_unit:"audiotel_platform",status:"preparation_only",
  micro_services_ceiling_2026_minor:8360000,
  vat_services_standard_2026_minor:3750000,
  vat_services_increased_2026_minor:4125000,
  recorded_monthly_drafts:1,recorded_form_scenarios:2,
  research_markets:[{country_code:"FR"},{country_code:"ES"}]};
 const h=buildPrelaunchAccountingMarkup(f,s);
 assert.match(h,/83[ ]?600 €|83600 €/);
 assert.match(h,/aucun arrêt automatique des services/);
 assert.match(h,/Brouillons uniquement/);
 assert.match(h,/Instructions de versement bloquées/);
 assert.match(h,/Surveillance mensuelle non activée/);
 assert.equal(buildPrelaunchAccountingMarkup(
  {...f,business_unit:"direct_sva"},null),null);
});
test("site and portals only lazy-load views if explicit simulator mode is selected",()=>{
 const files=[
  "assets/client-portal.js",
  "assets/customer-admin.js",
  "assets/accounting-cockpit.js"
 ];
 for(const file of files){
  const s=read(file);
  assert.match(s,/PGI_CONFIG\?\.mode==="simulator"/);
  assert.match(s,file.includes("client-portal")?
   /import\("\.\/client-prelaunch-preview\.js"\)/:
   /import\("\.\/prelaunch-admin-views\.js"\)/);
 }
 const server=read("backend/server.mjs");
 assert.match(server,/prelaunchCaseworkPreview&&method==="GET"/);
 assert.match(server,/prelaunchCaseworkPreview&&method==="POST"/);
});
