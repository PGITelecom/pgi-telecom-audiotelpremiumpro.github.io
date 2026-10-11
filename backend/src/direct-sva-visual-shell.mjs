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
 '<a class="brand brand-full" href="/" aria-label="Audiotel Premium Pro"><img src="/assets/audiotel-brand-logo-v33.png" width="238" height="78" alt="Audiotel Premium Pro"></a>'+
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
 if(!html.includes('<h1><span>Pôle Télécom</span> &amp; Réseau.</h1>'))return html;
 const previous=/<div class="hero-side"><figure class="hero-visual">[\s\S]*?<\/figure><\/div>/;
 const caption='Réseau télécom et interconnexion. Illustration du pôle en préparation.';
 const photo='<figure class="hero-visual ds-hero-photo-under-title">'+
 '<img src="/site/distribution-sva/telecom-hero.webp" alt="Antenne de télécommunications surplombant une ville au coucher du soleil" width="333" height="471" decoding="async" fetchpriority="high">'+
 '<figcaption>'+htmlEscape(caption)+'</figcaption></figure>';
 let output=html.replace(previous,"");
 return output.replace('<h1><span>Pôle Télécom</span> &amp; Réseau.</h1>',
 '<h1><span>Pôle Télécom</span> &amp; Réseau.</h1>\n'+photo);
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
 if(lang==="fr"&&pathname==="/distribution-sva/")html=installHeroPhoto(html);
 html=html.replace("</main>",sharedBottomBar(lang,pathname)+"</main>");
 return html;
}
