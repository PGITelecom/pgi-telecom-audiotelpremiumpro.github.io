/**
 * Read-only customer invoice evidence from the EXISTING signed Stripe webhook
 * journal. Does not call Stripe, modify subscriptions, issue invoices or pay.
 *
 * Event history may be incomplete. "Outstanding snapshot" is the last known
 * Stripe event snapshot, NOT the verified live amount owed today.
 */
const STATUSES=new Set(["draft","open","paid","void","uncollectible"]);
function minor(v){
 return typeof v==="number"&&Number.isSafeInteger(v)&&v>=0?v:null;
}
function currency(v){
 return typeof v==="string"&&/^[A-Z]{3}$/.test(v)?v:null;
}
function str(v,max=180){return typeof v==="string"?v.slice(0,max):null;}
function url(v){
 if(typeof v!=="string"||v.length>2000)return null;
 try{
  const u=new URL(v),host=u.hostname.toLowerCase();
  return u.protocol==="https:"&&(host==="stripe.com"||host.endsWith(".stripe.com"))?
   u.toString():null;
 }catch{return null;}
}
function eventDate(v){
 const d=new Date(v||"");
 return Number.isFinite(d.getTime())?d.toISOString():null;
}
function snapshot(row){
 const n=row.normalized_details;
 if(!n||typeof n!=="object"||Array.isArray(n))return null;
 const ref=str(n.provider_invoice_reference);
 if(!ref||!/^in_[A-Za-z0-9]+$/.test(ref))return null;
 const type=str(row.event_type)||"";
 if(!type.startsWith("invoice."))return null;
 const time=eventDate(row.event_time);
 if(!time)return null;
 return {
  ref,type,time,
  status:STATUSES.has(n.provider_invoice_status)?n.provider_invoice_status:null,
  paid:minor(n.provider_invoice_amount_paid_minor),
  due:minor(n.provider_invoice_amount_due_minor),
  remaining:minor(n.provider_invoice_amount_remaining_minor),
  currency:currency(n.provider_invoice_currency),
  url:url(n.provider_invoice_url),
  pdf:url(n.provider_invoice_pdf_url),
  attempts:minor(n.payment_attempt_count),
  next_attempt:eventDate(n.next_payment_attempt)
 };
}
function sumMoney(target,field,n){const current=target[field];target[field]=current===null||n===null?null:current+n;}
// Pure and deterministic: input must be newest event first, as returned by SQL.
export function summarizeCustomerInvoiceJournal(rows=[],{maxInvoices=50,sourceLimit=300}={}){
 if(!Array.isArray(rows))throw new TypeError("INVOICE_AUDIT_ROWS_INVALID");
 if(!Number.isInteger(maxInvoices)||maxInvoices<1||maxInvoices>100||
    !Number.isInteger(sourceLimit)||sourceLimit<1||sourceLimit>1000)
  throw new TypeError("INVOICE_AUDIT_LIMIT_INVALID");
 const invoices=new Map();let rowsWithoutInvoiceReference=0;
 for(const row of rows.slice(0,sourceLimit)){
  const e=snapshot(row);
  if(!e){rowsWithoutInvoiceReference++;continue;}
  const entry=invoices.get(e.ref)||{ref:e.ref,events:[]};
  entry.events.push(e);invoices.set(e.ref,entry);
 }
 const result=[];
 for(const entry of invoices.values()){
  // Stripe may deliver webhooks in an arbitrary order.
  entry.events.sort((a,b)=>b.time.localeCompare(a.time));
  const latest=entry.events[0];
  const paidEvent=entry.events.find(e=>e.type==="invoice.paid"&&
    (e.status===null||e.status==="paid"));
  const verifiedPaid=Boolean(paidEvent);
  const normalizedStatus=verifiedPaid?"paid":
    latest.status==="void"?"void":
    latest.status==="uncollectible"?"uncollectible":
    ["invoice.payment_failed","invoice.payment_action_required"].includes(latest.type)?"payment_issue":
    latest.status==="open"?"open":latest.status||"unconfirmed";
  // Do not assume a missing amount means 0. Prefer a paid event snapshot.
  const effective=verifiedPaid?paidEvent:latest;
  const amountPaid=verifiedPaid?paidEvent.paid:null;
  const recordCurrency=effective.currency||latest.currency||null;
  result.push(Object.freeze({
    invoice_reference:entry.ref,
    status:normalizedStatus,
    paid_at:verifiedPaid?paidEvent.time:null,
    last_event_at:latest.time,
    paid_minor:amountPaid,
    total_due_minor:effective.due,
    last_reported_remaining_minor:verifiedPaid?0:latest.remaining,
    currency:recordCurrency,
    invoice_url:effective.url||latest.url||null,
    invoice_pdf_url:effective.pdf||latest.pdf||null,
    payment_attempt_count:latest.attempts,
    next_payment_attempt:verifiedPaid?null:latest.next_attempt,
    payment_confirmed_by_stripe_invoice_event:verifiedPaid,
    balance_confirmed_live:false,
    refund_reconciliation_verified:false
  }));
 }
 result.sort((a,b)=>b.last_event_at.localeCompare(a.last_event_at)||
  a.invoice_reference.localeCompare(b.invoice_reference));
 const groups=new Map();
 for(const invoice of result){
  const cur=invoice.currency||"UNVERIFIED";
  if(!groups.has(cur))groups.set(cur,{
    currency:cur,paid_invoices:0,paid_invoices_missing_amount:0,
    payment_issue_invoices:0,paid_amount_minor:0,
    last_reported_unpaid_minor:0,unpaid_invoices_missing_amount:0
  });
  const g=groups.get(cur);
  if(invoice.status==="paid"){
   g.paid_invoices++;
   if(invoice.paid_minor===null)g.paid_invoices_missing_amount++;
   else g.paid_amount_minor+=invoice.paid_minor;
  }else if(["open","payment_issue"].includes(invoice.status)){
   if(invoice.status==="payment_issue")g.payment_issue_invoices++;
   if(invoice.last_reported_remaining_minor===null)g.unpaid_invoices_missing_amount++;
   else g.last_reported_unpaid_minor+=invoice.last_reported_remaining_minor;
  }
 }
 return Object.freeze({
  schema_version:"audiotel-customer-invoices/1",
  source:"signed_stripe_webhook_journal_only",
  all_stripe_invoices_verified:false,
  current_outstanding_balance_verified:false,
  excludes_refunds_and_disputes_from_paid_total:true,
  financial_accounting_net_profit_calculated:false,
  source_rows_scanned:Math.min(rows.length,sourceLimit),
  source_history_truncated:rows.length>=sourceLimit,
  rows_without_invoice_reference:rowsWithoutInvoiceReference,
  invoices_known:result.length,
  invoices_visible:Math.min(result.length,maxInvoices),
  currency_summaries:Object.freeze([...groups.values()].map(x=>Object.freeze(x))),
  invoices:Object.freeze(result.slice(0,maxInvoices)),
  notices:Object.freeze([
   "Only invoices observed via Stripe webhook journal are listed.",
   "Paid amounts are shown only when their Stripe event provides a monetary value.",
   "Outstanding amounts are snapshots, never a live Stripe balance.",
   "Refunds and provider fees must be reconciled before any net-profit claim."
  ]),
  no_payment_initiated:true,no_portability_or_number_provisioning:true
 });
}
