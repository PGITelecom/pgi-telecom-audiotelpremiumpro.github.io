import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {DIRECT_SVA_SEO_INVENTORY} from "../scripts/direct-sva-seo-plan.mjs";
import {publishedDistributionHtml} from "../backend/src/direct-sva-public-site.mjs";
import {renderDistributionContextLinks} from "../backend/src/direct-sva-internal-links.mjs";

const root="/distribution-sva/";
const publicPages=DIRECT_SVA_SEO_INVENTORY.filter(x=>!x.private);
const urls=new Set(publicPages.map(x=>root+x.suffix));
const state={publication_authorized:true,navigation_visible:true,commercial_requests_enabled:false};
const read=s=>fs.readFileSync(new URL("../site/distribution-sva/"+s+"index.html",import.meta.url),"utf8");
const published=p=>publishedDistributionHtml(read(p.suffix),state);
const contextual=s=>[...s.matchAll(/<a class="ds-related-link" href="([^"]+)">/g)].map(x=>x[1]);

test("topical contextual links are relevant, within the public inventory and never self-referencing",()=>{
 const noRelated=new Set(["","conditions/","mentions-legales/","confidentialite/"]);
 for(const page of publicPages){
  const html=published(page);
  assert.ok(html,root+page.suffix);
  const related=contextual(html);
  assert.equal(related.length,new Set(related).size,page.suffix+" duplicate contextual link");
  assert.ok(related.every(h=>urls.has(h)),page.suffix+" link to unpublished content");
  assert.ok(!related.includes(root+page.suffix),page.suffix+" self-link");
  assert.ok(!related.includes(root+"espace-client/"),page.suffix+" private client link");
  if(page.lang==="fr"){
   if(noRelated.has(page.suffix))assert.equal(related.length,0,page.suffix+" should not stuff legal/home pages");
   else assert.ok(related.length>=2&&related.length<=4,page.suffix+" should have 2-4 related articles");
  }else{
   assert.equal(related.length,3,page.suffix+" three localized related links");
   assert.ok(related.every(x=>x.startsWith(root+page.lang+"/")),page.suffix+" no cross-locale confusion");
  }
 }
});

test("technical guides replace the old 8-link catch-all menu with three relevant links",()=>{
 const pages=["architecture-reseau/","numerotation/","interconnexion-routage/","releves-reversements/","partenaires/","questions-frequentes/"];
 for(const suffix of pages){
  const result=published({suffix});
  assert.match(result,/class="ds-topic-links ds-related-grid"/,suffix);
  assert.doesNotMatch(result,/aria-label="Dossiers complémentaires"/,suffix+" generic menu should be replaced");
  assert.equal(contextual(result).length,3,suffix+" only three topical recommendations");
 }
});

test("solutions hub links the formerly inert functionality cards to real public technical guides",()=>{
 const html=published({suffix:"solutions/"});
 const area=html.split('<div class="cards">')[1].split('</div>')[0];
 const expected=["numerotation/","transition/","interconnexion-routage/","releves-reversements/","business-live/"];
 for(const suffix of expected)assert.ok(area.includes('href="'+root+suffix+'"'),"Missing article from solutions hub: "+suffix);
 assert.doesNotMatch(area,/href="\/distribution-sva\/espace-client\/"/);
 assert.equal(contextual(html).length,4);
});

test("localized links stay in their original language and only point to existing translated equivalents",()=>{
 for(const lang of ["en","es","pt","de","it"]){
  for(const suffix of ["","solutions/","faq/","partners/"]){
   const html=published({suffix:lang+"/"+suffix});
   const links=contextual(html);
   assert.equal(links.length,3,lang+"/"+suffix);
   assert.ok(links.every(h=>urls.has(h)&&h.startsWith(root+lang+"/")));
  }
 }
});

test("home uses its existing topical guides without injecting a redundant broad list",()=>{
 const html=published({suffix:""});
 const main=html.slice(html.indexOf("<main"),html.indexOf("</main>"));
 const links=[...new Set([...main.matchAll(/href="(\/distribution-sva\/[^"]+)"/g)].map(x=>x[1]))];
 const required=["solutions/","numerotation/","architecture-reseau/","interconnexion-routage/","releves-reversements/","transition/","conformite/","business-live/"];
 for(const target of required)assert.ok(links.includes(root+target),"Home is missing "+target);
 assert.equal(contextual(main).length,0,"No duplicate related-navigation block on home");
});

test("indexation and commercial restrictions remain intact when rendering link recommendations",()=>{
 assert.equal(publishedDistributionHtml(read("solutions/"),{publication_authorized:false}),null);
 assert.match(read("solutions/"),/name="robots" content="noindex,nofollow,noarchive"/);
 assert.match(published({suffix:"solutions/"}),/name="robots" content="index,follow,max-snippet:-1"/);
 assert.equal(renderDistributionContextLinks("unrelated","/not-a-page/","fr"),"unrelated");
 assert.equal(renderDistributionContextLinks("unrelated",root+"espace-client/","fr"),"unrelated");
 const css=fs.readFileSync(new URL("../site/distribution-sva/unified.css",import.meta.url),"utf8");
 assert.match(css,/\.ds-related-grid\{display:grid/);
 assert.match(css,/background:linear-gradient\(145deg,#f8eee5,#eaddcc\)/);
 assert.match(css,/background:rgba\(42,45,49,\.985\)!important/);
});
