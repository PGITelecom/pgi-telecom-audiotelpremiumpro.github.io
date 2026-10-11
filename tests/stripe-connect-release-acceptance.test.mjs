import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {
  calculateApplicationFee, createStripeCardCheckout, createStripeConnectOnboardingLink,
  normalizeStripeConnectPaymentEvent, stripeConnectWebhookSecretForPath
} from "../backend/src/stripe-connect.mjs";
import {verifyStripeWebhook} from "../backend/src/stripe-billing.mjs";

const merchant="acct_IntegrationMerchant123";
const request="11111111-1111-4111-8111-111111111111";
const cfg={
  stripeSecretKey:"sk_test_"+"T".repeat(32),stripeApiVersion:"2026-08-26.dahlia",
  publicBaseUrl:"https://audiotel-premium-pro.com",
  stripeWebhookSecret:"whsec_BillingIsolationSecret123",
  stripeConnectWebhookSecret:"whsec_PlatformIsolationSecret123",
  stripeConnectAccountsWebhookSecret:"whsec_ConnectedIsolationSecret123",
  bodyLimitBytes:262144,stripeWebhookToleranceSeconds:300
};
async function mockedStripe(handler,fn){
  const previous=globalThis.fetch;
  globalThis.fetch=async(url,init={})=>{
    assert.equal(new URL(String(url)).hostname,"api.stripe.com");
    return handler(String(url),init);
  };
  try{return await fn();}
  finally{globalThis.fetch=previous;}
}

test("connected-account direct checkout has 4.90 percent fee, metadata and idempotency",async()=>{
  let calls=0;
  await mockedStripe(async(url,init)=>{
    calls++;
    assert.equal(url,"https://api.stripe.com/v1/checkout/sessions");
    assert.equal(init.headers["Stripe-Account"],merchant);
    assert.equal(init.headers["Idempotency-Key"],"payment/"+request);
    const form=new URLSearchParams(init.body);
    assert.equal(form.get("line_items[0][price_data][unit_amount]"),"10000");
    assert.equal(form.get("line_items[0][price_data][currency]"),"eur");
    assert.equal(form.get("payment_intent_data[application_fee_amount]"),"490");
    assert.equal(form.get("payment_intent_data[metadata][pgi_card_payment_request]"),request);
    assert.equal(form.get("metadata[pgi_application_fee_bps]"),"490");
    assert.equal(form.get("client_reference_id"),request);
    assert.equal(form.get("payment_intent_data[metadata][pgi_tenant_public_id]"),"22222222-2222-4222-8222-222222222222");
    return {ok:true,json:async()=>({id:"cs_test_Integration123",url:"https://checkout.stripe.com/c/pay/cs_test_Integration123"})};
  },async()=>{
    const checkout=await createStripeCardCheckout(cfg,{
      connected_account:merchant,amount_minor:10000,currency:"EUR",
      description:"Prestation professionnelle",request_public_id:request,
      tenant_public_id:"22222222-2222-4222-8222-222222222222",
      idempotency_key:"payment/"+request
    });
    assert.equal(checkout.application_fee_minor,490);
    assert.equal(checkout.application_fee_bps,490);
    assert.equal(checkout.provider_checkout_session_reference,"cs_test_Integration123");
  });
  assert.equal(calls,1);
  assert.equal(calculateApplicationFee(10000),490);
  assert.equal(calculateApplicationFee(20000),980);
});

test("invalid payment details are rejected without an external API call",async()=>{
  let calls=0;
  await mockedStripe(async()=>{calls++;throw Error("Unexpected provider call");},async()=>{
    const base={connected_account:merchant,amount_minor:10000,currency:"EUR",description:"Prestation",request_public_id:request};
    await assert.rejects(()=>createStripeCardCheckout(cfg,{...base,connected_account:"cus_not_a_merchant"}),{code:"INVALID_CONNECT_ACCOUNT"});
    await assert.rejects(()=>createStripeCardCheckout(cfg,{...base,amount_minor:99}),{code:"INVALID_CARD_PAYMENT_AMOUNT"});
    await assert.rejects(()=>createStripeCardCheckout(cfg,{...base,amount_minor:100000001}),{code:"INVALID_CARD_PAYMENT_AMOUNT"});
    await assert.rejects(()=>createStripeCardCheckout(cfg,{...base,description:" "}),{code:"INVALID_CARD_PAYMENT_DESCRIPTION"});
  });
  assert.equal(calls,0);
});

