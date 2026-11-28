import test from "node:test";
import assert from "node:assert/strict";
import {productionOrigin,inspectProbe,checkWithConfirmation,runProductionSmoke} from "../scripts/production-smoke.mjs";
const base="https://audiotel-premium-pro.com";
const spec={name:"api.health",path:"/api/v1/health",expected:200,jsonCheck:b=>b?.status==="ok"&&b?.mode==="production"};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
const good=()=>json({status:"ok",mode:"production"});
test("production origin cannot contain credentials, query, path, or cleartext",()=>{
 assert.equal(productionOrigin(base+"/"),base);
 for(const u of ["http://audiotel-premium-pro.com","https://u:p@audiotel-premium-pro.com","https://audiotel-premium-pro.com/client.html","https://audiotel-premium-pro.com/?x=1"])
  assert.throws(()=>productionOrigin(u),/INVALID_PRODUCTION_ORIGIN/);
});
test("health requires a production JSON contract, not simply HTTP 200",async()=>{
 assert.equal((await inspectProbe(base,spec,{fetchImpl:async()=>good()})).pass,true);
 for(const body of [{status:"ok",mode:"simulator"},{status:"degraded",mode:"production"}]){
  const r=await inspectProbe(base,spec,{fetchImpl:async()=>json(body)});
  assert.equal(r.pass,false);assert.equal(r.code,"JSON_CONTRACT");
 }
});
test("auth boundary fails closed even when a login page returns HTTP 200",async()=>{
 const auth={name:"auth.boundary",path:"/api/v1/customer/auth/me",expected:401,tokens:["AUTH_REQUIRED"]};
 const r=await inspectProbe(base,auth,{fetchImpl:async()=>new Response("AUTH_REQUIRED",{status:200})});
 assert.equal(r.code,"HTTP_STATUS");assert.equal(r.pass,false);
});
test("cross-origin redirect is rejected without following it",async()=>{
 let calls=0;
 const r=await inspectProbe(base,spec,{fetchImpl:async()=>{calls++;return new Response(null,{status:302,headers:{location:"https://other.invalid/private"}})}});
 assert.equal(calls,1);assert.equal(r.code,"UNEXPECTED_REDIRECT");
});
test("same-origin redirects remain bounded",async()=>{
 let calls=0;
 const r=await inspectProbe(base,spec,{fetchImpl:async()=>{calls++;return new Response(null,{status:302,headers:{location:"/api/v1/health"}})}});
 assert.equal(calls,4);assert.equal(r.code,"REDIRECT_LIMIT");
});
test("body size is bounded without leaking content",async()=>{
 const r=await inspectProbe(base,spec,{fetchImpl:async()=>new Response("x".repeat(1024*1024+1),{status:200})});
 assert.equal(r.code,"BODY_LIMIT");assert.equal("body" in r,false);
});
test("valid CSS and JavaScript types are required for critical assets",async()=>{
 const css={name:"asset.client.styles",path:"/assets/client-portal.css",expected:200,tokens:[".cp-header"],contentType:"text/css"};
 assert.equal((await inspectProbe(base,css,{fetchImpl:async()=>new Response(".cp-header",{headers:{"content-type":"text/css"}})})).pass,true);
 assert.equal((await inspectProbe(base,css,{fetchImpl:async()=>new Response(".cp-header",{headers:{"content-type":"text/html"}})})).code,"CONTENT_TYPE");
});
test("an isolated failure is retried once and classified as transient",async()=>{
 let calls=0;
 const r=await checkWithConfirmation(base,spec,{pause:async()=>{},fetchImpl:async()=>++calls===1?json({status:"bad"},503):good()});
 assert.equal(calls,2);assert.equal(r.pass,true);assert.equal(r.classification,"transient");assert.equal(r.first_status,503);
});
test("two failed probes require incident follow-up, not false recovery",async()=>{
 let calls=0;
 const r=await checkWithConfirmation(base,spec,{pause:async()=>{},fetchImpl:async()=>{calls++;throw Error("do not log sensitive data")}});
 assert.equal(calls,2);assert.equal(r.classification,"confirmed_failure");assert.equal(r.pass,false);
 assert.equal(JSON.stringify(r).includes("sensitive"),false);
});
test("healthy checks do not retry and security headers must be valid",async()=>{
 let calls=0;const r=await checkWithConfirmation(base,spec,{fetchImpl:async()=>{calls++;return good()}});
 assert.equal(calls,1);assert.equal(r.classification,"healthy");
 const security={name:"security.headers",path:"/",expected:200,security:true};
 const bad=await inspectProbe(base,security,{fetchImpl:async()=>new Response("",{headers:{"strict-transport-security":"max-age=0","x-content-type-options":"nosniff","x-frame-options":"DENY"}})});
 assert.equal(bad.code,"SECURITY_HEADERS");
});
test("full smoke uses only bounded GETs to the configured same origin",async()=>{
 const urls=[];
 const r=await runProductionSmoke({target:base,pause:async()=>{},fetchImpl:async(url,opts)=>{
  urls.push(url);assert.equal(new URL(url).origin,base);assert.equal(opts.method,"GET");assert.equal(opts.redirect,"manual");
  assert.equal("Cookie" in opts.headers,false);
  return new Response("no private payload",{status:503});
 }});
 assert.equal(r.status,"failed");assert.equal(r.scope,"public_read_only");assert.equal(r.checks.length,23);
 assert.equal(urls.length,46);assert.equal(new Set(r.failed_keys).size,23);
 assert.equal(JSON.stringify(r).includes("private payload"),false);
});
