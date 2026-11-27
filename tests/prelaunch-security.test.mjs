import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createBackend} from "../backend/server.mjs";
import {hashPassword} from "../backend/src/security.mjs";

function cfg(){
  return {
    mode:"simulator",authMode:"session",host:"127.0.0.1",port:0,
    sessionSecret:"s".repeat(48),adminUsername:"admin",adminPasswordHash:hashPassword("admin-password-123456"),
    ingestToken:"",bodyLimitBytes:262144,rateLimitPerMinute:10000,heavyReadRateLimitPerMinute:10000,writeRateLimitPerMinute:10000,
    authMaxFailures:8,authFailureWindowSeconds:900,sessionTtlSeconds:3600,
    serviceRateTtcPerMin:.8,payoutRateHtPerMin:.46,expertCostHtPerMin:.18,reconciliationToleranceHt:.01,
    version:"security-test",protectMachineEndpoints:true,emailVerificationEnabled:false,
    externalBillingEnabled:false,stripeLiveMode:false,transactionalEmailEnabled:false,
    legalOperatorConfigured:false,consumerMediatorConfigured:false,b2cCommercialReady:false,onlineWithdrawalReady:false
  };
}
function cookiesFrom(headers){
  const rows=typeof headers.getSetCookie==="function"?headers.getSetCookie():[headers.get("set-cookie")||""],out=new Map();
  for(const row of rows)for(const part of String(row).split(/,(?=\s*__Host-)/)){
    const first=part.trim().split(";")[0],eq=first.indexOf("=");if(eq>0)out.set(first.slice(0,eq),first.slice(eq+1));
  }
  return out;
}
const cookieHeader=map=>[...map].map(([k,v])=>k+"="+v).join("; ");

test("prelaunch admin diagnostics preserve staff/customer isolation and readonly permissions",async()=>{
  const app=createBackend({config:{...cfg(),customerSelfRegistrationEnabled:true}});
  await app.store.createStaffUser(
    {login_name:"auditor",email:"auditor@example.test",display_name:"Auditor",role:"readonly"},
    hashPassword("readonly-password-123456"),{sub:"admin"}
  );
  const address=await app.listen(),base="http://127.0.0.1:"+address.port;
  try{
    let response=await fetch(base+"/api/v1/platform/launch-readiness");
    assert.equal(response.status,401);

    response=await fetch(base+"/api/v1/customer/auth/register",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        first_name:"Client",last_name:"Isolation",account_type:"business",company_name:"Isolation SAS",country_code:"FR",
        phone:"+33600000001",email:"isolation@example.test",password:"long-password-12345",
        authority_confirmed:true,legal_terms_accepted:true,privacy_notice_acknowledged:true,
        legal_version:"2026-10-06-b2b-b2c-v5",website:"",preferred_locale:"fr-FR",timezone:"Europe/Paris"
      })
    });
    assert.equal(response.status,201);
    const customerCookies=cookiesFrom(response.headers);
    response=await fetch(base+"/api/v1/platform/launch-readiness",{headers:{Cookie:cookieHeader(customerCookies)}});
    assert.equal(response.status,401);

    response=await fetch(base+"/api/v1/auth/login",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({username:"auditor",password:"readonly-password-123456"})
    });
    assert.equal(response.status,200);
    const staffCookies=cookiesFrom(response.headers);

    response=await fetch(base+"/api/v1/platform/launch-readiness",{headers:{Cookie:cookieHeader(staffCookies)}});
    assert.equal(response.status,200);

    response=await fetch(base+"/api/v1/platform/subscription-prices",{
      method:"POST",
      headers:{
        "Content-Type":"application/json","Idempotency-Key":randomUUID(),
        "X-CSRF-Token":staffCookies.get("__Host-pgi_csrf"),Cookie:cookieHeader(staffCookies)
      },
      body:JSON.stringify({amount_minor:400,currency:"EUR"})
    });
    assert.equal(response.status,403);
    assert.equal((await response.json()).error.code,"FORBIDDEN");
  }finally{await app.close();}
});

test("staff sessions cannot survive account revocation or fall back to an old admin password",async()=>{
  const config=cfg(), app=createBackend({config});
  const newPassword="updated-admin-password-123456";
  const created=await app.store.createStaffUser({login_name:"admin",email:"staff@example.test",display_name:"Admin",role:"admin"},hashPassword(newPassword),{sub:"admin"});
  const address=await app.listen(),base="http://127.0.0.1:"+address.port;
  const login=password=>fetch(base+"/api/v1/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:"admin",password})});
  try{
    assert.equal((await login("admin-password-123456")).status,401);
    const authenticated=await login(newPassword);
    assert.equal(authenticated.status,200);
    const cookies=cookieHeader(cookiesFrom(authenticated.headers));
    const me=()=>fetch(base+"/api/v1/auth/me",{headers:{Cookie:cookies}});
    assert.equal((await me()).status,200);
    const row=app.store.staffUsers.find(x=>String(x.id)===String(created.id));
    row.session_version++;
    assert.equal((await me()).status,401);
    row.enabled=false;
    assert.equal((await login(newPassword)).status,401);
    assert.equal((await login("admin-password-123456")).status,401);
  }finally{await app.close();}
});
