import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {Readable} from "node:stream";
import {calculateApplicationFee,normalizeStripeConnectPaymentEvent,retrieveStripeCardCheckout} from "../backend/src/stripe-connect.mjs";
import {verifyStripeWebhook,normalizeStripePortabilityPriorityEvent} from "../backend/src/stripe-billing.mjs";
import {PostgresStore} from "../backend/src/store-postgres.mjs";

const tenant="11111111-1111-4111-8111-111111111111";
const account="acct_Merchant";
const session="cs_test_Example";

test("reject fractional, negative and ambiguous minor-unit amounts and fees",()=>{
  for(const amount of [100.1,-100,NaN,Infinity,true,[],{}, "1e4","100.5"," 100"]){
    assert.throws(()=>calculateApplicationFee(amount),{code:"INVALID_CARD_PAYMENT_AMOUNT"});
  }
  for(const fee of [490.1,-1,3001,NaN,true,"4e2"]){
    assert.throws(()=>calculateApplicationFee(10000,fee),{code:"INVALID_APPLICATION_FEE_CONFIGURATION"});
  }
  assert.equal(calculateApplicationFee(10000,490),490);
  assert.equal(calculateApplicationFee(10000,0),0);
});

test("Connect evidence uses provider monetary fields, not metadata",async()=>{
  const base={id:"evt_Paid",account,type:"checkout.session.completed",data:{object:{
    id:session,payment_status:"paid",metadata:{pgi_card_payment_request:tenant,amount_minor:"1",currency:"usd"}
  }}};
  const missing=await normalizeStripeConnectPaymentEvent({},base);
  assert.equal(missing.verified_amount_minor,null);
  assert.equal(missing.verified_currency,null);
  const proven=await normalizeStripeConnectPaymentEvent({},{
    ...base,data:{object:{...base.data.object,amount_total:10000,currency:"eur"}}
  });
  assert.equal(proven.verified_amount_minor,10000);
  assert.equal(proven.verified_currency,"EUR");
  const intent=await normalizeStripeConnectPaymentEvent({},{
    id:"evt_Intent",type:"payment_intent.succeeded",account,data:{object:{
      id:"pi_Example",amount:10000,amount_received:9900,currency:"eur",metadata:{pgi_card_payment_request:tenant}
    }}
  });
  assert.equal(intent.verified_amount_minor,9900);
});

test("reconciliation rejects a mismatched Stripe session and carries real amount",async()=>{
  const previous=globalThis.fetch;
  try{
    globalThis.fetch=async()=>({ok:true,json:async()=>({id:"cs_test_Wrong"})});
    const config={stripeSecretKey:"sk_test_"+"X".repeat(32)};
    await assert.rejects(retrieveStripeCardCheckout(config,account,session),{code:"STRIPE_CHECKOUT_SESSION_MISMATCH"});
    globalThis.fetch=async()=>({ok:true,json:async()=>({id:session,payment_status:"paid",amount_total:10000,currency:"eur"})});
    const result=await retrieveStripeCardCheckout(config,account,session);
    assert.equal(result.verified_amount_minor,10000);
    assert.equal(result.verified_currency,"EUR");
  }finally{globalThis.fetch=previous;}
});

test("production accepts only signed events in the configured Stripe mode",async()=>{
  const secret="fixture-webhook-secret",time=Math.floor(Date.now()/1000);
  const config={mode:"production",stripeLiveMode:true,stripeWebhookSecret:secret};
  function request(livemode){
    const raw=Buffer.from(JSON.stringify({id:"evt_ModeCheck",livemode,type:"invoice.paid"}));
    const signature=createHmac("sha256",secret).update(String(time)+".").update(raw).digest("hex");
    return Object.assign(Readable.from([raw]),{headers:{"stripe-signature":"t="+time+",v1="+signature}});
  }
  await assert.rejects(verifyStripeWebhook(request(false),config),{code:"STRIPE_EVENT_MODE_MISMATCH"});
  await assert.rejects(verifyStripeWebhook(request(undefined),config),{code:"STRIPE_EVENT_MODE_MISMATCH"});
  assert.equal((await verifyStripeWebhook(request(true),config)).livemode,true);
});

test("priority portability cannot treat a free or unpaid checkout as paid",()=>{
  const base={id:"evt_Priority",type:"checkout.session.completed",data:{object:{
    id:session,payment_status:"no_payment_required",amount_total:0,
    metadata:{service_type:"portability_priority",tenant_public_id:tenant,portability_request_id:"1",currency:"EUR"}
  }}};
  assert.equal(normalizeStripePortabilityPriorityEvent(base).status,"pending");
  assert.equal(normalizeStripePortabilityPriorityEvent(base).currency,null);
  const paid={...base,data:{object:{...base.data.object,payment_status:"paid",amount_total:990,currency:"eur"}}};
  assert.equal(normalizeStripePortabilityPriorityEvent(paid).amount_minor,990);
  assert.equal(normalizeStripePortabilityPriorityEvent(paid).status,"paid");
});

test("payment journal updates are scoped to merchant, compatible stored references, amount and currency",async()=>{
  const calls=[];
  const store={sql:{begin:async fn=>fn({unsafe:async(query,params)=>{
    calls.push({query,params});
    return query.startsWith("INSERT")?[{id:1}]:[];
  }})}};
  const event={provider:"stripe",provider_event_id:"evt_Check",event_type:"checkout.session.completed",connected_account_reference:account,
    request_public_id:tenant,status:"paid",provider_checkout_session_reference:session,
    provider_payment_intent_reference:"pi_Example",verified_amount_minor:10000,verified_currency:"EUR"};
  const apply=input=>PostgresStore.prototype.applyCardPaymentProviderEvent.call(store,input);
  await apply({...event,verified_amount_minor:null});
  assert.equal(calls.length,1);
  calls.length=0;
  await apply({...event,connected_account_reference:null});
  assert.equal(calls.length,1);
  calls.length=0;
  await apply(event);
  const update=calls[1];
  assert.ok(update);
  assert.match(update.query,/a\.provider_account_reference=\$1/);
  assert.match(update.query,/r\.public_id=\$\d+::uuid/);
  assert.match(update.query,/r\.provider_checkout_session_reference IS NULL OR r\.provider_checkout_session_reference=\$\d+/);
  assert.match(update.query,/r\.amount_minor=\$\d+::bigint/);
  assert.match(update.query,/r\.currency=\$\d+/);
  assert.match(update.query,/r\.status IN \('created','open','failed','expired','paid'\)/);
  assert.equal(update.params[0],account);
  assert.ok(update.params.includes(10000));
  assert.ok(update.params.includes("EUR"));
});
