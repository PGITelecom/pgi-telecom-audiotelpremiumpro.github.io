// Audiotel Premium Pro (APP): read-only production evidence dashboard.
// This does not authorize order fulfillment, numbering, payment or publication.
// Keep this independent from the future direct_sva business unit.
import {APP_ORDER_STEPS,APP_ORDER_EXECUTION_PLAN} from "./audiotel-platform-order.mjs";
const UNIT="audiotel_platform";
function count(value){
  if(typeof value!=="number"&&typeof value!=="string")throw Error("APP_READINESS_INVALID_COUNT");
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<0)throw Error("APP_READINESS_INVALID_COUNT");
  return n;
}
function report(state,checks=[],counts={}){
  return Object.freeze({
    schema_version:"audiotel-order-assurance/1",
    business_unit:UNIT,source:"read_only_authoritative_database_snapshot",
    observation_status:state,commercial_activation_authorized:false,
    automatic_number_assignment_authorized:false,payments_authorized:false,
    customer_number_delivery_authorized:false,external_legal_review_completed:false,
    external_carrier_acceptance_completed:false,real_payment_verified:false,
    required_order_evidence:Object.freeze(APP_ORDER_STEPS.map(x=>x.key)),
    provisioning_protocol:Object.freeze(APP_ORDER_EXECUTION_PLAN.map(x=>x.key)),
    checks:Object.freeze(checks),counts:Object.freeze(counts)
  });
}
function check(key,observed,detail){
  return Object.freeze({key,status:observed?"observed":"blocked",detail});
}
export function evaluateAudiotelReadiness(observed={}){
  if(!observed||!observed.inventory||!observed.accounting)
    return report("unavailable",[check("database_snapshot",false,"Database snapshot unavailable")]);
  try{
    const i=observed.inventory,a=observed.accounting;
    const numbers=count(i.numbers),carrierConnections=count(i.carrier_connections),
      upstreamAssignments=count(i.upstream_assignments),customerAssignments=count(i.customer_assignments),
      planVersions=count(i.plan_versions),subscriptionEvents=count(i.subscription_events);
    const checks=[
      check("number_stock_recorded",numbers>0,"Number rows are not proof of availability or assigning rights"),
      check("carrier_connection_recorded",carrierConnections>0,"Connection record is not SIP acceptance"),
      check("upstream_number_assignment_recorded",upstreamAssignments>0,"Require independent regulatory operator acknowledgement"),
      check("subscription_price_version",planVersions===1,"Exactly one current APP subscription price required"),
      check("legal_identity",a.legal_identity_configured===true,"Legal SIREN must be configured and verified"),
      check("vat_configuration",a.vat_regime_configured===true&&a.vat_inclusive_known===true,"Tax treatment requires professional approval"),
      check("account_mapping",a.account_map_configured===true,"Chart of accounts needs expert approval"),
      check("fec_export_configuration",a.fec_enabled===true,"Export configuration is not proof of a compliant FEC"),
      check("overdue_payouts_clear",i.has_overdue_payable===false,"An overdue payable requires ledger/bank reconciliation; never automatically mark as paid"),
      check("payout_exceptions_clear",i.has_payout_hold===false,"Disputed or compliance-blocked publisher funds require case-level review"),
      check("payout_proof_complete",i.has_paid_without_proof===false,"A paid status without an authoritative reference must be investigated"),
      check("payout_complaints_clear",i.has_open_payout_complaint===false,"Open payout complaints require staff action and auditable response"),
      check("external_operator_acceptance",false,"Carrier contract, assignment API, SIP/CDR and numbering proof required"),
      check("payment_provider_live",false,"Stripe live connectivity deliberately not verified here"),
      check("statutory_accounting_review",false,"Principal/agent treatment and tax review required")
    ];
    return report(checks.some(c=>c.status!=="observed")?"blocked":"external_review_required",checks,{
      registered_numbers:numbers,ready_or_active_carrier_connection_records:carrierConnections,
      recorded_upstream_assignments:upstreamAssignments,
      customer_number_assignments:customerAssignments,
      current_subscription_price_versions:planVersions,subscription_provider_events:subscriptionEvents,
      overdue_payouts_detected:i.has_overdue_payable===true,
      payout_holds_detected:i.has_payout_hold===true,
      payout_proof_gaps_detected:i.has_paid_without_proof===true,
      open_payout_complaints_detected:i.has_open_payout_complaint===true
    });
  }catch{
    return report("unavailable",[check("database_snapshot",false,"Database values invalid")]);
  }
}
export async function inspectAudiotelReadiness(store){
  if(!store?.readSql?.unsafe)return evaluateAudiotelReadiness();
  try{
    const [inventory,accounting]=await Promise.all([
      store.readSql.unsafe(
        "SELECT (SELECT count(*)::int FROM sva_numbers) AS numbers,"+
        " (SELECT count(*)::int FROM carrier_connections WHERE state IN ('ready','active')) AS carrier_connections,"+
        " (SELECT count(*)::int FROM number_carrier_assignments WHERE assignment_status='active') AS upstream_assignments,"+
        " (SELECT count(*)::int FROM tenant_number_assignments WHERE status='active') AS customer_assignments,"+
        " (SELECT count(*)::int FROM service_plan_price_versions v JOIN service_plans p ON p.id=v.service_plan_id"+
        " WHERE p.plan_key='external-sva-access' AND p.status='active'"+
        " AND v.effective_from<=now() AND (v.effective_to IS NULL OR v.effective_to>now())) AS plan_versions,"+
        " (SELECT count(*)::int FROM subscription_billing_events) AS subscription_events,"+
        " EXISTS (SELECT 1 FROM tenant_revenue_distributions WHERE status='payable' AND payment_due_date<CURRENT_DATE) AS has_overdue_payable,"+
        " EXISTS (SELECT 1 FROM tenant_revenue_distributions WHERE status IN ('disputed','blocked_compliance','blocked_terms')) AS has_payout_hold,"+
        " EXISTS (SELECT 1 FROM tenant_revenue_distributions WHERE status='paid' AND (paid_at IS NULL OR NULLIF(btrim(payment_reference),'') IS NULL)) AS has_paid_without_proof,"+
        " EXISTS (SELECT 1 FROM tenant_service_incidents WHERE category='payout' AND status NOT IN ('resolved','closed')) AS has_open_payout_complaint"
      ),
      store.readSql.unsafe(
        "SELECT (siren ~ '^[0-9]{9}$') AS legal_identity_configured,"+
        " (vat_regime IS NOT NULL AND vat_regime NOT IN ('','unconfigured')) AS vat_regime_configured,"+
        " (prices_include_vat IS NOT NULL) AS vat_inclusive_known,"+
        " (account_map IS NOT NULL AND account_map<>'{}'::jsonb) AS account_map_configured,"+
        " fec_enabled FROM platform_accounting_settings WHERE id=1"
      )
    ]);
    if(inventory.length!==1||accounting.length!==1)return evaluateAudiotelReadiness();
    return evaluateAudiotelReadiness({inventory:inventory[0],accounting:accounting[0]});
  }catch{
    // Fail closed and avoid leaking database internals to a staff-facing API.
    return evaluateAudiotelReadiness();
  }
}