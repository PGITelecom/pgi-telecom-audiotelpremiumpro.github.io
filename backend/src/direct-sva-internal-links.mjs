// Contextual internal linking for PGI Telecom Distribution.
// Distinct from the Audiotel Premium Pro site, without new commercial claims.
// Whitelist every destination from the public, editorial SEO inventory.
import {DIRECT_SVA_SEO_INVENTORY} from "../../scripts/direct-sva-seo-plan.mjs";
const PUBLIC=new Set(DIRECT_SVA_SEO_INVENTORY.filter(x=>!x.private).map(x=>"/distribution-sva/"+x.suffix));
const ROOT="/distribution-sva/";
const url=suffix=>ROOT+suffix;
const escape=s=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const entries=[
 ["solutions/","Solutions et services télécoms préparés","Vue d’ensemble des fonctions futures, sans commercialisation"],
 ["business-live/","Business Live et continuité du suivi","Comprendre les données téléphoniques et les indicateurs"],
 ["transition/","Portabilité et continuité des numéros","Conditions et étapes d’un éventuel changement d’opérateur"],
 ["conformite/","Conformité de la distribution SVA","Vérifications contractuelles, éditoriales et opérationnelles"],
 ["architecture-reseau/","Architecture réseau et supervision","Rôles des opérateurs et contrôle des incidents"],
 ["numerotation/","Numérotation SVA et attribution","Origine, affectation, droits et traçabilité des numéros"],
 ["interconnexion-routage/","Interconnexion et routage des appels","Interfaces opérateurs, tests et continuité du service"],
 ["releves-reversements/","Relevés d’appels et reversements","CDR, rapprochements et montants confirmés"],
 ["partenaires/","Partenaires opérateurs télécoms","Responsabilités et relations contractuelles futures"],
 ["questions-frequentes/","Questions fréquentes sur PGI Telecom Distribution","Réponses sur la préparation et les limites du projet"],
 ["reclamations/","Réclamations et portabilité","Droits, suivi des demandes et recours"]
];
const TOPICS=new Map(entries.map(([suffix,title,description])=>[url(suffix),{url:url(suffix),title,description}]));
// Short, subject-driven clusters. The existing global navigation is handled separately.
// Do not send editorial visitors to /distribution-sva/espace-client/ (private).
const FR_RELATED={
 "solutions/":["numerotation/","interconnexion-routage/","releves-reversements/","architecture-reseau/"],
 "business-live/":["releves-reversements/","numerotation/","solutions/"],
 "transition/":["numerotation/","interconnexion-routage/","conformite/"],
 "conformite/":["partenaires/","numerotation/","reclamations/"],
 "architecture-reseau/":["interconnexion-routage/","partenaires/","solutions/"],
 "numerotation/":["transition/","solutions/","conformite/"],
 "interconnexion-routage/":["architecture-reseau/","transition/","solutions/"],
 "releves-reversements/":["business-live/","solutions/","transition/"],
 "partenaires/":["conformite/","architecture-reseau/","solutions/"],
 "questions-frequentes/":["solutions/","conformite/","transition/"],
 "reclamations/":["transition/","conformite/"],
 // Legal documents are intentionally not stuffed with commercial links.
 "conditions/":[], "mentions-legales/":[], "confidentialite/":[]
};
const LOCALES={
 en:{solutions:"Solutions in preparation",faq:"Questions about the project",partners:"Telecom operator partnerships",home:"Telecom & Network overview",desc:{solutions:"Technical capabilities being prepared",faq:"Clear answers before commercial launch",partners:"Contractual responsibilities and future partnerships",home:"Understand the proposed Distribution division"}},
 es:{solutions:"Soluciones en preparación",faq:"Preguntas sobre el proyecto",partners:"Socios operadores de telecomunicaciones",home:"Presentación de Telecomunicaciones y Red",desc:{solutions:"Funciones técnicas previstas",faq:"Respuestas antes de la apertura comercial",partners:"Responsabilidades y futuras colaboraciones",home:"Conocer la futura división de distribución"}},
 pt:{solutions:"Soluções em preparação",faq:"Perguntas sobre o projeto",partners:"Parceiros operadores de telecomunicações",home:"Apresentação de Telecomunicações e Rede",desc:{solutions:"Funcionalidades técnicas previstas",faq:"Respostas antes da abertura comercial",partners:"Responsabilidades e futuras parcerias",home:"Conhecer a futura divisão de distribuição"}},
 de:{solutions:"Geplante Lösungen",faq:"Fragen zum Vorhaben",partners:"Partner aus der Telekommunikation",home:"Überblick Telekommunikation und Netz",desc:{solutions:"Technische Funktionen in Vorbereitung",faq:"Antworten vor dem kommerziellen Start",partners:"Verantwortlichkeiten und künftige Partnerschaften",home:"Die geplante Vertriebssparte verstehen"}},
 it:{solutions:"Soluzioni in preparazione",faq:"Domande sul progetto",partners:"Partner operatori di telecomunicazioni",home:"Panoramica Telecomunicazioni e Rete",desc:{solutions:"Funzionalità tecniche in preparazione",faq:"Risposte prima del lancio commerciale",partners:"Responsabilità e collaborazioni future",home:"Scoprire la futura divisione di distribuzione"}}
};
const TRANSLATED_LINKS={
 "":["solutions","faq","partners"],
 "solutions/":["faq","partners","home"],
 "faq/":["solutions","partners","home"],
 "partners/":["solutions","faq","home"]
};
const SUFFIX={solutions:"solutions/",faq:"faq/",partners:"partners/",home:""};
function relatedFor(pathname,lang){
 if(lang!=="fr"){
  const base=ROOT+lang+"/";
  if(!pathname.startsWith(base))return [];
  const suffix=pathname.slice(base.length);
  const loc=LOCALES[lang],names=TRANSLATED_LINKS[suffix];
  if(!loc||!names)return [];
  return names.map(name=>({url:base+SUFFIX[name],title:loc[name],description:loc.desc[name]}))
    .filter(x=>PUBLIC.has(x.url)&&x.url!==pathname);
 }
 const suffix=pathname.slice(ROOT.length);
 return (FR_RELATED[suffix]||[]).map(s=>TOPICS.get(url(s))).filter(x=>x&&PUBLIC.has(x.url)&&x.url!==pathname);
}
function block(links,lang,standalone=true){
 const heading=lang==="fr"?"Approfondir le sujet":({en:"Explore related topics",es:"Explorar temas relacionados",pt:"Explorar temas relacionados",de:"Verwandte Themen entdecken",it:"Esplorare argomenti correlati"})[lang];
 const aria=lang==="fr"?"Pages complémentaires PGI Telecom Distribution":heading;
 const cards=links.map(x=>'<a class="ds-related-link" href="'+escape(x.url)+'"><strong>'+escape(x.title)+'</strong><span>'+escape(x.description)+'</span><span class="ds-related-arrow" aria-hidden="true">→</span></a>').join("");
 if(!standalone)return '<nav class="ds-topic-links ds-related-grid" aria-label="'+escape(aria)+'">'+cards+'</nav>';
 return '<section class="section-space ds-related-topic" aria-label="'+escape(aria)+'"><div class="wrap"><h2>'+escape(heading)+'</h2><nav class="ds-related-grid" aria-label="'+escape(aria)+'">'+cards+'</nav></div></section>';
}
function addSolutionCardLinks(html){
 const destinations=new Map([
 ["Ressources SVA","numerotation/"],["Portabilité","transition/"],
 ["Routage téléphonique","interconnexion-routage/"],["Relevés d'appels","releves-reversements/"],
 ["Comptabilité par activité","releves-reversements/"],["Relation client","business-live/"]
 ]);
 // Explicit, useful destinations instead of leaving apparently actionable feature cards inert.
 return html.replace(/<article class="card">([\s\S]*?)<\/article>/g,(whole,inside)=>{
  if(/<a\s/.test(inside))return whole;
  const h=/<h3>([^<]+)<\/h3>/.exec(inside)?.[1];
  const target=destinations.get(h),href=target?url(target):null;
  if(!href||!PUBLIC.has(href))return whole;
  return '<article class="card">'+inside+'<a class="ds-card-action" href="'+href+'">En savoir plus <span aria-hidden="true">→</span></a></article>';
 });
}
export function renderDistributionContextLinks(html,pathname,lang){
 if(typeof html!=="string"||typeof pathname!=="string"||!PUBLIC.has(pathname))return html;
 if(html.includes('class="ds-related-topic"')||html.includes('class="ds-related-grid"'))return html;
 if(lang==="fr"&&pathname===url("solutions/"))html=addSolutionCardLinks(html);
 // Home already has rich natural links to the guides, language versions and GEO answers.
 if(pathname===ROOT)return html;
 const links=relatedFor(pathname,lang);
 if(links.length===0)return html;
 // Detailed technical guides currently contain a large, generic 8-link list.
 // Replace it with a shorter, topical 3-4-link navigation instead of duplicating it.
 if(lang==="fr"&&/<nav class="ds-topic-links" aria-label="Dossiers complémentaires">/.test(html)){
  return html.replace(/<nav class="ds-topic-links" aria-label="Dossiers complémentaires">[\s\S]*?<\/nav>/,block(links,lang,false));
 }
 const htmlBlock=block(links,lang);
 // Keep related reading before the language selector if present.
 if(lang==="fr"&&html.includes('<section class="section-space ds-language-section"'))
  return html.replace('<section class="section-space ds-language-section"',htmlBlock+'<section class="section-space ds-language-section"');
 return html.replace("</main>",htmlBlock+"</main>");
}
