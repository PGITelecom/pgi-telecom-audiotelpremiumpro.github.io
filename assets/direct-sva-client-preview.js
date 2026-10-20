// Admin-only design preview, lazily imported inside the authenticated PGI cockpit.
// No requests, no customer data, no fake numbers, and no commercial activation.
const panes=[
 ["overview","Vue générale","Une vue lisible de vos dossiers, numéros et opérations, propre à la Distribution."],
 ["numbers","Mes numéros","Numéros directs, portabilité et état réglementaire, après attribution confirmée."],
 ["calls","Appels et activité","Données issues de relevés opérateur vérifiés, sans chiffres inventés."],
 ["finance","Reversements","Estimations, montants contractuellement confirmés et versements réellement exécutés, séparés."],
 ["documents","Mes documents","Contrats, justificatifs et historique propres à cette activité."],
 ["support","Assistance","Demandes sécurisées, suivi et interlocuteurs validés."]
];
const styles='#dsva-admin-client-preview{--line:rgba(208,222,233,.18);color:#eaf3f8;background:linear-gradient(145deg,#162a38,#101f2b);border:1px solid var(--line);border-radius:17px;padding:clamp(15px,3vw,25px);max-width:100%;box-sizing:border-box}#dsva-admin-client-preview *{box-sizing:border-box}#dsva-admin-client-preview .dsap-flag{display:inline-flex;padding:6px 11px;border-radius:100px;border:1px solid #b58d58;color:#ffdda7;font-size:11px;font-weight:750}#dsva-admin-client-preview h3{margin:14px 0 9px;color:#fff;font-size:clamp(21px,3vw,27px)}#dsva-admin-client-preview .dsap-intro,#dsva-admin-client-preview .dsap-main p{color:#c6d4de;font-size:13px;line-height:1.65}#dsva-admin-client-preview .dsap-layout{margin-top:22px;display:grid;grid-template-columns:minmax(0,190px) minmax(0,1fr);gap:18px}#dsva-admin-client-preview .dsap-menu{display:grid;align-content:start;gap:7px}#dsva-admin-client-preview .dsap-tab{width:100%;min-height:43px;text-align:left;border:1px solid var(--line);background:rgba(255,255,255,.045);color:#eaf3f8;padding:11px;border-radius:9px;font-size:12px;cursor:pointer}#dsva-admin-client-preview .dsap-tab[aria-selected=true]{color:#ffdda7;background:rgba(232,179,110,.13);border-color:#b58d58}#dsva-admin-client-preview .dsap-tab:focus-visible{outline:2px solid #ffdda7;outline-offset:2px}#dsva-admin-client-preview .dsap-main{border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.035);padding:19px;min-height:215px}#dsva-admin-client-preview h4{font-size:19px;margin:0 0 9px;color:#fff}#dsva-admin-client-preview .dsap-empty{margin-top:18px;padding:18px;border:1px dashed rgba(208,222,233,.3);border-radius:10px;color:#c6d4de;font-size:12px}#dsva-admin-client-preview .dsap-foot{margin-top:18px;border:1px solid rgba(232,179,110,.3);border-radius:10px;padding:13px;color:#ffe2b4;font-size:12px;line-height:1.6}@media(max-width:660px){#dsva-admin-client-preview .dsap-layout{grid-template-columns:1fr}#dsva-admin-client-preview .dsap-menu{grid-template-columns:repeat(2,minmax(0,1fr))}#dsva-admin-client-preview .dsap-main{min-height:175px}}@media(max-width:360px){#dsva-admin-client-preview .dsap-menu{grid-template-columns:1fr}}';
export function mountDirectSvaClientPreview(host){
 if(!host||!host.isConnected)return;
 const styleId="pgi-private-distribution-client-preview-style";
 if(!document.getElementById(styleId)){
  const sheet=document.createElement("style");
  sheet.id=styleId;sheet.textContent=styles;document.head.appendChild(sheet);
 }
 const page=document.createElement("section");
 page.id="dsva-admin-client-preview";
 page.setAttribute("aria-label","Aperçu administrateur du futur espace client Distribution");
 page.innerHTML='<span class="dsap-flag">APERÇU PRIVÉ ADMINISTRATEUR · NON COMMERCIALISÉ</span>'+
  '<h3>Pôle Telecom &amp; Réseau · Espace client</h3>'+
  '<p class="dsap-intro">Une identité PGI commune peut être conservée, mais chaque activité dispose de ses propres habilitations, numéros, appels, documents et relevés. Aucun client SVA ne voit ce portail.</p>'+
  '<div class="dsap-layout"><nav class="dsap-menu" aria-label="Rubriques du futur espace client">'+
  panes.map((p,i)=>'<button type="button" class="dsap-tab" data-dsap="'+p[0]+'" aria-selected="'+String(i===0)+'">'+p[1]+'</button>').join("")+
  '</nav><div class="dsap-main" aria-live="polite"><h4></h4><p></p><div class="dsap-empty">Aucune donnée client affichée. Aucun compte Distribution activé, aucun appel ni paiement simulé.</div></div></div>'+
  '<div class="dsap-foot">Accès public fermé. Inscription libre interdite. Distribution commerciale verrouillée. Ouverture future soumise à validation des contrats, de la sécurité et des droits clients.</div>';
 host.replaceChildren(page);
 function render(key){
  const pane=panes.find(p=>p[0]===key)||panes[0];
  page.querySelector(".dsap-main h4").textContent=pane[1];
  page.querySelector(".dsap-main p").textContent=pane[2];
  page.querySelectorAll("[data-dsap]").forEach(button=>{
   button.setAttribute("aria-selected",String(button.dataset.dsap===pane[0]));
  });
 }
 page.querySelectorAll("[data-dsap]").forEach(button=>{
  button.addEventListener("click",()=>render(button.dataset.dsap));
 });
 render("overview");
}
