import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {DIRECT_SVA_SEO_INVENTORY} from "../scripts/direct-sva-seo-plan.mjs";
import {publishedDistributionHtml} from "../backend/src/direct-sva-public-site.mjs";

const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const publications=DIRECT_SVA_SEO_INVENTORY.filter(p=>!p.private);
const legal=new Set(["conditions/","mentions-legales/","confidentialite/","reclamations/"]);
const editorial=publications.filter(p=>!legal.has(p.suffix));
const decode=s=>String(s||"").replaceAll("&amp;","&").replaceAll("&quot;",'"').replaceAll("&#39;","'");

test("Distribution descriptions across French and five localized editorial paths are substantial, structured and truthful",()=>{
 assert.equal(publications.length,35);
 assert.equal(editorial.length,31,"31 editorial pages; keep legal/complaints copy separately reviewed");
 const seenMeta=new Map();
 for(const p of editorial){
  const path="site/distribution-sva/"+p.suffix+"index.html";
  const html=read(path);
  const locale=p.lang;
  assert.match(html,new RegExp('<html lang="'+locale+'"'),path+" language");
  const description=decode(/<meta name="description" content="([^"]+)"/.exec(html)?.[1]);
  assert.ok(description.length>=80&&description.length<=230,path+" substantive and concise meta description");
  assert.ok(!seenMeta.has(description),path+" unique page intent; duplicate "+seenMeta.get(description));
  seenMeta.set(description,path);
  const lead=decode((p.suffix===""?/<p class="hero-lead hero-lead-simple">([\s\S]*?)<\/p>/:/<p class="lead">([\s\S]*?)<\/p>/).exec(html)?.[1]);
  assert.ok(lead.length>=210,path+" meaningful, customer-oriented introduction");
  assert.ok((html.match(/<h1\b/gi)||[]).length===1,path+" one H1");
  assert.match(html,/<link rel="canonical" href="https:\/\/audiotel-premium-pro\.com\/distribution-sva\//,path+" canonical");
  assert.match(html,/<meta name="robots" content="noindex,nofollow,noarchive"/,path+" draft publication restriction");
  const social=/<meta property="og:description" content="([^"]+)"/.exec(html)?.[1];
  if(social)assert.equal(decode(social),description,path+" Open Graph describes the same page");
  const data=/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1];
  if(data){
   const parsed=JSON.parse(data),items=parsed["@graph"]||[parsed];
   for(const item of items){
    if(["WebPage","CollectionPage"].includes(item["@type"])&&item.description)
     assert.equal(item.description,description,path+" semantic WebPage statement matches meta");
   }
  }
 }
});

test("the flagship Distribution landing makes only verifiable, pre-launch claims",()=>{
 const home=read("site/distribution-sva/index.html");
 assert.match(home,/Pôle Telecom &amp; Réseau prépare un cadre de distribution SVA/);
 assert.match(home,/responsabilités identifiées/);
 assert.match(home,/distinguer les sommes estimées, confirmées et réellement exigibles/);
 assert.match(home,/Aucune attribution de numéro ni aucun reversement n'est présenté comme acquis/);
 assert.match(home,/Les deux offres ont des périmètres différents/);
 assert.doesNotMatch(home,/>Deux univers sans mélange</);
 assert.doesNotMatch(home,/Nous ne promettons ni numéro immédiatement disponible/);
 const shell=read("backend/src/direct-sva-visual-shell.mjs");
 assert.match(shell,/la traçabilité des appels et la transparence des reversements/);
 const rendered=publishedDistributionHtml(home,{publication_authorized:true,navigation_visible:true,commercial_requests_enabled:false});
 assert.match(rendered,/class="ds-hero-photographic-copy"/);
 assert.match(rendered,/la continuité de vos numéros/);
 assert.match(rendered,/href="\/distribution-sva\/conformite\/"/);
 assert.doesNotMatch(rendered,/href="\/distribution-sva\/espace-client\/"/,"no private client portal marketing link");
});

test("critical supporting pages explain rights, eligibility, traces and actual settlement conditions",()=>{
 const pages={
  "solutions/":/distribution directe n.est pas commercialisée à ce stade/,
  "business-live/":/son éventuelle extension à la distribution directe dépend encore/,
  "transition/":/Aucune migration Distribution n.est actuellement proposée/,
  "conformite/":/Aucun service ni versement direct ne sera activé avant les contrôles requis/,
  "numerotation/":/sans annoncer de disponibilité ni de transfert avant confirmation/,
  "architecture-reseau/":/des contrôles à valider avant toute mise en exploitation/,
  "interconnexion-routage/":/efficacité devra être démontrée avant toute ouverture/,
  "releves-reversements/":/contestation.*avant tout versement autorisé/,
  "partenaires/":/Aucun partenariat, volume d'appels ou niveau de service n'est présenté comme acquis/,
  "questions-frequentes/":/sans confondre fonctionnalités prévues et services disponibles/
 };
 for(const [slug,re] of Object.entries(pages))assert.match(read("site/distribution-sva/"+slug+"index.html"),re,slug+" transparent statement");
});
