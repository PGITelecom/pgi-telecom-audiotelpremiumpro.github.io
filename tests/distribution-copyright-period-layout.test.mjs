import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {DIRECT_SVA_SEO_INVENTORY} from "../scripts/direct-sva-seo-plan.mjs";
import {publishedDistributionHtml} from "../backend/src/direct-sva-public-site.mjs";

const state={publication_authorized:true,navigation_visible:true,commercial_requests_enabled:false};
const pages=DIRECT_SVA_SEO_INVENTORY.filter(x=>!x.private);
const css=fs.readFileSync("site/distribution-sva/unified.css","utf8");
const js=fs.readFileSync("site/distribution-sva/site.js","utf8");

test("all 35 Distribution pages display copyright after all footer links",()=>{
 assert.equal(pages.length,35);
 for(const page of pages){
  const raw=fs.readFileSync("site/distribution-sva/"+page.suffix+"index.html","utf8");
  const published=publishedDistributionHtml(raw,state);
  assert.ok(published,"page visible "+page.suffix);
  const footer=published.split("<footer").at(-1).split("</footer>")[0];
  assert.equal((footer.match(/data-ds-year/g)||[]).length,1,page.suffix+" copyright once");
  assert.match(footer,/<div class="wrap ds-footer-rights"><p><span>© <span data-ds-year>/,page.suffix);
  assert.ok(footer.indexOf("ds-footer-rights")>footer.lastIndexOf("</a>"),page.suffix+" copyright after all links");
  assert.match(footer,/<\/p><\/div>\s*$/,page.suffix+" copyright is the final footer element");
 }
});
test("every Distribution page shows one period title with breathing room after the site header",()=>{
 for(const page of pages){
  const raw=fs.readFileSync("site/distribution-sva/"+page.suffix+"index.html","utf8");
  const published=publishedDistributionHtml(raw,state);
  assert.equal((published.match(/data-ds-current-period/g)||[]).length,1,page.suffix+" single period");
  const isHome=page.suffix==="";
  if(isHome)assert.doesNotMatch(published,/class="ds-period-strip"/);
  else{
   assert.match(published,/<\/header>\s*<div class="ds-period-strip">/);
   assert.ok(published.indexOf('class="ds-period-strip"')<published.indexOf("<main"),"banner precedes content");
  }
 }
 assert.match(css,/body\.ds-unified \.ds-period-strip\{padding:16px 0 14px/);
 assert.match(css,/body\.home-page\.ds-unified \.site-header\+main>\.hero:first-child\{padding-top:18px!important/);
});
test("dates stay dynamic in Paris timezone and locale, never locked to 2026",()=>{
 assert.match(js,/timeZone:"Europe\/Paris",month:"long",year:"numeric"/);
 for(const locale of ["fr-FR","en-GB","es-ES","pt-PT","de-DE","it-IT"])assert.ok(js.includes(locale));
 assert.match(js,/document\.querySelectorAll\("\[data-ds-year\]"\)/);
 assert.match(css,/body\.ds-unified footer>\.ds-footer-rights/);
});
