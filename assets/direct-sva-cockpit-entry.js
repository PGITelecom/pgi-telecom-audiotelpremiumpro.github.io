// Lazily mount only for an authenticated administrator on the main Cockpit.
// Never exposes the commercial activation lock or duplicates controls in accounting.
export async function mountDirectSvaCockpitControls(user){
 const overview=document.getElementById("view-overview");
 if(!overview)return;
 let host=document.getElementById("direct-sva-cockpit-controls");
 if(user?.role!=="admin"){host?.remove();return;}
 if(!host){
  host=document.createElement("section");
  host.id="direct-sva-cockpit-controls";
  host.className="pgi-direct-sva-cockpit-controls";
  host.setAttribute("aria-label","Commandes PGI Telecom Distribution");
  host.hidden=true;
  overview.prepend(host);
 }
 if(host.dataset.ready==="true"||host.dataset.loading==="true")return;
 host.dataset.loading="true";
 try{
  const module=await import("./direct-sva-switches.js");
  if(!host.isConnected)return;
  await module.mountDirectSvaSwitches(host,{onPreviewChange(enabled){
   window.dispatchEvent(new CustomEvent("pgi:direct-sva-preview-change",{detail:{enabled:enabled===true}}));
  }});
  if(host.isConnected)host.dataset.ready="true";
 }catch(_error){
  if(host.isConnected){host.hidden=false;host.textContent="Commandes Distribution temporairement indisponibles. Actualisez le cockpit.";}
 }finally{delete host.dataset.loading;}
}
