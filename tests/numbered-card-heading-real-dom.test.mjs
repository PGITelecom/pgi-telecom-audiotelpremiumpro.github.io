import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {publishedDistributionHtml} from "../backend/src/direct-sva-public-site.mjs";

const distCss=fs.readFileSync("site/distribution-sva/unified.css","utf8");
const svaCss=fs.readFileSync("site/site.css","utf8");
const distHome=fs.readFileSync("site/distribution-sva/index.html","utf8");
const published=publishedDistributionHtml(distHome,{publication_authorized:true,navigation_visible:true,commercial_requests_enabled:false});

test("capture mobile: les deux cartes deviennent des liens et conservent leur repère + titre",()=>{
  const cards=[...published.matchAll(/<a class="ds-universe-link"[^>]*>([\s\S]*?)<\/a>/g)];
  assert.equal(cards.length,2);
  assert.match(cards[0][1],/<span class="ds-unit-icon"[^>]*>01<\/span><strong>Audiotel Premium Pro<\/strong>/);
  assert.match(cards[1][1],/<span class="ds-unit-icon"[^>]*>02<\/span><strong>PGI Telecom Distribution<\/strong>/);
  assert.match(cards[0][1],/class="ds-universe-arrow"/);
  assert.match(cards[1][1],/class="ds-universe-arrow"/);
});
test("CSS du rendu réel aligne numéro et intitulé sur une seule rangée",()=>{
  assert.match(distCss,/body\.ds-unified \.ds-two-columns > :is\(div, a\.ds-universe-link\)\s*\{[\s\S]*?grid-template-columns:43px minmax\(0,1fr\);/);
  assert.match(distCss,/\.ds-two-columns > :is\(div, a\.ds-universe-link\) > \.ds-unit-icon\s*\{\s*grid-column:1;\s*grid-row:1;/);
  assert.match(distCss,/\.ds-two-columns > :is\(div, a\.ds-universe-link\) > strong\s*\{\s*grid-column:2;\s*grid-row:1;/);
  assert.match(distCss,/\.ds-two-columns > :is\(div, a\.ds-universe-link\) > p\s*\{\s*grid-column:1 \/ -1;\s*grid-row:2;/);
  assert.doesNotMatch(distCss,/white-space:nowrap/);
});
test("toutes les cartes fonctionnelles numérotées du Pôle sont couvertes",()=>{
  const badges=[...published.matchAll(/<span class="ds-feature-symbol"[^>]*>0[1-9]<\/span><h3>[^<]+<\/h3>/g)];
  assert.equal(badges.length,5);
  assert.match(distCss,/body\.ds-unified \.ds-features > article\.card:has\(> \.ds-feature-symbol \+ h3\)/);
  assert.match(distCss,/\.ds-feature-symbol\s*\{\s*grid-column:1;\s*grid-row:1;/);
  assert.match(distCss,/\.ds-features > article\.card:has\(> \.ds-feature-symbol \+ h3\) > h3\s*\{\s*grid-column:2;\s*grid-row:1;/);
});
test("pages SVA, juridique inclus, gardent l'alignement des repères à 2 et 3 chiffres",()=>{
  assert.match(svaCss,/\.benefit-grid article:has\(> span:first-child \+ h3\)/);
  assert.match(svaCss,/grid-template-columns:34px minmax\(0,1fr\)/);
  assert.match(svaCss,/\.benefit-grid article:has\(> span:first-child \+ h3\) > h3\s*\{\s*grid-column:2;\s*grid-row:1;/);
  const legal=fs.readFileSync("site/seo/conditions-abonnement.html","utf8");
  assert.match(legal,/<article><span>01<\/span><h3>Champ d’application<\/h3>/);
  assert.match(legal,/<article><span>101<\/span><h3>Portabilité prioritaire/);
  assert.match(svaCss,/\.steps li:has\(> span:first-child \+ div\)/);
});
