import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css=fs.readFileSync("site/site.css","utf8");
const home=fs.readFileSync("site/index.html","utf8");

test("comparator monthly gain is green, underlined, and its label is white",()=>{
  assert.match(home,/class="main"><span>Gain potentiel en plus \/ mois<\/span><strong id="saving-month">/);
  assert.match(css,/\.home-page \.hero-savings-results \.main span\{color:#fff!important\}/);
  assert.match(css,/\.home-page \.hero-savings-results \.main strong\{color:#36c878!important;text-decoration:underline/);
});
test("SVA mobile hero image caption stays visible and readable",()=>{
  assert.match(css,/@media\(max-width:680px\)\{\s*\.home-page \.hero-visual-caption\{[^}]*background:rgba\(13,11,10,\.9\)/);
  assert.match(css,/\.home-page \.hero-visual-caption strong\{font-size:13px;line-height:1\.45;font-weight:700;color:#fff!important/);
  assert.match(home,/class="hero-visual-caption"/);
});