test("Stripe-hosted Accounts v2 onboarding returns to the PGI client portal",async()=>{
  let calls=0;
  await mockedStripe(async(url,init)=>{
    calls++;
    assert.equal(url,"https://api.stripe.com/v2/core/account_links");
    assert.equal(init.headers["Stripe-Version"],"2026-08-26.preview");
    assert.equal(init.headers["Idempotency-Key"],"onboard/"+merchant);
    const body=JSON.parse(init.body);
    assert.equal(body.account,merchant);
    assert.equal(body.use_case.type,"account_onboarding");
    assert.equal(body.use_case.account_onboarding.collection_options.fields,"eventually_due");
    assert.equal(body.use_case.account_onboarding.return_url,"https://audiotel-premium-pro.com/client.html?card_connect=return");
    assert.equal(body.use_case.account_onboarding.refresh_url,"https://audiotel-premium-pro.com/client.html?card_connect=refresh");
    return {ok:true,json:async()=>({url:"https://connect.stripe.com/setup/e/test123",expires_at:1791687600})};
  },async()=>{
    const link=await createStripeConnectOnboardingLink(cfg,merchant,{idempotency_key:"onboard/"+merchant});
    assert.equal(link.url,"https://connect.stripe.com/setup/e/test123");
  });
  assert.equal(calls,1);
});

test("connected-account signer differs from existing Audiotel subscription signer",async()=>{
  const event={id:"evt_Integration123",type:"payment_intent.succeeded",account:merchant,data:{object:{}}};
  const body=Buffer.from(JSON.stringify(event));
  const ts=Math.floor(Date.now()/1000);
  const secret=stripeConnectWebhookSecretForPath(cfg,"/api/v1/billing/stripe/connect-accounts-webhook");
  assert.notEqual(secret,cfg.stripeWebhookSecret);
  assert.notEqual(secret,cfg.stripeConnectWebhookSecret);
  const sign=createHmac("sha256",secret).update(String(ts)+".").update(body).digest("hex");
  const input=(raw,headers)=>({headers,async *[Symbol.asyncIterator](){yield raw;}});
  assert.equal((await verifyStripeWebhook(input(body,{"stripe-signature":"t="+ts+",v1="+sign}),cfg,secret)).id,event.id);
  await assert.rejects(()=>verifyStripeWebhook(input(body,{"stripe-signature":"t="+ts+",v1="+sign}),cfg,cfg.stripeWebhookSecret),{code:"STRIPE_SIGNATURE_INVALID"});
  await assert.rejects(()=>verifyStripeWebhook(input(Buffer.from(JSON.stringify({...event,type:"payment_intent.payment_failed"})),{"stripe-signature":"t="+ts+",v1="+sign}),cfg,secret),{code:"STRIPE_SIGNATURE_INVALID"});
  await assert.rejects(()=>verifyStripeWebhook(input(body,{}),cfg,secret),{code:"STRIPE_SIGNATURE_INVALID"});
});

test("orphan and platform-only events do not create payment attribution",async()=>{
  const cases=[
    {id:"evt_Orphan",account:merchant,type:"payment_intent.succeeded",data:{object:{id:"pi_Orphan",metadata:{}}}},
    {id:"evt_Platform",type:"payment_intent.succeeded",data:{object:{id:"pi_Platform",metadata:{pgi_card_payment_request:request}}}},
    {id:"evt_InvalidAccount",account:"cus_not_valid",type:"payment_intent.succeeded",data:{object:{id:"pi_Unknown",metadata:{pgi_card_payment_request:request}}}}
  ];
  for(const event of cases)assert.equal(await normalizeStripeConnectPaymentEvent(cfg,event),null);
});

test("asynchronous payment lifecycle remains open until Stripe confirms receipt",async()=>{
  const base={account:merchant,created:1791687600};
  const pending=await normalizeStripeConnectPaymentEvent(cfg,{...base,id:"evt_Pending",type:"checkout.session.completed",
    data:{object:{id:"cs_test_Pending",payment_status:"unpaid",metadata:{pgi_card_payment_request:request}}}});
  const paid=await normalizeStripeConnectPaymentEvent(cfg,{...base,id:"evt_Paid",type:"checkout.session.async_payment_succeeded",
    data:{object:{id:"cs_test_Paid",payment_status:"paid",metadata:{pgi_card_payment_request:request}}}});
  const failed=await normalizeStripeConnectPaymentEvent(cfg,{...base,id:"evt_Failed",type:"checkout.session.async_payment_failed",
    data:{object:{id:"cs_test_Failed",payment_status:"unpaid",metadata:{pgi_card_payment_request:request}}}});
  assert.equal(pending.status,"open");
  assert.equal(paid.status,"paid");
  assert.equal(failed.status,"failed");
});
