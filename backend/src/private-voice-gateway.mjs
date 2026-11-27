// Future private gateway dispatcher. Not registered on Vercel or public API.
// Host adapter must enforce TLS, exact POST paths, size and private ingress.
// Reserve only from trusted routing decisions, not arbitrary IDs from a browser.
import {authenticateVoiceMachineRequest,postgresVoiceNonceConsumer} from "./voice-machine-auth.mjs";
import {reserveVoiceLine,recordVoiceMediaObservation} from "./voice-reservation-store.mjs";
function fail(code){const e=new Error(code);e.code=code;throw e;}
export function createPrivateVoiceGateway({sql,resolveKey,resolveMode,admitReservation,now,operations={reserve:reserveVoiceLine,observe:recordVoiceMediaObservation},consumeNonce}={}){
 if(!sql||typeof resolveKey!=="function"||typeof resolveMode!=="function"||typeof admitReservation!=="function")fail("VOICE_GATEWAY_UNCONFIGURED");
 const nonce=consumeNonce||postgresVoiceNonceConsumer(sql);
 return async function dispatch(request){
  const {authenticatedNode,payload}=await authenticateVoiceMachineRequest(request,{resolveKey,consumeNonce:nonce,now});
  // Resolve mode fresh per request. Drain blocks new calls but retains closure
  // and media observations so that rollback never abandons existing calls.
  const mode=await resolveMode();
  if(!["disabled","draining","enabled"].includes(mode)||mode==="disabled")fail("VOICE_GATEWAY_DISABLED");
  if(request.path==="/voice/v1/observe"){
   return operations.observe(sql,{call_id:payload.call_id,generation:payload.generation,sequence:payload.sequence,state:payload.state},{authenticatedNode});
  }
  if(mode!=="enabled")fail("VOICE_GATEWAY_DRAINING");
  // A trusted server-side decision must bind this root call to the precise
  // destination and prove that the legacy routing engine cannot use it.
  const decision=await admitReservation({node_id:authenticatedNode,call_id:payload.call_id});
  if(!decision||decision.allowed!==true||decision.exclusive!==true||decision.node_id!==authenticatedNode||decision.call_id!==payload.call_id.toLowerCase())fail("VOICE_ROUTE_NOT_AUTHORIZED");
  return operations.reserve(sql,{call_id:decision.call_id,tenant_id:decision.tenant_id,sva_number_id:decision.sva_number_id,destination_id:decision.destination_id},{authenticatedNode});
 };
}
