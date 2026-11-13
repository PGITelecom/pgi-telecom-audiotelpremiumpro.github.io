import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const store=fs.readFileSync("backend/src/store-postgres.mjs","utf8");
const ui=fs.readFileSync("assets/customer-profitability.js","utf8");
const fn=store.slice(store.indexOf("  async customerProfitability("),
 store.indexOf("  async platformAccounting("));
test("per-client subscription cash uses the existing signed Stripe journal and deduplicates by invoice",()=>{
 assert.match(fn,/subscriptionCash=null/);
 assert.match(fn,/if\(tenantId!==null\)/);
 assert.match(fn,/be\.tenant_id=\$1 AND be\.provider='stripe' AND be\.event_type='invoice\.paid'/);
 assert.match(fn,/DISTINCT ON \(be\.normalized_details->>'provider_invoice_reference'\)/);
 assert.match(fn,/invoice_count_missing_amount/);
 assert.match(fn,/paid_ttc_minor/);
 assert.match(fn,/subscription_cash_snapshot:subscriptionCash/);
});
test("currencies and VAT basis are not mixed into unsupported profit totals",()=>{
 assert.match(fn,/upper\(COALESCE\(be\.normalized_details->>'provider_invoice_currency',''\)\)=\$3/);
 assert.match(fn,/amounts_are_ttc:true/);
 assert.match(fn,/company_net_profit_after_costs_verified:false/);
 assert.match(fn,/refunds_and_provider_fees_deducted:false/);
 assert.match(fn,/margin_collected_ht/);
 assert.match(ui,/subPanel/);
 assert.match(ui,/Factures d’abonnement payées, TTC/);
 assert.match(ui,/Affiché séparément de la marge télécom HT/);
 assert.match(ui,/ne sont pas ajoutés à la marge SVA en HT/);
});
test("no new provider write calls were added to the financial drilldown",()=>{
 assert.doesNotMatch(fn,/stripeApi\(|fetch\(|INSERT INTO subscription_billing_events/);
});
