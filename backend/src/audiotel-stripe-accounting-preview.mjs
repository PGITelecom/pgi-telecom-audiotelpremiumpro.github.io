/**
 * Accounting preparations for current Audiotel Premium Pro (APP), EUR only.
 * No network, bank, Stripe, accounting posting or invoice emission.
 * IMPORTANT: these are DRAFT templates, never independently verified evidence,
 * and not a substitute for fiscal/contractual qualification.
 */
import {createHash} from 'node:crypto';

const EVENT_TYPES=new Set(['subscription_invoice','subscription_credit_note','stripe_payment','stripe_refund','stripe_fee','stripe_payout','free_period']);
const ACCESS_KEYS=Object.freeze({
 subscription_invoice:['accounts_receivable','subscription_revenue','vat_output'],
 subscription_credit_note:['subscription_revenue','vat_output','accounts_receivable'],
 stripe_payment:['stripe_clearing','accounts_receivable'],
 stripe_refund:['accounts_receivable','stripe_clearing'],
 stripe_fee:['psp_fee_expense','stripe_clearing'],
 stripe_payout:['bank','stripe_clearing'],
 free_period:[]
});
const fail=(code)=>{const e=new Error(code);e.code=code;e.status=422;throw e;};
const minor=(v,label,{positive=false}={})=>{
 if(!Number.isSafeInteger(v)||v<0||v>1_000_000_000_000||(positive&&v===0))fail('APP_LEDGER_INVALID_'+label);
 return v;
};
const reference=(v)=>typeof v==='string'&&/^[A-Za-z0-9_.:/-]{8,180}$/.test(v);
const account=(map,key)=>{
 const n=map?.[key];
 if(typeof n!=='string'||!/^[0-9]{3,12}$/.test(n))fail('APP_LEDGER_ACCOUNT_MISSING_'+key);
 return n;
};
const add=(arr)=>{let v=0;for(const n of arr){v+=n;if(!Number.isSafeInteger(v)||v>1_000_000_000_000)fail('APP_LEDGER_OVERFLOW');}return v;};
const formatLine=(code,debit,credit)=>{
 if((debit>0)===(credit>0))fail('APP_LEDGER_EMPTY_OR_TWO_SIDED_LINE');
 return Object.freeze({account_num:code,debit_minor:debit,credit_minor:credit});
};

export function previewAudiotelStripeEntry(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('APP_LEDGER_INVALID_INPUT');
 if(input.business_unit!=='audiotel_platform'||input.currency!=='EUR')fail('APP_LEDGER_INVALID_SCOPE');
 if(!EVENT_TYPES.has(input.event))fail('APP_LEDGER_EVENT_NOT_SUPPORTED');
 if(!reference(input.source_reference)||!reference(input.evidence_reference))fail('APP_LEDGER_MISSING_SOURCE');
 if(input.tax_policy_approved!==true)fail('APP_LEDGER_TAX_POLICY_NOT_APPROVED');
 if(input.account_map_approved!==true)fail('APP_LEDGER_ACCOUNT_MAP_NOT_APPROVED');
 const map=input.chart||{};
 const accounts=ACCESS_KEYS[input.event].map(k=>account(map,k));
 if(new Set(accounts).size!==accounts.length)fail('APP_LEDGER_CHART_ACCOUNT_COLLISION');
 let lines=[];
 const L=(key,d,c)=>formatLine(account(map,key),d,c);
 if(input.event==='subscription_invoice'||input.event==='subscription_credit_note'){
  const gross=minor(input.gross_minor,'GROSS',{positive:true});
  const vat=minor(input.vat_minor,'VAT');
  if(vat>=gross)fail('APP_LEDGER_VAT_GREATER_THAN_GROSS');
  const net=gross-vat;
  if(input.event==='subscription_invoice')lines=[L('accounts_receivable',gross,0),L('subscription_revenue',0,net),...(vat?[L('vat_output',0,vat)]:[])];
  else lines=[L('subscription_revenue',net,0),...(vat?[L('vat_output',vat,0)]:[]),L('accounts_receivable',0,gross)];
 }else if(input.event==='free_period'){
  if(input.gross_minor!==0||input.vat_minor!==0)fail('APP_LEDGER_FREE_PERIOD_MUST_BE_ZERO');
 }else{
  const amount=minor(input.amount_minor,'AMOUNT',{positive:true});
  switch(input.event){
   case 'stripe_payment':lines=[L('stripe_clearing',amount,0),L('accounts_receivable',0,amount)];break;
   case 'stripe_refund':lines=[L('accounts_receivable',amount,0),L('stripe_clearing',0,amount)];break;
   case 'stripe_fee':lines=[L('psp_fee_expense',amount,0),L('stripe_clearing',0,amount)];break;
   case 'stripe_payout':lines=[L('bank',amount,0),L('stripe_clearing',0,amount)];break;
  }
 }
 const debits=add(lines.map(l=>l.debit_minor)),credits=add(lines.map(l=>l.credit_minor));
 if(debits!==credits)fail('APP_LEDGER_UNBALANCED');
 const hash=createHash('sha256').update(JSON.stringify({scope:input.business_unit,event:input.event,source:input.source_reference,evidence:input.evidence_reference,lines})).digest('hex');
 return Object.freeze({schema_version:'app-stripe-preview/1',business_unit:'audiotel_platform',event:input.event,
  idempotency_key:'app:stripe:'+input.source_reference,source_reference:input.source_reference,evidence_reference:input.evidence_reference,
  currency:'EUR',fingerprint:hash,debit_minor:debits,credit_minor:credits,lines:Object.freeze(lines),
  journal_required:lines.length>0,posted:false,invoice_emitted:false,stripe_verified:false,bank_verified:false,
  statutory_export_authorized:false,needs_expert_review:true});
}

