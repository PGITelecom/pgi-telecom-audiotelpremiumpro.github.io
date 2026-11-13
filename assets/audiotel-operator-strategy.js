/**
 * Audiotel Premium Pro - private comparison cockpit (dry-run only).
 * All user entered quotes live in this tab until export, never in Neon.
 * Only the authenticated staff POST preview endpoint performs the calculation.
 */
const SERVICES=Object.freeze([
 ["collection","Collecte des appels"],
 ["portability","Portabilité"],
 ["sip_routing","Routage SIP"],
 ["cdr_reporting","CDR et rapprochement"],
 ["publisher_payout","Virement direct éditeurs"],
 ["noc_support","Supervision et support NOC"]
]);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const currency=n=>n===null||n===undefined?"Non évalué":new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:2}).format(n);
const fmt=n=>new Intl.NumberFormat("fr-FR",{maximumFractionDigits:2}).format(n);
const keys=["app_own_revenue_millieur_per_min","app_variable_cost_millieur_per_min","monthly_fixed_cost_cents","one_off_setup_cost_cents"];
const defaultProvider=()=>({id:"partenaire_1",label:"Partenaire à définir (hypothèse)",services:SERVICES.map(x=>x[0])});
let nextProvider=2,nextPlan=3,generated=null,busy=false;
let providers=[defaultProvider()];
const defaultAssignments=(delegated=false)=>Object.fromEntries(SERVICES.map(([k])=>[k,delegated||["collection","portability","sip_routing","publisher_payout"].includes(k)?"partenaire_1":"audiotel"]));
let plans=[
 {id:"maitrise",label:"Maîtrise et marge",assignments:defaultAssignments(false),terms:["","","",""],linkedSip:false,linkedCdr:false},
 {id:"delegue",label:"Gestion intégralement déléguée",assignments:defaultAssignments(true),terms:["","","",""],linkedSip:false,linkedCdr:false}
];

function style(){
 if(document.getElementById("app-operator-strategy-css"))return;
 const n=document.createElement("style");
 n.id="app-operator-strategy-css";
 n.textContent=".as-layout{display:grid;gap:14px;margin-top:16px}.as-block{padding:13px;border-radius:12px;border:1px solid rgba(128,158,192,.17);background:rgba(7,18,30,.76)}.as-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:9px}.as-grid-6{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:9px}.as-label{display:flex;flex-direction:column;gap:4px;font-size:11px;color:#a8c2d6}.as-label input,.as-label select{color:#eaf2f8;background:#07101b;border:1px solid #324356;border-radius:8px;padding:9px;max-width:100%;font:inherit}.as-block h4{margin:0 0 9px;font-size:13px}.as-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.as-actions button{padding:9px 13px;border-radius:8px;background:#172a3d;color:#ebf4f8;border:1px solid #34516a;cursor:pointer}.as-actions button:disabled{opacity:.45;cursor:default}.as-note{font-size:11px;color:#a6bad0;line-height:1.5;margin:7px 0}.as-bad{color:#ffc89c}.as-ok{color:#b6e2c8}.as-checks{display:flex;flex-wrap:wrap;gap:7px;margin-top:7px}.as-checks label{font-size:10px;color:#a8c2d6}.as-checks input{accent-color:#78c9c4}.as-result{overflow-x:auto}.as-result table{width:100%;border-collapse:collapse;font-size:11px}.as-result th,.as-result td{padding:8px 5px;border-bottom:1px solid #273f51;text-align:left}.as-selected{color:#a0eed8}.as-heading{margin:0 0 8px;font-size:15px}";
 document.head.append(n);
}
const field=(label,name,val,step="0.01",description="")=>'<label class="as-label">'+esc(label)+
 '<input data-as-field="'+esc(name)+'" type="number" step="'+step+'" min="0" value="'+esc(val)+'" placeholder="À renseigner" autocomplete="off">'+
 (description?'<small>'+esc(description)+'</small>':"")+'</label>';
