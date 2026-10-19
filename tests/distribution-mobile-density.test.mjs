import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const css=read("site/distribution-sva/unified.css");
const page=read("site/distribution-sva/interconnexion-routage/index.html");
const home=read("site/distribution-sva/index.html");
const responsive=css.slice(css.indexOf("/* Fiches editoriales du Pole : rythme mobile"));

test("mobile editorial spacing is scoped to non-home Distribution pages",()=>{
  assert.ok(responsive.startsWith("/* Fiches editoriales du Pole"));
  assert.match(responsive,/@media\(max-width:760px\)/);
  assert.match(responsive,/body\.ds-unified:not\(\.home-page\) main \.hero\{padding:26px 0 16px\}/);
  assert.match(responsive,/body\.ds-unified:not\(\.home-page\) main \.section-space\{padding:20px 0 28px\}/);
  assert.doesNotMatch(responsive,/revenue-quick|site-header|ds-network-showcase|\.hero-photographic/);
});

test("small screens keep readable modest title, card, notice and paragraph sizes",()=>{
  assert.match(responsive,/main \.section-space>\.wrap>h2\{font-size:clamp\(23px,5\.8vw,27px\)/);
  assert.match(responsive,/main \.section-space \.cards>\.card>h2\{font-size:19px/);
  assert.match(responsive,/main \.section-space \.cards>\.card>p\{font-size:13\.5px/);
  assert.match(responsive,/main \.hero>\.wrap>\.notice\{[^}]*font-size:13px/);
  assert.match(responsive,/main \.hero \.lead,\s*body\.ds-unified:not\(\.home-page\) main \.hero \.hero-lead\{font-size:15px/);
});

test("interconnection article and Pole homepage source stay intact",()=>{
  assert.match(page,/Comprendre les principaux enjeux/);
  assert.match(page,/Choix des interfaces/);
  assert.match(page,/Activité future non commercialisée/);
  assert.match(home,/Pôle Télécom &amp; Réseau/);
  assert.match(css,/body\.ds-unified \.revenue-quick-nav\{position:fixed!important/);
});
