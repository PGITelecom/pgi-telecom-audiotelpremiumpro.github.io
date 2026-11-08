/**
 * Audiotel client preview, mounted INSIDE the existing numbers/portability/
 * settlement sections. Only in the explicit local simulator environment.
 * Existing client calls, billing, routing and portability remain unchanged.
 */
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const stages=Object.freeze({
 received:"Demande reçue",awaiting_documents:"Pièces demandées",
 eligibility_review:"Vérification d'éligibilité",contract_review:"Contrat en vérification",
 operator_packet_prepared:"Dossier technique préparé",
 awaiting_operator_agreement:"Accord opérateur attendu",
 handoff_ready:"Dossier prêt pour revue finale",on_hold:"En attente",
 rejected:"Dossier refusé",cancelled:"Demande annulée"
});
const canEditStages=new Set(["received","awaiting_documents","on_hold"]);
let requestId=0,bound=false;
const preview=()=>typeof window!=="undefined"&&window.PGI_CONFIG?.mode==="simulator";

function categorySelect(value){
 return '<select name="category" required aria-label="Catégorie du numéro">'+
  ['081','082','089'].map(x=>'<option value="'+x+'"'+(value===x?" selected":"")+'>'+x+'</option>').join("")+'</select>';
}
function draftRow(x,kind,canEdit){
 const reference=String(x.case_reference??"");
 const number=String(x.number??"");
 const title=kind==="portability"?(number||"Numéro à compléter"):"Demande d'un premier numéro";
 const status=stages[x.status]||"Instruction en cours";
 const category=x.number_category?" · Catégorie "+x.number_category:"";
 const editable=canEdit&&canEditStages.has(x.status)&&
  (kind==="portability"?!number:!x.number_category);
 const form=editable?'<form class="cp-form" data-app-prelaunch-form data-app-case="'+esc(reference)+'" data-app-kind="'+kind+'">'+
  '<div class="cp-form-grid">'+
  (kind==="portability"?'<label>Numéro 08 à conserver<input type="tel" name="number" maxlength="24" inputmode="tel" autocomplete="off" placeholder="0890123456" required></label>':"")+
  '<label>Catégorie SVA souhaitée'+categorySelect(x.number_category)+'</label></div>'+
  '<button class="cp-ghost" type="submit">Compléter mon dossier</button>'+
  '<p class="cp-muted">Préparation uniquement. Aucun numéro n’est attribué ou transféré.</p></form>':"";
 return '<div class="cp-row"><div><strong>'+esc(title)+'</strong>'+
  '<span>'+esc(reference)+' · '+esc(status)+esc(category)+'</span>'+form+
  '</div><span class="cp-chip neutral">EN PRÉPARATION</span></div>';
}
export function buildPrelaunchClientMarkup(payload,{canEdit=false}={}){
 if(payload?.business_unit!=="audiotel_platform"||!Array.isArray(payload.cases))return null;
 const port=payload.cases.filter(x=>x.kind==="portability").slice(0,50);
 const fresh=payload.cases.filter(x=>x.kind==="new_number").slice(0,50);
 const financial=payload.finance?.business_unit==="audiotel_platform"&&
  payload.finance?.status==="financial_service_not_active"?payload.finance:null;
 return Object.freeze({
  port:port.length?'<p class="cp-muted">Dossiers de portabilité préparatoires ('+port.length+')</p>'+
   port.map(x=>draftRow(x,"portability",canEdit)).join(""):"",
  new_numbers:fresh.length?'<p class="cp-muted">Demandes de premier numéro ('+fresh.length+')</p>'+
   fresh.map(x=>draftRow(x,"new_number",canEdit)).join(""):"",
  finance:financial?'<div class="cp-row"><div><strong>Suivi SVA en préparation</strong>'+
   '<span>'+esc(Math.max(0,Number(financial.unverified_draft_call_count)||0))+
   ' ligne(s) CDR préparatoire(s). Aucun montant de reversement confirmé.</span>'+
   '</div><span class="cp-chip neutral">NON ACTIVÉ</span></div>':""
 });
}
function show(target,tag,markup){
 let node=document.querySelector('[data-app-client-preview="'+tag+'"]');
 if(!markup){node?.remove();return;}
 if(!target)return;
 if(!node){
  node=document.createElement("div");node.className="cp-stack";
  node.dataset.appClientPreview=tag;
  target.insertAdjacentElement("afterend",node);
 }
 node.innerHTML=markup;
}
export function clearPrelaunchClientPreview(){
 requestId++;
 if(typeof document!=="undefined")
  document.querySelectorAll("[data-app-client-preview]").forEach(x=>x.remove());
}
export async function refreshPrelaunchClientPreview({api,canEdit=false,active=()=>true}={}){
 if(!preview()||!api?.prelaunchCases)return;
 const thisRequest=++requestId;
 try{
  const result=await api.prelaunchCases();
  if(thisRequest!==requestId||!active()||!preview())return;
  const markup=buildPrelaunchClientMarkup(result,{canEdit});
  if(!markup)return;
  show(document.getElementById("portability-list"),"portability",markup.port);
  show(document.getElementById("numbers-list"),"new",markup.new_numbers);
  show(document.getElementById("settlements-list"),"finance",markup.finance);
  if(!bound){
   bound=true;
   document.getElementById("customer-app")?.addEventListener("submit",async event=>{
    const form=event.target.closest?.("[data-app-prelaunch-form]");
    if(!form||!preview())return;
    event.preventDefault();
    if(!api.prelaunchCaseNumber||!api.newIdempotencyKey)return;
    const button=form.querySelector('button[type="submit"]');
    if(button?.disabled)return;
    if(button)button.disabled=true;
    const category=form.elements.namedItem("category")?.value;
    const number=form.elements.namedItem("number")?.value||null;
    try{
     await api.prelaunchCaseNumber(form.dataset.appCase,number,category,api.newIdempotencyKey());
     if(form.isConnected){
      const note=document.createElement("p");note.className="cp-muted";note.setAttribute("role","status");
      note.textContent="Informations enregistrées dans le dossier. Aucune mise en service effectuée.";
      form.replaceWith(note);
     }
     await refreshPrelaunchClientPreview({api,canEdit,active});
    }catch(_){
     if(form.isConnected){
      let note=form.querySelector('[data-app-form-error]');
      if(!note){note=document.createElement("p");note.className="cp-muted";
       note.setAttribute("role","alert");note.dataset.appFormError="";
       form.appendChild(note);}
      note.textContent="Enregistrement impossible. Vérifiez le numéro, son statut et vos droits d'accès.";
     }
    }finally{if(button?.isConnected)button.disabled=false;}
   });
  }
 }catch(_){
  if(thisRequest===requestId)clearPrelaunchClientPreview();
 }
}
