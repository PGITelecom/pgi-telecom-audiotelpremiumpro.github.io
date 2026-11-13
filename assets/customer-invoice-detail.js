import {esc,date,money} from "./tenant-control-utils.js";

const invoiceAmount=(minor,currency)=>{
 if(minor===null||minor===undefined)return "Non communiqué";
 if(!/^[A-Z]{3}$/.test(String(currency||"")))return "Devise non vérifiée";
 if(!Number.isSafeInteger(minor)||minor<0)return "Non vérifié";
 return money(minor/100,currency);
};
const invoiceStatus=v=>({
 paid:"Payée",open:"Ouverte",payment_issue:"Incident de paiement",
 void:"Annulée",uncollectible:"Irrécouvrable",draft:"Brouillon",
 unconfirmed:"Non confirmé"
})[v]||"Non confirmé";

/**
 * Fits the CURRENT 360° administrative dialog; no new CSS or public route.
 * Only displays signed, already-journaled Stripe events and their evidence.
 */
export function renderCustomerInvoiceAudit(audit){
 if(!audit||audit.schema_version!=="audiotel-customer-invoices/1")
  return '<section class="td-section"><div class="td-section-head"><h3>Factures & paiements Stripe</h3></div><p class="td-empty">Historique indisponible. Aucun solde n’est déduit.</p></section>';
 const sums=(audit.currency_summaries||[]).map(s=>
  '<p class="td-empty"><strong>'+esc(s.currency)+'</strong> • '+
  esc(s.paid_invoices)+' facture(s) avec événement de paiement • '+
  'Montant renseigné : '+esc(invoiceAmount(s.paid_amount_minor,s.currency))+
  (s.paid_invoices_missing_amount?' • '+esc(s.paid_invoices_missing_amount)+' montant(s) non remonté(s)':'')+
  ' • Dernier solde ouvert signalé : '+esc(invoiceAmount(s.last_reported_unpaid_minor,s.currency))+
  (s.unpaid_invoices_missing_amount?' • '+esc(s.unpaid_invoices_missing_amount)+' solde(s) inconnu(s)':'')+'</p>'
 ).join("");
 const rows=(audit.invoices||[]).map(inv=>{
  const paid=inv.payment_confirmed_by_stripe_invoice_event===true;
  const link=inv.invoice_url?'<a href="'+esc(inv.invoice_url)+'" target="_blank" rel="noopener noreferrer">Voir facture</a>':
   inv.invoice_pdf_url?'<a href="'+esc(inv.invoice_pdf_url)+'" target="_blank" rel="noopener noreferrer">PDF Stripe</a>':"-";
  return '<tr><td>'+esc(inv.invoice_reference)+'</td><td>'+esc(invoiceStatus(inv.status))+
   '</td><td>'+esc(invoiceAmount(inv.total_due_minor,inv.currency))+'</td><td>'+
   (paid?esc(invoiceAmount(inv.paid_minor,inv.currency)):"Non confirmé")+'</td><td>'+
   (paid?"0 (facture payée)":esc(invoiceAmount(inv.last_reported_remaining_minor,inv.currency)))+
   '</td><td>'+esc(date(inv.last_event_at))+'</td><td>'+
   (paid?"-":esc(date(inv.next_payment_attempt)))+'</td><td>'+link+'</td></tr>';
 }).join("");
 return '<section class="td-section"><div class="td-section-head"><h3>Factures & paiements Stripe</h3><span>'+
   esc(audit.invoices_known||0)+' connue(s)</span></div>'+
   (sums||'<p class="td-empty">Aucune facture observée dans le journal Stripe.</p>')+
   '<p class="td-empty"><strong>Attention :</strong> les soldes affichés proviennent des derniers événements reçus et ne constituent pas une consultation du solde Stripe actuel. Les remboursements, litiges et frais Stripe ne sont pas déduits. Le revenu net client ne peut pas être établi ici.</p>'+
   '<div class="td-table-wrap"><table class="td-table"><thead><tr><th>Facture</th><th>Statut observé</th><th>Montant initial</th><th>Payé confirmé</th><th>Dernier reste signalé</th><th>Dernier événement</th><th>Relance prévue</th><th>Justificatif</th></tr></thead>'+
   '<tbody>'+(rows||'<tr><td colspan="8">Aucune facture enregistrée.</td></tr>')+
   '</tbody></table></div>'+
   '<div class="td-actions"><button type="button" class="td-btn" data-stripe-live-refresh>Consulter Stripe en direct (lecture seule)</button></div><div id="td-stripe-live-results" aria-live="polite"></div>'+
   (audit.source_history_truncated?'<p class="td-empty">Historique source partiel : rapprochement avec Stripe nécessaire.</p>':'')+
   (audit.invoices_known>audit.invoices_visible?'<p class="td-empty">Affichage limité aux 50 dernières factures connues.</p>':'')+
   '</section>';
}


