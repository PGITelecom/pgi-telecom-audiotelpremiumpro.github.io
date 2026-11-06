/**
 * APP accounting decision support, never a statutory ledger nor PSP executor.
 * EUR minor units, source references, cash-vs-statement reconciliation,
 * publisher liabilities and configurable margin warning.
 */
import {createHash} from "node:crypto";
const error=code=>{throw Object.assign(new Error(code),{code,status:422});};
const amount=(v,k)=>{if(!Number.isSafeInteger(v)||v<0||v>1e12)error("APP_FIN_INVALID_"+k);return v;};
const reference=s=>typeof s==="string"&&/^[A-Za-z0-9_.:/-]{8,180}$/.test(s);
const sum=(...items)=>{const n=items.reduce((s,v)=>s+v,0);if(!Number.isSafeInteger(n)||n>1e12)error("APP_FIN_OVERFLOW");return n;};
const proof=(v,issuer)=>v?.authoritative_source_verified===true&&v?.issuer===issuer&&reference(v.reference);
export function evaluateAudiotelSettlement(x={}){
 if(x.business_unit!=="audiotel_platform"||x.currency!=="EUR"||!reference(x.period_reference))
   error("APP_FIN_SCOPE_INVALID");
 const names=["operator_statement_minor","bank_received_minor","operator_adjustment_minor",
  "publisher_contract_due_minor","publisher_dispute_holds_minor","already_paid_minor",
  "network_cost_minor","psp_fee_minor","refund_minor","chargeback_minor","other_cost_minor"];
 const v={};for(const k of names)v[k]=amount(x[k]??0,k);
 const seconds=amount(x.billable_seconds??0,"billable_seconds");
 const marginTarget=amount(x.minimum_margin_minor_per_min??7,"margin_target");
 const missing=[];
 if(!proof(x.statement_evidence,"carrier_statement"))missing.push("operator_statement_not_verified");
 if(!proof(x.bank_evidence,"bank_feed"))missing.push("bank_funds_not_verified");
 if(!reference(x.publisher_contract_reference))missing.push("publisher_contract_not_verified");
 if(!["agent","principal"].includes(x.contract_model)||x.accounting_policy_approved!==true)
   missing.push("statutory_model_requires_expert_review");
 const operatorNet=v.operator_statement_minor-v.operator_adjustment_minor;
 if(operatorNet<0||operatorNet!==v.bank_received_minor)missing.push("bank_vs_operator_mismatch");
 if(v.publisher_dispute_holds_minor+v.already_paid_minor>v.publisher_contract_due_minor)
   missing.push("publisher_hold_exceeds_liability");
 const costs=sum(v.network_cost_minor,v.psp_fee_minor,v.refund_minor,v.chargeback_minor,v.other_cost_minor);
 const margin=v.bank_received_minor-v.publisher_contract_due_minor-costs;
 const remainingDue=Math.max(0,v.publisher_contract_due_minor-v.publisher_dispute_holds_minor-v.already_paid_minor);
 const availableCash=v.bank_received_minor-costs-v.already_paid_minor;
 if(availableCash<remainingDue)missing.push("publisher_liability_unfunded");
 if(seconds===0)missing.push("no_verified_billable_usage");
 else if(margin*60<seconds*marginTarget)missing.push("below_minimum_margin");
 if(v.publisher_dispute_holds_minor>0)missing.push("publisher_amount_on_hold");
 if(x.kyb_verified!==true)missing.push("publisher_kyb_pending");
 if(x.third_party_funds_compliance_approved!==true)missing.push("psp_legal_model_pending");
 const hash=createHash("sha256").update(JSON.stringify({unit:"audiotel_platform",period:x.period_reference,v,seconds})).digest("hex");
 return Object.freeze({
  schema_version:"audiotel-settlement-review/1",business_unit:"audiotel_platform",
  currency:"EUR",period_reference:x.period_reference,source_digest:hash,
  observed_operator_minor:v.operator_statement_minor,observed_bank_minor:v.bank_received_minor,
  operator_bank_difference_minor:operatorNet-v.bank_received_minor,
  estimated_margin_before_tax_minor:margin,
  publisher_due_contract_minor:v.publisher_contract_due_minor,
  publisher_due_remaining_minor:remainingDue,
  publisher_hold_minor:v.publisher_dispute_holds_minor,
  billable_seconds:seconds,minimum_margin_minor_per_min:marginTarget,
  statutory_revenue_minor:null,tax_minor:null,
  blocked_reasons:Object.freeze([...new Set(missing)]),
  eligible_for_independent_accounting_review:missing.length===0,
  payout_authorized:false,payout_executed:false,statutory_entry_posted:false
 });
}
export function classifyAudiotelMoneyEvent(e={}){
 const types=Object.freeze({
  stripe:["subscription_invoice","subscription_paid","subscription_failed","subscription_refund","credit_note"],
  carrier:["cdr_accepted","operator_statement","tariff_adjustment"],
  psp:["processor_fee","publisher_payout_confirmation"],
  bank:["operator_receipt","refund_settlement","publisher_payment_debit"]
 });
 if(e.business_unit!=="audiotel_platform"||!reference(e.external_event_id)||
   !types[e.source]?.includes(e.kind))error("APP_FIN_EVENT_SOURCE_INVALID");
 return Object.freeze({
  business_unit:"audiotel_platform",source:e.source,kind:e.kind,
  event_id:e.external_event_id,idempotency_scope:e.source+":"+e.external_event_id,
  verified_external_signature:false,automatic_revenue_recognition:false,
  automatic_payout:false,requires_authoritative_connector:true
 });
}