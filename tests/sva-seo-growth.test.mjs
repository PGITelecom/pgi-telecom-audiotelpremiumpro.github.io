import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=file=>fs.readFileSync(path.join(ROOT,file),"utf8");
const build=read("scripts/build-static.mjs");
const slugs=Array.from((/const seoPages=\[([\s\S]*?)\];/.exec(build)||[])[1]?.matchAll(/"([^"]+)"/g)||[],m=>m[1]);
const findRawSlug=slug=>read("site/seo/"+slug+".html");

test("all SVA landing pages have a valid basic semantic and crawlable foundation",()=>{
 assert.ok(slugs.length>=25,"the marketing SEO inventory must not accidentally shrink");
 assert.equal(new Set(slugs).size,slugs.length,"duplicate SEO page slugs");
 for(const slug of slugs){
  const html=findRawSlug(slug);
  assert.match(html,/<html lang="fr">/i,slug+" language declaration");
  assert.match(html,/<title>[^<]+<\/title>/i,slug+" title");
  assert.match(html,/<meta name="description" content="[^"]{60,}"/i,slug+" description");
  assert.match(html,/<link rel="canonical" href="[^"]+"/i,slug+" canonical");
  assert.ok((html.match(/<h1\b/gi)||[]).length>=1,slug+" must have a semantic H1");
  assert.match(html,/content="index,follow/,slug+" indexed marketing page");
 }
});

test("GSC-priority search intents receive distinct, accurate page-level snippets",()=>{
 const cases=[
  {slug:"changer-operateur-audiotel",title:"Changer d’opérateur Audiotel : étapes et portabilité",description:"Comparez les reversements"},
  {slug:"paiement-cb-audiotel",title:"Paiement CB pour consultations téléphoniques",description:"Encaissez des consultations ou forfaits"},
  {slug:"audiotel-professionnels",title:"Numéro surtaxé professionnel",description:"Numéro Audiotel professionnel"}
 ];
 for(const {slug,title,description} of cases){
  const entry=new RegExp('"'+slug.replaceAll("-","\\-")+'":\\{title:"([^"]+)",description:"([^"]+)"\\}').exec(build);
  assert.ok(entry,slug+" SEO override");
  assert.ok(entry[1].includes(title),slug+" unique search-intent title");
  assert.ok(entry[2].includes(description),slug+" helpful search-intent snippet");
  assert.ok(entry[1].length>=30&&entry[1].length<=95,slug+" title readable");
  assert.ok(entry[2].length>=90&&entry[2].length<=220,slug+" meaningful description");
  assert.doesNotMatch(entry[2],/garanti|numéro disponible immédiatement|meilleur prix du marché/i,"no unsupported promise");
 }
});

test("high-value SVA pages receive relevant crawlable, non-duplicative internal links",()=>{
 const graphStart=build.indexOf("const internalLinkGraph=Object.freeze(");
 const graphEnd=build.indexOf("function internalLinkHref(",graphStart);
 assert.ok(graphStart>=0&&graphEnd>graphStart);
 const graph=build.slice(graphStart,graphEnd);
 assert.match(graph,/\["changer-operateur-audiotel","Changer d’opérateur Audiotel sans perdre son numéro"/);
 assert.match(graph,/\["audiotel-coaching","Paiement CB et consultations téléphoniques"/);
 const entries=[...graph.matchAll(/\["([^"]+)","([^"]+)","([^"]+)"\]/g)];
 for(const [,destination,anchor,summary] of entries){
  assert.ok(slugs.includes(destination),destination+" must be a real static SEO page");
  assert.ok(anchor.length>14&&summary.length>15,destination+" meaningful anchor & description");
  assert.doesNotMatch(anchor,/cliquez ici|en savoir plus|page [0-9]+/i);
 }
 assert.ok(entries.length>=65,"existing contextual internal network must stay intact");
});

test("homepage remains the same commercial SVA business, with no early Distribution launch",()=>{
 const home=read("site/index.html");
 assert.match(home,/Monétisez vos appels/);
 assert.match(home,/4,90/);
 assert.match(home,/href="\/portabilite-numero-sva\/"/);
 assert.match(home,/href="\/comparateur-audiotel\/"/);
 assert.match(build,/\"sitemap\.xml\"/);
 assert.match(build,/\"robots\.txt\"/);
 assert.doesNotMatch(build,/\\bnoindex\\b.*?site\\/index\\.html/);
});
