// Admin-only continuity planning interface. The flag is OFF unless explicitly true.
// Simulation inputs are hypothetical, not measured operator health or entitlement.
const elementId="audiotel-carrier-continuity-console";
const styles=[
 "#"+elementId+"{margin:14px 0;padding:15px;border:1px solid #486176;border-radius:12px;background:#112031;color:#e8f2fa}",
 "#"+elementId+" *{box-sizing:border-box}",
 "#"+elementId+" h3{margin:0 0 7px;color:#fff;font-size:17px}",
 "#"+elementId+" p,#"+elementId+" small{color:#bdcfdf;font-size:12px;line-height:1.5}",
 "#"+elementId+" details{border:1px solid #456176;border-radius:8px;padding:10px}",
 "#"+elementId+" summary{cursor:pointer;min-height:42px;font-size:13px;font-weight:bold}",
 "#"+elementId+" .acc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}",
 "#"+elementId+" label{font-size:12px;display:grid;gap:5px;margin:5px 0}",
 "#"+elementId+" select,#"+elementId+" input{width:100%;min-height:44px;padding:8px;border:1px solid #7a94a8;border-radius:7px;background:#071727;color:white;font-size:15px}",
 "#"+elementId+" button{min-height:44px;padding:9px 14px;color:white;background:#244657;border:1px solid #9db6c6;border-radius:8px;cursor:pointer}",
 "#"+elementId+" button:disabled{opacity:.55;cursor:wait}",
 "#"+elementId+" input:focus-visible,#"+elementId+" select:focus-visible,#"+elementId+" button:focus-visible{outline:2px solid #f5c27b}",
 "#"+elementId+" [data-acc-output]{margin-top:10px;padding:10px;border:1px solid #456176;border-radius:8px}",
 "@media(max-width:720px){#"+elementId+" .acc-grid{grid-template-columns:1fr}}"
].join("\n");

