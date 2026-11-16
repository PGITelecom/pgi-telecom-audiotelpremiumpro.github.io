import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html=fs.readFileSync("site/distribution-sva/index.html","utf8");
const css=fs.readFileSync("site/distribution-sva/unified.css","utf8");
const headingItems=[
  "Continuité étudiée","Appels traçables","Suivi financier lisible",
  "Responsabilités identifiées"
];

test("mobile Distribution customer-value cards keep four complete readable entries",()=>{
  for(const heading of headingItems)assert.ok(html.includes("<h3>"+heading+"</h3>"));
  const grid=html.match(/<div class="ds-value-grid">([\s\S]*?)<\/div><\/div><\/section>/);
  assert.ok(grid,"value cards must remain present and in their original section");
  assert.equal((grid[1].match(/<article>/g)||[]).length,4);
  assert.equal((grid[1].match(/<a href=/g)||[]).length,4,"every card must retain its link");
  assert.equal((grid[1].match(/class="ds-value-emblem"/g)||[]).length,4);
});

test("compact spacing is scoped to small screens and the Distribution homepage only",()=>{
  const section=css.slice(css.indexOf("/* Compactage mobile des cartes éditoriales"));
  assert.match(section,/^\/\* Compactage mobile/);
  assert.match(section,/@media\(max-width:680px\)/);
  assert.match(section,/body\.home-page\.ds-unified \.ds-value-grid > article\{\s*display:grid;/);
  assert.match(section,/grid-template-columns:44px minmax\(0,1fr\)/);
  assert.match(section,/body\.home-page\.ds-unified \.ds-value-grid > article > h3\{/);
  assert.match(section,/grid-column:2;/);
  assert.match(section,/body\.home-page\.ds-unified \.ds-value-grid > article > p\{/);
  assert.match(section,/grid-column:1 \/ -1;/);
  assert.match(section,/body\.home-page\.ds-unified \.ds-value-grid > article > a\{/);
  assert.match(section,/min-height:30px/);
  assert.match(section,/body\.home-page\.ds-unified \.ds-profiles-grid > article/);
  assert.match(section,/body\.home-page\.ds-unified \.ds-features > article\.card/);
  assert.match(section,/body\.home-page\.ds-unified \.ds-geo-faq \.cards > \.card/);
  assert.match(section,/\.section-space:not\(\.ds-network-showcase\)/);
  assert.doesNotMatch(section,/display:none|visibility:hidden|overflow:hidden/);
});

test("the network photograph, fixed navigation and original wording are untouched",()=>{
  assert.match(html,/src="\/site\/distribution-sva\/pgi-telecom-pole-telecom-reseau-supervision-infrastructures\.webp"/);
  assert.match(html,/src="\/site\/distribution-sva\/telecom-hero\.webp"/);
  assert.match(html,/class="revenue-quick-nav"/);
  assert.match(html,/<h2 id="ds-profiles-title">À qui s'adresse le Pôle Telecom &amp; Réseau \?<\/h2>/);
});
