import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const home=file("site/index.html");
const biz=file("site/seo/business-live-audiotel.html");
const lead=file("site/seo/demande-ouverture.html");
const css=file("site/site.css");
const deployment=JSON.parse(file("vercel.json"));
test("SVA: 4 principes commerciaux vérifiables et parcours inchangés",()=>{
 assert.equal((home.match(/class="sva-confidence-index"/g)||[]).length,4);
 for(const term of ["Conditions transparentes","Continuité du numéro","Traçabilité financière","Demande centralisée","Pour qui ?","Qui est responsable ?"])assert.ok(home.includes(term),term);
 for(const url of ["/demande-ouverture/","/guide-audiotel-sva/","/mentions-legales/","/portabilite-numero-sva/"])assert.ok(home.includes('href="'+url+'"'),url);
 assert.ok(home.includes('id="simulateur"'));
 assert.ok(home.includes('id="tarif"'));
 assert.ok(home.includes('id="comparatif-offre"'));
 assert.ok(home.includes('class="header-distribution-link" href="/distribution-sva/" hidden'));
});
test("SVA: transparence sur les montants et sans activation prématurée",()=>{
 for(const term of ["montant estimé","conditions définitives","aucun paiement immédiat","Les validations d’éligibilité"])assert.ok((home+" "+lead).toLowerCase().includes(term.toLowerCase()),term);
 assert.ok(lead.includes('id="order-form"'));
 assert.ok(lead.includes('name="processing_consent"'));
 assert.ok(lead.includes('name="marketing_consent"'));
});
test("Business Live: illustration non contractuelle sans données privées",()=>{
 for(const term of ["APERÇU PÉDAGOGIQUE","ILLUSTRATION · AUCUNE DONNÉE CLIENT","Estimation","Confirmation","Validation","Pas de chiffres fictifs"])assert.ok(biz.includes(term),term);
 assert.ok(!biz.includes("data-customer-id"));
});
test("Mobile: mise en page isolée sans changement de Distribution",()=>{
 assert.ok(css.includes(".home-page .sva-confidence-grid"));
 assert.ok(css.includes(".conversion-page .sva-preview"));
 assert.ok(css.includes("@media(max-width:700px)"));
 assert.ok(!css.slice(css.indexOf("/* Améliorations SVA 2026-10-23")).includes(".distribution-sva"));
});
test("Vercel: aucune publication automatique hors main",()=>{
 assert.equal(deployment.git.deploymentEnabled["**"],false);
 assert.equal(deployment.git.deploymentEnabled.main,true);
});
