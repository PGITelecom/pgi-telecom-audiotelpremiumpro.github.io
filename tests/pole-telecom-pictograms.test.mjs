import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {publishedDistributionHtml} from "../backend/src/direct-sva-public-site.mjs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const page=read("site/distribution-sva/index.html");
const brand=read("site/distribution-sva/brand.css");
const unified=read("site/distribution-sva/unified.css");

test("les 11 chiffres decoratifs sont remplaces par des pictogrammes autonomes et accessibles",()=>{
  const groups=[["ds-value-emblem",4],["ds-feature-symbol",5],["ds-unit-icon",2]];
  for(const [kind,expected] of groups){
    const re=new RegExp('<span class="'+kind+'" aria-hidden="true"><svg class="ds-pictogram"[^>]+>[\\s\\S]*?<\\/svg><\\/span>','g');
    assert.equal((page.match(re)||[]).length,expected,kind);
  }
  assert.equal((page.match(/class="ds-pictogram"/g)||[]).length,11);
  assert.doesNotMatch(page,/<span class="(?:ds-value-number|ds-feature-symbol|ds-unit-icon)"[^>]*>0[1-9]</);
  assert.doesNotMatch(page,/<svg[^>]+(?:href="https?:|src="https?:)/i);
});
test("la page conserve tous les titres et les liens des cartes",()=>{
  for(const title of [
    "Continuité étudiée","Appels traçables","Suivi financier lisible","Responsabilités identifiées",
    "Numérotation","Suivi financier","Continuité de vos clients","Business Live unifié","Espace client",
    "Audiotel Premium Pro","PGI Telecom Distribution"
  ])assert.ok(page.includes(title),title);
  for(const href of [
    "/distribution-sva/transition/","/distribution-sva/architecture-reseau/",
    "/distribution-sva/releves-reversements/","/distribution-sva/conformite/"
  ])assert.ok(page.includes('href="'+href+'"'),href);
});
test("les pictogrammes restent compatibles avec les cartes responsives et le rendu publie",()=>{
  assert.match(brand,/\.ds-customer-value \.ds-value-grid \.ds-value-emblem/);
  assert.match(brand,/\.ds-pictogram/);
  assert.match(brand,/@media\(max-width:560px\)/);
  assert.match(unified,/body\.ds-unified \.ds-value-grid \.ds-value-emblem/);
  const published=publishedDistributionHtml(page,{
    publication_authorized:true,navigation_visible:true,commercial_requests_enabled:false
  });
  assert.ok(published);
  assert.equal((published.match(/class="ds-pictogram"/g)||[]).length,11);
  assert.equal((published.match(/class="ds-universe-link"/g)||[]).length,2);
});
