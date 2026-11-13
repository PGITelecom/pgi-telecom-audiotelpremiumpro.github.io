/**
 * Preview-only, strictly read-only integration with the existing admin and
 * customer portals. This file reads drafts stored in un-applied migration 092.
 * No customer amounts are called income, received or payable.
 */
import {
 AUDIOTEL_FINANCIAL_PROVIDER_PORTS,AUDIOTEL_RECONCILIATION_REQUIREMENTS
} from "./audiotel-financial-cycle-prelaunch.mjs";

const fail=(code,status=403)=>{throw Object.assign(new Error(code),{code,status});};
function storeRead(store){
 if(typeof store?.readSql?.unsafe!=="function")
   fail("APP_FINANCIAL_READONLY_DATABASE_REQUIRED",503);
 return store.readSql.unsafe.bind(store.readSql);
}
function requireBusiness(context){
 if(context?.business_unit!=="audiotel_platform"||context?.authenticated!==true)
   fail("APP_FINANCIAL_SCOPE_DENIED");
}
export async function readAudiotelFinanceStaffPreview(store,context={}){
 requireBusiness(context);
 if(context.role!=="administrator"||context.staff_finance_read_authorized!==true)
   fail("APP_FINANCIAL_STAFF_PERMISSION_DENIED");
 const sql=storeRead(store);
 const result=await sql(
  "SELECT (SELECT count(*)::int FROM app_fin_operator_statement_drafts) AS statement_drafts,"+
  " (SELECT count(*)::int FROM app_fin_contract_terms_drafts) AS contract_drafts,"+
  " (SELECT count(*)::int FROM app_fin_payout_instruction_drafts) AS payout_instruction_drafts,"+
  " (SELECT count(*)::int FROM app_fin_reconciliation_drafts) AS reconciliation_drafts");
 const row=result[0]||{};
 return Object.freeze({
  business_unit:"audiotel_platform",status:"prelaunch_unverified",
  statement_drafts:Number(row.statement_drafts||0),
  contract_drafts:Number(row.contract_drafts||0),
  payout_instruction_drafts:Number(row.payout_instruction_drafts||0),
  reconciliation_drafts:Number(row.reconciliation_drafts||0),
  available_provider_ports:AUDIOTEL_FINANCIAL_PROVIDER_PORTS.map(x=>x.key),
  required_independent_evidence:AUDIOTEL_RECONCILIATION_REQUIREMENTS,
  partner_operator_connected:false,bank_api_connected:false,
  revolut_business_connected:false,stripe_connect_publisher_payout_enabled:false,
  tax_status_validated:false,financial_settlements_approved:false,
  payable_minor:null,statutory_revenue_minor:null,
  can_execute_payout:false,can_create_number:false
 });
}

export async function readAudiotelFinanceCustomerPreview(store,context={}){
 requireBusiness(context);
 if(!Number.isSafeInteger(context.tenant_id)||context.tenant_id<=0||
   context.customer_finance_read_authorized!==true||
   context.tenant_membership_verified!==true)
   fail("APP_FINANCIAL_TENANT_DENIED");
 const sql=storeRead(store);
 const result=await sql(
  "SELECT count(*)::int AS preliminary_cdr_rows FROM app_fin_call_allocation_drafts"+
  " WHERE business_unit='audiotel_platform' AND tenant_id=$1",
  [context.tenant_id]);
 return Object.freeze({
  business_unit:"audiotel_platform",status:"financial_service_not_active",
  unverified_draft_call_count:Number(result[0]?.preliminary_cdr_rows||0),
  // Intentionally no unconfirmed financial amounts shown to customers.
  confirmed_minutes:null,verified_earnings_minor:null,
  payable_minor:null,already_paid_minor:null,currency:"EUR",
  operator_statement_confirmed:false,
  beneficiary_payment_verified:false,provider_connected:false,
  no_live_transfer:true
 });
}
