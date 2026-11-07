import {esc,date,nf,lab} from "./tenant-control-utils.js";

export function renderCustomerIdentity(data,t){
  const owner=(data.users||[]).find(u=>u.role==="owner")||(data.users||[])[0]||{};
  const signup=owner.signup_source==="public_marketing_site"?"Site public":owner.signup_source==="self_service_email"||owner.signup_source==="self_service"?"Inscription directe":owner.signup_source||"-";
  const intent=({new_number:"Nouveau numéro",portability:"Portabilité d’un numéro",advice:"Demande d’orientation"}[owner.service_intent]||owner.service_intent||"-");
  const users=(data.users||[]).map(u=>'<div class="td-expert"><strong>'+esc(u.display_name||u.email||"Utilisateur")+'</strong><small>'+esc(u.email||"-")+' • '+esc(lab(u.role||"readonly"))+' • '+esc(u.email_verified?"E-mail vérifié":"E-mail non vérifié")+'</small><small>'+esc(u.phone||"Téléphone non renseigné")+' • Inscrit '+esc(date(u.created_at))+' • Dernière connexion '+esc(date(u.last_authenticated_at))+'</small></div>').join("");
  const invitations=(data.invitations||[]).filter(i=>i.status==="pending").map(i=>'<div class="td-alert"><strong>'+esc(i.email)+'</strong><p>Invitation '+esc(lab(i.role||"readonly"))+' • expire '+esc(date(i.expires_at))+'</p></div>').join("");
  return '<section class="td-section"><div class="td-section-head"><h3>Identité & inscription</h3><span>'+esc(date(t.created_at))+'</span></div><div class="td-two"><div><p class="td-empty">Référence dossier : '+esc(t.dossier_ref||"-")+'<br>Société : '+esc(t.legal_name||t.display_name||"-")+'<br>E-mail facturation : '+esc(t.billing_email||"-")+'<br>Pays : '+esc(t.country_code||"-")+'<br>Langue : '+esc(t.preferred_locale||"-")+'<br>Fuseau : '+esc(t.timezone||"-")+'<br>Origine : '+esc(signup)+'<br>Demande initiale : '+esc(intent)+'</p></div><div><p class="td-empty">Immatriculation : '+esc(t.registration_number||"-")+'<br>Création : '+esc(date(t.created_at))+'<br>Mise à jour : '+esc(date(t.updated_at))+'<br>Utilisateurs : '+nf((data.users||[]).length)+'<br>Invitations en attente : '+nf((data.invitations||[]).filter(i=>i.status==="pending").length)+'</p></div></div><div class="td-experts" style="margin-top:9px">'+(users||'<p class="td-empty">Aucun utilisateur portail rattaché.</p>')+'</div>'+(invitations?'<div style="margin-top:9px">'+invitations+'</div>':"")+'</section>';
}