function rows(v,label){
 if(!Array.isArray(v)||v.length>10000)fail('APP_PSP_INVALID_'+label);
 const seen=new Set();
 return v.map(x=>{
  if(!x||!reference(x.reference)||seen.has(x.reference))fail('APP_PSP_DUPLICATE_'+label);
  seen.add(x.reference);
  return {reference:x.reference,amount_minor:minor(x.amount_minor,label,{positive:true})};
 });
}
/**
 * Reconciles a Stripe-clearing account using trusted external statements ONLY AFTER
 * their authenticity has been verified outside this module. This module never
 * asserts authenticity from an input flag supplied by a customer/client.
 */
export function previewAudiotelStripeClearing(input={}){
 if(input.business_unit!=='audiotel_platform'||input.currency!=='EUR'||!reference(input.period_reference))fail('APP_PSP_INVALID_SCOPE');
 const groups={payments:rows(input.payments??[],'PAYMENTS'),refunds:rows(input.refunds??[],'REFUNDS'),
  chargebacks:rows(input.chargebacks??[],'CHARGEBACKS'),fees:rows(input.fees??[],'FEES'),
  payouts:rows(input.payouts??[],'PAYOUTS')};
 const totals=Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,add(v.map(x=>x.amount_minor))]));
 const opening=minor(input.opening_clearing_minor,'OPENING');
 const closing=minor(input.reported_closing_clearing_minor,'CLOSING');
 const expected=opening+totals.payments-totals.refunds-totals.chargebacks-totals.fees-totals.payouts;
 const problems=[];
 if(!Number.isSafeInteger(expected))problems.push('ARITHMETIC_OVERFLOW');
 if(expected<0)problems.push('NEGATIVE_CLEARING_BALANCE');
 if(expected!==closing)problems.push('STRIPE_CLEARING_MISMATCH');
 if(groups.payments.length===0)problems.push('NO_PAYMENT_EVENTS');
 problems.push('STRIPE_EVENTS_AND_BANK_STATEMENT_NOT_AUTHENTICATED');
 return Object.freeze({schema_version:'app-stripe-clearing-preview/1',business_unit:'audiotel_platform',
  period_reference:input.period_reference,currency:'EUR',opening_clearing_minor:opening,
  total_payment_minor:totals.payments,total_refund_minor:totals.refunds,total_chargeback_minor:totals.chargebacks,
  total_fee_minor:totals.fees,total_payout_minor:totals.payouts,
  expected_closing_minor:expected,reported_closing_minor:closing,
  difference_minor:expected-closing,issues:Object.freeze(problems),
  reconciled_with_verified_stripe_and_bank:false,accounting_posted:false,payout_permitted:false});
}