function providerHtml(p){
 return '<div class="as-block" data-as-provider="'+esc(p.id)+'">'+
 '<div class="as-grid">'+
 '<label class="as-label">Nom / référence fournisseur<input data-as-provider-name type="text" value="'+esc(p.label)+'" maxlength="80"></label>'+
 '<div><p class="as-note">Fonctions supposées disponibles. Vérification contractuelle obligatoire.</p>'+
 '<div class="as-checks">'+SERVICES.map(([key,label])=>'<label><input type="checkbox" data-as-provider-service="'+esc(key)+'"'+(p.services.includes(key)?" checked":"")+'>'+esc(label)+'</label>').join("")+'</div></div></div>'+
 '<div class="as-actions"><button type="button" data-as-remove-provider="'+esc(p.id)+'">Retirer ce partenaire</button></div></div>';
}
function planHtml(p){
 return '<div class="as-block" data-as-plan="'+esc(p.id)+'">'+
 '<h4>Option de fonctionnement</h4>'+
 '<label class="as-label">Nom de l’option<input type="text" data-as-plan-name maxlength="100" value="'+esc(p.label)+'"></label>'+
 '<p class="as-note">Indiquez les responsabilités. « Audiotel » signifie une gestion en interne, pas nécessairement une infrastructure physique.</p>'+
 '<div class="as-grid-6">'+SERVICES.map(([key,label])=>
 '<label class="as-label">'+esc(label)+'<select data-as-assignment="'+esc(key)+'">'+
 [{id:"audiotel",label:"Audiotel en interne"},...providers].map(x=>
 '<option value="'+esc(x.id)+'"'+(p.assignments[key]===x.id?" selected":"")+'>'+esc(x.label)+'</option>').join("")+
 '</select></label>').join("")+'</div>'+
 '<div class="as-grid" style="margin-top:10px">'+
 field("Rémunération propre Audiotel, €/min",keys[0],p.terms[0],"0.001","Après tous reversements éditeurs et retenues amont")+
 field("Autres coûts variables APP, €/min",keys[1],p.terms[1],"0.001","Ne comptez pas deux fois les retenues déjà déduites")+
 field("Coûts fixes mensuels, €",keys[2],p.terms[2],"0.01")+
 field("Frais initiaux uniques, €",keys[3],p.terms[3],"0.01")+
 '</div>'+
 '<div class="as-checks">'+
 '<label><input type="checkbox" data-as-link="sip"'+(p.linkedSip?" checked":"")+
 '> Interconnexion SIP multi-prestataires documentée</label>'+
 '<label><input type="checkbox" data-as-link="cdr"'+(p.linkedCdr?" checked":"")+
 '> Transmission CDR entre fournisseurs documentée</label></div>'+
 '<div class="as-actions"><button type="button" data-as-remove-plan="'+esc(p.id)+'">Retirer cette option</button></div></div>';
}
function readState(root){
 const providerRows=[...root.querySelectorAll("[data-as-provider]")];
 const planRows=[...root.querySelectorAll("[data-as-plan]")];
 if(!providerRows.length||!planRows.length)return;
 providers=providerRows.map(r=>({
  id:r.dataset.asProvider,label:r.querySelector("[data-as-provider-name]").value,
  services:[...r.querySelectorAll("[data-as-provider-service]:checked")].map(x=>x.dataset.asProviderService)
 }));
 plans=planRows.map(r=>({
  id:r.dataset.asPlan,label:r.querySelector("[data-as-plan-name]").value,
  assignments:Object.fromEntries([...r.querySelectorAll("[data-as-assignment]")].map(x=>[x.dataset.asAssignment,x.value])),
  terms:keys.map(key=>r.querySelector('[data-as-field="'+key+'"]').value),
  linkedSip:r.querySelector('[data-as-link="sip"]').checked,
  linkedCdr:r.querySelector('[data-as-link="cdr"]').checked
 }));
}
function number(value,multiplier,key){
 if(value===""||value===null||value===undefined)throw new Error("CHAMP_MANQUANT_"+key);
 const s=String(value).trim().replace(",",".");
 if(!/^\d+(?:\.\d{1,3})?$/.test(s))throw new Error("MONTANT_INVALIDE_"+key);
 const n=Number(s)*multiplier,rounded=Math.round(n);
 if(!Number.isSafeInteger(rounded)||Math.abs(n-rounded)>0.000001)throw new Error("PRECISION_INVALIDE_"+key);
 return rounded;
}
function payload(root){
 readState(root);
 const mode=root.querySelector("[data-as-objective]").value;
 const volume=root.querySelector('[data-as-field="minutes"]').value;
 const keep=root.querySelector('[data-as-field="retention"]').value;
 const accept=root.querySelector('[data-as-field="sacrifice"]').value;
 return {
  business_unit:"audiotel_platform",currency:"EUR",
  objective:mode,billable_minutes_month:number(volume,1,"MINUTES"),
  max_profit_sacrifice_bps:number(accept,100,"SACRIFICE"),
  personal_retention_basis_points:keep===""?null:number(keep,100,"RETENTION"),
  providers:providers.map(x=>({...x})),
  plans:plans.map(p=>({
   id:p.id,label:p.label,assignments:p.assignments,
   cross_provider_sip_interconnection_documented:p.linkedSip,
   cross_provider_reconciliation_documented:p.linkedCdr,
   financial_terms:{
    app_own_revenue_millieur_per_min:number(p.terms[0],1000,"APP_REVENUE"),
    app_variable_cost_millieur_per_min:number(p.terms[1],1000,"VARIABLE_COSTS"),
    monthly_fixed_cost_cents:number(p.terms[2],100,"MONTHLY_FIXED"),
    one_off_setup_cost_cents:p.terms[3]===""?0:number(p.terms[3],100,"SETUP_COST")
   }
  }))
 };
}
function results(root,data){
 const area=root.querySelector("[data-as-result]");
 if(!data||!Array.isArray(data.plans))return;
 const rows=data.plans.map(x=>
 '<tr><td>'+esc(x.label)+(x.id===data.selected_preview_plan_id?' <strong class="as-selected">OPTION RETENUE EN SIMULATION</strong>':"")+'</td>'+
 '<td>'+esc(fmt(x.delegation_percent))+' %</td>'+
 '<td>'+esc(currency(x.monthly_operating_before_tax_eur))+'</td>'+
 '<td>'+esc(currency(x.estimated_personal_monthly_net_eur))+'</td>'+
 '<td>'+esc(x.external_provider_count)+'</td>'+
 '<td>'+esc(x.issues.join(", ")||"Devis et contrôles à vérifier")+'</td></tr>').join("");
 area.innerHTML='<div class="as-result"><table><thead><tr><th>Configuration</th><th>Délégation</th><th>Résultat société avant impôts</th><th>Net personnel hypothétique</th><th>Partenaires</th><th>Alertes</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
 '<p class="as-note">'+(data.selected_preview_plan_id?"Option retenue pour étude : "+esc(data.selected_preview_plan_id)+". Perte de résultat estimée par rapport au maximum : "+esc(currency(data.monthly_company_result_sacrifice_eur))+".":"Aucune configuration financièrement viable et compatible : aucune option retenue.")+
 ' Aucune activation, aucune sauvegarde en base, aucun virement ni changement opérateur.</p>'+
 '<div class="as-actions"><button type="button" data-as-export>Exporter ce rapport JSON</button></div>';
 generated=data;
}
function render(root){
 const oldMode=root.querySelector("[data-as-objective]")?.value||"max_profit";
 const oldMinutes=root.querySelector('[data-as-field="minutes"]')?.value||"";
 const oldRetention=root.querySelector('[data-as-field="retention"]')?.value||"";
 const oldSacrifice=root.querySelector('[data-as-field="sacrifice"]')?.value||"0";
 const oldResult=generated;
 root.innerHTML='<div class="as-layout">'+
 '<section class="as-block"><h3 class="as-heading">Couteau suisse : rentabilité ou délégation</h3>'+
 '<p class="as-note">Comparez des offres réelles, puis choisissez qui gère chaque étape. Simulation privée, non enregistrée. Les champs sont volontairement vides tant que les devis sont inconnus.</p>'+
 '<div class="as-grid">'+
 '<label class="as-label">Objectif<select data-as-objective>'+
 [['max_profit',"Marge maximale"],["balanced","Équilibre"],["max_delegation","Délégation maximale"]].map(([k,v])=>'<option value="'+k+'"'+(oldMode===k?" selected":"")+'>'+v+'</option>').join("")+
 '</select></label>'+
 field("Minutes facturables / mois","minutes",oldMinutes,"1")+
 field("Part du résultat conservée personnellement, %","retention",oldRetention,"0.01","Hypothèse fiscale à valider, non garantie")+
 field("Perte maximale acceptée sur résultat, %","sacrifice",oldSacrifice,"0.01","0 % pour marge maximale, à personnaliser sinon")+
 '</div></section>'+
 '<section class="as-block"><h3 class="as-heading">Prestataires possibles</h3><p class="as-note">Des partenaires hypothétiques jusqu’à réception de contrats et de spécifications vérifiés.</p>'+
 providers.map(providerHtml).join("")+
 '<div class="as-actions"><button type="button" data-as-add-provider>Ajouter un opérateur</button></div></section>'+
 '<section class="as-block"><h3 class="as-heading">Configurations à comparer</h3><p class="as-note">Tarifs propres à Audiotel, nets des parts éditeurs. Les frais fixes et les prélèvements personnels restent séparés.</p>'+
 plans.map(planHtml).join("")+
 '<div class="as-actions"><button type="button" data-as-add-plan>Ajouter une configuration</button></div></section>'+
 '<div class="as-actions"><button type="button" data-as-run>Comparer les options sans les activer</button></div>'+
 '<div class="as-block" data-as-result role="status" aria-live="polite"><p class="as-note">Renseignez vos paramètres et au moins une offre réelle pour calculer.</p></div>'+
 '</div>';
 if(oldResult)results(root,oldResult);
 root.querySelector('[data-as-field="minutes"]').value=oldMinutes;
 root.querySelector('[data-as-field="retention"]').value=oldRetention;
 root.querySelector('[data-as-field="sacrifice"]').value=oldSacrifice;
}
function wire(root,request){
 root.addEventListener("click",async ev=>{
  const el=ev.target.closest("button");if(!el||!root.contains(el)||busy)return;
  if(el.hasAttribute("data-as-add-provider")){
   readState(root);
   if(providers.length>=20)return;
   const id="partenaire_"+nextProvider++;
   providers.push({id,label:"Partenaire à définir (hypothèse)",services:SERVICES.map(x=>x[0])});
   generated=null;render(root);return;
  }
  if(el.hasAttribute("data-as-remove-provider")){
   readState(root);
   if(providers.length<=1)return;
   const id=el.dataset.asRemoveProvider;
   providers=providers.filter(p=>p.id!==id);
   for(const p of plans)for(const [k,v] of Object.entries(p.assignments))
    if(v===id)p.assignments[k]="audiotel";
   generated=null;render(root);return;
  }
  if(el.hasAttribute("data-as-add-plan")){
   readState(root);
   if(plans.length>=30)return;
   const id="plan_"+nextPlan++;
   plans.push({id,label:"Nouvelle configuration",assignments:Object.fromEntries(SERVICES.map(([k])=>[k,k==="publisher_payout"?providers[0].id:"audiotel"])),terms:["","","",""],linkedSip:false,linkedCdr:false});
   generated=null;render(root);return;
  }
  if(el.hasAttribute("data-as-remove-plan")){
   readState(root);
   if(plans.length<=1)return;
   plans=plans.filter(x=>x.id!==el.dataset.asRemovePlan);
   generated=null;render(root);return;
  }
  if(el.hasAttribute("data-as-export")&&generated){
   const blob=new Blob([JSON.stringify(generated,null,2)+"\n"],{type:"application/json"});
   const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="audiotel-operateurs-comparaison.json";
   document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);return;
  }
  if(!el.hasAttribute("data-as-run"))return;
  const target=root.querySelector("[data-as-result]");busy=true;el.disabled=true;generated=null;
  try{
   const input=payload(root);
   target.textContent="Comparaison interne en cours…";
   const data=await request("/platform/audiotel/operator-strategy/preview",input);
   results(root,data);
  }catch(err){
   target.innerHTML='<p class="as-bad">Impossible de comparer : '+esc(err.code||err.message||"Données ou accès invalides")+'. Vérifiez les devis, les responsabilités et les montants saisis.</p>';
  }finally{busy=false;el.disabled=false;}
 });
 root.addEventListener("change",ev=>{
  if(!ev.target.matches("[data-as-objective]"))return;
  const target=root.querySelector('[data-as-field="sacrifice"]');
  if(target)target.value=ev.target.value==="max_profit"?"0":ev.target.value==="balanced"?"10":"30";
 });
}
export function mountAudiotelOperatorStrategy(root,request){
 if(!root||typeof request!=="function")return;
 if(root.dataset.asMounted==="1")return;
 root.dataset.asMounted="1";
 style();render(root);wire(root,request);
}
