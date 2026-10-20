import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {createVercelLazyServer} from "../backend/src/vercel-lazy-server.mjs";
import {createStaticSiteHandler} from "../backend/src/static-site.mjs";
import {isDirectSvaPrivatePortalPath,DIRECT_SVA_CUSTOMER_PORTAL_RELEASE} from "../backend/src/direct-sva-private-portal.mjs";

const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const BLOCKED=[
 "/distribution-sva/espace-client",
 "/distribution-sva/espace-client/",
 "/distribution-sva/espace-client/index.html",
 "/site/distribution-sva/espace-client/index.html",
 "/site/distribution-sva/client-portal.js",
 "/site/distribution-sva/client-portal.css",
 "/distribution-sva/espace-client/%69ndex.html"
];

test("public Pôle information and future private Distribution account have separate release states",()=>{
 assert.equal(DIRECT_SVA_CUSTOMER_PORTAL_RELEASE.business_unit,"direct_sva");
 assert.equal(DIRECT_SVA_CUSTOMER_PORTAL_RELEASE.public_portal_enabled,false);
 assert.equal(DIRECT_SVA_CUSTOMER_PORTAL_RELEASE.customer_login_entry_enabled,false);
 assert.equal(DIRECT_SVA_CUSTOMER_PORTAL_RELEASE.customer_self_registration_enabled,false);
 assert.equal(DIRECT_SVA_CUSTOMER_PORTAL_RELEASE.public_navigation_enabled,false);
 for(const url of BLOCKED)assert.equal(isDirectSvaPrivatePortalPath(url),true,url);
 for(const url of ["/distribution-sva/","/distribution-sva/business-live/","/site/distribution-sva/telecom-hero.webp","/site/distribution-sva/unified.css","/client.html","/assets/client-portal.js"])assert.equal(isDirectSvaPrivatePortalPath(url),false,url);
});

test("Vercel returns 404 on dormant Distribution portal without starting Neon",async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"pgi-private-client-"));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const forbidden=path.join(root,"site","distribution-sva","espace-client","index.html");
 fs.mkdirSync(path.dirname(forbidden),{recursive:true});
 fs.writeFileSync(forbidden,"PRIVATE-PORTAL-FORBIDDEN");
 fs.writeFileSync(path.join(root,"client.html"),"SVA-CLIENT-REMAINS-SEPARATE");
 let bootCount=0;
 const app=createVercelLazyServer({staticDir:root,initializeBackend:async()=>{bootCount++;throw Error("Neon should not be called");}});
 await new Promise(resolve=>app.server.listen(0,"127.0.0.1",resolve));
 t.after(()=>app.close());
 const base="http://127.0.0.1:"+app.server.address().port;
 for(const url of BLOCKED){
  const result=await fetch(base+url);
  assert.equal(result.status,404,url);
  assert.equal(result.headers.get("cache-control"),"no-store",url);
  assert.match(result.headers.get("x-robots-tag")||"",/noindex/,url);
  assert.doesNotMatch(await result.text(),/PRIVATE-PORTAL-FORBIDDEN/,url);
 }
 for(const method of ["HEAD","POST"]){
  assert.equal((await fetch(base+"/distribution-sva/espace-client/",{method})).status,404,method);
 }
 assert.equal(bootCount,0,"never wake Neon for a blocked portal URL");
});

test("the origin static handler rejects the dormant portal before public SEO visibility lookup",async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"pgi-direct-private-"));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 let checks=0;
 const serve=createStaticSiteHandler(root,{getDirectSvaWebsiteState:async()=>{
  checks++;return {publication_authorized:true,navigation_visible:true};
 }});
 for(const p of BLOCKED.slice(0,6)){
  const response={status:null,headers:{},writeHead(code,headers){this.status=code;this.headers=headers;},end(){this.ended=true;}};
  const served=await serve({method:"GET"},response,p);
  assert.equal(served,true,p);
  assert.equal(response.status,404,p);
  assert.match(response.headers["X-Robots-Tag"],/noindex/,p);
 }
 assert.equal(checks,0);
});

test("only authenticated administrator cockpit offers the private visual preview, with no SVA client link",()=>{
 const cockpit=read("assets/direct-sva-cockpit.js");
 const entry=read("assets/direct-sva-cockpit-entry.js");
 const preview=read("assets/direct-sva-client-preview.js");
 const currentCustomer=read("client.html");
 const currentCustomerScript=read("assets/client-portal.js");
 const privatePage=read("site/distribution-sva/espace-client/index.html");
 assert.match(entry,/user\?\.role!=="admin"/);
 assert.match(cockpit,/client_preview","Espace client \(aperçu privé\)/);
 assert.match(cockpit,/import\("\.\/direct-sva-client-preview\.js"\)/);
 assert.match(preview,/Aucune donnée client affichée/);
 assert.doesNotMatch(preview,/fetch\(|\/api\/v1\/customer\//);
 assert.doesNotMatch(currentCustomer,/\/distribution-sva\/espace-client\/|direct-sva-client-preview/);
 assert.doesNotMatch(currentCustomerScript,/\/distribution-sva\/espace-client\/|direct-sva-client-preview/);
 assert.match(privatePage,/<meta name="robots" content="noindex,nofollow,noarchive">/);
 assert.match(privatePage,/id="ds-client-content" hidden/);
 assert.match(privatePage,/Mes justificatifs et contrats/);
 assert.match(privatePage,/Assistance Distribution/);
});

test("the Distribution client API keeps individual enrollment and commercial-release protections",()=>{
 const src=read("backend/src/direct-sva-customer.mjs");
 const server=read("backend/server.mjs");
 assert.match(src,/commercialEnabled!==true/);
 assert.match(src,/enrollment\.dashboard_enabled!==true/);
 assert.match(src,/enrollment\.client_contract_accepted!==true/);
 assert.match(src,/business_unit='direct_sva'/);
  assert.ok(server.includes('pathname==="/api/v1/customer/direct-sva/overview"'));
 assert.match(server,/requireCustomerPermission\(context,"overview.read"\)/);
});
