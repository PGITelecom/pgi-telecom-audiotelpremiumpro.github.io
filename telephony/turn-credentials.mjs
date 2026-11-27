// Short-lived TURN REST credentials for a future approved Coturn deployment.
// Server-side utility only, no browser exposure of the shared HMAC key.
// Not wired to a public endpoint: tenant/session authorization remains required.
import {createHmac} from "node:crypto";
function fail(code){const e=new Error(code);e.code=code;e.status=400;throw e;}
export function issueTurnCredentials({subject,sharedSecret,turnUrls,ttlSeconds=300,now=new Date()}={}){
 if(typeof subject!=="string"||! /^[A-Za-z0-9_-]{8,80}$/.test(subject))fail("TURN_INVALID_SUBJECT");
 if(typeof sharedSecret!=="string"||Buffer.byteLength(sharedSecret)<32||Buffer.byteLength(sharedSecret)>512)fail("TURN_SECRET_INVALID");
 if(!Number.isSafeInteger(ttlSeconds)||ttlSeconds<60||ttlSeconds>600)fail("TURN_TTL_INVALID");
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))fail("TURN_TIME_INVALID");
 if(!Array.isArray(turnUrls)||!turnUrls.length||turnUrls.length>4||new Set(turnUrls).size!==turnUrls.length)fail("TURN_URLS_INVALID");
 for(const u of turnUrls){
  // TLS TURN over TCP only in this conservative starter profile.
  if(typeof u!=="string"||!/^turns:[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?:5349\?transport=tcp$/.test(u))fail("TURN_TLS_URL_REQUIRED");
 }
 const expires=Math.floor(now.getTime()/1000)+ttlSeconds;
 if(!Number.isSafeInteger(expires)||expires<=0)fail("TURN_TIME_INVALID");
 const username=expires+":"+subject;
 // Coturn REST API uses HMAC-SHA1 for interoperability, not password storage.
 const credential=createHmac("sha1",sharedSecret).update(username).digest("base64");
 return {iceServers:[{urls:[...turnUrls],username,credential}],expires_at:new Date(expires*1000).toISOString(),
  credential_type:"temporary_turn_rest",network_activation_authorized:false};
}