const csvCell=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
export function downloadCustomerExport(data){
  const rows=[["Section","Champ","Valeur"]],add=(section,field,value)=>rows.push([section,field,value??""]);
  Object.entries(data.tenant||{}).forEach(([k,v])=>add("Client",k,v));
  for(const [key,label] of [["users","Utilisateur"],["invitations","Invitation"],["subscriptions","Abonnement"],["lines","Ligne"],["portability","Portabilité"],["settlements","Reversement"]]){
    (data[key]||[]).forEach((row,i)=>Object.entries(row).forEach(([k,v])=>add(label+" "+(i+1),k,v)));
  }
  Object.entries(data.activity||{}).forEach(([k,v])=>add("Activité",k,v));
  const csv="\ufeff"+rows.map(r=>r.map(csvCell).join(";")).join("\r\n"),blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a"),safe=String(data.tenant?.display_name||"client").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase()||"client";
  a.href=url;a.download="dossier-client-"+String(data.tenant?.dossier_ref||safe).replace(/[^a-z0-9-]+/gi,"-")+"-"+new Date().toISOString().slice(0,10)+".csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

// Each payout stays linked to the selected customer, never to the global payout overview.
// Real receipt timestamp/reference are displayed only when the provider-backed state is paid.
const payoutNumber=(v,c)=>{try{return new Intl.NumberFormat("fr-FR",{style:"currency",currency:c||"EUR"}).format(Number(v)||0);}catch{return esc(v)+" "+esc(c||"");}};
function customerPayoutRows(rows){
  return (rows||[]).map(x=>{
    const paid=x.status==="paid"&&x.paid_at&&x.payment_reference;
    const datePaid=paid?date(x.paid_at):"Non versé";
    const paymentRef=paid?x.payment_reference:"-";
    return '<tr><td>'+esc(x.period_start||"-")+" au "+esc(x.period_end||"-")+
      '</td><td>'+esc(x.market||"-")+'</td><td>'+payoutNumber(x.net_payout_ht,x.currency)+'</td>'+
      '<td>'+payoutNumber(x.held_amount_ht,x.currency)+'</td>'+
      '<td>'+esc(x.payment_due_date||"-")+'</td>'+
      '<td>'+esc(datePaid)+'</td><td>'+esc(paymentRef)+'</td><td>'+esc(lab(x.status))+'</td></tr>';
  }).join("");
}
export function mountCustomerPayoutHistory(tenantId,root,initialRows=[]){
  if(!root)return;
  const safeRows=Array.isArray(initialRows)?initialRows:[];
  root.innerHTML='<div class="td-section-head"><h3>Reversements SVA du client</h3>'+
    '<span>Historique individualisé</span></div>'+
    '<p class="td-empty">La date et la référence bancaire ne sont indiquées que pour un reversement confirmé comme versé. Les lignes en attente ne sont pas des paiements reçus.</p>'+
    '<div class="td-table-wrap"><table class="td-table"><thead><tr>'+
    '<th>Période</th><th>Pays</th><th>Net client</th><th>Retenue</th>'+
    '<th>Échéance</th><th>Date de versement</th><th>Référence</th><th>Statut</th>'+
    '</tr></thead><tbody data-payout-rows>'+
    (customerPayoutRows(safeRows)||'<tr><td colspan="8">Aucun reversement enregistré.</td></tr>')+
    '</tbody></table></div><div class="td-actions"><button class="td-btn" type="button" data-payout-more>'+
    'Consulter tout l’historique</button><span data-payout-count aria-live="polite">'+
    esc(safeRows.length)+' dernier(s) reversement(s)</span></div>'+
    '<p data-payout-error class="td-feedback" role="status"></p>';
  const button=root.querySelector("[data-payout-more]"),body=root.querySelector("[data-payout-rows]");
  const count=root.querySelector("[data-payout-count]"),err=root.querySelector("[data-payout-error]");
  let cursor=null,loaded=false,busy=false,total=0;
  button?.addEventListener("click",async()=>{
    if(busy||!window.PGIApi?.tenantPayoutHistory)return;
    busy=true;button.disabled=true;err.textContent="";
    try{
      const payload=await window.PGIApi.tenantPayoutHistory(tenantId,{limit:"50",...(cursor?{cursor}:{})});
      if(!root.isConnected)return;
      const rows=Array.isArray(payload?.data)?payload.data:[];
      if(!loaded){body.innerHTML="";loaded=true;total=0;}
      const html=customerPayoutRows(rows);
      if(html)body.insertAdjacentHTML("beforeend",html);
      total+=rows.length;
      if(total===0)body.innerHTML='<tr><td colspan="8">Aucun reversement enregistré.</td></tr>';
      cursor=payload.next_cursor||null;
      count.textContent=total+" reversement(s) chargé(s)";
      button.hidden=!cursor;
      if(cursor)button.textContent="Charger les reversements précédents";
    }catch(_error){
      if(root.isConnected)err.textContent="Historique indisponible. Réessayer sans modifier les écritures.";
    }finally{
      busy=false;if(root.isConnected)button.disabled=false;
    }
  });
}
