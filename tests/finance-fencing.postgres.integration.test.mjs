import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {EventBus} from "../backend/src/event-bus.mjs";
import {PostgresStore} from "../backend/src/store-postgres.mjs";

const url=process.env.PGI_TEST_DATABASE_URL||"";
const enabled=Boolean(url);
if(enabled){
  const parsed=new URL(url);
  if(!["127.0.0.1","localhost","[::1]"].includes(parsed.hostname)||
     parsed.pathname!=="/pgi_test"||decodeURIComponent(parsed.username)!=="pgi_test")
    throw new Error("Refusing finance integration tests against non-CI PostgreSQL database");
}
const config=()=>({
  mode:"production",databaseUrl:url,databasePoolMax:8,databaseSsl:"disable",
  callerHashKey:"k".repeat(32),requireCarrierContract:true,
  serviceRateTtcPerMin:.8,payoutRateHtPerMin:.46,expertCostHtPerMin:.18,
  reconciliationToleranceHt:.01
});
const rejectedCode=(code)=>error=>error?.code===code;

test("one financial reward cannot be paid twice under 24 concurrent manual requests", {skip:!enabled}, async()=>{
  const store=await PostgresStore.connect(config(),new EventBus());
  const unique=randomUUID().replace(/-/g,"").slice(0,16);
  try{
    const referrer=(await store.sql.unsafe(
      "INSERT INTO tenants(slug,display_name,legal_name,tenant_type,status,country_code,billing_email) VALUES($1,'Finance Referrer CI','Finance Referrer CI','customer','active','FR',$2) RETURNING id",
      ["finref-"+unique,"referrer-"+unique+"@example.test"]
    ))[0];
    const referred=(await store.sql.unsafe(
      "INSERT INTO tenants(slug,display_name,legal_name,tenant_type,status,country_code,billing_email) VALUES($1,'Finance Referred CI','Finance Referred CI','customer','active','FR',$2) RETURNING id",
      ["finnew-"+unique,"referred-"+unique+"@example.test"]
    ))[0];
    const code=(await store.sql.unsafe(
      "INSERT INTO customer_referral_codes(tenant_id,code) VALUES($1,$2) RETURNING id",
      [referrer.id,"F"+unique.toUpperCase()]
    ))[0];
    const referral=(await store.sql.unsafe(
      "INSERT INTO customer_referrals(referral_code_id,referrer_tenant_id,referred_tenant_id,status,reward_minor,reward_currency) VALUES($1,$2,$3,'rewarded',100,'EUR') RETURNING id",
      [code.id,referrer.id,referred.id]
    ))[0];
    const reward=(await store.sql.unsafe(
      "INSERT INTO customer_referral_rewards(referral_id,tenant_id,amount_minor,currency,payout_state,payout_attempt_count) VALUES($1,$2,100,'EUR','processing',2) RETURNING id",
      [referral.id,referrer.id]
    ))[0];

    const stale=await store.failAutomaticReferralPayout(reward.id,{
      expected_attempt_count:1,state:"retry",error_code:"STALE_WORKER"
    });
    assert.equal(stale,null,"an older worker cannot reset the latest payout attempt");
    await assert.rejects(
      ()=>store.completeAutomaticReferralPayout(reward.id,{
        expected_attempt_count:1,provider_transfer_reference:"tr_StaleClaim123",
        destination_account:"acct_TestClaim123",amount_minor:100,currency:"EUR"
      }),
      rejectedCode("REFERRAL_PAYOUT_ATTEMPT_STALE")
    );
    await assert.rejects(
      ()=>store.settleCustomerReferralReward(reward.id,"manual-test-payment",{sub:1}),
      rejectedCode("REFERRAL_PAYOUT_IN_PROGRESS")
    );
    const current=await store.failAutomaticReferralPayout(reward.id,{
      expected_attempt_count:2,state:"retry",error_code:"CI_CHECK"
    });
    assert.equal(current.payout_state,"retry");

    const results=await Promise.all(Array.from({length:24},()=>store.settleCustomerReferralReward(reward.id,"manual-test-payment",{sub:1})));
    assert.equal(results.filter(r=>r.already_paid===false).length,1);
    assert.equal(results.filter(r=>r.already_paid===true).length,23);
    const audit=await store.sql.unsafe(
      "SELECT count(*)::int AS count FROM audit_log WHERE action='referral.reward.paid' AND entity_id=$1",
      [String(reward.id)]
    );
    assert.equal(audit[0].count,1,"manual payment audit record is inserted exactly once");
    const paid=await store.sql.unsafe(
      "SELECT status,payout_state,paid_reference FROM customer_referral_rewards WHERE id=$1",
      [reward.id]
    );
    assert.equal(paid[0].status,"paid");
    assert.equal(paid[0].payout_state,"manual");
    assert.equal(paid[0].paid_reference,"manual-test-payment");
    const manualReplay=await store.settleCustomerReferralReward(reward.id,"manual-test-payment",{sub:1});
    assert.equal(manualReplay.already_paid,true);
    await assert.rejects(
      ()=>store.settleCustomerReferralReward(reward.id,"different-payment-reference",{sub:1}),
      rejectedCode("REFERRAL_PAYMENT_REFERENCE_MISMATCH")
    );
    await assert.rejects(
      ()=>store.completeAutomaticReferralPayout(reward.id,{
        expected_attempt_count:2,provider_transfer_reference:"tr_NotManual123",
        destination_account:"acct_TestCI123",amount_minor:100,currency:"EUR"
      }),
      rejectedCode("REFERRAL_TRANSFER_REFERENCE_MISMATCH")
    );
    const anotherTenant=(await store.sql.unsafe(
      "INSERT INTO tenants(slug,display_name,legal_name,tenant_type,status,country_code,billing_email) VALUES($1,'Replay Referred CI','Replay Referred CI','customer','active','FR',$2) RETURNING id",
      ["finreplay-"+unique,"replay-"+unique+"@example.test"]
    ))[0];
    const anotherReferral=(await store.sql.unsafe(
      "INSERT INTO customer_referrals(referral_code_id,referrer_tenant_id,referred_tenant_id,status,reward_minor,reward_currency) VALUES($1,$2,$3,'rewarded',100,'EUR') RETURNING id",
      [code.id,referrer.id,anotherTenant.id]
    ))[0];
    const transferReference="tr_CI"+unique.toUpperCase(),destination="acct_CI"+unique.toUpperCase();
    const transferred=(await store.sql.unsafe(
      "INSERT INTO customer_referral_rewards(referral_id,tenant_id,amount_minor,currency,status,payout_state,payout_attempt_count,paid_reference,provider_transfer_reference,payout_destination_reference,paid_at)"+
      " VALUES($1,$2,100,'EUR','paid','transferred',2,$3,$3,$4,now()) RETURNING id",
      [anotherReferral.id,referrer.id,transferReference,destination]
    ))[0];
    const sameTransfer={expected_attempt_count:2,provider_transfer_reference:transferReference,
      destination_account:destination,amount_minor:100,currency:"EUR"};
    assert.equal((await store.completeAutomaticReferralPayout(transferred.id,sameTransfer)).already_paid,true);
    await assert.rejects(
      ()=>store.completeAutomaticReferralPayout(transferred.id,{...sameTransfer,amount_minor:101}),
      rejectedCode("REFERRAL_TRANSFER_AMOUNT_MISMATCH")
    );
    await assert.rejects(
      ()=>store.completeAutomaticReferralPayout(transferred.id,{...sameTransfer,destination_account:"acct_OtherCI123"}),
      rejectedCode("REFERRAL_PAYOUT_DESTINATION_MISMATCH")
    );
    await assert.rejects(
      ()=>store.completeAutomaticReferralPayout(transferred.id,{...sameTransfer,provider_transfer_reference:"tr_OtherCI123"}),
      rejectedCode("REFERRAL_TRANSFER_REFERENCE_MISMATCH")
    );
    await assert.rejects(
      ()=>store.settleCustomerReferralReward(transferred.id,"manual-test-payment",{sub:1}),
      rejectedCode("REFERRAL_PAYMENT_REFERENCE_MISMATCH")
    );
  }finally{
    await store.close();
  }
});

