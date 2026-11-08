/**
 * Prelaunch panels for existing Audiotel administration sections only.
 * Lazy-loaded from existing modules; not an alternate admin dashboard.
 * No render or network request outside explicit simulator mode.
 */
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const humanDate=v=>{if(!v)return"Date indisponible";const d=new Date(v);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium"}).format(d):"Date indisponible";};
const n=v=>Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):0;
const preview=()=>typeof window!=="undefined"&&window.PGI_CONFIG?.mode==="simulator";
const stages=Object.freeze({
 received:"Demande enregistrée",awaiting_documents:"Pièces à compléter",
 eligibility_review:"Vérification d'éligibilité",contract_review:"Contrat à vérifier",
 operator_packet_prepared:"Dossier technique préparé",
 awaiting_operator_agreement:"Accord opérateur attendu",
 handoff_ready:"Prêt pour contrôle final",on_hold:"En attente",
 rejected:"Refusé",cancelled:"Annulé"
});
function line(x){
 const reference=esc(x.public_reference||"Référence indisponible");
 const number=x.requested_e164?esc(x.requested_e164):"Numéro à renseigner";
 const category=x.number_category?" · "+esc(x.number_category):"";
 const status=esc(stages[x.stage]||"Instruction en cours");
 return '<div class="ca-alert"><div><strong>'+reference+'</strong><span class="ca-chip pending">'+status+'</span></div>'+
  '<p>'+number+category+'</p><small>Ouvert le '+esc(humanDate(x.created_at))+
  ' · Aucune opération télécom exécutée</small></div>';
}
export function buildPrelaunchCaseAdminMarkup(data){
 if(data?.business_unit!=="audiotel_platform"||
  !Array.isArray(data.portability)||!Array.isArray(data.new_numbers))return null;
 const port=data.portability.slice(0,50),numbers=data.new_numbers.slice(0,50);
 return '<div class="ca-card-head"><div><p class="panel-kicker">DOSSIERS EN PRÉPARATION</p>'+
  '<h3>Portabilités prioritaires et ouvertures</h3></div>'+
  '<span class="ca-count">'+(port.length+numbers.length)+' affiché(s)</span></div>'+
  '<p class="muted">Prévisualisation interne uniquement. Aucun numéro activé ni transféré.</p>'+
  '<div class="ca-alert-list"><strong>Portabilités ('+port.length+')</strong>'+
  (port.length?port.map(line).join(""):'<p class="muted">Aucun dossier préparatoire.</p>')+
  '<strong>Nouveaux numéros ('+numbers.length+')</strong>'+
  (numbers.length?numbers.map(line).join(""):'<p class="muted">Aucun dossier préparatoire.</p>')+
  '</div>';
}
export function buildPrelaunchAccountingMarkup(finance,strategy){
 const fin=finance?.business_unit==="audiotel_platform"&&finance?.status==="prelaunch_unverified"?finance:null;
 const strat=strategy?.business_unit==="audiotel_platform"&&strategy?.status==="preparation_only"?strategy:null;
 if(!fin&&!strat)return null;
 let html='<div class="acc-section-head"><div><p class="panel-kicker">PRÉPARATION</p>'+
  '<h3>Conformité financière et évolution juridique</h3></div></div>'+
  '<p class="acc-note">Brouillons uniquement. Aucun chiffre d’affaires, reversement ou régime fiscal réel n’est validé.</p>';
 if(fin)html+='<div class="acc-kpis">'+[
  ["Relevés opérateurs préparés",n(fin.statement_drafts)],
  ["Contrats préparés",n(fin.contract_drafts)],
  ["Instructions de versement bloquées",n(fin.payout_instruction_drafts)],
  ["Rapprochements à valider",n(fin.reconciliation_drafts)]
 ].map(x=>'<div class="acc-kpi"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>').join("")+
 '</div><p class="acc-note">Partenaires de paiement non raccordés. Aucun ordre de versement transmis.</p>';
 if(strat)html+='<div class="acc-section-head"><h3>Surveillance juridique et internationale</h3></div>'+
  '<p class="acc-note">Seuils de référence 2026, prestations de services : micro '+
  esc(n(strat.micro_services_ceiling_2026_minor)/100)+' €, TVA de base '+
  esc(n(strat.vat_services_standard_2026_minor)/100)+' € et majorée '+
  esc(n(strat.vat_services_increased_2026_minor)/100)+' €. '+
  'Alertes uniquement : aucun arrêt automatique des services lors d’un dépassement.</p>'+
  '<p class="acc-note">Surveillance mensuelle non activée. '+
  esc(n(strat.recorded_monthly_drafts))+' relevé(s) préparatoire(s) et '+
  esc(n(strat.recorded_form_scenarios))+' scénario(s) juridique(s) enregistrés.</p>'+
  '<p class="acc-note">Marchés à l’étude : '+
  (Array.isArray(strat.research_markets)?strat.research_markets.map(x=>esc(x.country_code)).join(", "):"aucun")+
  '. Aucun marché étranger ouvert.</p>';
 return html;
}
export async function mountCustomerAdminPreview(root,api){
 if(!preview()||!root||!api?.prelaunchCases)return;
 try{
  const data=await api.prelaunchCases();
  if(!preview()||!root.isConnected)return;
  const html=buildPrelaunchCaseAdminMarkup(data);
  if(html===null)return;
  let card=root.querySelector("[data-app-cases-preview]");
  if(!card){
   const before=root.querySelector(".ca-grid");if(!before)return;
   card=document.createElement("article");card.className="ca-card";
   card.dataset.appCasesPreview="";before.parentNode.insertBefore(card,before);
  }
  card.innerHTML=html;
 }catch(_){root.querySelector("[data-app-cases-preview]")?.remove();}
}
export async function mountAccountingPreview(root,api){
 if(!preview()||!root||!api)return;
 const settled=await Promise.allSettled([
  typeof api.prelaunchFinance==="function"?api.prelaunchFinance():Promise.reject(Error("unavailable")),
  typeof api.prelaunchStrategy==="function"?api.prelaunchStrategy():Promise.reject(Error("unavailable"))
 ]);
 if(!preview()||!root.isConnected)return;
 const markup=buildPrelaunchAccountingMarkup(
  settled[0].status==="fulfilled"?settled[0].value:null,
  settled[1].status==="fulfilled"?settled[1].value:null
 );
 if(markup===null)return;
 let section=root.querySelector("[data-app-accounting-preview]");
 if(!section){
  const head=root.querySelector(".acc-head");if(!head)return;
  section=document.createElement("section");section.className="acc-section";
  section.dataset.appAccountingPreview="";
  head.insertAdjacentElement("afterend",section);
 }
 section.innerHTML=markup;
}
