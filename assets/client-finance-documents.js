/* Client finance archive. Read-only access to Stripe invoices and SVA ledger statements.
   No accounting invoice is fabricated by browser code. */
let root=null,busy=false,lastTenant="",loaded=false;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const price=(v,c)=>{try{return new Intl.NumberFormat("fr-FR",{style:"currency",currency:c||"EUR"}).format(Number(v)||0);}catch{return esc(v)+" "+esc(c);}};
const minor=(v,c)=>price((Number(v)||0)/100,c);
function validStripeLink(v){
  if(typeof v!=="string")return null;
  try{const u=new URL(v);return u.protocol==="https:"&&!u.username&&!u.password&&(u.hostname==="stripe.com"||u.hostname.endsWith(".stripe.com"))?u.href:null;}
  catch{return null;}
}
function calendar(v){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(v||"")))return String(v||"");
  return new Intl.DateTimeFormat("fr-FR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(v+"-01T12:00:00Z"));
}
function ensureRoot(){
  if(root?.isConnected)return root;
  const target=document.getElementById("client-finance");
  if(!target)return null;
  root=document.createElement("section");
  root.id="client-finance-documents";
  root.className="cp-panel cp-finance-documents";
  root.setAttribute("aria-label","Documents financiers mensuels");
  root.innerHTML='<div class="cp-finance-docs-head"><div><p class="cp-kicker">DOCUMENTS FINANCIERS</p><h2>Mes factures et relevés mensuels</h2><p class="cp-muted">Archives sécurisées et téléchargeables, accessibles uniquement depuis votre compte.</p></div><button type="button" class="cp-ghost" data-refresh-docs>Actualiser</button></div><div class="cp-finance-docs-content" aria-live="polite">Chargement des documents…</div>';
  target.appendChild(root);
  if(!document.getElementById("cp-finance-documents-style")){
    const css=document.createElement("style");css.id="cp-finance-documents-style";
    css.textContent=".cp-finance-documents{margin-top:20px;padding:20px;border:1px solid rgba(128,128,128,.23);border-radius:18px}.cp-finance-docs-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}.cp-finance-documents h2{margin:4px 0 8px}.cp-finance-docs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin-top:18px}.cp-finance-docs-box{border:1px solid rgba(128,128,128,.23);padding:16px;border-radius:14px;min-width:0}.cp-finance-docs-box h3{margin:0 0 8px}.cp-finance-docs-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 0;border-top:1px solid rgba(128,128,128,.15)}.cp-finance-docs-row span{font-size:.88em}.cp-finance-docs-row strong{display:block}.cp-finance-docs-action{background:transparent;border:1px solid currentColor;border-radius:8px;padding:7px 11px;cursor:pointer;color:inherit;text-decoration:underline;white-space:nowrap}.cp-finance-docs-note{margin-top:12px;font-size:.82em;line-height:1.55;opacity:.87}.cp-finance-docs-row a{color:inherit}.cp-finance-docs-action:focus-visible{outline:3px solid #dfaa73;outline-offset:3px}@media(max-width:460px){.cp-finance-docs-row{flex-wrap:wrap}.cp-finance-docs-action{width:100%}}";
    document.head.appendChild(css);
  }
  root.addEventListener("click",async e=>{
    if(e.target.closest("[data-refresh-docs]")){await reload();return;}
    const btn=e.target.closest("[data-statement-period]");
    if(!btn||busy)return;
    const period=btn.dataset.statementPeriod,currency=btn.dataset.statementCurrency;
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)||!/^[A-Z]{3}$/.test(currency))return;
    btn.disabled=true;btn.textContent="Téléchargement…";
    try{
      const base=String(window.PGI_CONFIG?.apiBaseUrl||"").replace(/\/$/,"");
      if(!/^https?:\/\//i.test(base))throw new Error("API_NOT_CONFIGURED");
      const url=base+"/customer/finance/statements/"+period+".pdf?currency="+encodeURIComponent(currency);
      const res=await fetch(url,{method:"GET",credentials:"include",cache:"no-store",headers:{Accept:"application/pdf"},signal:AbortSignal.timeout(25000)});
      if(!res.ok||!(res.headers.get("content-type")||"").includes("application/pdf"))throw new Error("DOCUMENT_UNAVAILABLE");
      const blob=await res.blob();
      if(blob.size<100||blob.size>10*1024*1024)throw new Error("INVALID_DOCUMENT_SIZE");
      const objectUrl=URL.createObjectURL(blob),link=document.createElement("a");
      link.href=objectUrl;link.download="audiotel-releve-sva-"+period+"-"+currency+".pdf";
      document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(objectUrl),3000);
    }catch{showError("Le relevé PDF est momentanément indisponible. Réessayez depuis votre espace sécurisé.");}
    finally{btn.disabled=false;btn.textContent="PDF";}
  });
  return root;
}
function showError(message){
  const node=root?.querySelector(".cp-finance-docs-content");if(node)node.innerHTML='<p class="cp-finance-docs-note" role="alert">'+esc(message)+'</p>';
}
function render(data){
  const node=root?.querySelector(".cp-finance-docs-content");if(!node)return;
  const invoices=Array.isArray(data?.invoices)?data.invoices:[],statements=Array.isArray(data?.statements)?data.statements:[];
  const status={paid:"Payée",open:"En attente",uncollectible:"Impayée",void:"Annulée",draft:"Brouillon"};
  const invoiceRows=invoices.map(x=>{
    const pdf=validStripeLink(x.invoice_pdf),host=validStripeLink(x.hosted_invoice_url),link=pdf||host;
    const title=x.number||"Facture Stripe";
    return '<div class="cp-finance-docs-row"><div><strong>'+esc(title)+'</strong><span>'+esc(x.issued_at||"Date indisponible")+' · '+esc(status[x.status]||x.status||"")+' · '+esc(minor(x.total_minor,x.currency))+'</span></div>'+(link?'<a class="cp-finance-docs-action" href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">'+(pdf?"PDF officiel":"Consulter")+'</a>':"<span>PDF non disponible</span>")+"</div>";
  }).join("");
  const statementRows=statements.map(x=>'<div class="cp-finance-docs-row"><div><strong>'+esc(calendar(x.period))+'</strong><span>'+esc(price(x.net_payout_ht,x.currency))+' net HT · '+(x.status==="provisional"?"À rapprocher / contesté":"Relevé disponible")+' · '+Number(x.records||0)+' écriture(s)</span></div><button class="cp-finance-docs-action" type="button" data-statement-period="'+esc(x.period)+'" data-statement-currency="'+esc(x.currency)+'">PDF</button></div>').join("");
  node.innerHTML='<div class="cp-finance-docs-grid"><section class="cp-finance-docs-box"><h3>Factures d’abonnement et prestations</h3><p class="cp-muted">Documents fiscaux officiels émis par Stripe selon les paiements réels.</p>'+(data.invoice_error?'<p role="alert" class="cp-finance-docs-note">Connexion Stripe temporairement indisponible.</p>':"")+(invoiceRows||'<p class="cp-finance-docs-note">Aucune facture émise pour ce compte. Les factures apparaîtront après leur émission effective.</p>')+(data.invoice_archive_truncated?'<p class="cp-finance-docs-note">L’historique très ancien reste disponible via le portail Stripe.</p>':"")+'</section><section class="cp-finance-docs-box"><h3>Relevés de reversements SVA</h3><p class="cp-muted">Documents distincts des factures. Périodes et montants issus du registre financier.</p>'+(statementRows||'<p class="cp-finance-docs-note">Aucun relevé de reversement disponible pour le moment.</p>')+'</section></div><p class="cp-finance-docs-note">Les montants de reversements sont indépendants de l’abonnement mensuel. Un statut interne « réglé » ne garantit pas à lui seul la réception bancaire. Les informations provisoires peuvent être corrigées. La facture électronique réglementaire reste du ressort de l’émetteur et de sa plateforme agréée.</p>';
}
async function reload(){
  if(busy)return;busy=true;
  const node=root?.querySelector(".cp-finance-docs-content");
  if(node)node.textContent="Actualisation des factures et reversements…";
  try{
    if(!window.PGICustomerApi?.financeDocuments)throw new Error("API_UNAVAILABLE");
    const data=await window.PGICustomerApi.financeDocuments();
    if(root?.isConnected){render(data);loaded=true;}
  }catch{loaded=false;showError("Le centre documentaire est temporairement indisponible. Aucun justificatif n’a été remplacé ni créé.");}
  finally{busy=false;}
}
export function mount({tenantId="",demo=false}={}){
  if(!ensureRoot())return;
  if(demo){showError("Les factures et reversements réels sont masqués en démonstration.");return;}
  const id=String(tenantId||"");
  if(lastTenant!==id){lastTenant=id;loaded=false;}
  if(!loaded&&!busy)void reload();
}
