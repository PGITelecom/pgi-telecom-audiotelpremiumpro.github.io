import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const home=file("site/index.html");
const solutions=file("site/seo/solutions-audiotel.html");
const biz=file("site/seo/business-live-audiotel.html");
const lead=file("site/seo/demande-ouverture.html");
const css=file("site/site.css");
const deployment=JSON.parse(file("vercel.json"));
test("SVA : identité, publics, transparence et 4 engagements",()=>{
 assert.ok(home.includes('href="/solutions-audiotel/#pourquoi-pgi-sva"'));
 for(const term of ["Conditions transparentes","Continuité du numéro","Traçabilité financière","Demande centralisée","Particuliers","mentions légales","sans paiement immédiat"])assert.ok(solutions.toLowerCase().includes(term.toLowerCase()),term);
 assert.equal((solutions.match(/<article><span>0[1-4]<\/span><h3>/g)||[]).length>=4,true);
 for(const target of ["/mentions-legales/","/guide-audiotel-sva/","/demande-ouverture/"])assert.ok(solutions.includes('href="'+target+'"'),target);
});
test("SVA : parcours existants, consentements et séparation des activités",()=>{
 for(const id of ['id="simulateur"','id="tarif"','id="comparatif-offre"'])assert.ok(home.includes(id),id);
 assert.ok(home.includes('class="header-distribution-link" href="/distribution-sva/" hidden'));
 assert.ok(lead.includes('id="order-form"'));
 assert.ok(lead.includes('name="processing_consent"'));
 assert.ok(lead.includes('name="marketing_consent"'));
 assert.ok(lead.includes("demande transmise après confirmation du serveur"));
});
test("Business Live : aperçu explicatif sans fausses données client",()=>{
 for(const term of ["APERÇU PÉDAGOGIQUE","AUCUNE DONNÉE CLIENT","Estimation","Confirmation","Validation","versement effectivement reçu"])assert.ok(biz.includes(term),term);
 assert.ok(!biz.includes("data-customer-id"));
});
test("Performance : feuilles existantes et aucune nouvelle dépendance",()=>{
 assert.ok(css.includes("benefit-grid"));
 assert.ok(!home.includes("sva-confidence-grid"));
 assert.ok(!biz.includes("sva-preview-grid"));
});
test("Déploiement : seulement main et jamais cette branche",()=>{
 assert.equal(deployment.git.deploymentEnabled["**"],false);
 assert.equal(deployment.git.deploymentEnabled.main,true);
});
