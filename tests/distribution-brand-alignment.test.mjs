import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Distribution keeps precisely the same brown and gold palette as Audiotel SVA",()=>{
 const source=read("site/site.css");
 const global=read("site/distribution-sva/style.css");
 const brand=read("site/distribution-sva/brand.css");
 for(const [mainName,distributionName,value] of [["--bg","--bg","#17100d"],["--panel","--panel","#2a1d18"],["--gold","--accent","#e8b36e"]]){
  assert.ok(source.includes(mainName+":"+value),mainName+" main site token");
  assert.ok(global.includes(distributionName+":"+value),distributionName+" Distribution token");
 }
 assert.match(brand,/\.ds-two-univers/);
 assert.match(brand,/\.ds-feature-symbol/);
 assert.match(brand,/\.ds-hero-photo/);
 assert.match(brand,/\.ds-launch-note/);
});

test("the genuine Distribution webpage loads the matching stylesheet and the telecom photo",()=>{
 const html=read("site/distribution-sva/index.html");
 const builder=read("scripts/build-static.mjs");
 assert.match(html,/<link rel="stylesheet" href="\/site\/distribution-sva\/style\.css">/);
 assert.match(html,/<link rel="stylesheet" href="\/site\/distribution-sva\/brand\.css">/);
 assert.match(html,/<figure class="hero-visual">/);
 assert.match(html,/class="hero-marketing-badge"/);
 assert.match(html,/class="site-header ds-main-header"/);
 assert.match(html,/data-site-search/);
 assert.match(html,/class="revenue-quick-nav"/);
 assert.match(html,/<img src="https:\/\/images\.unsplash\.com\/photo-/);
 assert.match(html,/alt="Antenne de télécommunications au coucher du soleil/);
 assert.match(html,/PGI Telecom Distribution/);
 assert.match(html,/EN OCTOBRE 2026/);
 assert.match(html,/<meta name="robots" content="noindex,nofollow,noarchive">/);
 assert.match(html,/Aucun numéro n'est actuellement proposé/);
 assert.match(html,/La distribution directe n'est pas encore activée/);
 assert.match(builder,/cpSync\(path\.join\(root,"site","distribution-sva"\)/);
});

test("mobile navigation and feature cards fit narrow phones with tappable controls",()=>{
 const html=read("site/distribution-sva/index.html"),brand=read("site/distribution-sva/brand.css");
 assert.match(html,/<details class="ds-mobile-menu">/);
 assert.match(html,/<nav class="ds-mobile-links"/);
 assert.match(brand,/@media\(max-width:840px\)/);
 assert.match(brand,/@media\(max-width:560px\)/);
 assert.match(brand,/@media\(max-width:350px\)/);
 assert.match(brand,/min-height:48px/);
 assert.match(brand,/grid-template-columns:minmax\(0,1fr\)/);
 assert.match(brand,/\.actions\{display:grid/);
 assert.match(brand,/\.ds-two-columns,.ds-features\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(brand,/focus/);
});

test("the direct SVA brand refresh does not change Audiotel payment or SVA activation",()=>{
 const html=read("site/distribution-sva/index.html");
 const js=read("site/distribution-sva/site.js");
 assert.doesNotMatch(html,/create-checkout|checkout\.stripe|paiement\/commencer|\/api\/v1\/billing/i);
 assert.match(js,/Aucune demande envoyée/);
 assert.doesNotMatch(html,/numéros immédiatement disponibles|paiements activés|reversements garantis/);
});
