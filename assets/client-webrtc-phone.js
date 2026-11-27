// Local device readiness only. No SIP registration, audio upload, CDR or billing.
// Future live controls must be authorized by a server-issued, tenant-bound session.
const el=id=>document.getElementById(id);
export function browserVoiceReadiness({secure=globalThis.isSecureContext,media=globalThis.navigator?.mediaDevices,peer=globalThis.RTCPeerConnection,audio=globalThis.AudioContext||globalThis.webkitAudioContext,policy=globalThis.document?.permissionsPolicy||globalThis.document?.featurePolicy}={}){
 let microphoneAllowed=true;
 try{if(typeof policy?.allowsFeature==="function")microphoneAllowed=policy.allowsFeature("microphone");}catch{microphoneAllowed=false;}
 return {secure:secure===true,webrtc:typeof peer==="function",microphone:typeof media?.getUserMedia==="function"&&microphoneAllowed,audio:typeof audio==="function"};
}
export function mountVoicePhone({getDemo=()=>false}={}){
 const studio=el("client-voice-studio"),app=el("customer-app");
 if(!studio||!app||el("client-webrtc-phone"))return;
 const section=document.createElement("section");
 section.id="client-webrtc-phone";section.className="vs-card";
 section.style.margin="12px 0";
 section.innerHTML='<div class="vs-card-top"><div><h3>Téléphone WebRTC</h3><small>Réception directe des appels dans votre navigateur</small></div><span class="vs-chip draft">NON RACCORDÉ</span></div><p class="vs-note" role="status" id="pgi-phone-network">La réception reste inactive : raccordement SIP et serveur voix requis. Vos destinations actuelles restent inchangées.</p><div class="vs-actions"><button type="button" class="vs-btn" id="pgi-phone-mic">Vérifier le microphone</button><button type="button" class="vs-btn" id="pgi-phone-speaker">Vérifier le son</button><button type="button" class="vs-btn" id="pgi-phone-stop" disabled>Arrêter le contrôle</button></div><p class="vs-note" id="pgi-phone-device" role="status" aria-live="polite"></p><div class="vs-actions" aria-label="Commandes de réception inactives"><button type="button" class="vs-btn good" disabled>Décrocher</button><button type="button" class="vs-btn" disabled>Refuser</button><button type="button" class="vs-btn" disabled>Couper le micro</button><button type="button" class="vs-btn" disabled>Raccrocher</button></div><p class="vs-note">Les contrôles audio sont locaux, sans enregistrement ni transmission. Aucun appel ni coût téléphonique n’est déclenché.</p>';
 const list=el("voice-studio-list");
 studio.insertBefore(section,list&&list.parentNode===studio?list:null);
 const mic=el("pgi-phone-mic"),speaker=el("pgi-phone-speaker"),stopButton=el("pgi-phone-stop"),device=el("pgi-phone-device");
 let generation=0,stream=null,context=null,timer=null,busy=false;
 const visible=()=>!app.hidden&&!document.hidden&&section.isConnected&&!getDemo();
 function refresh(){
  const r=browserVoiceReadiness();
  mic.disabled=busy||!visible()||!r.secure||!r.microphone||!r.webrtc;
  speaker.disabled=busy||!visible()||!r.audio;
  stopButton.disabled=!busy;
 }
 function stop(message){
  generation++;busy=false;
  clearTimeout(timer);timer=null;
  if(stream){for(const track of stream.getTracks())track.stop();stream=null;}
  if(context){const old=context;context=null;void old.close().catch(()=>{});}
  if(message)device.textContent=message;
  refresh();
 }
 async function checkMic(){
  if(!visible()||busy||mic.disabled)return;
  busy=true;const own=++generation;refresh();
  device.textContent="Autorisez le microphone dans votre navigateur.";
  timer=setTimeout(()=>{if(own===generation)stop("Contrôle interrompu : autorisation trop longue.");},20000);
  try{
   const acquired=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
   if(own!==generation||!visible()){for(const t of acquired.getTracks())t.stop();if(own===generation)stop("Contrôle interrompu.");return;}
   stream=acquired;
   const tracks=stream.getAudioTracks();
   const ok=tracks.some(t=>t.readyState==="live"&&t.enabled);
   stop(ok?"Microphone accessible. Cela ne confirme pas la disponibilité du réseau SIP.":"Aucun microphone actif.");
  }catch(e){if(own===generation)stop(e?.name==="NotAllowedError"?"Accès au microphone refusé ou bloqué par le navigateur.":e?.name==="NotFoundError"?"Aucun microphone détecté.":"Microphone momentanément inaccessible.");}
 }
 async function checkSpeaker(){
  if(!visible()||busy||speaker.disabled)return;
  busy=true;const own=++generation;refresh();
  timer=setTimeout(()=>{if(own===generation)stop("Contrôle sonore terminé.");},3000);
  try{
   const C=globalThis.AudioContext||globalThis.webkitAudioContext;
   context=new C();
   await context.resume();
   if(own!==generation||!visible()){if(own===generation)stop("Contrôle interrompu.");return;}
   const osc=context.createOscillator(),gain=context.createGain();
   const now=context.currentTime;
   osc.frequency.value=440;gain.gain.setValueAtTime(0.06,now);
   gain.gain.exponentialRampToValueAtTime(0.001,now+0.45);
   osc.connect(gain);gain.connect(context.destination);
   osc.onended=()=>{if(own===generation)stop("Signal sonore émis. Vérifiez que vous l’avez entendu.");};
   osc.start(now);osc.stop(now+0.5);
  }catch{if(own===generation)stop("Lecture audio impossible sur cet appareil.");}
 }
 mic.addEventListener("click",checkMic);
 speaker.addEventListener("click",checkSpeaker);
 stopButton.addEventListener("click",()=>stop("Contrôle interrompu."));
 const onVisibility=()=>{if(!visible()&&busy)stop("Contrôle interrompu.");else refresh();};
 document.addEventListener("visibilitychange",onVisibility);
 window.addEventListener("pagehide",()=>stop("Contrôle interrompu."));
 new MutationObserver(onVisibility).observe(app,{attributes:true,attributeFilter:["hidden"]});
 const r=browserVoiceReadiness();
 device.textContent=getDemo()?"Contrôles indisponibles en démonstration.":!r.secure?"HTTPS requis.":!r.webrtc?"WebRTC non disponible sur ce navigateur.":!r.microphone?"Microphone indisponible ou bloqué par la politique de sécurité.":"Contrôlez votre microphone et votre sortie audio avant le raccordement.";
 refresh();
}
