import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const file=x=>fs.readFileSync(new URL("../"+x,import.meta.url),"utf8");

test("existing SVA pages gain practical guides without changing their commercial structure",()=>{
 const cases=[
  {slug:"changer-operateur-audiotel",id:"checklist-portabilite",links:["/comparateur-audiotel/","/portabilite-numero-sva/","/demande-ouverture/?type=portabilite"]},
  {slug:"reversement-audiotel",id:"lire-releve-reversement",links:["/comparateur-audiotel/","/business-live-audiotel/","/combien-rapporte-numero-surtaxe/"]}
 ];
 for(const c of cases){
  const html=file("site/seo/"+c.slug+".html");
  const section=html.split('id="'+c.id+'"')[1]?.split("</section>")[0]||"";
  assert.ok(section.length>1500,c.slug+" must give substantial guidance");
  assert.equal((section.match(/<article>/g)||[]).length,4,c.slug+" practical checks");
  for(const link of c.links)assert.ok(section.includes('href="'+link+'"'),c.slug+" destination "+link);
  assert.equal((html.match(/<h1\b/g)||[]).length,1,c.slug+" heading unchanged");
  assert.ok(html.includes('name="robots" content="index,follow'),c.slug+" still indexable");
  assert.ok(html.includes('class="final-cta"'),c.slug+" existing conversion kept");
  assert.ok(html.indexOf('id="'+c.id+'"')<html.indexOf('class="final-cta"'),c.slug+" guide before CTA");
 }
});
test("SVA homepage, pricing, payment and account remain outside the editorial change set",()=>{
 const homepage=file("site/index.html");
 assert.match(homepage,/4,90/);
 assert.match(homepage,/href="\/portabilite-numero-sva\/"/);
 assert.match(homepage,/href="\/comparateur-audiotel\/"/);
 assert.ok(file("scripts/build-static.mjs").includes('"paiement-cb-audiotel"'));
});
