/** Durable APP intake only; intentionally not attached to a public endpoint.
 * The backend must supply the authenticated tenant and plan version, not the browser.
 */
import {createHash} from 'node:crypto';
import {audiotelOrderFingerprint} from './audiotel-platform-order.mjs';
const err=(code,status=409)=>{throw Object.assign(new Error(code),{code,status});};
const id=x=>Number.isSafeInteger(Number(x))&&Number(x)>0&&String(Number(x))===String(x);
export async function prepareAudiotelNumberOrder(store,{context,request}={}){
 const sql=store?.sql;
 if(!sql||typeof sql.begin!=='function')err('APP_POSTGRES_TRANSACTION_REQUIRED',503);
 if(!context||context.authenticated!==true||context.tenant_membership_verified!==true||
    context.business_unit!=='audiotel_platform'||!id(context.tenant_id)||
    context.number_order_creation_authorized!==true)
  err('APP_CUSTOMER_AUTHORIZATION_REQUIRED',403);
 // Price version has already been selected by the trusted server-side plan catalog.
 if(!request||request.tenant_id!==undefined||request.business_unit!==undefined)
  err('APP_UNTRUSTED_TENANT_OR_UNIT',400);
 const normalized={tenant_id:Number(context.tenant_id),request_key:request.request_key,
  request_kind:request.request_kind,category:request.category,price_version_id:context.server_price_version_id};
 const fingerprint=audiotelOrderFingerprint(normalized);
 return sql.begin(async tx=>{
  // Tenant ID forms part of both idempotency lock and uniqueness key.
  await tx.unsafe('SELECT pg_advisory_xact_lock(hashtext($1))',['app_order:'+normalized.tenant_id+':'+normalized.request_key]);
  const found=(await tx.unsafe('SELECT id,request_fingerprint,stage FROM app_number_order_intents'+
    ' WHERE tenant_id=$1 AND request_key=$2 FOR UPDATE',
    [normalized.tenant_id,normalized.request_key]))[0];
  if(found){
   if(found.request_fingerprint!==fingerprint)err('APP_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_ORDER');
   return Object.freeze({order_id:Number(found.id),created:false,status:found.stage||'pending_evidence',number:null});
  }
  const inserted=(await tx.unsafe('INSERT INTO app_number_order_intents'+
   '(tenant_id,request_key,request_fingerprint,request_kind,preferred_category,price_version_id)'+
   ' VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
   [normalized.tenant_id,normalized.request_key,fingerprint,normalized.request_kind,
    normalized.category,normalized.price_version_id]))[0];
  if(!id(inserted?.id))err('APP_ORDER_DATABASE_INSERT_FAILED',503);
  const order_id=Number(inserted.id);
  await tx.unsafe("INSERT INTO app_number_order_audit(order_id,event_type,source_reference,actor_hash)"+
   " VALUES($1,'request_prepared',$2,$3)",
   [order_id,'request:'+fingerprint.slice(0,32),createHash('sha256').update('app-tenant:'+normalized.tenant_id).digest('hex')]);
  return Object.freeze({order_id,created:true,status:'pending_evidence',number:null});
 });
}
