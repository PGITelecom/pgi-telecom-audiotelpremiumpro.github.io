import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {mountCustomerPayoutHistory} from "../assets/customer-360-detail.js";
const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const store=read("backend/src/store-postgres.mjs");
const server=read("backend/server.mjs");
const api=read("assets/api-client.js");
const admin=read("assets/customer-admin.js");
const detail=read("assets/tenant-control-detail.js");

test("name/email/dossier lookup remains a server-side tenant directory",()=>{
  assert.match(admin,/id="ca-q"/);
  assert.match(admin,/data-dossier/);
  assert.match(admin,/Recherche client/);
  assert.match(store,/t\.display_name_search LIKE \$1\|\|'%'/);
  assert.match(store,/lower\(btrim\(COALESCE\(t\.billing_email,''\)\)\) LIKE \$1\|\|'%'/);
  assert.match(store,/function dossierLookup/);
});

test("a selected client has a staff-only paginated payout API, scoped in SQL",()=>{
  const method=store.split("async tenantPayoutHistory(publicId,params={}){")[1]?.split("async tenantControlDetail(publicId){")[0];
  assert.ok(method);
  assert.match(method,/tenant\.tenant_type==="internal"/);
  assert.match(method,/WHERE d\.tenant_id=\$1/);
  assert.match(method,/decodeNumericCursor/);
  assert.match(method,/LIMIT \$3/);
  assert.match(method,/payment_reference/);
  assert.match(method,/paid_at/);
  const route=server.split('"/api/v1/platform/tenants/:id/payout-history"')[1]?.slice(0,340)||"";
  assert.match(route,/requireRole\(actor,\["admin","finance","readonly"\]\)/);
  assert.match(route,/store\.tenantPayoutHistory/);
  assert.match(api,/tenantPayoutHistory:function/);
  assert.doesNotMatch(server,/\/api\/v1\/customer\/payout-history/);
});

test("the main customer file shows a dedicated payout and support section",()=>{
  assert.match(detail,/mountCustomerPayoutHistory\(currentId,\$\("td-payout-history"\),data\.settlements\|\|\[\]\)/);
  assert.match(detail,/renderServiceOperations\(data\)/);
  assert.match(detail,/mountTenantRelations/);
  assert.match(detail,/mountInternalNotes/);
});

function fakeRoot(){
  const button={hidden:false,disabled:false,textContent:"",addEventListener(name,cb){this.listener=cb;}};
  const body={innerHTML:"",insertAdjacentHTML(_where,html){this.innerHTML+=html;}};
  const count={textContent:""},err={textContent:""};
  const root={innerHTML:"",isConnected:true,querySelector(sel){
    return ({"[data-payout-more]":button,"[data-payout-rows]":body,"[data-payout-count]":count,"[data-payout-error]":err})[sel]||null;
  }};
  return{root,button,body,count,err};
}
const paid={currency:"EUR",period_start:"2026-10-01",period_end:"2026-10-31",market:"FR",net_payout_ht:150,held_amount_ht:0,status:"paid",payment_due_date:"2026-11-07",paid_at:"2026-11-07T11:03:00Z",payment_reference:"SEPA-20261107-001"};
const pending={...paid,status:"payable",paid_at:null,payment_reference:null};

test("paid payouts expose their payment date and bank reference; pending payouts never masquerade as paid",()=>{
  const {root}=fakeRoot();
  mountCustomerPayoutHistory("00000000-0000-4000-8000-000000000001",root,[paid,pending]);
  assert.match(root.innerHTML,/SEPA-20261107-001/);
  assert.match(root.innerHTML,/Date de versement/);
  assert.match(root.innerHTML,/Non versé/);
  assert.match(root.innerHTML,/150,00/);
  assert.doesNotMatch(root.innerHTML,/Aucun reversement enregistré/);
});

test("a paged payout history never queries another tenant and loads subsequent pages",async()=>{
  const previous=global.window;
  const called=[];
  global.window={PGIApi:{tenantPayoutHistory:async(id,params)=>{
    called.push({id,params});
    return called.length===1?{data:[paid],next_cursor:"cursor_value"}:{data:[pending],next_cursor:null};
  }}};
  try{
    const t="00000000-0000-4000-8000-000000000001";
    const {root,button,body,count,err}=fakeRoot();
    mountCustomerPayoutHistory(t,root,[]);
    await button.listener();
    assert.equal(called[0].id,t);
    assert.equal(called[0].params.limit,"50");
    assert.match(body.innerHTML,/SEPA-20261107-001/);
    assert.equal(button.hidden,false);
    await button.listener();
    assert.equal(called[1].id,t);
    assert.equal(called[1].params.cursor,"cursor_value");
    assert.equal(button.hidden,true);
    assert.equal(count.textContent,"2 reversement(s) chargé(s)");
    assert.equal(err.textContent,"");
  }finally{global.window=previous;}
});
