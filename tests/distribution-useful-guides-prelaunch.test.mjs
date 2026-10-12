import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const get=x=>fs.readFileSync(new URL("../site/distribution-sva/"+x+"/index.html",import.meta.url),"utf8");

test("prelaunch Distribution guides are useful, honest, and remain embargoed",()=>{
 const guides=[
  ["transition","guide-transition-controles",["/distribution-sva/numerotation/","/distribution-sva/releves-reversements/"]],
  ["releves-reversements","guide-verification-releves",["/distribution-sva/business-live/","/distribution-sva/conformite/"]]
 ];
 for(const [slug,id,links] of guides){
  const html=get(slug),section=html.split('id="'+id+'"')[1]?.split("</section>")[0]||"";
  assert.ok(section.length>1400,slug+" guide has meaningful details");
  assert.equal((section.match(/<article class="card">/g)||[]).length,4,slug+" checklist");
  for(const target of links)assert.ok(section.includes('href="'+target+'"'),slug+" linked guide");
  assert.equal((html.match(/<h1\b/g)||[]).length,1,slug+" original H1 remains");
  assert.ok(html.includes('content="noindex,nofollow,noarchive"'),slug+" no premature search indexing");
  assert.match(section,/pas encore ouvert|n’est pas encore ouvert|Aucun encaissement|Aucune migration réelle/i,slug+" realistic release status");
  assert.ok(!section.includes('href="/distribution-sva/espace-client/"'),slug+" no private portal");
 }
});
