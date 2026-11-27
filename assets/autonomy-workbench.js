// Administrateur uniquement, opt-in. Aucun appel reseau, stockage ou transfert.
import {evaluateAutonomyCosts} from "./autonomy-cost-engine.mjs";
const ID="audiotel-autonomy-cost-workbench";
const eur=new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"});
const integer=new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0});
const css=`
#${ID}{padding:16px;margin:14px 0;background:#101c2b;border:1px solid #456176;border-radius:12px;color:#eaf2fa}
#${ID} *{box-sizing:border-box}
#${ID} h3{margin:0 0 9px;font-size:18px;color:#fff}
#${ID} h4{margin:0 0 10px;font-size:13px;color:#fff}
#${ID} p,#${ID} small{font-size:12px;line-height:1.55;color:#bdcfde}
#${ID} .awc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:12px 0}
#${ID} .awc-box{border:1px solid #38556a;border-radius:9px;padding:12px;min-width:0}
#${ID} label{display:grid;gap:5px;margin:9px 0;font-size:12px}
#${ID} input{width:100%;min-height:44px;border:1px solid #70899a;border-radius:8px;background:#091521;color:white;padding:9px;font-size:16px}
#${ID} button{min-height:44px;border:1px solid #70899a;border-radius:8px;background:#234151;color:white;padding:9px 16px;cursor:pointer}
#${ID} input:focus-visible,#${ID} button:focus-visible{outline:2px solid #ffca86;outline-offset:2px}
#${ID} .awc-result{border:1px solid #3e6474;border-radius:8px;padding:11px;margin-top:12px}
#${ID} .awc-warn{color:#ffd5a0}
@media(max-width:720px){#${ID} .awc-grid{grid-template-columns:1fr}}
`;
const content=(root,message)=>{const p=document.createElement("p");p.textContent=message;root.appendChild(p);};
function get(form,name){
 const input=form.elements.namedItem(name);
 if(!input||!input.value.trim())throw new RangeError("Tous les champs doivent etre renseignes, y compris les frais nuls (0).");
 return input.value.trim().replace(",",".");
}
export function mountAutonomyWorkbench(host){
 if(!host?.isConnected||host.dataset.awcReady==="true")return;
 if(window.PGI_CONFIG?.autonomyWorkbenchEnabled!==true)return;
 host.id=ID;
 host.setAttribute("aria-label","Simulation de coûts entre deux architectures téléphoniques");
 if(!document.getElementById("audiotel-autonomy-workbench-css")){
  const style=document.createElement("style");style.id="audiotel-autonomy-workbench-css";
  style.textContent=css;document.head.appendChild(style);
 }
 host.innerHTML=`
 <h3>Autonomie SVA : comparer deux modèles</h3>
 <p>Calcul local et indicatif, aucune donnée sauvegardée. Les tarifs réels ne sont pas présumés connus.</p>
 <p class="awc-warn">Saisir la part de revenu HT contractuellement acquise à Audiotel après reversement éditeur, avant frais d'exploitation. Hors TVA, fiscalité, cotisations, fraude et charges non renseignées.</p>
 <form data-awc-form novalidate>
 <div class="awc-grid">
 <div class="awc-box"><h4>Données communes</h4>
 <label>Minutes mensuelles facturables<input name="minutes" type="number" inputmode="numeric" min="0" step="1" placeholder="A renseigner"></label>
 <label>Part Audiotel par minute (€ HT)<input name="revenue" type="text" inputmode="decimal" placeholder="Apres part editeur"></label></div>
 <div class="awc-box"><h4>A. Opérateur intégré</h4>
 <label>Coûts variables totaux (€/minute)<input name="av" type="text" inputmode="decimal" placeholder="Contrat verifie"></label>
 <label>Frais mensuels fixes (€)<input name="af" type="text" inputmode="decimal" placeholder="Abonnements compris"></label></div>
 <div class="awc-box"><h4>B. Nos logiciels + collecte minimale</h4>
 <label>Coûts variables totaux (€/minute)<input name="bv" type="text" inputmode="decimal" placeholder="Collecte, reseau, voix"></label>
 <label>Frais mensuels fixes (€)<input name="bf" type="text" inputmode="decimal" placeholder="Serveurs, maintenance, secours"></label></div>
 </div><button type="submit">Comparer les coûts</button>
 </form><div class="awc-result" data-awc-result role="status" aria-live="polite">Saisissez les hypothèses ou tarifs vérifiés pour obtenir une comparaison.</div>
 <small>Lecture et calcul uniquement : aucune activation 089, aucun virement et aucun changement d'operateur. Ne saisissez pas de donnée client ou de secret.</small>`;
 const form=host.querySelector("[data-awc-form]");
 const output=host.querySelector("[data-awc-result]");
 form.addEventListener("submit",event=>{
  event.preventDefault();output.replaceChildren();
  try{
   const r=evaluateAutonomyCosts({minutes:get(form,"minutes"),retainedRevenuePerMinute:get(form,"revenue"),options:[
    {variableCostPerMinute:get(form,"av"),fixedCostMonthly:get(form,"af")},
    {variableCostPerMinute:get(form,"bv"),fixedCostMonthly:get(form,"bf")}
   ]});
   content(output,"Part mensuelle theorique avant frais : "+eur.format(r.monthlyRetainedRevenue));
   content(output,"A : coûts "+eur.format(r.options[0].monthlyCost)+" ; contribution avant fiscalité "+eur.format(r.options[0].monthlyContribution));
   content(output,"B : coûts "+eur.format(r.options[1].monthlyCost)+" ; contribution avant fiscalité "+eur.format(r.options[1].monthlyContribution));
   const winner=r.winner==="independent"?"B moins coûteux":r.winner==="integrated"?"A moins coûteux":"Coûts équivalents";
   content(output,winner+" sur les seuls chiffres saisis. Ecart B moins A : "+eur.format(r.monthlyDifference));
   if(r.breakEvenMinutes!==null)content(output,"Seuil théorique des coûts de B versus A : "+integer.format(r.breakEvenMinutes)+" minutes/mois");
   content(output,"Ce résultat n'est ni un bénéfice personnel net, ni une offre, ni une autorisation de lancement.");
  }catch(e){content(output,e instanceof RangeError?e.message:"Calcul indisponible.");}
 });
 host.dataset.awcReady="true";
}