/**
 * Manual-only, authenticated Stripe GET. Never auto-polls or changes a payment.
 * Uses the existing 360 dialog, not a second portal or an altered public page.
 */
export function mountCustomerStripeLive(id,root){
 const btn=root?.querySelector("[data-stripe-live-refresh]");
 const target=root?.querySelector("#td-stripe-live-results");
 if(!btn||!target)return false;
 const currencyAmount=(n,c)=>esc(invoiceAmount(n,c));
 const formatLive=payload=>{
  if(payload?.schema_version!=="audiotel-stripe-live-invoices/1")
   throw Error("APP_INVOICE_SCHEMA_MISMATCH");
  const sums=(payload.currency_balances_on_page||[]).map(x=>
   '<p class="td-empty">'+esc(x.currency)+' • Ouvert restant sur cette page : '+
   currencyAmount(x.unpaid_open_minor,x.currency)+
   (x.open_with_unknown_remaining?' • '+esc(x.open_with_unknown_remaining)+' montant(s) inconnu(s)':'')+
   '</p>').join("");
  const rows=(payload.invoice_rows||[]).map(inv=>{
   const link=inv.invoice_url?'<a href="'+esc(inv.invoice_url)+'" target="_blank" rel="noopener noreferrer">Voir</a>':"-";
   return '<tr><td>'+esc(inv.invoice_reference)+'</td><td>'+esc(invoiceStatus(inv.status))+'</td><td>'+
    currencyAmount(inv.amount_due_minor,inv.currency)+'</td><td>'+
    currencyAmount(inv.amount_paid_minor,inv.currency)+'</td><td>'+
    currencyAmount(inv.amount_remaining_minor,inv.currency)+'</td><td>'+
    esc(date(inv.due_at))+'</td><td>'+link+'</td></tr>';
  }).join("");
  return '<p class="td-empty"><strong>Consultation Stripe : '+esc(date(payload.fetched_at))+
   '</strong>. Montants actuels à cette consultation, non garantis pour une autre date. '+ 
   'Aucune déduction des remboursements, commissions et litiges. Les montants ci-dessous concernent cette page, pas tout le compte.</p>'+
   (sums||'<p class="td-empty">Aucune facture d’abonnement correspondante dans cette page.</p>')+
   '<div class="td-table-wrap"><table class="td-table"><thead><tr><th>Facture</th><th>État Stripe</th><th>Montant</th><th>Payé</th><th>Reste à payer</th><th>Échéance</th><th>Document</th></tr></thead><tbody>'+
   (rows||'<tr><td colspan="7">Aucune facture rattachée à un abonnement du dossier dans cette page.</td></tr>')+
   '</tbody></table></div>'+
   (payload.has_more?'<button type="button" class="td-btn" data-stripe-next="'+esc(payload.next_cursor)+'">Page suivante</button>':'');
 };
 const load=async cursor=>{
  const base=String(window.PGI_CONFIG?.apiBaseUrl||"").replace(/\/$/,"");
  if(!base){target.textContent="Connexion Stripe indisponible dans cet environnement.";return;}
  btn.disabled=true;target.textContent="Consultation Stripe en lecture seule…";
  try{
   const query=new URLSearchParams({limit:"25"});if(cursor)query.set("starting_after",cursor);
   const r=await fetch(base+"/platform/tenants/"+encodeURIComponent(id)+"/stripe-invoices?"+query,{
    credentials:"include",cache:"no-store",headers:{Accept:"application/json"}
   });
   if(!r.ok)throw Error("READ_UNAVAILABLE");
   const body=await r.json();
   target.innerHTML=formatLive(body);
   const next=target.querySelector("[data-stripe-next]");
   if(next)next.addEventListener("click",()=>load(next.dataset.stripeNext),{once:true});
  }catch{
   target.textContent="Lecture Stripe impossible ou dossier non associé. Le journal interne reste disponible ; aucun paiement n’a été effectué.";
  }finally{btn.disabled=false;}
 };
 btn.addEventListener("click",()=>load(null));
 return true;
}
