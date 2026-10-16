import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html=fs.readFileSync("site/index.html","utf8");
const css=fs.readFileSync("site/site.css","utf8");
const patch=css.split("/* Lisibilité du parcours SVA sur mobile")[1]||"";

test("les quatre étapes SVA conservent leurs numéros, titres et explications",()=>{
  const section=html.split('<ol class="steps">')[1]?.split("</ol>")[0]||"";
  const cards=[...section.matchAll(/<li><span>(\d+)<\/span><div><h3>([^<]+)<\/h3><p>([^<]+)<\/p><\/div><\/li>/g)];
  assert.equal(cards.length,4);
  assert.deepEqual(cards.map(m=>m[1]),["1","2","3","4"]);
  for(const [, ,title,description] of cards){
    assert.ok(title.trim().length>10);
    assert.ok(description.trim().length>30);
  }
});

test("la grille est limitée à 2 colonnes sur tablette et 1 colonne sur téléphone",()=>{
  assert.ok(patch,"correctif non trouvé");
  assert.match(patch,/#fonctionnement \.steps\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
  assert.match(patch,/@media\(max-width:1100px\)\{\.home-page #fonctionnement \.steps\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(patch,/@media\(max-width:700px\)\{[\s\S]*?\.home-page #fonctionnement \.steps\{grid-template-columns:minmax\(0,1fr\)!important/);
});

test("titres et paragraphes lisibles sans mots cassés",()=>{
  assert.match(patch,/#fonctionnement \.steps h3\{font-size:17px/);
  assert.match(patch,/#fonctionnement \.steps p\{font-size:14px/);
  assert.match(patch,/word-break:normal!important;overflow-wrap:normal!important;hyphens:none/);
  assert.match(patch,/#fonctionnement \.steps h3\{font-size:18px/);
  assert.match(css,/\.steps li:has\(> span:first-child \+ div\)/,"le badge reste à côté de son titre");
});

test("aucune refonte des CTA, opérateurs, paiements ou des autres pages",()=>{
  assert.ok(patch.startsWith(" : des cartes assez larges") || patch.includes("jamais 4 colonnes étroites"));
  assert.doesNotMatch(patch,/footer|billing|stripe|\.ds-|\.hero|\.btn|\.price/);
  const vercel=JSON.parse(fs.readFileSync("vercel.json","utf8"));
  assert.equal(vercel.git.deploymentEnabled["**"],false);
  assert.equal(vercel.git.deploymentEnabled.main,true);
});
