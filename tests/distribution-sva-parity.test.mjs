import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const load=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Distribution home adopts the actual SVA logo, searchable header, two golden CTAs and fixed 5-way mobile nav",()=>{
 const source=load("site/index.html");
 const html=load("site/distribution-sva/index.html");
 const css=load("site/distribution-sva/parity.css");
 for(const shared of ["brand brand-full","header-account-entry","hero-marketing-badge","hero-brand-signature","hero-service-line","hero-actions","hero-visual","hero-visual-brand","hero-visual-caption","trust-line","revenue-quick-nav","revenue-quick-tabs"]){
  assert.ok(source.includes(shared),shared+" must exist in SVA site");
  assert.ok(html.includes(shared),shared+" must be reused in Distribution");
 }
 assert.match(html,/href="\/site\/site\.css"/);
 assert.match(html,/src="\/site\/site-search\.js" defer/);
 assert.match(html,/data-site-search-input/);
 assert.match(html,/data-site-search-results/);
 assert.match(html,/aria-label="Rechercher sur le site PGI Telecom"/);
 assert.match(html,/class="btn" href="\/distribution-sva\/solutions\/"/);
 assert.match(html,/class="btn hero-portability-cta" href="\/distribution-sva\/transition\/"/);
 assert.equal((html.match(/class="revenue-quick-tab(?: [^"]*)?"/g)||[]).length,5);
 assert.match(css,/\.ds-parity \.hero h1/);
 assert.match(css,/\.ds-parity \.hero-actions \.btn/);
 assert.match(css,/@media\(max-width:380px\)/);
 assert.match(css,/\.ds-parity \.revenue-quick-nav\{position:fixed/);
});

test("photo used in the SVA-style hero is actually served from our site build",()=>{
 const html=load("site/distribution-sva/index.html");
 const builder=load("scripts/build-static.mjs");
 const image=fs.readFileSync(new URL("../site/distribution-sva/telecom-hero.webp",import.meta.url));
 assert.equal(image.subarray(0,4).toString(),"RIFF");
 assert.equal(image.subarray(8,12).toString(),"WEBP");
 assert.ok(image.length>3000);
 assert.match(html,/class="hero-visual-main" src="\/site\/distribution-sva\/telecom-hero\.webp"/);
 assert.match(builder,/cpSync\(path\.join\(root,"site","distribution-sva"\)/);
 assert.doesNotMatch(html,/images\.unsplash\.com/);
});

test("the launch preparation and pricing separation remain truthful",()=>{
 const html=load("site/distribution-sva/index.html");
 const js=load("site/distribution-sva/site.js");
 assert.match(html,/Distribution en préparation/);
 assert.match(html,/La distribution directe n'est pas encore activée/);
 assert.match(html,/Aucun numéro n'est actuellement proposé/);
 assert.match(html,/Le.+numéro/);
 assert.doesNotMatch(html,/4,90\s*€|créer mon compte distributeur|paiement immédiat/);
 assert.match(js,/data-ds-current-period/);
 assert.match(js,/Europe\/Paris/);
 assert.doesNotMatch(html,/\/api\/v1\/billing|\/api\/v1\/platform\/direct-sva\/switches/);
});