test("expired work leases cannot be renewed, completed or failed by stale workers", {skip:!enabled}, async()=>{
  const store=await PostgresStore.connect(config(),new EventBus());
  try{
    const queue="ci_finance_"+randomUUID().slice(0,8);
    const task=await store.enqueueWork(queue,{ci_only:true},{dedupe_key:queue});
    const claimed=await store.claimWork(queue,"finance-worker-1",1,15);
    assert.equal(claimed.length,1);
    assert.equal(Number(claimed[0].id),Number(task.id));
    await store.sql.unsafe("UPDATE work_queue SET lease_expires_at=now()-interval '1 second' WHERE id=$1",[task.id]);
    await assert.rejects(()=>store.extendWorkLease(task.id,"finance-worker-1",15),rejectedCode("WORK_LEASE_LOST"));
    await assert.rejects(()=>store.completeWork(task.id,"finance-worker-1"),rejectedCode("WORK_LEASE_LOST"));
    await assert.rejects(()=>store.failWork(task.id,"finance-worker-1","stale",15),rejectedCode("WORK_LEASE_LOST"));
    const recovered=await store.claimWork(queue,"finance-worker-2",1,15);
    assert.equal(recovered.length,1);
    const done=await store.completeWork(task.id,"finance-worker-2");
    assert.equal(Number(done.id),Number(task.id));
  }finally{
    await store.close();
  }
});
