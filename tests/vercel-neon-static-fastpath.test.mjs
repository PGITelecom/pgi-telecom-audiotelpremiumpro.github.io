import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import {createVercelLazyServer,requiresDatabaseBackedSiteState} from "../backend/src/vercel-lazy-server.mjs";

function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"pgi-neon-static-"));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const [p,content] of Object.entries({
    "index.html":"<h1>Homepage</h1>",
    "robots.txt":"User-agent: *",
    "manifest.webmanifest":"{\"name\":\"PGI\"}",
    "assets/site.css":"body{color:#fff}",
    "guide/index.html":"<h1>Guide SEO</h1>",
    "client.html":"<h1>Customer login</h1>",
    "distribution-sva/index.html":"<h1>Distribution</h1>"
  })){
    fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});
    fs.writeFileSync(path.join(root,p),content);
  }
  return root;
}
async function serve(t,initializeBackend){
  const app=createVercelLazyServer({staticDir:fixture(t),initializeBackend});
  await new Promise(resolve=>app.server.listen(0,"127.0.0.1",resolve));
  t.after(async()=>{await app.close();});
  return "http://127.0.0.1:"+app.server.address().port;
}

test("static assets, published SEO pages and private login HTML never initialize Neon",async t=>{
  let initializes=0;
  const base=await serve(t,async()=>{initializes++;throw Error("Neon unreachable");});
  const css=await fetch(base+"/assets/site.css");
  assert.equal(css.status,200);
  assert.match(await css.text(),/color:#fff/);
  assert.equal(css.headers.get("x-content-type-options"),"nosniff");
  assert.equal(css.headers.get("x-frame-options"),"DENY");
  assert.match(css.headers.get("cache-control"),/max-age=300/);
  const guide=await fetch(base+"/guide/");
  assert.equal(guide.status,200);
  assert.match(await guide.text(),/Guide SEO/);
  assert.equal(guide.headers.get("cache-control"),"no-store, must-revalidate");
  const client=await fetch(base+"/client.html");
  assert.equal(client.status,200);
  assert.match(client.headers.get("x-robots-tag"),/noindex/);
  assert.match(client.headers.get("content-security-policy"),/accounts.google.com/);
  assert.equal((await fetch(base+"/assets/site.css",{method:"HEAD"})).status,200);
  assert.equal(initializes,0);
});

test("all DB-controlled pages and API endpoints keep the full backend and initialize once",async t=>{
  let initializes=0,hits=0;
  const base=await serve(t,async()=>{
    initializes++;
    return {server:http.createServer((req,res)=>{
      hits++;res.writeHead(200,{"Content-Type":"application/json"});
      res.end(JSON.stringify({routed:req.url}));
    }),close:async()=>{}};
  });
  for(const route of ["/","/robots.txt","/distribution-sva/","/api/v1/health","/api/v1/customer/auth/me"]){
    const response=await fetch(base+route);
    assert.equal(response.status,200);
    assert.equal((await response.json()).routed,route);
  }
  assert.equal(initializes,1);
  assert.equal(hits,5);
});

test("database failure leaves static assets reachable but never opens protected routes",async t=>{
  let initializes=0;
  const base=await serve(t,async()=>{initializes++;throw Error("DATABASE_UNAVAILABLE");});
  const dynamic=await fetch(base+"/api/v1/customer/auth/me");
  assert.equal(dynamic.status,503);
  assert.equal((await dynamic.json()).error.code,"SERVICE_UNAVAILABLE");
  assert.equal(dynamic.headers.get("cache-control"),"no-store");
  const staticRes=await fetch(base+"/assets/site.css");
  assert.equal(staticRes.status,200);
  assert.equal(initializes,1);
});

test("common PHP probes do not waste a Neon wake-up",async t=>{
  let initializes=0;
  const base=await serve(t,async()=>{initializes++;throw Error("should not open Neon");});
  const response=await fetch(base+"/wp-admin/install.php");
  assert.equal(response.status,404);
  assert.equal(response.headers.get("x-content-type-options"),"nosniff");
  assert.equal(initializes,0);
});

test("homepage, robots and every distribution page cannot bypass publication state",()=>{
  for(const route of ["/","/robots.txt","/distribution-sva","/distribution-sva/","/distribution-sva/solutions/","/distribution-sva/sitemap.xml","/site/distribution-sva/telecom-hero.webp","/site/distribution-sva/pgi-telecom-supervision-infrastructure-reseau.webp","/site/distribution-sva/unified.css","/site/distribution-sva/style.css","/site/distribution-sva/site.js","/site/distribution-sva/measurement.js","/site/distribution-sva/not-allowed.webp"]){
    assert.equal(requiresDatabaseBackedSiteState(route),true,route);
  }
  for(const route of ["/assets/site.css","/site/site.js","/guide/","/client.html"]){
    assert.equal(requiresDatabaseBackedSiteState(route),false,route);
  }
});
