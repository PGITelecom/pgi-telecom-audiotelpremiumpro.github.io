/**
 * Double-entry accounting PREVIEW ONLY, in integer EUR cents.
 * A single statutory ledger for the legal entity, distinct analytical units.
 * No invoice emission, tax classification, FEC writing, PSP action or bank transfer.
 * Validate chart mapping, tax regime, agent/principal contract with an accountant.
 */
import {createHash} from 'node:crypto';
export const FINANCIAL_DRAFT_SCHEMA='audiotel-financial-draft/1';
const EVENTS=Object.freeze({
  subscription_invoice:'audiotel_platform',
  subscription_receipt:'audiotel_platform',
  subscription_credit_note:'audiotel_platform',
  subscription_refund:'audiotel_platform',
  carrier_collection_agent:'direct_sva',
  publisher_payout:'direct_sva',
  operator_cost_invoice:'direct_sva',
  bank_fee:'direct_sva'
});
const invalid=c=>{const e=new Error(c);e.code=c;e.status=422;throw e;};
const num=(v,field,nonzero=false)=>{if(!Number.isSafeInteger(v)||v<0||v>1_000_000_000_000||(nonzero&&v===0))invalid('FIN_INVALID_'+field);return v;};
const sum=(...xs)=>{const n=xs.reduce((a,b)=>a+b,0);if(!Number.isSafeInteger(n)||n>1_000_000_000_000)invalid('FIN_AMOUNT_OVERFLOW');return n;};
const ref=x=>typeof x==='string'&&/^[A-Za-z0-9_.:/-]{8,180}$/.test(x);
const journalLine=(account,debit_minor,credit_minor)=>{
 if(!/^[0-9]{6}$/.test(String(account||''))||
    (debit_minor>0)===(credit_minor>0))invalid('FIN_JOURNAL_LINE_INVALID');
 return Object.freeze({account_code:account,debit_minor,credit_minor});
};
const requiredAccount=(chart,key)=>{const acc=chart?.[key];if(!/^[0-9]{6}$/.test(String(acc||'')))invalid('FIN_MAPPING_MISSING_'+key.toUpperCase());return acc;};
const cash=(chart)=>requiredAccount(chart,'bank');
const receivable=chart=>requiredAccount(chart,'receivable');
const revenue=chart=>requiredAccount(chart,'revenue');
const vatAcc=chart=>requiredAccount(chart,'vat_output');
function line(chart,key,debit,credit){return journalLine(requiredAccount(chart,key),debit,credit);}
/** Provide one journal for one independently identified fact, never a tax conclusion. */
export function prepareFinancialJournalDraft(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))invalid('FIN_INPUT_INVALID');
 const event=String(input.event||'');
 if(!Object.hasOwn(EVENTS,event)||input.business_unit!==EVENTS[event])invalid('FIN_BUSINESS_UNIT_EVENT_MISMATCH');
 if(input.currency!=='EUR'||!ref(input.source_reference)||!ref(input.evidence_reference))invalid('FIN_CURRENCY_OR_EVIDENCE_INVALID');
 const chart=input.chart||{};let lines=[];
 if(['subscription_invoice','subscription_credit_note'].includes(event)){
  const gross=num(input.gross_minor,'GROSS',true),vat=num(input.vat_minor,'VAT');
  if(vat>=gross)invalid('FIN_VAT_GROSS_MISMATCH');
  const net=gross-vat;
  if(event==='subscription_invoice'){
   lines=[journalLine(receivable(chart),gross,0),journalLine(revenue(chart),0,net),
    ...(vat?[journalLine(vatAcc(chart),0,vat)]:[])];
  }else{
   lines=[journalLine(revenue(chart),net,0),...(vat?[journalLine(vatAcc(chart),vat,0)]:[]),
    journalLine(receivable(chart),0,gross)];
  }
 }else if(event==='subscription_receipt'||event==='subscription_refund'){
  const amount=num(input.amount_minor,'AMOUNT',true);
  lines=event==='subscription_receipt'?
   [journalLine(cash(chart),amount,0),journalLine(receivable(chart),0,amount)]:
   [journalLine(receivable(chart),amount,0),journalLine(cash(chart),0,amount)];
 }else if(event==='carrier_collection_agent'){
  if(input.contract_model!=='agent_expert_approved'||!ref(input.accounting_policy_reference))
   invalid('FIN_AGENT_MODEL_REQUIRES_EXPERT_POLICY');
  const received=num(input.received_minor,'RECEIVED',true),due=num(input.publisher_due_minor,'PUBLISHER_DUE');
  const fee=num(input.commission_net_minor,'COMMISSION_NET'),vat=num(input.commission_vat_minor,'COMMISSION_VAT');
  if(sum(due,fee,vat)!==received)invalid('FIN_OPERATOR_SETTLEMENT_UNBALANCED');
  lines=[journalLine(cash(chart),received,0),
    ...(due?[line(chart,'publisher_liability',0,due)]:[]),
    ...(fee?[journalLine(revenue(chart),0,fee)]:[]),
    ...(vat?[journalLine(vatAcc(chart),0,vat)]:[])];
 }else if(event==='publisher_payout'){
  const amount=num(input.amount_minor,'PAYOUT',true);
  const due=num(input.reconciled_publisher_due_minor,'DUE'),holds=num(input.holds_minor,'HOLDS');
  const alreadyPaid=num(input.already_paid_minor,'ALREADY_PAID');
  if(sum(holds,alreadyPaid,amount)>due)invalid('FIN_PAYOUT_EXCEEDS_VERIFIED_LIABILITY');
  lines=[line(chart,'publisher_liability',amount,0),journalLine(cash(chart),0,amount)];
 }else if(event==='operator_cost_invoice'){
  const gross=num(input.gross_minor,'COST_GROSS',true),vat=num(input.vat_minor,'COST_VAT');
  if(vat>=gross)invalid('FIN_COST_VAT_GROSS_MISMATCH');
  lines=[line(chart,'technical_expense',gross-vat,0),
    ...(vat?[line(chart,'vat_input',vat,0)]:[]),line(chart,'supplier_liability',0,gross)];
 }else if(event==='bank_fee'){
  const amount=num(input.amount_minor,'BANK_FEE',true);
  lines=[line(chart,'bank_fee_expense',amount,0),journalLine(cash(chart),0,amount)];
 }
 if(lines.length<2||lines.some(l=>l.debit_minor===0&&l.credit_minor===0))invalid('FIN_JOURNAL_ZERO_LINE');
 if(new Set(lines.map(l=>l.account_code)).size!==lines.length)invalid('FIN_JOURNAL_DUPLICATE_ACCOUNT');
 const debit=sum(...lines.map(l=>l.debit_minor)),credit=sum(...lines.map(l=>l.credit_minor));
 if(debit!==credit)invalid('FIN_JOURNAL_UNBALANCED');
 const fingerprint=createHash('sha256').update(JSON.stringify({event,unit:input.business_unit,source:input.source_reference,
  evidence:input.evidence_reference,lines})).digest('hex');
 return Object.freeze({schema_version:FINANCIAL_DRAFT_SCHEMA,business_unit:input.business_unit,
  event,source_reference:input.source_reference,evidence_reference:input.evidence_reference,
  currency:'EUR',fingerprint,lines:Object.freeze(lines),debit_minor:debit,credit_minor:credit,
  reconciled_with_authoritative_sources:false,
  statutory_posting_authorized:false,payout_execution_authorized:false,
  tax_treatment_requires_professional_validation:true,
  accounting_document_type:'draft_for_expert_review'});
}

