import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareAudiotelNumberOrder} from '../backend/src/audiotel-platform-intake.mjs';

const context={authenticated:true,tenant_membership_verified:true,business_unit:'audiotel_platform',tenant_id:77,number_order_creation_authorized:true,server_price_version_id:8};
const request={request_key:'req_20261106_cust77',request_kind:'new_number',category:'089'};
function database(){
 const statements=[];let next=0;const found=new Map();
 const tx={unsafe:async(sql,params=[])=>{
  statements.push({sql,params});
  if(sql.startsWith('SELECT pg_advisory'))return [];
  if(sql.startsWith('SELECT id,request_fingerprint'))return found.has(params[0]+':'+params[1])?[found.get(params[0]+':'+params[1])]:[];
  if(sql.startsWith('INSERT INTO app_number_order_intents')){
   const row={id:++next,request_fingerprint:params[2],stage:'pending_evidence'};
   found.set(params[0]+':'+params[1],row);return [row];
  }
  if(sql.startsWith('INSERT INTO app_number_order_audit'))return [];
  throw Error('Unexpected SQL '+sql);
 }};
 return {store:{sql:{begin:async fn=>fn(tx)}},statements,found};
}
test('new order is recorded once and cannot provision or bill',async()=>{
 const db=database();
 const one=await prepareAudiotelNumberOrder(db.store,{context,request});
 const two=await prepareAudiotelNumberOrder(db.store,{context,request});
 assert.equal(one.created,true);assert.equal(two.created,false);
 assert.equal(one.order_id,two.order_id);assert.equal(one.number,null);
 assert.equal(db.statements.filter(x=>x.sql.startsWith('INSERT INTO app_number_order_intents')).length,1);
 assert.equal(db.statements.some(x=>/Stripe|provision|activate|payout/i.test(x.sql)),false);
});
test('replayed requests preserve recorded on-hold state',async()=>{
 const db=database();
 await prepareAudiotelNumberOrder(db.store,{context,request});
 db.found.get('77:'+request.request_key).stage='on_hold';
 const replay=await prepareAudiotelNumberOrder(db.store,{context,request});
 assert.equal(replay.created,false);assert.equal(replay.status,'on_hold');
});
test('reusing idempotency key for a different category is blocked',async()=>{
 const db=database();await prepareAudiotelNumberOrder(db.store,{context,request});
 await assert.rejects(()=>prepareAudiotelNumberOrder(db.store,{context,request:{...request,category:'082'}}),/APP_IDEMPOTENCY_KEY_REUSED/);
});
test('browser supplied tenant and unauthorised request are rejected',async()=>{
 const db=database();
 await assert.rejects(()=>prepareAudiotelNumberOrder(db.store,{context,request:{...request,tenant_id:90}}),/APP_UNTRUSTED_TENANT_OR_UNIT/);
 await assert.rejects(()=>prepareAudiotelNumberOrder(db.store,{context:{...context,number_order_creation_authorized:false},request}),/APP_CUSTOMER_AUTHORIZATION_REQUIRED/);
});
