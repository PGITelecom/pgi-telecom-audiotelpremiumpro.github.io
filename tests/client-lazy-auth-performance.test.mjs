import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const premium=fs.readFileSync("assets/client-premium.js","utf8");
const analytics=fs.readFileSync("assets/client-analytics-plus.js","utf8");

test("customer-only extensions are requested after portal data arrives",()=>{
  assert.match(premium,/document\.addEventListener\("pgi:portal-loaded",loadCommandCenter,\{once:true\}\)/);
  assert.match(premium,/if\(window\.PGIClientPortalData\)loadCommandCenter\(\)/);
  assert.doesNotMatch(premium,/setTimeout\(function\(\)\{import\("\.\/client-experience-command-center\.js"\)/);
  assert.match(analytics,/function loadAuthenticatedExtras\(\)/);
  assert.match(analytics,/if\(window\.PGIClientPortalData\)\{/);
  assert.match(analytics,/loadAuthenticatedExtras\(\)/);
});
