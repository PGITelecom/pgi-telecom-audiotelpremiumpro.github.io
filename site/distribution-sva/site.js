// Dedicated distribution direct public UI. This file is not packaged before explicit release.
(() => {
 "use strict";
 const badge=document.querySelector("[data-ds-service-state]");
 if(badge)badge.textContent="PGI Telecom Distribution en préparation";
 const parisNow=new Date();
 const language=(document.documentElement.lang||"fr").slice(0,2).toLowerCase();
 const periods={
  fr:{locale:"fr-FR",before:"EN ",after:" ... PÔLE TÉLÉCOM & RÉSEAU EN PRÉPARATION"},
  en:{locale:"en-GB",before:"IN ",after:" ... TELECOM & NETWORK DIVISION IN PREPARATION"},
  es:{locale:"es-ES",before:"EN ",after:" ... ÁREA DE TELECOMUNICACIONES Y RED EN PREPARACIÓN"},
  pt:{locale:"pt-PT",before:"EM ",after:" ... POLO DE TELECOMUNICAÇÕES E REDE EM PREPARAÇÃO"},
  de:{locale:"de-DE",before:"IM ",after:" ... TELEKOMMUNIKATIONS- UND NETZBEREICH IN VORBEREITUNG"},
  it:{locale:"it-IT",before:"A ",after:" ... POLO TELECOMUNICAZIONI E RETE IN PREPARAZIONE"}
 };
 const period=periods[language]||periods.fr;
 const distributionMonth=new Intl.DateTimeFormat(period.locale,{timeZone:"Europe/Paris",month:"long",year:"numeric"}).format(parisNow).toLocaleUpperCase(period.locale);
 document.querySelectorAll("[data-ds-current-period]").forEach(n=>n.textContent=period.before+distributionMonth+period.after);
 const currentYear=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",year:"numeric"}).format(new Date());
 document.querySelectorAll("[data-ds-year]").forEach(n=>n.textContent=currentYear);
 const activePath=location.pathname;
 document.querySelectorAll('.menu a[href]').forEach(a=>{
  const href=a.getAttribute("href");if(href===activePath)a.setAttribute("aria-current","page");
 });
 // One consent-gated measurement adapter for all future public language pages.
 // The shared tracker is the single authority enforcing Audiotel GA4 exclusion.
 const analytics=window.__PGI_DIRECT_SVA_MEASUREMENT__;
 const privatelyScoped=new RegExp("^/distribution-sva/(?:espace-client|conditions|confidentialite|mentions-legales)(?:/|$)","i").test(location.pathname);
 if(!privatelyScoped&&analytics?.enabled===true&&analytics?.directReleaseApproved===true&&
    analytics?.dedicatedPropertyConfirmed===true&&analytics?.customDimensionRegistered===true&&
    analytics?.legalApproved===true&&/^G-[A-Z0-9]{8,}$/.test(String(analytics?.measurementId||""))&&
    navigator.globalPrivacyControl!==true&&
    !document.querySelector('script[src*="/site/distribution-sva/measurement.js"]')){
   const script=document.createElement("script");
   script.type="module";
   script.src="/site/distribution-sva/measurement.js";
   document.head.appendChild(script);
 }
 // Marketing forms are not activated until API, consent, CRM and legal gates are verified.
 document.querySelectorAll("form[data-ds-prelaunch-form]").forEach(form=>{
  form.addEventListener("submit",event=>{
    event.preventDefault();
    const status=form.querySelector("[role=status]");
    if(status)status.textContent="Aucune demande envoyée. La souscription directe sera ouverte après les validations nécessaires.";
  });
 });
})();
