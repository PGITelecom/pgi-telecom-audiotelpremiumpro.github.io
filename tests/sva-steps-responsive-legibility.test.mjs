import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css=fs.readFileSync("site/site.css","utf8");
const home=fs.readFileSync("site/index.html","utf8");
const section=css.split("/* SVA accueil | Étapes lisibles sur mobile et tablette (2026-10-16).")[1]||"";

test("four onboarding steps retain their original explicit HTML headings",()=>{
  const block=home.match(/<ol class="steps">([\s\S]*?)<\/ol>/)?.[1]||"";
  const titles=[...block.matchAll(/<li><span>(\d)<\/span><div><h3>([^<]+)<\/h3>/g)];
  assert.equal(titles.length,4);
  assert.deepEqual(titles.map(x=>x[1]),["1","2","3","4"]);
  assert.ok(titles.every(x=>x[2].trim().length>5));
});
test("SVA onboarding uses a spacious 2-column desktop layout",()=>{
  assert.match(section,/\.home-page \.steps-section \.steps\s*\{\s*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important;/);
  assert.match(section,/grid-template-columns:40px minmax\(0,1fr\)/);
});
test("SVA onboarding shows one readable card per row on mobile/tablet",()=>{
  assert.match(section,/@media \(max-width:1100px\)\s*\{[\s\S]*?\.home-page \.steps-section \.steps\s*\{\s*grid-template-columns:minmax\(0,1fr\)!important;/);
  assert.match(section,/@media \(max-width:420px\)/);
  assert.match(section,/grid-template-columns:36px minmax\(0,1fr\)/);
});
test("step title never wraps inside words or below its number",()=>{
  assert.match(section,/> li > span:first-child\s*\{[\s\S]*?grid-column:1;[\s\S]*?grid-row:1;/);
  assert.match(section,/> li > div\s*\{[\s\S]*?grid-column:2;[\s\S]*?grid-row:1;/);
  assert.match(section,/\.steps h3\s*\{[\s\S]*?overflow-wrap:normal!important;[\s\S]*?word-break:normal!important;/);
});
