import test from "node:test";
import assert from "node:assert/strict";
import {
 readAudiotelFinanceStaffPreview,readAudiotelFinanceCustomerPreview
} from "../backend/src/audiotel-finance-prelaunch-read.mjs";

const staff={authenticated:true,business_unit:"audiotel_platform",
 role:"administrator",staff_finance_read_authorized:true};
const customer=t=>({authenticated:true,business_unit:"audiotel_platform",
 tenant_id:t,tenant_membership_verified:true,customer_finance_read_authorized:true});

function store(){
 const history=[];
 const rows=[{tenant_id:1},{tenant_id:1},{tenant_id:2}];
 return{
  store:{readSql:{unsafe:async(sql,parameters=[])=>{
   history.push({sql,parameters});
   if(sql.includes("AS statement_drafts"))return[{
    statement_drafts:4,contract_drafts:2,payout_instruction_drafts:3,reconciliation_drafts:1
   }];
   if(sql.includes("AS preliminary_cdr_rows")){
    assert.match(sql,/WHERE business_unit='audiotel_platform' AND tenant_id=\$1/);
    return[{preliminary_cdr_rows:rows.filter(x=>x.tenant_id===parameters[0]).length}];
   }
   throw Error("Unknown SQL "+sql);
  }}},
  history
 };
}

test("staff read-only financial cockpit exposes draft counts not verified money",async()=>{
 const d=store(),view=await readAudiotelFinanceStaffPreview(d.store,staff);
 assert.equal(view.status,"prelaunch_unverified");
 assert.equal(view.statement_drafts,4);
 assert.equal(view.contract_drafts,2);
 assert.equal(view.payout_instruction_drafts,3);
 assert.deepEqual(view.available_provider_ports,
   ["carrier_direct","regulated_psp","stripe_connect","revolut_own_funds"]);
 assert.equal(view.tax_status_validated,false);
 assert.equal(view.payable_minor,null);
 assert.equal(view.can_execute_payout,false);
 assert.ok(d.history.every(x=>x.sql.startsWith("SELECT")));
});
test("client financial overview is tenant scoped and never presents draft funds as revenue",async()=>{
 const d=store();
 const a=await readAudiotelFinanceCustomerPreview(d.store,customer(1));
 const b=await readAudiotelFinanceCustomerPreview(d.store,customer(2));
 assert.equal(a.unverified_draft_call_count,2);
 assert.equal(b.unverified_draft_call_count,1);
 assert.equal(a.confirmed_minutes,null);
 assert.equal(a.verified_earnings_minor,null);
 assert.equal(a.payable_minor,null);
 assert.equal(a.already_paid_minor,null);
 assert.equal(a.provider_connected,false);
 assert.deepEqual(d.history.map(x=>x.parameters[0]),[1,2]);
 assert.ok(d.history.every(x=>x.sql.startsWith("SELECT")));
});
test("cross-business-unit, unauthenticated or unprivileged views fail closed",async()=>{
 const d=store();
 await assert.rejects(()=>readAudiotelFinanceStaffPreview(d.store,
  {...staff,business_unit:"direct_sva"}),{code:"APP_FINANCIAL_SCOPE_DENIED"});
 await assert.rejects(()=>readAudiotelFinanceStaffPreview(d.store,
  {...staff,role:"readonly"}),{code:"APP_FINANCIAL_STAFF_PERMISSION_DENIED"});
 await assert.rejects(()=>readAudiotelFinanceCustomerPreview(d.store,
  {...customer(1),tenant_id:0}),{code:"APP_FINANCIAL_TENANT_DENIED"});
 await assert.rejects(()=>readAudiotelFinanceCustomerPreview(d.store,
  {...customer(1),customer_finance_read_authorized:false}),
  {code:"APP_FINANCIAL_TENANT_DENIED"});
 assert.equal(d.history.length,0);
});
