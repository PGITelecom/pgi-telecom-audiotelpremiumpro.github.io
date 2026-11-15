import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {hashPassword,verifyPassword,issueSession,verifySession} from "../backend/src/security.mjs";
import fs from "node:fs";

const secret="security-tests-"+ "x".repeat(48);
const signed=payload=>{
  const body=Buffer.from(JSON.stringify(payload)).toString("base64url");
  return body+"."+createHmac("sha256",secret).update(body).digest("base64url");
};

test("password hashes require the bounded canonical scrypt work factor",()=>{
  const password="correct-hardened-passphrase";
  const encoded=hashPassword(password);
  assert.equal(verifyPassword(password,encoded),true);
  assert.equal(verifyPassword("wrong-passphrase",encoded),false);
  assert.equal(verifyPassword(password,encoded.replace("$16384$","$2147483648$")),false);
  assert.equal(verifyPassword(password,encoded.replace("$8$1$","$65535$999$")),false);
  assert.equal(verifyPassword(password,encoded+"$junk"),false);
  assert.equal(verifyPassword(password,"scrypt$16384$8$1$AA$AA"),false);
  assert.equal(verifyPassword("x".repeat(8193),encoded),false);
});

test("signed sessions reject extra token fragments, unbounded inputs and invalid timelines",()=>{
  const issued=issueSession({secret,user:{id:1,role:"admin",name:"A"},ttlSeconds:60});
  assert.equal(verifySession(issued.token,secret).role,"admin");
  assert.equal(verifySession(issued.token+".ignored",secret),null);
  assert.equal(verifySession(issued.token+"..",secret),null);
  assert.equal(verifySession("x".repeat(9000),secret),null);
  assert.equal(verifySession(issued.token,"wrong-secret"),null);
  const now=Math.floor(Date.now()/1000);
  assert.equal(verifySession(signed({sub:"1",iat:now,exp:now}),secret),null);
  assert.equal(verifySession(signed({sub:"1",iat:now+3600,exp:now+7200}),secret),null);
  assert.equal(verifySession(signed({sub:"1",iat:"now",exp:now+3600}),secret),null);
  assert.equal(verifySession(signed({sub:"1",iat:now,exp:now+3600,role:"admin"}),secret).role,"admin");
});

test("queue operations fence expired lease ownership and referral payouts have atomic guards",()=>{
  const store=fs.readFileSync("backend/src/store-postgres.mjs","utf8");
  const manual=store.slice(store.indexOf("async settleCustomerReferralReward("),store.indexOf("async customerPortabilityRequests("));
  assert.match(manual,/this\.sql\.begin\(async tx=>/);
  assert.match(manual,/FROM customer_referral_rewards WHERE id=\$1 FOR UPDATE/);
  assert.match(manual,/AND payout_state IN \('pending','retry','waiting_account'\)/);
  assert.match(manual,/await tx\.unsafe\([\s\S]*INSERT INTO audit_log/);
  const complete=store.slice(store.indexOf("async completeWork("),store.indexOf("async failWork("));
  const extend=store.slice(store.indexOf("async extendWorkLease("),store.indexOf("async completeWork("));
  const fail=store.slice(store.indexOf("async failWork("),store.indexOf("async enqueueWork("));
  for(const source of [complete,extend,fail])assert.match(source,/lease_expires_at>now\(\)/);
  const auto=store.slice(store.indexOf("async completeAutomaticReferralPayout("),store.indexOf("async settleCustomerReferralReward("));
  assert.match(auto,/REFERRAL_PAYOUT_ATTEMPT_STALE/);
  assert.match(auto,/payout_attempt_count=\$5::int/);
  const automation=fs.readFileSync("backend/src/referral-payout-automation.mjs","utf8");
  assert.match(automation,/expected_attempt_count:item\.payout_attempt_count/);
});
