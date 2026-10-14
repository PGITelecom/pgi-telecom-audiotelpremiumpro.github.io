import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {publishedDistributionHtml} from "../backend/src/direct-sva-public-site.mjs";
import {DIRECT_SVA_SEO_INVENTORY} from "../scripts/direct-sva-seo-plan.mjs";
const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const raw=read("site/distribution-sva/index.html");
const html=publishedDistributionHtml(raw,{publication_authorized:true,navigation_visible:true,commercial_requests_enabled:false});
const css=read("site/distribution-sva/unified.css");

test("SVA gray footer remains unchanged and home cards use warm beige",()=>{
 assert.equal((css.match(/background:rgba\(42,45,49,\.985\)!important/g)||[]).length,2);
 assert.doesNotMatch(css,/background:rgba\(19,12,10,\.985\)!important/);
 assert.match(css,/home-page\.ds-unified \.panel,body\.home-page\.ds-unified \.card[\s\S]*?background:linear-gradient\(145deg,#f8eee5,#eaddcc\)!important/);
 assert.match(css,/color:#503c30!important/);
});
test("hero spacing and photography blend are optimized for desktop and narrow mobile",()=>{
 assert.match(css,/home-page\.ds-unified \.hero\{padding:9px 0 42px!important/);
 assert.match(css,/home-page\.ds-unified \.public-search-wrap\{padding-bottom:2px/);
 assert.match(css,/home-page\.ds-unified \.hero-marketing-badge[\s\S]*?margin:0 auto 6px!important/);
 assert.match(css,/home-page\.ds-unified \.ds-hero-photographic[\s\S]*?border:0!important;border-radius:0!important/);
 assert.match(css,/mask-image:radial-gradient/);
 assert.match(css,/filter:contrast\(1\.12\) saturate\(1\.07\) brightness\(1\.055\)!important/);
 assert.match(html,/src="\/site\/distribution-sva\/telecom-hero\.webp"/);
 assert.match(html,/width="960" height="1358"/);
});
test("SEO title, indexation gate and structured data are accurate",()=>{
 assert.match(raw,/<title>PGI Telecom Distribution \| Numérotation SVA et Réseau<\/title>/);
 assert.match(raw,/name="description" content="PGI Telecom prépare son Pôle Télécom/);
 assert.match(raw,/name="robots" content="noindex,nofollow,noarchive"/);
 assert.match(html,/name="robots" content="index,follow,max-snippet:-1"/);
 const json=JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(raw)[1]);
 const page=json["@graph"].find(x=>x["@type"]==="WebPage");
 assert.equal(page.primaryImageOfPage.width,960);
 assert.equal(page.primaryImageOfPage.height,1358);
 assert.equal(page.url,"https://audiotel-premium-pro.com/distribution-sva/");
 assert.ok(page.about.some(x=>/Portabilité/.test(x.name)));
});
test("GEO questions are factual and link only to published editorial pages",()=>{
 assert.match(html,/id="questions-pole-telecom"/);
 assert.match(html,/PGI Telecom Distribution est-il déjà ouvert commercialement/);
 assert.match(html,/Pourra-t-on conserver son numéro surtaxé/);
 assert.match(html,/Comment les appels SVA et les reversements seront-ils suivis/);
 assert.match(html,/Business Live et les dossiers des clients seront-ils conservés/);
 const region=html.split('id="questions-pole-telecom"')[1].split('class="section-space ds-language-section"')[0];
 const links=[...region.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
 const allowed=new Set(DIRECT_SVA_SEO_INVENTORY.filter(x=>!x.private).map(x=>"/distribution-sva/"+x.suffix));
 assert.equal(links.length,4);
 for(const href of links)assert.ok(allowed.has(href),"Invalid public link: "+href);
});
test("client card no longer links to the intentionally private Distribution portal",()=>{
 const cards=html.split('<div class="cards ds-features">')[1].split("</section>")[0];
 assert.match(cards,/Découvrir les fonctions client prévues/);
 assert.match(cards,/href="\/distribution-sva\/solutions\/"/);
 assert.doesNotMatch(cards,/href="\/distribution-sva\/espace-client\/"/);
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
});
