import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {readAudiotelStripeInvoices} from "../backend/src/stripe-invoice-readonly.mjs";
const cfg={externalBillingEnabled:true,stripeSecretKey:"sk_test_fake_not_a_secret"};
const binding={customer_reference:"cus_Customer1",subscription_references:["sub_A","sub_B"]};
const response=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});
const inv=(id="in_A",sub="sub_A",more={})=>({
 id,customer:"cus_Customer1",subscription:sub,status:"open",currency:"eur",
 amount_due:490,amount_paid:0,amount_remaining:490,created:1794445200,
 due_date:1795050000,hosted_invoice_url:"https://invoice.stripe.com/i/example",...more
});
test("Stripe read-only request is GET and returns only verified customer and subscription invoices",async()=>{
 let request=null;
 const result=await readAudiotelStripeInvoices(cfg,binding,{
  limit:5,fetchImpl:async(url,options)=>{
   request={url,options};
   return response(200,{data:[
    inv("in_One"),
    inv("in_WrongSubscription","sub_ThirdParty"),
    inv("in_WrongCustomer","sub_A",{customer:"cus_SomeoneElse"}),
    inv("in_Dollars","sub_B",{currency:"usd",amount_due:500,amount_remaining:500})
   ],has_more:false});
  }
 });
 assert.equal(request.options.method,"GET");
 assert.match(request.url,/\/v1\/invoices\?customer=cus_Customer1/);
 assert.equal("body" in request.options,false);
 assert.equal(result.invoice_rows.length,2);
 assert.equal(result.other_or_unverifiable_invoices_excluded,2);
 assert.deepEqual(result.currency_balances_on_page.map(x=>x.currency).sort(),["EUR","USD"]);
 assert.equal(result.currency_balances_on_page.find(x=>x.currency==="EUR").unpaid_open_minor,490);
 assert.equal(result.currency_balances_on_page.find(x=>x.currency==="USD").unpaid_open_minor,500);
 assert.equal(result.current_customer_total_due_verified,false);
 assert.equal(result.no_charge_invoice_payment_or_payout_executed,true);
});
test("pagination returns provider cursor, never sums page as entire customer balance",async()=>{
 const result=await readAudiotelStripeInvoices(cfg,binding,{
  limit:2,starting_after:"in_Prev",fetchImpl:async(url,options)=>{
   assert.match(url,/starting_after=in_Prev/);
   assert.equal(options.method,"GET");
   return response(200,{data:[inv("in_First"),inv("in_Last")],has_more:true});
  }
 });
 assert.equal(result.next_cursor,"in_Last");
 assert.equal(result.has_more,true);
 assert.equal(result.page_totals_are_not_customer_lifetime_totals,true);
 assert.equal(result.upstream_page_size,2);
});
test("invalid Stripe IDs and disabled Stripe block request before any external call",async()=>{
 let calls=0;
 const fetchImpl=async()=>{calls++;throw Error("must not call");};
 await assert.rejects(readAudiotelStripeInvoices({...cfg,externalBillingEnabled:false},binding,{fetchImpl}),
  {code:"APP_INVOICE_STRIPE_NOT_CONFIGURED"});
 await assert.rejects(readAudiotelStripeInvoices(cfg,{customer_reference:"cus_Other",subscription_references:["sub_"]},{fetchImpl}),
  {code:"APP_INVOICE_STRIPE_BINDING_UNVERIFIED"});
 await assert.rejects(readAudiotelStripeInvoices(cfg,binding,{starting_after:"invalid",fetchImpl}),
  {code:"APP_INVOICE_READ_CURSOR_INVALID"});
 await assert.rejects(readAudiotelStripeInvoices(cfg,binding,{limit:100000,fetchImpl}),
  {code:"APP_INVOICE_READ_LIMIT_INVALID"});
 assert.equal(calls,0);
});
test("Stripe document URLs stay on Stripe domain and amounts unknown remain unknown",async()=>{
 const result=await readAudiotelStripeInvoices(cfg,binding,{
  fetchImpl:async()=>response(200,{data:[inv("in_Null","sub_A",{
   amount_due:null,amount_paid:null,amount_remaining:null,
   hosted_invoice_url:"https://invoice.stripe.com.attacker.test/i/p",
   invoice_pdf:"https://pay.stripe.com/doc/test"
  })],has_more:false})
 });
 assert.equal(result.invoice_rows[0].amount_remaining_minor,null);
 assert.equal(result.invoice_rows[0].invoice_url,null);
 assert.equal(result.invoice_rows[0].invoice_pdf_url,"https://pay.stripe.com/doc/test");
 assert.equal(result.currency_balances_on_page[0].open_with_unknown_remaining,1);
 assert.equal(result.currency_balances_on_page[0].unpaid_open_minor,0);
});
test("upstream errors are sanitized; no request body is ever sent",async()=>{
 await assert.rejects(readAudiotelStripeInvoices(cfg,binding,{
  fetchImpl:async()=>response(429,{error:{message:"hidden details"}})
 }),{code:"APP_INVOICE_STRIPE_READ_REJECTED",status:503});
 await assert.rejects(readAudiotelStripeInvoices(cfg,binding,{
  fetchImpl:async()=>response(200,{data:[],has_more:"wrong"})
 }),{code:"APP_INVOICE_STRIPE_PAYLOAD_INVALID"});
});
test("admin-only route binds from Neon and UI refresh is explicit, never automatic",()=>{
 const server=fs.readFileSync("backend/server.mjs","utf8");
 const store=fs.readFileSync("backend/src/store-postgres.mjs","utf8");
 const ui=fs.readFileSync("assets/customer-invoice-detail.js","utf8");
 const detail=fs.readFileSync("assets/tenant-control-detail.js","utf8");
 assert.match(server,/\/api\/v1\/platform\/tenants\/:id\/stripe-invoices/);
 assert.match(server,/const binding=await store\.tenantStripeBillingBinding\(match\.id\)/);
 assert.match(server,/requireRole\(actor,\["admin","finance"\]\)/);
 assert.match(store,/async tenantStripeBillingBinding\(publicId\)/);
 assert.match(store,/STRIPE_CUSTOMER_BINDING_AMBIGUOUS/);
 assert.match(store,/AND s\.billing_provider='stripe'/);
 assert.match(ui,/data-stripe-live-refresh/);
 assert.match(ui,/btn\.addEventListener\("click",\(\)=>load\(null\)\)/);
 assert.match(detail,/mountCustomerStripeLive\(currentId/);
});
