// PREPARATION ONLY: not imported by the public portal or static build.
// Inject a pinned, self-hosted SIP.js SimpleUser after gateway acceptance.
// Single concurrent incoming session per endpoint. No outgoing call method.
// Browser events are never evidence of server-side call termination/billing.
function fail(code){const e=new Error(code);e.code=code;throw e;}
export function createInboundSipAdapter({SimpleUser,grant,expectedWss,expectedSipDomain,remoteAudio,onState=()=>{},now=Date.now}={}){
 if(typeof SimpleUser!=="function"||typeof now!=="function"||typeof onState!=="function")fail("SIP_ADAPTER_INVALID");
 if(grant?.enabled!==true||!remoteAudio||!expectedWss||!expectedSipDomain)fail("SIP_NOT_AUTHORIZED");
 let url;
 try{url=new URL(grant.wss_url);}catch{fail("SIP_GATEWAY_INVALID");}
 if(url.protocol!=="wss:"||url.username||url.password||url.search||url.hash||url.href!==expectedWss)fail("SIP_GATEWAY_INVALID");
 if(typeof expectedSipDomain!=="string"||! /^[A-Za-z0-9.-]+$/.test(expectedSipDomain))fail("SIP_DOMAIN_INVALID");
 const username=grant.username,password=grant.password;
 if(typeof username!=="string"||! /^[A-Za-z0-9_.-]{1,128}$/.test(username)||typeof password!=="string"||password.length<16||password.length>512)fail("SIP_CREDENTIAL_INVALID");
 const aor="sip:"+username+"@"+expectedSipDomain;
 if(grant.aor!==aor)fail("SIP_AOR_INVALID");
 const expires=Date.parse(grant.expires_at);
 if(!Number.isFinite(expires)||expires<=now()+30000||expires>now()+600000)fail("SIP_GRANT_EXPIRY_INVALID");
 // Require the approved PGI TURN configuration, never a public STUN default.
 // The grant issuer and WSS gateway must enforce tenant and device scope.
 if(!Array.isArray(grant.ice_servers)||grant.ice_servers.length<1||grant.ice_servers.length>4)fail("SIP_ICE_REQUIRED");
 const iceServers=grant.ice_servers.map(s=>{
  if(typeof s?.urls!=="string"||! /^turns:[A-Za-z0-9.-]+(?::[0-9]{1,5})?\?transport=tcp$/.test(s.urls)||typeof s.username!=="string"||!s.username||typeof s.credential!=="string"||!s.credential)fail("SIP_ICE_INVALID");
  return {urls:s.urls,username:s.username,credential:s.credential};
 });
 let state="idle",transport=false,registered=false,occupied=false,closed=false,muted=false,busy=false;
 const snapshot=()=>({state,transport,registered,occupied,muted,busy,authoritative:false});
 function emit(next){state=next;try{onState(snapshot());}catch{/* UI cannot interrupt signaling. */}}
 const delegate={
  onServerConnect(){if(closed)return;transport=true;emit(occupied?"uncertain":"registering");},
  onRegistered(){if(closed)return;registered=true;emit(occupied?"uncertain":"available");},
  onUnregistered(){if(closed)return;registered=false;emit(occupied?"uncertain":"unavailable");},
  onServerDisconnect(){if(closed)return;transport=false;registered=false;emit(occupied?"uncertain":"offline");},
  onCallReceived(){if(closed)return;occupied=true;muted=false;emit(transport?"incoming":"uncertain");},
  onCallAnswered(){if(closed)return;occupied=true;emit(transport?"connected":"uncertain");},
  onCallHangup(){if(closed)return;muted=false;
   // Local hangup is a UI event only. A lost signaling path requires
   // authoritative reconciliation before this endpoint may be reused.
   if(!transport||state==="uncertain"){emit("uncertain");return;}
   occupied=false;emit(registered?"available":"unavailable");
  }
 };
 const user=new SimpleUser(url.href,{
  aor,delegate,reconnectionAttempts:0,
  media:{constraints:{audio:true,video:false},remote:{audio:remoteAudio}},
  registererOptions:{expires:60},
  userAgentOptions:{authorizationUsername:username,authorizationPassword:password,
   logConfiguration:false,logBuiltinEnabled:false,logLevel:"error",
   sessionDescriptionHandlerFactoryOptions:{peerConnectionConfiguration:{iceServers,iceTransportPolicy:"relay"}}}
 });
 async function run(allowed,action){
  if(closed||busy||!allowed.includes(state))fail("SIP_ACTION_NOT_ALLOWED");
  busy=true;emit(state);
  try{await action();}
  catch{emit(occupied?"uncertain":"unavailable");fail("SIP_ACTION_FAILED");}
  finally{busy=false;emit(state);}
 }
 return Object.freeze({
  snapshot,
  // No auto retry during ambiguous calls. Obtain a fresh grant after expiry.
  start:()=>run(["idle"],async()=>{if(expires<=now()+30000)fail("SIP_GRANT_EXPIRED");emit("connecting");await user.connect();await user.register();}),
  answer:()=>run(["incoming"],async()=>{emit("answering");await user.answer();}),
  decline:()=>run(["incoming"],async()=>{emit("ending");await user.decline();}),
  hangup:()=>run(["connected"],async()=>{emit("ending");await user.hangup();}),
  toggleMute:()=>run(["connected"],async()=>{if(muted)await user.unmute();else await user.mute();muted=!muted;}),
  close:()=>run(["idle","available","unavailable","offline"],async()=>{
   if(occupied)fail("SIP_RECONCILIATION_REQUIRED");
   if(registered)await user.unregister();
   await user.disconnect();closed=true;transport=false;registered=false;emit("closed");
  })
 });
}