function uniqueRows(rows,label){
 if(!Array.isArray(rows)||rows.length>10000)invalid('FIN_'+label+'_INVALID');
 const seen=new Set();return rows.map(r=>{
  if(!r||!ref(r.reference)||seen.has(r.reference))invalid('FIN_'+label+'_DUPLICATE_OR_MISSING_REF');
  seen.add(r.reference);
  return {reference:r.reference,amount_minor:num(r.amount_minor,label+'_AMOUNT',true),
   authoritative_verified:r.authoritative_verified===true};
 });
}
/** Compare statements, actual bank receipts and proposed publisher amounts. */
export function reconcileFinancialPeriod(input={}){
 if(input.business_unit!=='direct_sva'||!ref(input.period_reference)||input.currency!=='EUR')
  invalid('FIN_RECONCILIATION_SCOPE_INVALID');
 const statements=uniqueRows(input.operator_statements||[],'STATEMENT');
 const receipts=uniqueRows(input.bank_receipts||[],'RECEIPT');
 const holds=uniqueRows(input.dispute_holds||[],'HOLD');
 const publisher=uniqueRows(input.publisher_liabilities||[],'LIABILITY');
 const paid=uniqueRows(input.payouts||[],'PAYOUT');
 const total=r=>sum(...r.map(x=>x.amount_minor));
 const operatorReported=total(statements),bankReceived=total(receipts),publisherDue=total(publisher),onHold=total(holds),alreadyPaid=total(paid);
 const sourcesVerified=[...statements,...receipts,...holds,...publisher,...paid].every(x=>x.authoritative_verified);
 const unexplained=operatorReported-bankReceived;
 const remaining=publisherDue-onHold-alreadyPaid;
 const flags=[
  ...(statements.length===0?['MISSING_OPERATOR_STATEMENT']:[]),
  ...(receipts.length===0?['MISSING_BANK_RECEIPT']:[]),
  ...(unexplained!==0?['OPERATOR_BANK_DIFFERENCE']:[]),
  ...(remaining<0?['PAYOUT_OR_HOLD_EXCEEDS_LIABILITY']:[]),
  ...(publisherDue>operatorReported?['PUBLISHER_LIABILITY_EXCEEDS_OPERATOR_STATEMENT']:[]),
  ...(!sourcesVerified?['UNVERIFIED_SOURCE_EVIDENCE']:[]),
  'REGULATED_PAYOUT_EXECUTION_NOT_CONNECTED'
 ];
 return Object.freeze({schema_version:'audiotel-sva-reconciliation/1',
  business_unit:'direct_sva',period_reference:input.period_reference,
  currency:'EUR',operator_reported_minor:operatorReported,bank_received_minor:bankReceived,
  publisher_due_minor:publisherDue,held_minor:onHold,already_paid_minor:alreadyPaid,
  bank_difference_minor:unexplained,remaining_to_review_minor:remaining,
  reconciliation_unexplained_difference:unexplained!==0,
  accounting_entries_posted:false,payouts_executable:false,flags:Object.freeze(flags)});
}
