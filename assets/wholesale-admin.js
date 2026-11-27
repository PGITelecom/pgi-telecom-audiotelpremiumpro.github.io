// Loaded only when an administrator opens the wholesale tools in the existing cockpit.
const specs=Object.freeze({
 "volume-tiers":{"label":"Négocier les paliers de volume et minimums","template":{"business_unit":"audiotel_platform","currency":"EUR","billing_basis":"minute","category":"089","retail_service_micro_eur_per_min":null,"publisher_micro_eur_per_min":null,"other_variable_micro_eur_per_min":null,"target_contribution_micro_eur_per_min":null,"monthly_fixed_micro_eur":null,"minimum_network_spend_micro_eur":null,"one_off_micro_eur":null,"horizon_months":12,"low_monthly_minutes":null,"base_monthly_minutes":null,"high_monthly_minutes":null,"tier_mode":"marginal","tiers":[{"from_minutes":0,"operator_net_micro_eur_per_min":null,"network_micro_eur_per_min":null}],"evidence":{}}},
 "call-economics":{label:"Contribution enregistrée par numéro et destination",template:{business_unit:"audiotel_platform",currency:"EUR",from_utc:null,to_utc:null}},
 "internalization-tco":{"label":"Comparer le coût total des outils gratuits et payants","template":{"business_unit":"audiotel_platform","currency":"EUR","unit":"minute","horizon_months":12,"low_monthly_units":null,"base_monthly_units":null,"high_monthly_units":null,"current":{"monthly_cost_micro_eur":{"license":null,"hosting":null,"maintenance":null,"security_backup":null,"compliance":null,"support":null,"other":null},"one_off_cost_micro_eur":{"setup":null,"migration":null,"exit":null,"parallel_run":null,"hardware":null},"included_monthly_units":null,"excess_unit_micro_eur":null,"verified_monthly_capacity":null,"internal_monthly_minutes":null,"internal_hourly_cost_micro_eur":null,"evidence":{}},"alternative":{"monthly_cost_micro_eur":{"license":null,"hosting":null,"maintenance":null,"security_backup":null,"compliance":null,"support":null,"other":null},"one_off_cost_micro_eur":{"setup":null,"migration":null,"exit":null,"parallel_run":null,"hardware":null},"included_monthly_units":null,"excess_unit_micro_eur":null,"verified_monthly_capacity":null,"internal_monthly_minutes":null,"internal_hourly_cost_micro_eur":null,"evidence":{}}}},
 compare:{label:"Comparer les offres wholesale",template:{business_unit:"audiotel_platform",currency:"EUR",billing_basis:"minute",category:"089",retail_service_micro_eur_per_min:null,monthly_minutes:null,horizon_months:12,publisher_micro_eur_per_min:null,publisher_contract_verified:false,offers:[{provider_key:"operateur-a",operator_net_micro_eur_per_min:null,variable_cost_micro_eur_per_min:{network:null,payment:null,other:null,intermediary:null},fixed_cost_micro_eur:{monthly_fee:null,minimum_commitment_topup:null,setup_fee:null,switching_fee:null,termination_fee:null},costs_verified:false,evidence:{}}]}},
 "normalize-csv":{label:"Importer directement un CSV opérateur",template:{business_unit:"audiotel_platform",currency:"EUR",provider_key:"operateur-a",delimiter:";",decimal_separator:".",field_mapping:{id:"external_call_id",start:"started_at",stop:"ended_at",talk:"conversation_seconds",bill:"payout_eligible_seconds",amount:"confirmed_payout_ht"},csv:""}},
 "reconcile-csv":{label:"Rapprocher directement un CSV avec PGI",template:{business_unit:"audiotel_platform",currency:"EUR",carrier_id:null,from_utc:null,to_utc:null,delimiter:";",decimal_separator:".",field_mapping:{id:"external_call_id",start:"started_at",stop:"ended_at",talk:"conversation_seconds",bill:"payout_eligible_seconds",amount:"confirmed_payout_ht"},csv:""}},
 "economic-routing":{label:"Comparer les destinations SIP et téléphoniques",template:{business_unit:"audiotel_platform",currency:"EUR",tenant_public_id:"",sva_number_id:null,typical_call_seconds:60,quotes:[{destination_id:null,minimum_billable_seconds:null,billing_increment_seconds:null,rate_micro_eur_per_min:null,connection_fee_micro_eur:null,cost_verified:false,quality_verified:false,customer_consent_verified:false}]}},
 "normalize-export":{label:"Normaliser les CDR opérateur",template:{business_unit:"audiotel_platform",currency:"EUR",provider_key:"operateur-a",field_mapping:{id:"external_call_id",start:"started_at",end:"ended_at",talk:"conversation_seconds",bill:"payout_eligible_seconds",amount:"confirmed_payout_ht"},rows:[]}},
 "reconcile-ledger":{label:"Rapprocher avec nos appels enregistrés",template:{business_unit:"audiotel_platform",currency:"EUR",carrier_id:null,from_utc:null,to_utc:null,reported_rows:[]}},
 "voice-cost":{label:"Évaluer les économies WebRTC",template:{business_unit:"audiotel_platform",currency:"EUR",monthly_minutes:null,webrtc_adoption_bps:null,fallback_bps:null,horizon_months:12,pstn_cost_micro_eur_per_min:null,webrtc_cost_micro_eur_per_min:null,monthly_fixed_cost_micro_eur:null,setup_cost_micro_eur:null,evidence:{}}}
});
const eur=new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:2});
const micro=v=>Number.isSafeInteger(v)?eur.format(v/1000000):"Non disponible";
function el(tag,txt){const n=document.createElement(tag);if(txt!==undefined)n.textContent=String(txt);return n;}
function line(root,label,value){const p=el("p");p.append(el("strong",label+" : "),document.createTextNode(String(value??"Non disponible")));root.append(p);}
function apiBase(){const b=String(window.PGI_CONFIG?.apiBaseUrl||"").replace(/\/$/,"");if(!b)throw Error("API_NOT_CONFIGURED");return b;}
function renderResult(root,result){
 root.replaceChildren();
 if(result.schema_version==="pgi-recorded-call-economics/1"){
  line(root,"Appels examinés",result.scoped_calls);
  line(root,"Groupes",result.total_groups);
  for(const g of result.groups)line(root,[g.display_number||"Numéro non identifié",g.carrier_name||"Opérateur non identifié",g.destination_type||"Destination non identifiée"].join(" / "),g.contribution_ht===null?"Données insuffisantes":g.contribution_ht+" € HT de contribution enregistrée ; "+g.evaluable_calls+"/"+g.calls+" appels évaluables");
  if(result.groups_truncated)line(root,"Limite","100 groupes affichés ; réduire la période");
  line(root,"Réserve","Hors charges non enregistrées et fiscalité ; aucun encaissement bancaire vérifié");
 }else if(result.schema_version==="pgi-wholesale-tiers/1"){
  for(const s of result.scenarios)line(root,s.monthly_minutes+" minutes/mois",micro(s.monthly_contribution_micro_eur)+" de contribution mensuelle estimée ; complément minimum "+micro(s.minimum_commitment_topup_micro_eur)+" ; objectif "+(s.target_met?"atteint dans ce scénario":"non atteint"));
  line(root,"Décision",result.status==="blocked"?"À vérifier : "+result.blocked_reasons.join(", "):"Candidat à revue indépendante");
 }else if(Array.isArray(result.scenarios)){
  for(const s of result.scenarios)line(root,s.monthly_units+" unités/mois",micro(s.horizon_saving_micro_eur)+" économisés sur la période");
  line(root,"Décision",result.status==="blocked"?"À vérifier : "+result.blocked_reasons.join(", "):"Candidat à revue indépendante");
 }else if(Array.isArray(result.offers)){
  for(const offer of result.offers)line(root,offer.provider_key,micro(offer.monthly_average_contribution_micro_eur)+"/mois · "+(offer.status==="blocked"?"À vérifier : "+offer.blocked_reasons.join(", "):"Candidat à revue indépendante"));
 }else if(Number.isSafeInteger(result.gross_shortfall_micro_eur)){
  line(root,"Écarts défavorables à examiner",micro(result.gross_shortfall_micro_eur));
  line(root,"Écarts favorables",micro(result.gross_overage_micro_eur));
 }else if(Number.isSafeInteger(result.monthly_saving_micro_eur)){
  line(root,"Économie mensuelle estimée",micro(result.monthly_saving_micro_eur));
  line(root,"Économie sur la période",micro(result.horizon_saving_micro_eur));
  line(root,"Amortissement",result.payback_months==null?"Non atteint":result.payback_months+" mois");
 }else if(Object.hasOwn(result,"candidate_destination_id")){
  line(root,"Destination économique candidate",result.candidate_destination_id??"Aucune alternative vérifiée plus économique");
  line(root,"Économie estimée par appel",micro(result.estimated_saving_per_call_micro_eur));
 }else if(Number.isSafeInteger(result.row_count)){
  line(root,"Appels normalisés",result.row_count);
  line(root,"Reversement déclaré",micro(result.total_reported_payout_micro_eur));
 }
 const details=el("details"),summary=el("summary","Résultat détaillé"),pre=el("pre",JSON.stringify(result,null,2));
 pre.style.whiteSpace="pre-wrap";pre.style.overflowWrap="anywhere";
 details.append(summary,pre);root.append(details);
}
export async function open({root,postJson,feedback}){
 if(!root)return;
 root.hidden=false;root.replaceChildren();
 root.append(el("h3","Indépendance télécom et rentabilité"),el("p","Aucune bascule, attribution de numéro ou opération financière n’est déclenchée ici."));
 const status=el("div","Lecture des données PGI…");root.append(status);
 const picker=el("select");picker.setAttribute("aria-label","Choisir une analyse wholesale");
 for(const [key,s] of Object.entries(specs)){const o=el("option",s.label);o.value=key;picker.append(o);}
 const note=el("p","Saisir les données contractuelles exactes. Montants en micro-euros HT : 1 € = 1 000 000. Les champs null doivent être complétés, y compris les frais nuls confirmés. Les preuves restent déclaratives.");
 note.className="pa-note";
 const input=el("textarea");input.setAttribute("aria-label","Données de l’analyse wholesale");input.rows=12;input.style.width="100%";input.style.maxWidth="100%";input.style.boxSizing="border-box";input.spellcheck=false;
 const file=el("input");file.type="file";file.accept=".csv,text/csv,text/plain";file.setAttribute("aria-label","Relevé CSV opérateur");
 file.hidden=true;
 file.addEventListener("change",async()=>{
  const selected=file.files?.[0];if(!selected)return;
  try{
   if(selected.size>180000)throw Error("Fichier trop volumineux");
   const text=await selected.text();const payload=JSON.parse(input.value);payload.csv=text;input.value=JSON.stringify(payload,null,2);
  }catch(e){output.textContent="CSV non chargé : "+String(e.message||"Erreur").slice(0,200);}
  finally{file.value="";}
 });
 const run=el("button","Analyser");run.type="button";run.className="pa-btn";
 const output=el("div");output.setAttribute("role","status");
 const template=()=>{const data=structuredClone(specs[picker.value].template);if(picker.value==="call-economics"){const end=new Date();end.setUTCMilliseconds(0);data.to_utc=end.toISOString().replace(".000Z","Z");data.from_utc=new Date(end.getTime()-7*86400000).toISOString().replace(".000Z","Z");}input.value=JSON.stringify(data,null,2);file.hidden=!["normalize-csv","reconcile-csv"].includes(picker.value);output.replaceChildren();};
 picker.addEventListener("change",template);template();
 run.addEventListener("click",async()=>{
  run.disabled=true;picker.disabled=true;output.textContent="Analyse en cours…";
  try{
   if(!Object.hasOwn(specs,picker.value)||input.value.length>200000)throw Error("Données trop volumineuses ou invalides");
   const payload=JSON.parse(input.value);if(!payload||typeof payload!=="object"||Array.isArray(payload))throw Error("Objet JSON requis");
   renderResult(output,await postJson("/platform/wholesale/"+picker.value,payload));
  }catch(e){output.textContent="Analyse indisponible : "+String(e.code||e.message||"Erreur").slice(0,200);}
  finally{run.disabled=false;picker.disabled=false;}
 });
 root.append(picker,note,file,input,run,output);
 try{
  const res=await fetch(apiBase()+"/platform/wholesale/independence",{credentials:"include",cache:"no-store",headers:{Accept:"application/json"}});
  if(!res.ok)throw Error("WHOLESALE_INVENTORY_UNAVAILABLE");
  const data=await res.json();status.replaceChildren();
  const r=data.resource_records||{};
  line(status,"Blocs ARCEP enregistrés",r.recorded_current_grants);
  line(status,"Numéros en inventaire",r.inventory_records);
  line(status,"Contrats d’interconnexion enregistrés",r.recorded_current_contracts);
  for(const x of data.logical_routes||[])line(status,x.route_key,x.active_carrier||"Aucun opérateur actif enregistré");
  for(const x of data.carrier_finance||[])line(status,x.carrier_name||"Opérateur non identifié",x.expected_ht+" € HT attendus · "+x.recorded_paid_ht+" € HT marqués payés (30 jours)");
  status.append(el("p","Les données enregistrées ne constituent pas une preuve d’encaissement bancaire ni une autorisation réglementaire."));
 }catch(e){status.textContent="Inventaire réel indisponible. Aucune valeur n’est supposée.";feedback?.("Inventaire télécom indisponible","error");}
}
