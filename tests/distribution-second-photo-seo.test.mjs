import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {publishedDistributionHtml,isDirectSvaPublicAsset} from "../backend/src/direct-sva-public-site.mjs";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const assetName="pgi-telecom-supervision-infrastructure-reseau.webp";
const assetPath="/site/distribution-sva/"+assetName;
const home=read("site/distribution-sva/index.html");
const visible=publishedDistributionHtml(home,{publication_authorized:true,navigation_visible:true,commercial_requests_enabled:false});
const css=read("site/distribution-sva/unified.css");

test("the approved user image is an optimized real 1536x864 WebP with its own filename",()=>{
 const img=fs.readFileSync(new URL("../site/distribution-sva/"+assetName,import.meta.url));
 assert.ok(img.length>150000&&img.length<300000,"reasonable quality / compressed size");
 assert.equal(img.toString("ascii",0,4),"RIFF");
 assert.equal(img.toString("ascii",8,12),"WEBP");
 assert.equal(img.readUInt32LE(4)+8,img.length,"not truncated");
 assert.equal(isDirectSvaPublicAsset(assetPath),true,"explicitly allow public image fetch");
 assert.equal(isDirectSvaPublicAsset("/site/distribution-sva/secret-image.webp"),false);
});

test("homepage keeps dark hero and network showcase ahead of the lower two-activities section",()=>{
 const old=visible.indexOf('src="/site/distribution-sva/telecom-hero.webp"');
 const two=visible.indexOf('class="ds-two-univers"');
 const newPhoto=visible.indexOf('src="'+assetPath+'"');
 const cards=visible.indexOf('class="cards ds-features"');
 const faq=visible.indexOf('id="questions-pole-telecom"');
 const resources=visible.indexOf('id="ressources-du-pole"');
 assert.ok(old>0 && newPhoto>old && cards>newPhoto && faq>cards && two>faq && resources>two,
   "expected editorial flow: dark hero, network image, features, FAQ, two activities, resources");
 assert.equal((visible.match(/<h1\b/g)||[]).length,1,"one primary heading");
 assert.match(visible,/<section class="section-space ds-network-showcase" id="infrastructure-telecom"/);
 assert.match(visible,new RegExp('src="'+assetPath.replaceAll(".","\\.")+'"'));
 assert.match(visible,/width="1536" height="864" loading="lazy" decoding="async"/);
 assert.match(visible,/alt="Illustration des télécommunications avec antennes, équipe de supervision/);
 assert.match(visible,/équipements représentés ne constituent pas une déclaration d'exploitation déjà active/);
 const figure=visible.match(/<figure class="ds-network-showcase-figure">([\s\S]*?)<\/figure>/);
 assert.ok(figure);
 assert.doesNotMatch(figure[1],/<h1\b/);
});

test("the contextual links are genuine published topical pages and the visual keeps native dimensions on mobile",()=>{
 const destinations=["architecture-reseau/","interconnexion-routage/","releves-reversements/"];
 for(const suffix of destinations)assert.match(visible,new RegExp('href="/distribution-sva/'+suffix+'"'));
 assert.match(css,/\.ds-network-showcase-figure>img\{display:block;width:100%;height:auto!important;aspect-ratio:16\/9!important/);
 assert.match(css,/ds-network-showcase-links\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/\.ds-network-showcase-links\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/background:rgba\(42,45,49,\.985\)!important/,"SVA grey footer unchanged");
});

test("structured data describes the photograph accurately without implying operating infrastructure",()=>{
 const json=JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(home)[1]);
 const webpage=json["@graph"].find(x=>x["@type"]==="WebPage");
 const images=webpage.image;
 assert.equal(images.length,2,"original hero and second visual");
 const second=images[1];
 assert.equal(second.contentUrl,"https://audiotel-premium-pro.com"+assetPath);
 assert.equal(second.width,1536);
 assert.equal(second.height,864);
 assert.match(second.caption,/Illustration/);
 assert.match(home,/noindex,nofollow,noarchive/,"publication gate remains active");
});


test("les deux activités apparaissent à la fin et leurs numéros 01/02 restent accolés aux titres publiés",()=>{
 const light=visible.indexOf('class="ds-two-univers"');
 const faq=visible.indexOf('id="questions-pole-telecom"');
 const resources=visible.indexOf('id="ressources-du-pole"');
 assert.ok(faq>0&&light>faq&&resources>light,"beige organizational panel should come near page end");
 assert.match(visible,/<a class="ds-universe-link"[^>]*><span class="ds-unit-icon"[^>]*>01<\/span><strong>Audiotel Premium Pro<\/strong>/);
 assert.match(visible,/<a class="ds-universe-link"[^>]*><span class="ds-unit-icon"[^>]*>02<\/span><strong>PGI Telecom Distribution<\/strong>/);
 assert.match(css,/body\.home-page\.ds-unified \.ds-two-columns > \.ds-universe-link\{[\s\S]*?grid-template-columns:43px minmax\(0,1fr\)/);
 assert.match(css,/\.ds-universe-link > strong\{[\s\S]*?grid-column:2;[\s\S]*?grid-row:1;/);
 assert.match(css,/\.ds-universe-link > p\{[\s\S]*?grid-column:1 \/ -1;[\s\S]*?grid-row:2;/);
});
