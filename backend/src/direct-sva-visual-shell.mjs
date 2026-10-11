// One public SVA visual shell for all prepared Distribution editorial pages.
// Keep editorial copy, SEO metadata, locale, consent and commercial locks intact.
const LABELS={
 fr:{overview:"Présentation",solutions:"Solutions",third:"Business Live",fourth:"Conserver mes numéros",fifth:"Audiotel Premium Pro",small:["PRÉSENTATION","SOLUTIONS","SUIVI","PORTABILITÉ","SERVICE ACTUEL"],sub:["Pôle Télécom & Réseau","Fonctionnalités en préparation","Continuité des indicateurs","Transition des numéros","Offre SVA disponible"],account:"Se connecter à mon espace client",pole:"Pôle Télécom & Réseau",search:"Rechercher sur tout le site…",aria:"Navigation PGI Telecom Distribution"},
 en:{overview:"Overview",solutions:"Solutions",third:"Questions",fourth:"Partners",fifth:"Audiotel Premium Pro",small:["OVERVIEW","SOLUTIONS","ANSWERS","PARTNERS","CURRENT SERVICE"],sub:["Telecom & Network","Planned features","Frequently asked questions","Telecom partnerships","Existing SVA service"],account:"Audiotel customer sign-in",pole:"Telecom & Network",search:"Search the entire website…",aria:"PGI Telecom Distribution navigation"},
 es:{overview:"Presentación",solutions:"Soluciones",third:"Preguntas",fourth:"Socios",fifth:"Audiotel Premium Pro",small:["PRESENTACIÓN","SOLUCIONES","PREGUNTAS","SOCIOS","SERVICIO ACTUAL"],sub:["Telecomunicaciones y red","Funciones previstas","Preguntas frecuentes","Socios de telecomunicaciones","Oferta SVA existente"],account:"Acceder al espacio cliente Audiotel",pole:"Telecomunicaciones y red",search:"Buscar en todo el sitio…",aria:"Navegación PGI Telecom Distribution"},
 pt:{overview:"Apresentação",solutions:"Soluções",third:"Perguntas",fourth:"Parceiros",fifth:"Audiotel Premium Pro",small:["APRESENTAÇÃO","SOLUÇÕES","PERGUNTAS","PARCEIROS","SERVIÇO ATUAL"],sub:["Telecomunicações e rede","Funcionalidades previstas","Perguntas frequentes","Parceiros de telecomunicações","Serviço SVA existente"],account:"Entrar na área de cliente Audiotel",pole:"Telecomunicações e rede",search:"Pesquisar em todo o site…",aria:"Navegação PGI Telecom Distribution"},
 de:{overview:"Übersicht",solutions:"Lösungen",third:"Fragen",fourth:"Partner",fifth:"Audiotel Premium Pro",small:["ÜBERSICHT","LÖSUNGEN","FRAGEN","PARTNER","AKTUELLER DIENST"],sub:["Telekommunikation und Netz","Geplante Funktionen","Häufige Fragen","Telekommunikationspartner","Bestehender SVA-Dienst"],account:"Zum Audiotel-Kundenbereich",pole:"Telekommunikation und Netz",search:"Website durchsuchen…",aria:"PGI Telecom Distribution Navigation"},
 it:{overview:"Presentazione",solutions:"Soluzioni",third:"Domande",fourth:"Partner",fifth:"Audiotel Premium Pro",small:["PRESENTAZIONE","SOLUZIONI","DOMANDE","PARTNER","SERVIZIO ATTUALE"],sub:["Telecomunicazioni e rete","Funzionalità previste","Domande frequenti","Partner di telecomunicazioni","Offerta SVA esistente"],account:"Accedi all'area clienti Audiotel",pole:"Telecomunicazioni e rete",search:"Cerca in tutto il sito…",aria:"Navigazione PGI Telecom Distribution"}
};
function htmlEscape(s){return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;").replaceAll(">","&gt;").replaceAll("'","&#39;");}
function routes(lang){
 if(lang==="fr")return ["/distribution-sva/","/distribution-sva/solutions/","/distribution-sva/business-live/","/distribution-sva/transition/","/"];
 const prefix="/distribution-sva/"+lang+"/";
 return [prefix,prefix+"solutions/",prefix+"faq/",prefix+"partners/","/"];
}
function link(value,label,current){return '<a href="'+value+'"'+(current?' aria-current="page"':"")+'>'+htmlEscape(label)+'</a>';}
function sharedHeader(lang,path){
 const t=LABELS[lang]||LABELS.fr;
 const r=routes(lang);
 const items=[t.overview,t.solutions,t.third,t.fourth];
 const links=items.map((name,i)=>link(r[i],name,path===r[i])).join("");
 return '<header class="site-header ds-main-header">'+
 '<div class="wrap header-inner">'+
 '<a class="brand brand-full" href="'+(path==="/distribution-sva/"?"/":"/distribution-sva/")+'" aria-label="'+htmlEscape(path==="/distribution-sva/"?"Revenir à Audiotel Premium Pro":"Revenir à l’accueil Pôle Télécom & Réseau")+'"><img src="/assets/audiotel-brand-logo-v33.png" width="238" height="78" alt="Audiotel Premium Pro"></a>'+
 '<nav class="ds-main-nav" aria-label="'+htmlEscape(t.aria)+'">'+links+'</nav>'+
 '<div class="header-actions"><div class="header-account-entry">'+
 '<a class="header-login" href="/client.html"><strong>'+htmlEscape(t.account)+'</strong></a>'+
 '<a class="header-distribution-link" href="/distribution-sva/">'+htmlEscape(t.pole)+'</a>'+
 '</div></div></div>'+
 '<div class="wrap public-search-wrap" data-site-search><form class="public-search" data-site-search-form role="search" aria-label="'+htmlEscape(t.search)+'">'+
 '<div class="public-search-box"><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'+
 '<label class="sr-only" for="site-search-input">'+htmlEscape(t.search)+'</label>'+
 '<input id="site-search-input" data-site-search-input type="search" inputmode="search" autocomplete="off" spellcheck="false" placeholder="'+htmlEscape(t.search)+'" aria-autocomplete="list" aria-controls="site-search-results" aria-expanded="false">'+
 '<span class="public-search-hint" aria-hidden="true">/</span></div>'+
 '<div class="public-search-results" id="site-search-results" data-site-search-results role="listbox" hidden></div></form></div></header>';
}
function sharedBottomBar(lang,path){
 const t=LABELS[lang]||LABELS.fr,r=routes(lang);
 const names=[t.overview,t.solutions,t.third,t.fourth,t.fifth];
 const cards=names.map((label,i)=>
 '<a class="revenue-quick-tab'+(path===r[i]?' revenue-quick-tab-primary':'')+'" href="'+r[i]+'"'+(path===r[i]?' aria-current="page"':'')+'>'+
 '<small>'+htmlEscape(t.small[i])+'</small><strong>'+htmlEscape(label)+'</strong>'+
 '<span>'+htmlEscape(t.sub[i])+'</span></a>').join("");
 return '<section class="revenue-quick-nav" aria-label="'+htmlEscape(t.aria)+'"><div class="wrap"><nav class="revenue-quick-tabs" aria-label="'+htmlEscape(t.aria)+'">'+cards+'</nav></div></section>';
}
const cssLinks=[
 '<link rel="stylesheet" href="/site/distribution-sva/style.css">',
 '<link rel="stylesheet" href="/site/site.css">',
 '<link rel="stylesheet" href="/site/distribution-sva/brand.css">',
 '<link rel="stylesheet" href="/site/distribution-sva/parity.css">',
 '<link rel="stylesheet" href="/site/distribution-sva/unified.css">'
].join("\n");
const sourceStyles=/<link\s+rel="stylesheet"\s+href="\/site\/(?:site\.css|distribution-sva\/(?:style|brand|parity|unified)\.css)"\s*\/?>\s*/g;
const sourceSearch=/<script\s+src="\/site\/site-search\.js"\s+defer><\/script>\s*/g;
function installHeroPhoto(html){
 const heading='<h1><span>Pôle Télécom</span> &amp; Réseau.</h1>';
 if(!html.includes(heading))return html;
 // Reuse the originally selected tower-at-sunset image. Unlike the old card,
 // the title and a short statement live inside the photographic composition.
 const art='<div class="ds-hero-photographic" role="group" aria-label="Pôle Télécom et Réseau">'+
 '<img class="ds-network-tower" src="/site/distribution-sva/telecom-hero.webp" alt="Antenne de télécommunications, ville au soleil couchant et connexions lumineuses" width="333" height="471" decoding="async" fetchpriority="high">'+
 '<div class="ds-hero-photographic-copy">'+
 '<p class="ds-hero-photo-kicker">PGI TELECOM DISTRIBUTION <span>EN PRÉPARATION</span></p>'+
 heading+
 '<p class="ds-hero-photo-description">L’infrastructure de demain, pensée pour la continuité de vos services à valeur ajoutée.</p>'+
 '</div></div>';
 let out=html.replace(/<div class="hero-side"><figure class="hero-visual">[\s\S]*?<\/figure><\/div>/,"");
 // The original source includes the pre-image typography lines. Move their
 // meaning into the hero photo, without duplicating visible headings.
 out=out.replace(/<p class="eyebrow hero-brand-signature">[\s\S]*?<\/p>\s*<p class="eyebrow hero-service-line">[\s\S]*?<\/p>\s*<h1><span>Pôle Télécom<\/span> &amp; Réseau\.<\/h1>/,art);
 return out;
}
function enhanceDistributionHome(html){
 // Informational panels that look actionable should have a real destination,
 // not an inert hover state or a synthetic "button".
 const destinations=new Map([
 ["Numérotation","/distribution-sva/numerotation/"],
 ["Suivi financier","/distribution-sva/releves-reversements/"],
 ["Espace client","/distribution-sva/espace-client/"]
 ]);
 html=html.replace(/<article class="card">([\s\S]*?)<\/article>/g,(original,inner)=>{
  let content=inner;
  const title=/<h3>([^<]+)<\/h3>/.exec(inner)?.[1]||"";
  const href=destinations.get(title);
  if(!/<a\s/.test(content)&&href){
   content+='<a class="ds-card-action" href="'+href+'">Découvrir '+htmlEscape(title.toLowerCase())+' <span aria-hidden="true">→</span></a>';
  }
  if(!/<a\s/.test(content))return original;
  return '<article class="card ds-card-clickable">'+content+'</article>';
 });
 html=html.replace(/<div class="ds-two-columns">([\s\S]*?)<\/div><p class="notice">/,(_all,content)=>{
  const boxes=content.replace(/<div>(<span class="ds-unit-icon"[\s\S]*?<\/p>)<\/div>/g,(part,inner)=>{
   const first=inner.includes("Audiotel Premium Pro");
   return '<a class="ds-universe-link" href="'+(first?"/":"/distribution-sva/solutions/")+'">'+inner+'<span class="ds-universe-arrow" aria-hidden="true">→</span></a>';
  });
  return '<div class="ds-two-columns">'+boxes+'</div><p class="notice">';
 });
 return html;
}

function stretchExistingCardLinks(html){
 // A single destination on a feature card becomes a real full-card touch target,
 // including on all informational subpages. Cards without a link remain static.
 return html.replace(/<article class="card([^"]*)">([\s\S]*?)<\/article>/g,(whole,classes,inner)=>{
  if(classes.includes("ds-card-clickable"))return whole;
  const links=inner.match(/<a\s+[^>]*href="[^"]+"[^>]*>/g)||[];
  if(links.length!==1)return whole;
  return '<article class="card'+classes+' ds-card-clickable">'+inner+'</article>';
 });
}
export function renderDirectSvaVisualShell(source){
 if(typeof source!=="string"||!source.includes("</head>")||!source.includes("</main>"))return source;
 const lang=(/<html\s+lang="(fr|en|es|pt|de|it)"/i.exec(source)?.[1]||"fr").toLowerCase();
 const pathname=/rel="canonical"\s+href="https:\/\/audiotel-premium-pro\.com(\/distribution-sva\/[^"]*)"/.exec(source)?.[1]||"/distribution-sva/";
 let html=source.replace(sourceStyles,"").replace(sourceSearch,"");
 html=html.replace("</head>",cssLinks+'\n<script src="/site/site-search.js" defer></script>\n</head>');
 html=html.replace(/<body([^>]*)>/i,(_,attrs)=>{
  if(/\bclass="[^"]*"/.test(attrs))return '<body'+attrs.replace(/\bclass="([^"]*)"/,'class="$1 ds-unified"')+'>';
  return '<body'+attrs+' class="ds-unified">';
 });
 html=html.replace(/<header\b[\s\S]*?<\/header>/i,sharedHeader(lang,pathname));
 html=html.replace(/<section class="revenue-quick-nav"[\s\S]*?<\/section>/g,"");
 if(lang==="fr"&&pathname==="/distribution-sva/")html=enhanceDistributionHome(installHeroPhoto(html));
 html=stretchExistingCardLinks(html);
 html=html.replace("</main>",sharedBottomBar(lang,pathname)+"</main>");
 return html;
}
