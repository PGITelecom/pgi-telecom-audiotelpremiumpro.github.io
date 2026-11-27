import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {readFileSync} from "node:fs";
import {constantTimeTokenEqual,hashPassword,verifySession,issueSession} from "../backend/src/security.mjs";
import {customerPermissions,hasCustomerPermission} from "../backend/src/customer-access.mjs";

test("credentials must be present and correctly typed",()=>{
  for(const [a,b] of [["",""],[null,null],[undefined,undefined],[1,"1"],[false,false],["x",""],["","x"],["x","y"]]){
    assert.equal(constantTimeTokenEqual(a,b),false);
  }
  assert.equal(constantTimeTokenEqual("valid","valid"),true);
  assert.throws(()=>hashPassword("x".repeat(8193)));
});

test("signed sessions require canonical signature encoding",()=>{
  const secret="fixture-session-secret";
  const {token}=issueSession({secret,user:{id:42,role:"admin"},ttlSeconds:60});
  assert.equal(verifySession(token,secret)?.sub,"42");
  const [encoded,sig]=token.split(".");
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const alias=sig.slice(0,-1)+alphabet[alphabet.indexOf(sig.at(-1))+1];
  assert.deepEqual(Buffer.from(alias,"base64url"),Buffer.from(sig,"base64url"));
  assert.equal(verifySession(encoded+"."+alias,secret),null);
  const tampered=Buffer.from(JSON.stringify({sub:"43",iat:1,exp:9999999999})).toString("base64url");
  assert.notEqual(createHmac("sha256",secret).update(tampered).digest("base64url"),sig);
  assert.equal(verifySession(tampered+"."+sig,secret),null);
});

test("permission grants cannot elevate a non-owner to wildcard authority",()=>{
  assert.equal(hasCustomerPermission({customer_role:"readonly",permission_grants:["*"]},"team.manage"),false);
  assert.equal(hasCustomerPermission({customer_role:"owner",permission_denials:["team.manage"]},"team.manage"),false);
  assert.equal(hasCustomerPermission({customer_role:"owner",permission_denials:["*"]},"finance.read"),false);
  assert.equal(hasCustomerPermission({customer_role:"owner"},"finance.read"),true);
  assert.equal(hasCustomerPermission({customer_role:"analyst",permission_grants:["finance.export"]},"finance.export"),true);
  for(const role of ["constructor","__proto__","toString"]){
    assert.deepEqual(customerPermissions({customer_role:role}),customerPermissions({customer_role:"readonly"}));
  }
});

test("server-controlled resource identifiers cannot be overwritten in replay fingerprints",()=>{
  const source=readFileSync(new URL("../backend/server.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(source,/\{(?:tenant_id:context\.tenant_id(?:,service_id:match\.id)?|tenant:match\.id|id:match\.id),\.\.\.body\}/);
  assert.match(source,/\{\.\.\.body,tenant_id:context\.tenant_id,service_id:match\.id\}/);
  assert.match(source,/\{\.\.\.body,tenant_id:context\.tenant_id\}/);
});
