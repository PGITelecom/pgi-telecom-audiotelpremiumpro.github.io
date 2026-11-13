/**
 * Audiotel Premium Pro. On-demand, read-only invoice snapshot.
 * No POST/PUT/PATCH/DELETE, no checkout, no charge, no payout, no billing
 * subscription change, no webhook replay, no background polling.
 * Tenant/customer binding MUST be obtained from the authenticated local DB.
 */
const CUS=/^cus_[A-Za-z0-9]+$/;
const SUB=/^sub_[A-Za-z0-9]+$/;
const INV=/^in_[A-Za-z0-9]+$/;
const STATUSES=new Set(["draft","open","paid","void","uncollectible"]);
function fail(code,status=422){
 const e=new Error(code);e.code=code;e.status=status;throw e;
}
function cent(n){
 return typeof n==="number"&&Number.isSafeInteger(n)&&n>=0?n:null;
}
function iso(n){
 return typeof n==="number"&&Number.isSafeInteger(n)&&n>0&&n<8640000000000?
  new Date(n*1000).toISOString():null;
}
function link(v){
 if(typeof v!=="string"||v.length>2000)return null;
 try{
  const u=new URL(v),host=u.hostname.toLowerCase();
  return u.protocol==="https:"&&(host==="stripe.com"||host.endsWith(".stripe.com"))?
   u.toString():null;
 }catch{return null;}
}
function subscriptionRef(invoice){
 const data=invoice?.parent?.subscription_details?.subscription??invoice?.subscription;
 return typeof data==="string"?data:typeof data?.id==="string"?data.id:null;
}
function normalizeInvoice(invoice,allowed,customer){
 if(!invoice||!INV.test(String(invoice.id||"")))return null;
 const linkedCustomer=typeof invoice.customer==="string"?invoice.customer:invoice.customer?.id;
 if(linkedCustomer!==customer)return null;
 const sub=subscriptionRef(invoice);
 if(!SUB.test(String(sub||""))||!allowed.has(sub))return null;
 const cur=String(invoice.currency||"").toUpperCase();
 if(!/^[A-Z]{3}$/.test(cur))return null;
 const status=String(invoice.status||"");
 if(!STATUSES.has(status))return null;
 return Object.freeze({
  invoice_reference:invoice.id,
  subscription_reference:sub,
  currency:cur,status,
  amount_due_minor:cent(invoice.amount_due),
  amount_paid_minor:cent(invoice.amount_paid),
  amount_remaining_minor:cent(invoice.amount_remaining),
  created_at:iso(invoice.created),
  due_at:iso(invoice.due_date),
  paid_at:iso(invoice.status_transitions?.paid_at),
  invoice_url:link(invoice.hosted_invoice_url),
  invoice_pdf_url:link(invoice.invoice_pdf),
  live_stripe_invoice_status_verified:true,
  refund_and_dispute_net_result_verified:false
 });
}
function parseOptions(options){
 const limit=options.limit===undefined?25:Number(options.limit);
 if(!Number.isInteger(limit)||limit<1||limit>25)fail("APP_INVOICE_READ_LIMIT_INVALID",400);
 const after=options.starting_after==null?"":String(options.starting_after).trim();
 if(after&&!INV.test(after))fail("APP_INVOICE_READ_CURSOR_INVALID",400);
 return {limit,after};
}
/**
 * Live Stripe GET only, manual administrator-initiated.
 * The Stripe customer and subscriptions are pre-validated locally.
 */
export async function readAudiotelStripeInvoices(config,binding,options={}){
 if(config?.externalBillingEnabled!==true||!config?.stripeSecretKey)
  fail("APP_INVOICE_STRIPE_NOT_CONFIGURED",503);
 const customer=String(binding?.customer_reference||"");
 const refs=binding?.subscription_references;
 if(!CUS.test(customer)||!Array.isArray(refs)||refs.length<1||refs.length>50||
  refs.some(x=>!SUB.test(String(x||""))))
  fail("APP_INVOICE_STRIPE_BINDING_UNVERIFIED",409);
 const allowed=new Set(refs);
 const {limit,after}=parseOptions(options);
 const fetchImpl=options.fetchImpl||globalThis.fetch;
 if(typeof fetchImpl!=="function")fail("APP_INVOICE_FETCH_UNAVAILABLE",503);
 const params=new URLSearchParams({customer,limit:String(limit)});
 if(after)params.set("starting_after",after);
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),8000);
 let response;
 try{
  response=await fetchImpl("https://api.stripe.com/v1/invoices?"+params,{
   method:"GET",
   headers:{
    Authorization:"Bearer "+config.stripeSecretKey,
    "Stripe-Version":String(config?.stripeApiVersion||"2026-08-26.dahlia")
   },
   signal:controller.signal
  });
 }catch{
  fail("APP_INVOICE_STRIPE_READ_UNAVAILABLE",502);
 }finally{clearTimeout(timer);}
 if(!response.ok)fail("APP_INVOICE_STRIPE_READ_REJECTED",response.status===429?503:502);
 let payload;
 try{payload=await response.json();}catch{fail("APP_INVOICE_STRIPE_PAYLOAD_INVALID",502);}
 if(!Array.isArray(payload?.data)||payload.data.length>limit||
  typeof payload.has_more!=="boolean")fail("APP_INVOICE_STRIPE_PAYLOAD_INVALID",502);
 const filtered=payload.data.map(x=>normalizeInvoice(x,allowed,customer)).filter(Boolean);
 const excluded=payload.data.length-filtered.length;
 const totals=new Map();
 for(const inv of filtered){
  const k=inv.currency;
  if(!totals.has(k))totals.set(k,{
   currency:k,unpaid_open_minor:0,open_with_unknown_remaining:0,
   paid_invoice_count:0,open_invoice_count:0
  });
  const t=totals.get(k);
  if(inv.status==="paid")t.paid_invoice_count++;
  if(inv.status==="open"){
   t.open_invoice_count++;
   if(inv.amount_remaining_minor===null)t.open_with_unknown_remaining++;
   else t.unpaid_open_minor+=inv.amount_remaining_minor;
  }
 }
 const last=payload.data.at(-1)?.id;
 if(payload.has_more&&!INV.test(String(last||"")))
  fail("APP_INVOICE_STRIPE_PAGINATION_INVALID",502);
 return Object.freeze({
  schema_version:"audiotel-stripe-live-invoices/1",
  business_unit:"audiotel_platform",
  source:"stripe_invoices_get_read_only",
  fetched_at:new Date().toISOString(),
  upstream_page_size:payload.data.length,
  other_or_unverifiable_invoices_excluded:excluded,
  invoice_count:filtered.length,
  invoice_rows:Object.freeze(filtered),
  currency_balances_on_page:Object.freeze([...totals.values()].map(x=>Object.freeze(x))),
  current_customer_total_due_verified:false,
  has_more:payload.has_more,
  next_cursor:payload.has_more?last:null,
  page_totals_are_not_customer_lifetime_totals:true,
  no_refunds_or_disputes_netting:true,
  no_charge_invoice_payment_or_payout_executed:true,
  no_telecom_activation_or_external_provisioning:true
 });
}
