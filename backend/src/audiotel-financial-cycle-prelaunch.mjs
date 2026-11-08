/**
 * Audiotel Premium Pro only: deterministic EUR-minor financial preparation.
 * Reuses tenant-revenue-finance, audiotel-platform-economics, accounting-expert
 * and the existing Stripe Billing / Stripe Connect implementation.
 *
 * No authoritative external source is attached here. Even a perfectly balanced
 * draft is NOT a verified receivable, client revenue, statement or payout.
 * Never execute transfers, tax declarations, accounting postings or API calls.
 */
import {createHash} from "node:crypto";

const UNIT="audiotel_platform";
const MODELS=new Set(["commission_agent","professional_services","direct_operator"]);
const ROUTES=new Set(["carrier_direct","regulated_psp","stripe_connect","revolut_own_funds"]);
const HOLDS=new Set(["fraud","dispute","chargeback","contract","compliance"]);
const STATES=new Set(["operator_reported","provisional","disputed","rejected"]);
const REF=/^[A-Za-z0-9_.:/-]{8,180}$/;
const SHA=/^[a-f0-9]{64}$/;
const CURRENCIES=new Set(["EUR"]);
const isRecord=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const abort=(code,status=422)=>{throw Object.assign(new Error("APP_CYCLE_"+code),{code:"APP_CYCLE_"+code,status});};
function shape(x,keys,label){
 if(!isRecord(x)||Object.keys(x).some(k=>!keys.includes(k)))abort("INVALID_"+label);
 return x;
}
function ref(x,label){if(typeof x!=="string"||!REF.test(x))abort("INVALID_"+label);return x;}
function cents(x,label){if(!Number.isSafeInteger(x)||x<0||x>1000000000000)abort("INVALID_"+label);return x;}
function count(x,label){if(!Number.isSafeInteger(x)||x<0||x>1000000000)abort("INVALID_"+label);return x;}
function bps(x,label){if(!Number.isSafeInteger(x)||x<0||x>10000)abort("INVALID_"+label);return x;}
function checkedSum(a,b){const s=a+b;if(!Number.isSafeInteger(s)||s>1000000000000)abort("AMOUNT_OVERFLOW");return s;}
function mulDivRound(n,m,d){
 const result=(BigInt(n)*BigInt(m)+BigInt(d)/2n)/BigInt(d);
 if(result>1000000000000n)abort("AMOUNT_OVERFLOW");
 return Number(result);
}
const digest=data=>createHash("sha256").update(JSON.stringify(data)).digest("hex");

export const AUDIOTEL_FINANCIAL_PROVIDER_PORTS=Object.freeze([
 Object.freeze({key:"carrier_direct",role:"carrier_settles_publisher_and_audiotel",api:"carrier_contract_specific"}),
 Object.freeze({key:"regulated_psp",role:"third_party_payout_under_approved_mandate",api:"psp_contract_specific"}),
 Object.freeze({key:"stripe_connect",role:"separate_provider_connect_subject_to_approval",api:"existing_stripe_connect"}),
 Object.freeze({key:"revolut_own_funds",role:"business_own_funds_transfers_only",api:"revolut_business"})
]);
export const AUDIOTEL_RECONCILIATION_REQUIREMENTS=Object.freeze([
 "carrier_statement_authenticated","cdr_source_authenticated",
 "published_contract_version_verified","tariff_and_mgit_verified",
 "publisher_kyb_verified","service_and_number_ownership_verified",
 "bank_or_partner_settlement_confirmed","holds_and_adjustments_reviewed",
 "funds_and_payment_services_legal_model_approved",
 "statutory_and_tax_policy_approved","independent_payout_release"
]);

