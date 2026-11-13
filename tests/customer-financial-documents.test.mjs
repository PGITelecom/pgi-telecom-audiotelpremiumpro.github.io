import test from "node:test";
import assert from "node:assert/strict";
import {
  monthlySettlementIndex,monthlySettlementReport,createMonthlySettlementPdf,publicInvoiceUrl
} from "../backend/src/customer-financial-documents.mjs";

const rows=[
  {period_start:"2026-10-01",period_end:"2026-10-31",currency:"EUR",status:"paid",
    upstream_payout_ht:180.50,platform_fee_ht:20.25,net_payout_ht:160.25,
    statement_reference:"OP-123",paid_at:"2026-11-10",payment_due_date:"2026-11-15"},
  {period_start:"2026-10-22",period_end:"2026-10-31",currency:"EUR",status:"disputed",
    upstream_payout_ht:13.20,platform_fee_ht:2.20,net_payout_ht:11,
    statement_reference:"OP-124",payment_due_date:"2026-11-30"},
  {period_start:"2026-09-01",period_end:"2026-09-30",currency:"EUR",status:"reconciled",
    upstream_payout_ht:10,platform_fee_ht:1,net_payout_ht:9,statement_reference:"OP-SEP"},
  {period_start:"2026-10-01",period_end:"2026-10-31",currency:"USD",status:"open",
    upstream_payout_ht:8,platform_fee_ht:1,net_payout_ht:7}
];

test("monthly index isolates months and currencies; disputed rows remain provisional",()=>{
  const groups=monthlySettlementIndex(rows);
  assert.equal(groups.length,3);
  const oct=groups.find(x=>x.period==="2026-10"&&x.currency==="EUR");
  assert.equal(oct.records,2);
  assert.equal(oct.net_payout_ht,171.25);
  assert.equal(oct.platform_fee_ht,22.45);
  assert.equal(oct.disputed_records,1);
  assert.equal(oct.status,"provisional");
  assert.equal(groups.find(x=>x.period==="2026-10"&&x.currency==="USD").net_payout_ht,7);
});

test("report contains no invented invoice, totals, client identity or paid dates",()=>{
  const report=monthlySettlementReport({tenant:{legal_name:"Entreprise Exemple"},rows,period:"2026-10",currency:"EUR"});
  assert.equal(report.kind,"non_fiscal_sva_statement");
  assert.equal(report.reference,"RELEVE-SVA-2026-10-EUR");
  assert.equal(report.customer_name,"Entreprise Exemple");
  assert.equal(report.lines.length,2);
  assert.equal(report.lines[0].paid_at,"2026-11-10");
  assert.equal(report.net_payout_ht,171.25);
  assert.equal(monthlySettlementReport({rows,period:"2026-08",currency:"EUR"}),null);
  assert.equal(monthlySettlementReport({rows,period:"2026-13",currency:"EUR"}),null);
});

test("generated PDF is binary, multi-page, branded and no fiscal invoice is invented",()=>{
  const report=monthlySettlementReport({tenant:{display_name:"Dossier Exemple"},rows,period:"2026-10",currency:"EUR"});
  const pdf=createMonthlySettlementPdf(report);
  assert.ok(Buffer.isBuffer(pdf));
  assert.match(pdf.toString("latin1",0,9),/^%PDF-1\.4/);
  assert.match(pdf.toString("latin1"),/\/Type \/Catalog/);
  assert.match(pdf.toString("latin1"),/\/Subtype \/Image/); // The repository's real logo is embedded.
  assert.match(pdf.toString("latin1"),/non fiscal/);
  assert.match(pdf.toString("latin1"),/%%EOF/);
  const longReport={...report,lines:Array.from({length:40},(_,i)=>({...report.lines[0],statement_reference:"E-"+i}))};
  const multiple=createMonthlySettlementPdf(longReport);
  assert.match(multiple.toString("latin1"),/\/Count 4/);
  assert.throws(()=>createMonthlySettlementPdf({kind:"invoice",period:"2026-10",currency:"EUR"}),/INVALID_STATEMENT/);
});

test("external URLs are limited to official Stripe HTTPS origins",()=>{
  assert.equal(publicInvoiceUrl("https://pay.stripe.com/invoice/acct_123/example"),"https://pay.stripe.com/invoice/acct_123/example");
  assert.equal(publicInvoiceUrl("https://stripe.com.attacker.example/invoice"),null);
  assert.equal(publicInvoiceUrl("javascript:alert(1)"),null);
  assert.equal(publicInvoiceUrl("https://user:pass@stripe.com/invoice"),null);
  assert.equal(publicInvoiceUrl(null),null);
});