const definitions=[
 ["number","Numéro 089 du scénario","text","+33890123456"],
 ["primaryCarrier","Code collecteur principal","text","CARRIER_A"],
 ["otherCarrier","Code collecteur alternatif","text","CARRIER_B"],
 ["primaryState","État de la route principale","select","active|Active,standby|En veille,disabled|Désactivée"],
 ["primaryHealth","Santé déclarée du principal","select","up|Disponible,degraded|Dégradée,down|Indisponible,unknown|Inconnue"],
 ["backupState","État du secours même collecteur","select","ready|Prête,standby|En veille,disabled|Désactivée"],
 ["backupHealth","Santé déclarée du secours même collecteur","select","up|Disponible,degraded|Dégradée,down|Indisponible,unknown|Inconnue"],
 ["alternateState","État du secours autre collecteur","select","ready|Prête,standby|En veille,disabled|Désactivée"],
 ["alternateHealth","Santé déclarée du secours autre collecteur","select","up|Disponible,degraded|Dégradée,down|Indisponible,unknown|Inconnue"]
];
const route=(routeId,carrierCode,type,state,health,priority)=>({routeId,carrierCode,type,state,health,priority});
function token(){
 const prefix="__Host-pgi_csrf=";
 for(const part of String(document.cookie||"").split(";")){
  const v=part.trim();
  if(v.startsWith(prefix))return decodeURIComponent(v.slice(prefix.length));
 }
 return "";
}
function value(form,name){
 const element=form.elements.namedItem(name);
 const v=String(element?.value||"").trim();
 if(!v)throw Error("Tous les champs du scénario sont obligatoires.");
 return v;
}
function write(node,lines){
 node.replaceChildren();
 for(const line of lines){
  const p=document.createElement("p");p.textContent=String(line);node.append(p);
 }
}
export function assertContinuityPlanSafe(report){
 if(!report||report.schema_version!=="audiotel-sip-continuity-preview/1"||
   report.business_unit!=="direct_sva"||
   report.access_to_089_independently_verified!==false||
   report.automatic_failover_enabled!==false||
   report.can_change_sip_route!==false||
   report.can_trigger_portability!==false||
   report.can_activate_089!==false||
   report.external_actions_executed!==false)
  throw Error("CONTINUITY_RESPONSE_UNSAFE");
 return report;
}
async function simulate(body){
 const base=String(window.PGI_CONFIG?.apiBaseUrl||"").replace(/\/$/,"");
 if(!base)throw Error("API_NOT_CONFIGURED");
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),8000);
 try{
  const res=await fetch(base+"/platform/carrier-autonomy/continuity-preview",{
   method:"POST",credentials:"include",cache:"no-store",signal:controller.signal,
   headers:{"Accept":"application/json","Content-Type":"application/json","X-CSRF-Token":token()},
   body:JSON.stringify(body)
  });
  const json=await res.json().catch(()=>null);
  if(!res.ok)throw Error(json?.error?.code||"HTTP_"+res.status);
  return assertContinuityPlanSafe(json);
 }finally{clearTimeout(timeout);}
}
export function mountCarrierContinuityConsole(host){
 if(!host?.isConnected||host.dataset.accReady==="true")return;
 if(window.PGI_CONFIG?.carrierContinuityPreviewEnabled!==true)return;
 host.id=elementId;
 host.setAttribute("aria-label","Préparation d'un secours SIP sans activation");
 if(!document.getElementById("audiotel-carrier-continuity-css")){
  const style=document.createElement("style");
  style.id="audiotel-carrier-continuity-css";style.textContent=styles;
  document.head.append(style);
 }
 const heading=document.createElement("h3");heading.textContent="Continuité téléphonique, scénario sans effet réel";
 const explanation=document.createElement("p");
 explanation.textContent="Réservé à l’administrateur. Aucun état réseau, contrat ou numéro attribué n’est vérifié par cet outil. Toutes les valeurs ci-dessous sont des hypothèses.";
 const details=document.createElement("details");
 const summary=document.createElement("summary");summary.textContent="Préparer une solution de secours SIP";
 const form=document.createElement("form");form.noValidate=true;
 const grid=document.createElement("div");grid.className="acc-grid";
 for(const [name,labelText,type,hint] of definitions){
  const label=document.createElement("label");label.textContent=labelText;
  let control;
  if(type==="select"){
   control=document.createElement("select");
   const empty=document.createElement("option");empty.value="";empty.textContent="Sélectionner";
   control.append(empty);
   for(const option of hint.split(",")){
    const [v,text]=option.split("|");
    const item=document.createElement("option");item.value=v;item.textContent=text;control.append(item);
   }
  }else{
   control=document.createElement("input");control.type="text";
   control.placeholder=hint;control.autocomplete="off";control.maxLength=name==="number"?12:32;
  }
  control.name=name;control.required=true;label.append(control);grid.append(label);
 }
 const button=document.createElement("button");button.type="submit";button.textContent="Analyser sans bascule";
 form.append(grid,button);details.append(summary,form);
 const status=document.createElement("div");status.dataset.accOutput="true";status.setAttribute("role","status");status.setAttribute("aria-live","polite");
 write(status,["Aucune route ni santé SIP connectée. Aucun appel n’est modifié."]);
 const footnote=document.createElement("small");
 footnote.textContent="Un serveur SIP de secours ne garantit pas l’accessibilité nationale d’un 089 sans interconnexion et collecte autorisées.";
 host.replaceChildren(heading,explanation,details,status,footnote);
 form.addEventListener("submit",async event=>{
  event.preventDefault();
  try{
   const primary=value(form,"primaryCarrier").toUpperCase(),other=value(form,"otherCarrier").toUpperCase();
   if(primary===other)throw Error("Le collecteur alternatif doit être différent du principal.");
   const body={number:value(form,"number"),currentRouteId:"route_primary",routes:[
    route("route_primary",primary,"primary",value(form,"primaryState"),value(form,"primaryHealth"),0),
    route("route_backup_a",primary,"same_carrier_backup",value(form,"backupState"),value(form,"backupHealth"),1),
    route("route_backup_b",other,"alternate_carrier",value(form,"alternateState"),value(form,"alternateHealth"),2)
   ]};
   button.disabled=true;write(status,["Calcul du scénario sans action réseau…"]);
   const result=await simulate(body);
   if(!host.isConnected)return;
   write(status,[result.note,"Route envisagée : "+(result.proposed_route?.route_id||"aucune"),
     "Bascule et mise en service : non autorisées. Disponibilité du 089 : non vérifiée."]);
  }catch(error){
   if(host.isConnected)write(status,["Simulation indisponible : "+String(error?.name==="AbortError"?"délai dépassé":error?.message||"erreur")]);
  }finally{button.disabled=false;}
 });
 host.dataset.accReady="true";
}
