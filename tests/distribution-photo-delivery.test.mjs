import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import {createVercelLazyServer} from "../backend/src/vercel-lazy-server.mjs";
import {createStaticSiteHandler} from "../backend/src/static-site.mjs";
import {isDirectSvaPublicAsset} from "../backend/src/direct-sva-public-site.mjs";

const PUBLIC_PATHS=[
 "/site/distribution-sva/telecom-hero.webp",
 "/site/distribution-sva/pgi-telecom-supervision-infrastructure-reseau.webp",
 "/site/distribution-sva/style.css",
 "/site/distribution-sva/brand.css",
 "/site/distribution-sva/parity.css",
 "/site/distribution-sva/unified.css",
 "/site/distribution-sva/site.js",
 "/site/distribution-sva/measurement.js"
];

function buildFixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"pgi-distribution-images-"));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const url of PUBLIC_PATHS){
  const rel=url.replace(/^\//,"");
  const sourceFile=path.join(process.cwd(),rel);
  assert.equal(fs.existsSync(sourceFile),true,"source asset must exist: "+rel);
  const destination=path.join(root,rel);
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.copyFileSync(sourceFile,destination);
 }
 const extra=path.join(root,"assets","simple.css");
 fs.mkdirSync(path.dirname(extra),{recursive:true});
 fs.writeFileSync(extra,"body{color:white}");
 return root;
}
async function start(t,authorized){
 const root=buildFixture(t);
 let backendStarts=0,visibilityChecks=0;
 const app=createVercelLazyServer({staticDir:root,initializeBackend:async()=>{
  backendStarts++;
  const site=createStaticSiteHandler(root,{getDirectSvaWebsiteState:async()=>{
   visibilityChecks++;
   return {publication_authorized:authorized,navigation_visible:true,commercial_requests_enabled:false};
  }});
  return {server:http.createServer(async(req,res)=>{
   const pathname=new URL(req.url,"http://localhost").pathname;
   if(await site(req,res,pathname))return;
   res.writeHead(404);res.end();
  }),close:async()=>{}};
 }});
 await new Promise(resolve=>app.server.listen(0,"127.0.0.1",resolve));
 t.after(()=>app.close());
 return {url:"http://127.0.0.1:"+app.server.address().port,
  counters:()=>({backendStarts,visibilityChecks})};
}

test("both real Distribution WebP photos and all CSS/JS assets are delivered on a published site",async t=>{
 const {url,counters}=await start(t,true);
 for(const pathname of PUBLIC_PATHS){
  assert.equal(isDirectSvaPublicAsset(pathname),true,"asset must be allowlisted");
  const response=await fetch(url+pathname);
  assert.equal(response.status,200,pathname);
  const bytes=Buffer.from(await response.arrayBuffer());
  const real=fs.readFileSync(path.join(process.cwd(),pathname.replace(/^\//,"")));
  assert.deepEqual(bytes,real,"served asset must be byte-for-byte intact: "+pathname);
  const mime=response.headers.get("content-type")||"";
  assert.match(mime,pathname.endsWith(".webp")?/^image\/webp$/:pathname.endsWith(".css")?/^text\/css/:/^text\/javascript/);
 }
 assert.equal(counters().backendStarts,1,"use shared application backend after first gated asset");
 assert.ok(counters().visibilityChecks>=PUBLIC_PATHS.length);
 const ordinary=await fetch(url+"/assets/simple.css");
 assert.equal(ordinary.status,200,"non-Distribution public assets still work");
});

test("when Distribution publishing is disabled, images and scripts remain inaccessible",async t=>{
 const {url,counters}=await start(t,false);
 for(const pathname of PUBLIC_PATHS){
  const response=await fetch(url+pathname);
  assert.equal(response.status,404,pathname);
  assert.match(response.headers.get("x-robots-tag")||"",/noindex/);
 }
 assert.equal(counters().backendStarts,1);
});

test("non-approved image files remain blocked even when Distribution publishing is enabled",async t=>{
 const {url}=await start(t,true);
 assert.equal(isDirectSvaPublicAsset("/site/distribution-sva/unapproved.webp"),false);
 assert.equal((await fetch(url+"/site/distribution-sva/unapproved.webp")).status,404);
});

test("public SVA assets are still available without starting a Neon-backed backend",async t=>{
 const {url,counters}=await start(t,false);
 assert.equal((await fetch(url+"/assets/simple.css")).status,200);
 assert.equal(counters().backendStarts,0);
});
