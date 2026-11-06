/**
 * Synchronize SVA dossier subscription proof using the existing signed Stripe
 * webhook journal. Does not initiate payment, subscription, number or payout.
 * The original Stripe subscription remains the single billing source of truth.
 */
import {createHash} from 'node:crypto';
function problem(code,status=400){const e=new Error(code);e.code=code;e.status=status;throw e;}
function validLimit(value){const n=Number(value);if(!Number.isInteger(n)||n<1||n>100)problem('DIRECT_SVA_BILLING_BATCH_INVALID');return n;}
export function validateVerifiedSubscriptionProof(row){
 if(!row||row.subscription_status!=='active'||row.billing_provider!=='stripe'||
    !/^sub_[A-Za-z0-9]+$/.test(String(row.provider_subscription_reference||''))||
    !/^(evt_)[A-Za-z0-9]+$/.test(String(row.provider_event_id||''))||
    !['customer.subscription.created','customer.subscription.updated','invoice.paid'].includes(String(row.event_type||''))||
    !/^[0-9a-f]{64}$/.test(String(row.payload_sha256||''))||
    !row.event_time||!row.last_event_at)return null;
 const deadline=row.current_period_end?new Date(row.current_period_end).getTime():NaN;
 if(!Number.isFinite(deadline)||deadline<=Date.now())return null;
 return Object.freeze({
  case_id:Number(row.case_id),
  evidence_reference:'stripe-confirmed:'+String(row.provider_event_id).slice(0,100),
  event_id:String(row.provider_event_id),
  digest:createHash('sha256').update('audiotel-sva-webhook-evidence:'+row.provider_event_id).digest('hex')
 });
}
export async function reconcileSvaSubscriptionEvidence(store,{limit=30}={}){
 const max=validLimit(limit),sql=store?.sql;
 if(typeof sql?.unsafe!=='function'||typeof sql?.begin!=='function')problem('DIRECT_SVA_POSTGRES_REQUIRED',503);
 // Only preparatory dossiers whose gate is pending. Rejected/expired gates
 // always require a separate compliance review.
 const rows=await sql.unsafe(
  "SELECT c.id AS case_id,t.status AS subscription_status,t.billing_provider,"+
  " t.provider_subscription_reference,t.last_event_at,t.current_period_end,"+
  " e.provider_event_id,e.event_type,e.event_time,e.payload_sha256"+
  " FROM direct_sva_customer_cases c"+
  " JOIN direct_sva_case_gate_status g ON g.case_id=c.id"+
  " AND g.gate_key='subscription_confirmed' AND g.state='pending'"+
  " JOIN tenant_subscriptions t ON t.tenant_id=c.tenant_id AND t.status='active'"+
  " AND t.billing_provider='stripe' AND t.provider_subscription_reference IS NOT NULL"+
  " JOIN LATERAL (SELECT e.provider_event_id,e.event_type,e.event_time,e.payload_sha256"+
  " FROM subscription_billing_events e WHERE e.subscription_id=t.id"+
  " AND e.tenant_id=c.tenant_id AND e.provider='stripe'"+
  " AND e.event_type IN ('customer.subscription.created','customer.subscription.updated','invoice.paid')"+
  " ORDER BY e.event_time DESC,e.id DESC LIMIT 1) e ON TRUE"+
  " ORDER BY c.id ASC LIMIT $1",[max]);
 let changed=0,skipped=0;
 for(const row of rows){
  const verified=validateVerifiedSubscriptionProof(row);
  if(!verified||!Number.isSafeInteger(verified.case_id)||verified.case_id<1){skipped++;continue;}
  const updated=await sql.begin(async tx=>{
   const gated=(await tx.unsafe(
    "SELECT state FROM direct_sva_case_gate_status"+
    " WHERE case_id=$1 AND gate_key='subscription_confirmed' FOR UPDATE",[verified.case_id]))[0];
   if(gated?.state!=='pending')return false;
   // Recheck the subscription is still active under the same tenant while locked.
   const stillValid=(await tx.unsafe(
    "SELECT 1 FROM tenant_subscriptions t JOIN direct_sva_customer_cases c ON c.tenant_id=t.tenant_id"+
    " WHERE c.id=$1 AND t.status='active' AND t.billing_provider='stripe'"+
    " AND t.provider_subscription_reference=$2"+
    " AND (t.current_period_end IS NULL OR t.current_period_end>now()) LIMIT 1",
    [verified.case_id,row.provider_subscription_reference]))[0];
   if(!stillValid)return false;
   await tx.unsafe(
    "UPDATE direct_sva_case_gate_status SET state='verified',issuer='billing_reconciliation',"+
    " evidence_reference=$2,evidence_checked_at=now(),updated_at=now()"+
    " WHERE case_id=$1 AND gate_key='subscription_confirmed' AND state='pending'",
    [verified.case_id,verified.evidence_reference]);
   await tx.unsafe(
    "INSERT INTO direct_sva_case_gate_events"+
    " (case_id,gate_key,state,issuer,evidence_reference,actor_hash)"+
    " VALUES($1,'subscription_confirmed','verified','billing_reconciliation',$2,$3)",
    [verified.case_id,verified.evidence_reference,verified.digest]);
   return true;
  });
  if(updated)changed++;else skipped++;
 }
 return Object.freeze({scanned:rows.length,verified_from_stripe_journal:changed,skipped,
  number_activation:false,payouts:false});
}
