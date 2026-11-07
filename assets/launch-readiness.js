const esc=v=>String(v??"").replace(/[&<>"']/g,c=>c==="&"?"&amp;":c==="<"?"&lt;":c===">"?"&gt;":c==='"'?"&quot;":"&#039;");

function badge(status){
  const s=String(status||"").toLowerCase();
  const cls=s==="ready"?"ok":s==="blocked"?"bad":"warn";
  const label={ready:"PRÊT",blocked:"BLOQUÉ",action_required:"ACTION",pending_external:"EXTERNE"}[s]||s.toUpperCase();
  return '<span class="ct-badge '+cls+'">'+esc(label)+'</span>';
}

function exportEvidence(data){
  const blob=new Blob([JSON.stringify(data,null,2)+"\n"],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  const stamp=String(data.generated_at||new Date().toISOString()).replace(/[:.]/g,"-");
  a.download="launch-readiness-"+stamp+".json";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),0);
}

export async function render(target,request){
  if(!target)return;
  target.innerHTML='<p class="ct-note">Calcul du gate de mise en production…</p>';
  try{
    const data=await request("/platform/launch-readiness");
    const sections=Array.isArray(data.sections)?data.sections:[];
    target.innerHTML='<div class="ct-score"><div class="ct-ring" style="--score:'+Math.max(0,Math.min(100,Number(data.score)||0))+'%"><strong>'+esc(data.score||0)+'%</strong></div><div><p class="ct-kicker">LAUNCH READINESS</p><div class="ct-status">'+badge(data.ready_for_b2b?"ready":"blocked")+'<span class="ct-badge">B2B</span>'+badge(data.ready_for_b2c?"ready":"blocked")+'<span class="ct-badge">B2C</span></div><p class="ct-note">Gate fondé sur l’état réellement observable. Un branchement externe absent reste bloquant : aucun statut n’est déduit d’une maquette ou d’une intention.</p><div class="ct-actions"><button class="ct-btn" type="button" data-launch-readiness-export>Exporter la preuve JSON</button></div></div></div><div class="ct-list" style="margin-top:12px">'+sections.map(x=>'<div class="ct-row"><div><strong>'+esc(x.label)+'</strong><small>'+esc(x.detail)+'</small></div>'+badge(x.status)+'</div>').join("")+'</div>';
    const priorities=data.audiotel_operational_priorities;
    if(priorities?.business_unit==="audiotel_platform"&&Array.isArray(priorities.actions)){
      const actions=priorities.actions.slice(0,10);
      const dependencyLabel={internal:"Interne",external:"Opérateur / prestataire",
        legal:"Réglementaire",accounting:"Comptabilité",stripe_deferred:"Stripe différé"};
      const rows=actions.map(x=>'<div class="ct-row"><div><strong>'+esc(x.title)+'</strong>'+
        '<small>'+esc(x.action)+'</small></div><span class="ct-badge '+
        (x.priority==="critical"?"bad":"warn")+'">'+esc(dependencyLabel[x.dependency]||"À traiter")+'</span></div>').join("");
      target.insertAdjacentHTML("beforeend",
        '<section class="ct-list" style="margin-top:16px" aria-label="Priorités Audiotel">'+
        '<div class="ct-row"><div><strong>Actions prioritaires Audiotel Premium Pro</strong>'+
        '<small>À partir des preuves observées : '+esc(priorities.action_count)+' point(s) restant(s). '+
        'Les contrôles listés ne constituent ni une attribution de numéro, ni un paiement, ni une autorisation de lancement.</small></div>'+
        '<span class="ct-badge warn">Préparation</span></div>'+
        (rows||'<div class="ct-row"><small>Aucun blocage détecté par ce diagnostic. '+
          'Les contrôles externes et la recette restent obligatoires.</small></div>')+
        '</section>');
    }
    target.querySelector("[data-launch-readiness-export]")?.addEventListener("click",()=>exportEvidence(data));
  }catch(error){
    target.innerHTML='<p class="ct-note">Launch Readiness indisponible. '+esc(error.code||error.message||"")+'</p>';
  }
}
