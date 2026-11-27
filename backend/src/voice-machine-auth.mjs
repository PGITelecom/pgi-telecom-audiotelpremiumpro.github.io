// Private machine authentication for the future voice gateway.
// TLS and a private network are mandatory at the transport boundary.
// No public HTTP route is registered by this module.
import {createHash,createHmac,timingSafeEqual} from "node:crypto";
import {voiceNodeId,voiceCallId} from "./voice-reservation-lifecycle.mjs";
const PATHS=new Set(["/voice/v1/reserve","/voice/v1/observe"]);
const WINDOW=60;
function fail(code){const e=new Error(code);e.code=code;throw e;}
function secretBytes(secret){
 if(typeof secret!=="string"||! /^[A-Za-z0-9_-]{43}$/.test(secret))fail("VOICE_MACHINE_KEY_INVALID");
 const b=Buffer.from(secret,"base64url");
 if(b.length!==32||b.toString("base64url")!==secret)fail("VOICE_MACHINE_KEY_INVALID");
 return b;
}
function canonical({node,keyId,timestamp,nonce,path,body}){
 voiceNodeId(node);
 if(typeof keyId!=="string"||! /^[A-Za-z0-9_-]{1,64}$/.test(keyId))fail("VOICE_MACHINE_KEY_ID_INVALID");
 if(!Number.isSafeInteger(timestamp)||timestamp<1)fail("VOICE_MACHINE_TIME_INVALID");
 if(typeof nonce!=="string"||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(nonce))fail("VOICE_MACHINE_NONCE_INVALID");
 if(!PATHS.has(path)||!Buffer.isBuffer(body)||body.length===0||body.length>16384)fail("VOICE_MACHINE_REQUEST_INVALID");
 return ["PGI-VOICE-V1","POST",path,node,keyId,String(timestamp),nonce,createHash("sha256").update(body).digest("hex")].join("\n");
}
export function signVoiceMachineRequest(input,secret){
 return createHmac("sha256",secretBytes(secret)).update(canonical(input)).digest("hex");
}
export async function authenticateVoiceMachineRequest(input,{resolveKey,consumeNonce,now=()=>Math.floor(Date.now()/1000)}={}){
 const message=canonical(input);
 const time=now();
 if(!Number.isSafeInteger(time)||Math.abs(time-input.timestamp)>WINDOW)fail("VOICE_MACHINE_REQUEST_EXPIRED");
 if(typeof input.signature!=="string"||! /^[0-9a-f]{64}$/.test(input.signature))fail("VOICE_MACHINE_AUTH_FAILED");
 if(typeof resolveKey!=="function"||typeof consumeNonce!=="function")fail("VOICE_MACHINE_AUTH_UNCONFIGURED");
 const key=await resolveKey(input.node,input.keyId);
 if(!key||key.enabled!==true||key.node_id!==input.node||key.key_id!==input.keyId||!Number.isSafeInteger(key.valid_from)||!Number.isSafeInteger(key.valid_until)||time<key.valid_from||time>=key.valid_until)fail("VOICE_MACHINE_AUTH_FAILED");
 const expected=createHmac("sha256",secretBytes(key.secret)).update(message).digest();
 if(!timingSafeEqual(expected,Buffer.from(input.signature,"hex")))fail("VOICE_MACHINE_AUTH_FAILED");
 // Consume only authenticated requests. Retries must use a fresh nonce and
 // retain the original call UUID / event sequence for business idempotency.
 if(await consumeNonce({node_id:input.node,key_id:input.keyId,nonce:input.nonce,expires_at:Math.max(time,input.timestamp)+WINDOW+1})!==true)fail("VOICE_MACHINE_REPLAY");
 let payload;
 try{payload=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(input.body));}catch{fail("VOICE_MACHINE_BODY_INVALID");}
 if(!payload||typeof payload!=="object"||Array.isArray(payload))fail("VOICE_MACHINE_BODY_INVALID");
 voiceCallId(payload.call_id);
 return {authenticatedNode:input.node,payload};
}
export function postgresVoiceNonceConsumer(sql){
 return async ({node_id,key_id,nonce,expires_at})=>{
  const rows=await sql.unsafe("INSERT INTO voice_machine_nonces(node_id,key_id,nonce,expires_at) VALUES($1,$2,$3::uuid,to_timestamp($4::double precision)) ON CONFLICT DO NOTHING RETURNING nonce",[node_id,key_id,nonce,expires_at]);
  return rows.length===1;
 };
}
