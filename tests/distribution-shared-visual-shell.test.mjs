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
  for(const match of html.matchAll(/<article class="card([^"]*)">([\s\S]*?)<\/article>/g)){
   if((match[2].match(/<a\s+[^>]*href="[^"]+"/g)||[]).length===1)
    assert.ok(match[1].includes("ds-card-clickable"),name+": single-link article should be fully tappable");
  }
  assert.doesNotMatch(html,/<header class="top">/,name+": no legacy header");
  assert.match(html,/content="index,follow,max-snippet:-1"/,name+": existing editorial release rule");
  assert.ok(html.includes('href="/client.html"'),name+": existing Audiotel login");
  assert.ok(!html.includes('class="header-login" href="/distribution-sva/espace-client/"'),name+": no private Distribution login");
  assert.ok(html.indexOf("</main>")<html.indexOf("<footer"),name+": semantic footer");
  assert.equal((html.match(/<link rel="stylesheet" href="\/site\/distribution-sva\/unified\.css">/g)||[]).length,1,name+": no CSS duplication");
  if(page.lang!=="fr"){
   assert.match(html,new RegExp('href="/distribution-sva/'+page.lang+'/solutions/"'),name+": language-specific navigation");
  }
 }
});

test("the approved network photograph integrates real HTML title and copy in its warm gradient",()=>{
 const raw=fs.readFileSync(new URL("../site/distribution-sva/index.html",import.meta.url),"utf8");
 const html=publishedDistributionHtml(raw,state);
 const photo=html.indexOf('class="ds-hero-photographic"');
 const title=html.indexOf('<h1><span>Pôle Télécom</span> &amp; Réseau.</h1>');
 const lead=html.indexOf('class="hero-lead hero-lead-simple"');
 assert.ok(photo>0&&title>photo&&lead>title,"title should be readable on image, with long copy below");
 assert.match(html,/class="ds-hero-photographic-copy"/);
 assert.match(html,/src="\/site\/distribution-sva\/telecom-hero\.webp"/);
 assert.match(html,/width="960" height="1358"/);
 assert.match(html,/alt="Antenne de télécommunications/);
 assert.doesNotMatch(html,/class="hero-visual-brand"/);
 assert.doesNotMatch(html,/<div class="hero-side">/);
 assert.match(html,/class="card ds-card-clickable"/);
 assert.match(html,/class="ds-universe-link"/);
 assert.match(html,/href="\/distribution-sva\/numerotation\/"/);
 assert.match(html,/href="\/distribution-sva\/releves-reversements\/"/);
 assert.match(html,/href="\/distribution-sva\/espace-client\/"/);
});
test("brand logo returns to SVA on Pôle home and to Pôle home everywhere else",()=>{
 for(const page of pages){
  const raw=fs.readFileSync(new URL("../site/distribution-sva/"+page.suffix+"index.html",import.meta.url),"utf8");
  const html=publishedDistributionHtml(raw,state);
  const logo=/<a class="brand brand-full" href="([^"]+)" aria-label="[^"]+"><img src="\/assets\/audiotel-brand-logo-v33\.png"/.exec(html);
  assert.ok(logo,page.suffix+" logo");
  assert.equal(logo[1],page.suffix===""?"/":"/distribution-sva/",page.suffix+" destination");
 }
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
 assert.match(styles,/background:rgba\(42,45,49,\.985\)!important/);
 const svaCss=fs.readFileSync(new URL("../site/site.css",import.meta.url),"utf8");
 assert.match(svaCss,/\.revenue-quick-nav\{position:fixed!important[^}]*background:rgba\(42,45,49,\.985\)!important/);
 assert.equal((styles.match(/background:rgba\(42,45,49,\.985\)!important/g)||[]).length,2);
 assert.doesNotMatch(styles,/background:rgba\(19,12,10,\.985\)!important/);
 assert.match(styles,/font-weight:500!important/);
 assert.match(styles,/ds-hero-photo-under-title img/);
 assert.match(styles,/\.ds-hero-photographic::after/);
 assert.match(styles,/@media\(max-width:365px\)/);
});