/** A source payload from a form or CSV never proves the operator signature. */
export function planAudiotelFinancialCycle(input={}){
 shape(input,["business_unit","currency","period_reference","contract_model","settlement_route",
  "statement","contracts","holds","bank_receipt_minor","minimum_margin_minor_per_min"],
 "INPUT");
 if(input.business_unit!==UNIT||!CURRENCIES.has(input.currency))abort("SCOPE_INVALID");
 const period=ref(input.period_reference,"PERIOD");
 if(!MODELS.has(input.contract_model))abort("MODEL_INVALID");
 if(!ROUTES.has(input.settlement_route))abort("SETTLEMENT_ROUTE_INVALID");
 const statement=shape(input.statement,
  ["operator_reference","statement_reference","document_sha256","rows","declared_total_minor"],
  "STATEMENT");
 ref(statement.operator_reference,"OPERATOR");
 ref(statement.statement_reference,"STATEMENT_REFERENCE");
 if(typeof statement.document_sha256!=="string"||
    !SHA.test(statement.document_sha256))abort("STATEMENT_DIGEST_INVALID");
 if(!Array.isArray(statement.rows)||statement.rows.length===0||statement.rows.length>5000)
   abort("STATEMENT_ROWS_INVALID");
 const declared=cents(statement.declared_total_minor,"DECLARED_OPERATOR_TOTAL");
 if(!Array.isArray(input.contracts)||input.contracts.length===0||
    input.contracts.length>500)abort("CONTRACTS_INVALID");
 const map=new Map();
 const normalizedContracts=input.contracts.map(item=>{
  shape(item,["tenant_reference","contract_reference","version_reference","fee_bps",
    "fee_minor_per_min","fixed_fee_minor_per_call"],"CONTRACT");
  const tenant=ref(item.tenant_reference,"TENANT");
  if(map.has(tenant))abort("DUPLICATE_TENANT_CONTRACT");
  const contract=Object.freeze({tenant_reference:tenant,
   contract_reference:ref(item.contract_reference,"CONTRACT_REFERENCE"),
   version_reference:ref(item.version_reference,"VERSION_REFERENCE"),
   fee_bps:bps(item.fee_bps,"FEE_BPS"),
   fee_minor_per_min:cents(item.fee_minor_per_min,"FEE_PER_MIN"),
   fixed_fee_minor_per_call:cents(item.fixed_fee_minor_per_call??0,"FIXED_FEE")
  });
  map.set(tenant,contract);
  return contract;
 });
 const refs=new Set(),summaries=new Map(),rows=[];
 let reportedGross=0,reportedCarrierFees=0,reportedProcessorFees=0;
 let reportedSeconds=0,unconfirmedGross=0,disputedCount=0;
 for(const item of statement.rows){
  shape(item,["call_reference","tenant_reference","sva_number","eligible_seconds",
    "operator_gross_minor","carrier_fee_minor","processor_fee_minor","state",
    "rate_reference"],"CDR");
  const call=ref(item.call_reference,"CALL");
  const tenant=ref(item.tenant_reference,"TENANT");
  if(refs.has(call))abort("DUPLICATE_CDR");
  refs.add(call);
  const contract=map.get(tenant);
  if(!contract)abort("CDR_CONTRACT_MISSING");
  if(typeof item.sva_number!=="string"||
     !/^\+338(?:1|2|9)[0-9]{7}$/.test(item.sva_number))
    abort("INVALID_FR_SVA_NUMBER");
  const seconds=count(item.eligible_seconds,"ELIGIBLE_SECONDS");
  const gross=cents(item.operator_gross_minor,"OPERATOR_GROSS");
  const carrier=cents(item.carrier_fee_minor,"CARRIER_FEE");
  const processor=cents(item.processor_fee_minor,"PROCESSOR_FEE");
  if(carrier+processor>gross)abort("CDR_FEES_EXCEED_GROSS");
  if(!STATES.has(item.state))abort("CDR_STATE_INVALID");
  ref(item.rate_reference,"RATE");
  if(item.state==="rejected"&&gross!==0)abort("REJECTED_CALL_HAS_REVENUE");
  reportedGross=checkedSum(reportedGross,gross);
  reportedCarrierFees=checkedSum(reportedCarrierFees,carrier);
  reportedProcessorFees=checkedSum(reportedProcessorFees,processor);
  reportedSeconds=checkedSum(reportedSeconds,seconds);
  const net=gross-carrier-processor;
  const fee=Math.min(net,checkedSum(
    checkedSum(mulDivRound(net,contract.fee_bps,10000),
      mulDivRound(seconds,contract.fee_minor_per_min,60)),
    contract.fixed_fee_minor_per_call));
  const due=net-fee;
  const counted=item.state==="operator_reported";
  if(!counted){
   unconfirmedGross=checkedSum(unconfirmedGross,gross);
   if(item.state==="disputed")disputedCount++;
  }
  const entry={call_reference:call,tenant_reference:tenant,
   state:item.state,eligible_seconds:seconds,
   operator_gross_minor:gross,carrier_fee_minor:carrier,
   processor_fee_minor:processor,contract_version_reference:contract.version_reference,
   platform_fee_preview_minor:counted?fee:0,
   publisher_due_preview_minor:counted?due:0,
   withheld_preview_minor:counted?0:due,
   // Never mislabel reported minutes as authenticated/paid.
   operator_confirmed:false,bank_confirmed:false,payout_eligible:false};
  rows.push(Object.freeze(entry));
  const sum=summaries.get(tenant)||{tenant_reference:tenant,
    contract_reference:contract.contract_reference,contract_version_reference:contract.version_reference,
    call_count:0,operator_reported_seconds:0,
    operator_gross_preview_minor:0,carrier_and_processing_cost_preview_minor:0,
    audiotel_fee_preview_minor:0,publisher_due_preview_minor:0,
    excluded_or_disputed_calls:0};
  sum.call_count++;
  if(counted){
    sum.operator_reported_seconds=checkedSum(sum.operator_reported_seconds,seconds);
    sum.operator_gross_preview_minor=checkedSum(sum.operator_gross_preview_minor,gross);
    sum.carrier_and_processing_cost_preview_minor=checkedSum(
      sum.carrier_and_processing_cost_preview_minor,carrier+processor);
    sum.audiotel_fee_preview_minor=checkedSum(sum.audiotel_fee_preview_minor,fee);
    sum.publisher_due_preview_minor=checkedSum(sum.publisher_due_preview_minor,due);
  }else sum.excluded_or_disputed_calls++;
  summaries.set(tenant,sum);
 }
 if(reportedGross!==declared)abort("STATEMENT_TOTAL_MISMATCH");
 const holdRows=Array.isArray(input.holds)?input.holds:[];
 if(holdRows.length>500)abort("HOLDS_INVALID");
 const holdRefs=new Set();
 const holdsByTenant=new Map();
 for(const hold of holdRows){
  shape(hold,["hold_reference","tenant_reference","kind","amount_minor"],"HOLD");
  const k=ref(hold.hold_reference,"HOLD_REFERENCE");
  const t=ref(hold.tenant_reference,"HOLD_TENANT");
  if(holdRefs.has(k))abort("DUPLICATE_HOLD");
  holdRefs.add(k);
  if(!HOLDS.has(hold.kind)||!summaries.has(t))abort("INVALID_HOLD");
  holdsByTenant.set(t,checkedSum(holdsByTenant.get(t)||0,
    cents(hold.amount_minor,"HOLD_AMOUNT")));
 }
 const minimumMargin=cents(input.minimum_margin_minor_per_min??7,"MINIMUM_MARGIN");
 const publishers=[...summaries.values()].sort((a,b)=>
   a.tenant_reference.localeCompare(b.tenant_reference)).map(row=>{
    const held=holdsByTenant.get(row.tenant_reference)||0;
    if(held>row.publisher_due_preview_minor)abort("HOLDS_EXCEED_PUBLISHER_DUE");
    const due=row.publisher_due_preview_minor-held;
    const pkey=digest([UNIT,period,statement.statement_reference,
      row.tenant_reference,row.contract_version_reference]);
    return Object.freeze({...row,
     held_preview_minor:held,after_holds_preview_minor:due,
     payout_draft_reference:"APP-PAYOUT-"+pkey.slice(0,32),
     confirmed_payout_minor:0,already_paid_minor:0,bank_received_minor:0,
     payment_instruction_status:"blocked",publisher_kyb_verified:false,
     can_dispatch_payment:false
    });
   });
 const bankReported=input.bank_receipt_minor==null?null:
   cents(input.bank_receipt_minor,"BANK_RECEIPT");
 const totalDue=publishers.reduce((n,p)=>checkedSum(n,p.publisher_due_preview_minor),0);
 const totalFee=publishers.reduce((n,p)=>checkedSum(n,p.audiotel_fee_preview_minor),0);
 const totalHeld=publishers.reduce((n,p)=>checkedSum(n,p.held_preview_minor),0);
 const totalOperatorReported=publishers.reduce((n,p)=>checkedSum(n,p.operator_gross_preview_minor),0);
 const totalCosts=publishers.reduce((n,p)=>checkedSum(n,p.carrier_and_processing_cost_preview_minor),0);
 if(totalFee+totalDue+totalCosts!==totalOperatorReported)abort("UNBALANCED_REPORTED_ALLOCATION");
 const totalSeconds=publishers.reduce((n,p)=>checkedSum(n,p.operator_reported_seconds),0);
 const lessThanTarget=totalSeconds>0&&totalFee*60<minimumMargin*totalSeconds;
 const mismatches=[];
 if(bankReported!==null&&bankReported!==declared)
   mismatches.push("reported_bank_vs_operator_difference");
 if(unconfirmedGross>0)mismatches.push("unconfirmed_or_disputed_calls_present");
 if(totalHeld>0)mismatches.push("publisher_holds_present");
 if(totalSeconds===0)mismatches.push("no_reported_payout_eligible_seconds");
 if(lessThanTarget)mismatches.push("estimated_margin_below_target");
 const fingerprint=digest({
  business_unit:UNIT,period,contract_model:input.contract_model,
  settlement_route:input.settlement_route,
  operator:statement.operator_reference,statement:statement.statement_reference,
  statement_sha256:statement.document_sha256,
  contracts:normalizedContracts.sort((a,b)=>a.tenant_reference.localeCompare(b.tenant_reference)),
  rows:rows.slice().sort((a,b)=>a.call_reference.localeCompare(b.call_reference)),
  holds:holdRows.slice().sort((a,b)=>a.hold_reference.localeCompare(b.hold_reference))
 });
 return Object.freeze({
  schema_version:"app-financial-cycle-prelaunch/1",business_unit:UNIT,
  currency:"EUR",period_reference:period,
  contract_model:input.contract_model,
  settlement_route:input.settlement_route,
  input_source:"unauthenticated_draft_only",source_digest:fingerprint,
  reported_operator_total_minor:declared,reported_bank_receipt_minor:bankReported,
  reported_seconds:reportedSeconds,
  operator_reported_eligible_seconds_preview:totalSeconds,
  disputed_or_excluded_calls:disputedCount,
  unconfirmed_operator_gross_minor:unconfirmedGross,
  operator_reported_gross_preview_minor:totalOperatorReported,
  carrier_and_processing_cost_preview_minor:totalCosts,
  audiotel_fee_preview_minor:totalFee,
  publisher_due_preview_minor:totalDue,
  publisher_hold_preview_minor:totalHeld,
  publisher_after_hold_preview_minor:totalDue-totalHeld,
  minimum_margin_minor_per_min:minimumMargin,
  potential_mismatches:Object.freeze(mismatches),
  publishers:Object.freeze(publishers),
  call_allocations:Object.freeze(rows),
  required_independent_evidence:AUDIOTEL_RECONCILIATION_REQUIREMENTS,
  // Legal classification depends on contracts, invoicing and tax decisions.
  statutory_revenue_minor:null,vat_minor:null,micro_enterprise_turnover_minor:null,
  legally_excluded_third_party_funds_minor:null,
  carrier_statement_authenticated:false,carrier_cdr_verified:false,
  bank_funds_authenticated:false,contract_legal_model_approved:false,
  client_kyb_verified:false,payment_service_rights_approved:false,
  accounting_posting_authorized:false,
  could_be_paid_directly_by_carrier:false,
  payout_authorized:false,payout_executed:false,
  operator_api_called:false,bank_api_called:false,stripe_api_called:false,
  monetary_transfer_enabled:false,
  next_action:"Authenticate carrier CDR and statements; confirm economic/legal payer model before any external payment"
 });
}

