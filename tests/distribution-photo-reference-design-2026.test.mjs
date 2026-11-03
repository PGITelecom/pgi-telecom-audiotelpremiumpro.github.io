import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {renderDirectSvaVisualShell} from "../backend/src/direct-sva-visual-shell.mjs";

const source=fs.readFileSync(new URL("../site/distribution-sva/index.html",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../site/distribution-sva/unified.css",import.meta.url),"utf8");
const html=renderDirectSvaVisualShell(source);

test("Pôle keeps the real original network-tower photo, without a generated replacement",()=>{
 assert.equal((html.match(/class="ds-network-tower"/g)||[]).length,1);
 assert.match(html,/src="\/site\/distribution-sva\/telecom-hero\.webp"/);
 assert.match(html,/class="ds-hero-photographic"/);
 assert.match(html,/Une organisation télécom pensée pour la continuité de vos numéros/);
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.match(css,/mask-image:none!important/);
 assert.match(css,/body\.home-page\.ds-unified \.ds-hero-photographic/);
});

test("Pôle period label remains dynamically dated with a gold light flare",()=>{
 assert.match(html,/data-ds-current-period/);
 assert.match(css,/body\.home-page\.ds-unified \.hero-marketing-badge::after/);
 assert.match(css,/radial-gradient\(ellipse/);
 assert.match(css,/border:1px solid rgba\(255,197,103/);
});

test("Pôle fixed navigation has five accessible destinations and decorative icons",()=>{
 const nav=html.match(/<section class="revenue-quick-nav"[\s\S]*?<\/section>/)?.[0];
 assert.ok(nav);
 assert.equal((nav.match(/class="revenue-quick-tab(?:\s|")/g)||[]).length,5);
 assert.equal((nav.match(/class="ds-tab-icon" aria-hidden="true"/g)||[]).length,5);
 assert.equal((nav.match(/<svg viewBox=/g)||[]).length,5);
 for(const dest of ["/distribution-sva/","/distribution-sva/solutions/","/distribution-sva/business-live/","/distribution-sva/transition/","/"]){
  assert.ok(nav.includes('href="'+dest+'"'),dest);
 }
 for(const label of ["PRÉSENTATION","SOLUTIONS","SUIVI","PORTABILITÉ","SERVICE ACTUEL"]){
  assert.ok(nav.includes(label),label);
 }
 assert.match(css,/body\.ds-unified \.revenue-quick-tab \.ds-tab-icon/);
 assert.match(css,/body\.ds-unified \.revenue-quick-tab\{/);
 assert.match(css,/@media\(max-width:760px\)/);
});

test("Pôle commercial and private customer protections remain unchanged",()=>{
 assert.ok(!html.includes('href="/distribution-sva/espace-client/"'));
 assert.match(html,/La distribution directe n'est pas encore ouverte/);
 assert.match(html,/Souscription directe non ouverte/);
 assert.match(html,/revenue-quick-tab-primary/);
});
