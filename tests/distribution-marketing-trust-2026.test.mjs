import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {publishedDistributionHtml} from "../backend/src/direct-sva-public-site.mjs";

const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const state={publication_authorized:true,navigation_visible:true,commercial_requests_enabled:false};
const home=publishedDistributionHtml(read("site/distribution-sva/index.html"),state);
const css=read("site/distribution-sva/unified.css");

test("Pôle marketing benefits, relevant audiences and transparency stay truthful",()=>{
  assert.match(home,/id="pourquoi-pgi-telecom"/);
  assert.match(home,/id="a-qui-sadresse-le-pole"/);
  assert.match(home,/id="engagements-et-transparence"/);
  assert.match(home,/id="preparer-mon-projet"/);
  assert.match(home,/Souscription directe non ouverte/);
  assert.match(home,/Aucun paiement n.est sollicité/);
  assert.match(home,/Cette préparation est informative/);
  assert.doesNotMatch(home,/<form[^>]*data-ds-inquiry/i);
  assert.match(home,/a href="\/distribution-sva\/solutions\/"/);
  assert.match(home,/a href="\/distribution-sva\/conformite\/"/);
});

test("approved photos and editorial order remain intact",()=>{
  const hero=home.indexOf("telecom-hero.webp");
  const second=home.indexOf("pgi-telecom-supervision-infrastructure-reseau.webp");
  const faq=home.indexOf('id="questions-pole-telecom"');
  const light=home.indexOf('class="ds-two-univers"');
  assert.ok(hero>0&&second>hero&&faq>second&&light>faq);
  assert.equal((home.match(/<h1\b/g)||[]).length,1);
  assert.match(home,/PÔLE TELECOM &amp; RÉSEAU <span>EN PRÉPARATION/);
  assert.match(css,/\.ds-value-grid\{display:grid/);
  assert.match(css,/@media\(max-width:680px\)/);
});

test("solutions, Business Live and transition explain current status with useful internal paths",()=>{
  for(const [slug,required] of [
    ["solutions/","Quatre besoins, un parcours de préparation cohérent"],
    ["business-live/","VUE PÉDAGOGIQUE, PAS UNE CAPTURE DE DONNÉES RÉELLES"],
    ["transition/","Ce que nous vérifierions avec vous"],
    ["partenaires/","DES ENGAGEMENTS VÉRIFIABLES"]
  ]){
    const content=publishedDistributionHtml(read("site/distribution-sva/"+slug+"index.html"),state);
    assert.ok(content.includes(required),slug);
    assert.match(content,/href="\/distribution-sva\/conformite\/"|href="\/distribution-sva\/transition\/"|href="\/portabilite-numero-sva\/"/);
  }
});