/** Adaptors only describe future responsibility. No external endpoint, no IBAN, no token. */
export function planAudiotelFinancialProviderAdapter(input={}){
 shape(input,["business_unit","provider","settlement_reference",
  "beneficiary_reference","amount_minor","idempotency_reference"],"ADAPTER");
 if(input.business_unit!==UNIT||!ROUTES.has(input.provider))abort("ADAPTER_SCOPE_INVALID");
 const settlement=ref(input.settlement_reference,"SETTLEMENT_REFERENCE");
 const beneficiary=ref(input.beneficiary_reference,"BENEFICIARY_REFERENCE");
 const idempotency=ref(input.idempotency_reference,"IDEMPOTENCY_REFERENCE");
 const amount=cents(input.amount_minor,"PAYOUT_AMOUNT");
 if(amount===0)abort("PAYOUT_ZERO");
 const key=digest([UNIT,input.provider,settlement,beneficiary,amount,idempotency]);
 return Object.freeze({
  business_unit:UNIT,adapter_key:input.provider,
  settlement_reference:settlement,beneficiary_reference:beneficiary,
  amount_minor:amount,currency:"EUR",
  external_reference:"APP-DRYRUN-"+key.slice(0,32),
  idempotency_fingerprint:key,
  dispatch_status:"not_authorized",
  trust_level:"manual_unverified",
  transfers_third_party_funds_authorized:false,
  payout_executed:false,
  provider_account_created:false,
  external_adapter_connected:false,
  provider_request:null,provider_response:null,
  no_bank_coordinates_stored:true,
  can_dispatch:false
 });
}
