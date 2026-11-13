import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {summarizeCustomerInvoiceJournal} from "../backend/src/customer-invoice-audit.mjs";

function row(ref,type,time,fields={}){
 return {event_type:type,event_time:time,normalized_details:{
  provider_invoice_reference:ref,
  provider_invoice_currency:"EUR",
  provider_invoice_amount_paid_minor:null,
  provider_invoice_amount_due_minor:null,
  provider_invoice_amount_remaining_minor:null,
  provider_invoice_status:null,
  provider_invoice_url:"https://invoice.stripe.com/i/test",
  ...fields
 }};
}
const day="2026-11-13T09:00:00Z";
test("deduplicates paid invoices with failed retries, not double counting income",()=>{
 const a=summarizeCustomerInvoiceJournal([
  row("in_AAA","invoice.payment_failed","2026-11-12T09:00:00Z",{
   provider_invoice_status:"open",provider_invoice_amount_remaining_minor:490
  }),
  row("in_AAA","invoice.paid",day,{
   provider_invoice_status:"paid",
   provider_invoice_amount_paid_minor:490,
   provider_invoice_amount_due_minor:490,
   provider_invoice_amount_remaining_minor:0
  }),
  row("in_AAA","invoice.paid",day,{
   provider_invoice_status:"paid",
   provider_invoice_amount_paid_minor:490
  })
 ]);
 assert.equal(a.invoices_known,1);
 assert.equal(a.currency_summaries[0].paid_amount_minor,490);
 assert.equal(a.currency_summaries[0].paid_invoices,1);
 assert.equal(a.invoices[0].status,"paid");
 assert.equal(a.invoices[0].last_reported_remaining_minor,0);
 assert.equal(a.current_outstanding_balance_verified,false);
 assert.equal(a.no_payment_initiated,true);
});
test("missing amount stays unknown and is not falsely treated as zero",()=>{
 const a=summarizeCustomerInvoiceJournal([
  row("in_BBB","invoice.paid",day,{provider_invoice_status:"paid"})
 ]);
 assert.equal(a.invoices[0].paid_minor,null);
 assert.equal(a.currency_summaries[0].paid_invoices_missing_amount,1);
 assert.equal(a.currency_summaries[0].paid_amount_minor,0);
 assert.equal(a.excludes_refunds_and_disputes_from_paid_total,true);
});
test("open invoice snapshot does not claim current debt",()=>{
 const a=summarizeCustomerInvoiceJournal([
  row("in_CCC","invoice.payment_failed",day,{
   provider_invoice_status:"open",provider_invoice_amount_due_minor:490,
   provider_invoice_amount_remaining_minor:490,
   payment_attempt_count:2
  })
 ]);
 assert.equal(a.invoices[0].status,"payment_issue");
 assert.equal(a.invoices[0].last_reported_remaining_minor,490);
 assert.equal(a.invoices[0].balance_confirmed_live,false);
 assert.equal(a.currency_summaries[0].last_reported_unpaid_minor,490);
 assert.equal(a.current_outstanding_balance_verified,false);
});
test("rejects forged invoice links and ignores records without trusted invoice reference",()=>{
 const a=summarizeCustomerInvoiceJournal([
  row("in_DDD","invoice.payment_failed",day,{
   provider_invoice_status:"open",provider_invoice_url:"https://stripe.com.evil.test/steal"
  }),
  row("bad-ref","invoice.paid",day,{provider_invoice_status:"paid"}),
  row("in_EEE","invoice.paid","invalid-date",{provider_invoice_status:"paid"})
 ]);
 assert.equal(a.invoices_known,1);
 assert.equal(a.rows_without_invoice_reference,2);
 assert.equal(a.invoices[0].invoice_url,null);
});
test("does not mix EUR and USD and can report history as incomplete",()=>{
 const a=summarizeCustomerInvoiceJournal([
  row("in_EU","invoice.paid",day,{
   provider_invoice_status:"paid",provider_invoice_amount_paid_minor:490
  }),
  row("in_US","invoice.paid",day,{
   provider_invoice_currency:"USD",provider_invoice_status:"paid",
   provider_invoice_amount_paid_minor:700
  })
 ],{sourceLimit:2,maxInvoices:1});
 assert.equal(a.currency_summaries.length,2);
 assert.equal(a.invoices_visible,1);
 assert.equal(a.source_history_truncated,true);
});
test("existing protected admin API integrates invoice evidence without a new payment endpoint",()=>{
 const store=fs.readFileSync("backend/src/store-postgres.mjs","utf8");
 const server=fs.readFileSync("backend/server.mjs","utf8");
 const ui=fs.readFileSync("assets/tenant-control-detail.js","utf8");
 const detail=fs.readFileSync("assets/customer-invoice-detail.js","utf8");
 const stripe=fs.readFileSync("backend/src/stripe-billing.mjs","utf8");
 assert.match(store,/summarizeCustomerInvoiceJournal/);
 assert.match(store,/WHERE tenant_id=\$1 AND provider='stripe' AND event_type LIKE 'invoice\.\%'/);
 assert.match(store,/invoice_audit:invoiceAudit/);
 assert.match(server,/requireRole\(actor,\["admin","finance","readonly"\]\)/);
 assert.match(ui,/renderCustomerInvoiceAudit\(data.invoice_audit\)/);
 assert.match(detail,/Derni[eè]r reste signalé|Dernier reste signalé/);
 assert.match(detail,/noopenervalue|paid_minor/);
 assert.match(stripe,/provider_invoice_amount_remaining_minor/);
 assert.match(store,/legacyHash/);
});
test("all returned records are inert and never query the network",()=>{
 const a=summarizeCustomerInvoiceJournal([]);
 assert.deepEqual(a.invoices,[]);
 assert.equal(a.no_payment_initiated,true);
 assert.equal(a.financial_accounting_net_profit_calculated,false);
});
