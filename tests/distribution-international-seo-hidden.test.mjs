import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const css=fs.readFileSync("site/distribution-sva/unified.css","utf8");
const home=fs.readFileSync("site/distribution-sva/index.html","utf8");
const en=fs.readFileSync("site/distribution-sva/en/index.html","utf8");
test("le sélecteur de langue est masqué uniquement par le CSS du pôle Distribution",()=>{
  assert.match(css,/body\.ds-unified \.ds-language-section/);
  assert.match(css,/body\.ds-unified \.ds-language-links/);
  assert.match(css,/display:none!important/);
});
test("les pages internationales et les liens hreflang restent en place",()=>{
  assert.match(home,/hreflang="en"/);
  assert.match(home,/hreflang="es"/);
  assert.match(home,/hreflang="pt"/);
  assert.match(home,/hreflang="de"/);
  assert.match(home,/hreflang="it"/);
  assert.match(en,/<html lang="en"/);
  assert.match(home,/noindex,nofollow,noarchive/);
});
