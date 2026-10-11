import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {DIRECT_SVA_SEO_INVENTORY} from "../scripts/direct-sva-seo-plan.mjs";
import {publishedDistributionHtml,isDirectSvaPublicAsset} from "../backend/src/direct-sva-public-site.mjs";
import {renderDirectSvaVisualShell} from "../backend/src/direct-sva-visual-shell.mjs";

const state={publication_authorized:true,navigation_visible:true,commercial_requests_enabled:false};
const pages=DIRECT_SVA_SEO_INVENTORY.filter(p=>!p.private);
test("all 35 publicly eligible Distribution editorial pages share the actual SVA header, search and black footer",()=>{
 assert.equal(pages.length,35);
 for(const page of pages){
  const name="site/distribution-sva/"+page.suffix+"index.html";
  const raw=fs.readFileSync(new URL("../"+name,import.meta.url),"utf8");
  const html=publishedDistributionHtml(raw,state);
  assert.ok(html,name+": output");
  assert.equal((html.match(/<header\b/g)||[]).length,1,name+": one header");
  assert.equal((html.match(/class="revenue-quick-nav"/g)||[]).length,1,name+": one bottom bar");
  assert.equal((html.match(/class="revenue-quick-tab(?: [^"]*)?"/g)||[]).length,5,name+": exactly five links");
  assert.equal((html.match(/id="site-search-input"/g)||[]).length,1,name+": one search box");
  assert.match(html,/class="brand brand-full"/,name+": Audiotel brand logo");
  assert.match(html,/site-search\.js" defer/,name+": functional shared search script");
  assert.match(html,/\/site\/distribution-sva\/unified\.css"/,name+": unified stylesheet");
  assert.match(html,/<body[^>]*class="[^"]*ds-unified/,name+": scoped unified CSS");
  assert.match(html,/class="revenue-quick-tabs"/,name+": real SVA bottom-bar component");
  assert.doesNotMatch(html,/<header class="top">/,name+": no legacy header");
  assert.match(html,/content="index,follow,max-snippet:-1"/,name+": existing editorial release rule");
  assert.ok(html.includes('href="/client.html"'),name+": existing Audiotel login");
  assert.ok(!html.includes('href="/distribution-sva/espace-client/"'),name+": unavailable Distribution login stays blocked");
  assert.ok(html.indexOf("</main>")<html.indexOf("<footer"),name+": semantic footer");
  assert.equal((html.match(/<link rel="stylesheet" href="\/site\/distribution-sva\/unified\.css">/g)||[]).length,1,name+": no CSS duplication");
  if(page.lang!=="fr"){
   assert.match(html,new RegExp('href="/distribution-sva/'+page.lang+'/solutions/"'),name+": language-specific navigation");
  }
 }
});

test("network photograph is below the Pôle Télécom & Réseau title and unobscured by overlay logo",()=>{
 const raw=fs.readFileSync(new URL("../site/distribution-sva/index.html",import.meta.url),"utf8");
 const html=publishedDistributionHtml(raw,state);
 const title=html.indexOf("<h1><span>Pôle Télécom</span> &amp; Réseau.</h1>");
 const photo=html.indexOf('class="hero-visual ds-hero-photo-under-title"');
 const text=html.indexOf('class="hero-lead hero-lead-simple"');
 assert.ok(title>0&&photo>title&&text>photo,"photo immediately after title, before the descriptive text");
 assert.match(html,/src="\/site\/distribution-sva\/telecom-hero\.webp"/);
 assert.match(html,/height="471"/);
 assert.match(html,/alt="Antenne de télécommunications surplombant une ville/);
 assert.doesNotMatch(html,/<div class="hero-side">/);
 assert.doesNotMatch(html,/class="hero-visual-brand"/);
});
test("all locales render correctly without leaking French navigation labels",()=>{
 const labels={en:"Overview",es:"Presentación",pt:"Apresentação",de:"Übersicht",it:"Presentazione"};
 for(const [lang,word] of Object.entries(labels)){
  const page=fs.readFileSync(new URL("../site/distribution-sva/"+lang+"/index.html",import.meta.url),"utf8");
  const html=publishedDistributionHtml(page,state);
  assert.match(html,new RegExp('>'+word+'</strong>'),lang);
  assert.match(html,new RegExp('href="/distribution-sva/'+lang+'/partners/"'),lang);
  assert.ok(!html.includes("Conserver mes numéros"),lang+" must not show French Distribution navigation");
 }
});
test("only explicitly approved stylesheet served, commercial and private restrictions remain intact",()=>{
 assert.equal(isDirectSvaPublicAsset("/site/distribution-sva/unified.css"),true);
 assert.equal(isDirectSvaPublicAsset("/site/distribution-sva/secret.css"),false);
 assert.equal(isDirectSvaPublicAsset("/site/distribution-sva/index.html"),false);
 assert.equal(publishedDistributionHtml("<html></html>",{publication_authorized:false}),null);
 const preview=renderDirectSvaVisualShell("<html><head></head><body><main></main></body></html>");
 assert.match(preview,/ds-unified/);
 const styles=fs.readFileSync(new URL("../site/distribution-sva/unified.css",import.meta.url),"utf8");
 assert.match(styles,/\.revenue-quick-nav\{position:fixed!important/);
 assert.match(styles,/background:rgba\(42,45,49,\.99\)!important/);
 assert.match(styles,/font-weight:500!important/);
 assert.match(styles,/ds-hero-photo-under-title img/);
 assert.match(styles,/aspect-ratio:auto!important/);
 assert.match(styles,/@media\(max-width:365px\)/);
});
