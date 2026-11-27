// Voice reservation lifecycle, deliberately not wired to the legacy routing API.
// Only authenticated media-node observations may advance media state.
// A browser disconnect, elapsed TTL or unknown network status is not a hangup.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES=new Set(["reserved","dialing","connected","uncertain","released"]);
const MEDIA=new Set(["dialing","connected","unknown","terminal"]);
function fail(code){const e=new Error(code);e.code=code;throw e;}
export function voiceCallId(value){
 if(typeof value!=="string"||!UUID.test(value))fail("VOICE_CALL_ID_INVALID");
 return value.toLowerCase();
}
export function voiceNodeId(value){
 if(typeof value!=="string"||! /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(value))fail("VOICE_NODE_ID_INVALID");
 return value;
}
export function mediaObservation(previous,observation){
 if(!previous||!STATES.has(previous.state))fail("VOICE_STATE_INVALID");
 const call=voiceCallId(observation?.call_id);
 const node=voiceNodeId(observation?.node_id);
 const generation=observation?.generation;
 const sequence=observation?.sequence;
 if(call!==previous.call_id||node!==previous.node_id||generation!==previous.generation)fail("VOICE_RESERVATION_FENCE_MISMATCH");
 if(!Number.isSafeInteger(sequence)||sequence<1||!MEDIA.has(observation.state))fail("VOICE_OBSERVATION_INVALID");
 if(!Number.isSafeInteger(previous.sequence)||previous.sequence<0)fail("VOICE_SEQUENCE_INVALID");
 if(sequence<previous.sequence)return {state:previous.state,sequence:previous.sequence,applied:false,release_capacity:false};
 if(sequence===previous.sequence){
  if(previous.last_observation!==observation.state)fail("VOICE_SEQUENCE_CONFLICT");
  return {state:previous.state,sequence:previous.sequence,applied:false,release_capacity:false};
 }
 // No late event can reopen a released reservation or release capacity twice.
 if(previous.state==="released")return {state:"released",sequence:previous.sequence,applied:false,release_capacity:false};
 let state=previous.state;
 if(observation.state==="terminal")state="released";
 else if(observation.state==="unknown")state="uncertain";
 else if(observation.state==="connected")state="connected";
 else if(observation.state==="dialing"&&previous.state==="reserved")state="dialing";
 // A delayed dialing event must not downgrade connected/uncertain media.
 return {state,sequence,applied:true,last_observation:observation.state,release_capacity:state==="released"};
}
export function reservationHealth(row,now=Date.now(),staleMs=90000){
 if(!STATES.has(row?.state)||!Number.isSafeInteger(now)||!Number.isSafeInteger(staleMs)||staleMs<1000)fail("VOICE_HEALTH_INVALID");
 const time=Date.parse(row.last_observed_at||row.created_at);
 if(!Number.isFinite(time))fail("VOICE_OBSERVATION_TIME_INVALID");
 const stale=now-time>=staleMs;
 return {state:row.state,stale,occupies_capacity:row.state!=="released",
  needs_media_reconciliation:row.state!=="released"&&(stale||row.state==="uncertain"),
  release_authorized:false};
}
