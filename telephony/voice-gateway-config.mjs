// Private voice host only: no defaults for network identities or credentials.
import {open,realpath} from "node:fs/promises";
import {constants} from "node:fs";
import path from "node:path";
import {isIP} from "node:net";
import {voiceNodeId} from "../backend/src/voice-reservation-lifecycle.mjs";
function fail(code){const e=new Error(code);e.code=code;throw e;}
export function privateVoiceBind(ip){
 if(typeof ip!=="string"||isIP(ip)!==4)return false;
 const [a,b]=ip.split(".").map(Number);
 return a===127||a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168);
}
export function normalizeFingerprint(value){
 if(typeof value!=="string"||! /^(?:[0-9a-f]{2}:){31}[0-9a-f]{2}$/i.test(value))fail("VOICE_CERT_FINGERPRINT_INVALID");
 return value.toUpperCase();
}
function secretPath(value){
 if(typeof value!=="string"||!path.isAbsolute(value)||value==="/"||path.normalize(value)!==value)fail("VOICE_PRIVATE_FILE_REQUIRED");
 return value;
}
export async function readPrivateVoiceFile(file,max=65536){
 file=secretPath(file);
 if(await realpath(file)!==file)fail("VOICE_PRIVATE_FILE_SYMLINK");
 const handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const s=await handle.stat();
  if(!s.isFile()||s.uid!==process.getuid()||(s.mode&0o077)!==0||s.nlink!==1||s.size<1||s.size>max)fail("VOICE_PRIVATE_FILE_PERMISSIONS");
  const body=await handle.readFile();
  if(body.length>max)fail("VOICE_PRIVATE_FILE_SIZE");
  return body;
 }finally{await handle.close();}
}
export function validateVoiceGatewayConfig(raw){
 if(!raw||typeof raw!=="object"||raw.enabled!==true)fail("VOICE_GATEWAY_CONFIG_DISABLED");
 if(!privateVoiceBind(raw.bind_ipv4))fail("VOICE_PRIVATE_BIND_REQUIRED");
 if(!Number.isInteger(raw.port)||raw.port<1024||raw.port>65535)fail("VOICE_GATEWAY_PORT_INVALID");
 if(!Array.isArray(raw.nodes)||raw.nodes.length<1||raw.nodes.length>100)fail("VOICE_GATEWAY_NODES_INVALID");
 const keys=new Map(),fingerprints=new Map();
 for(const x of raw.nodes){
  const node=voiceNodeId(x.node_id);
  const fp=normalizeFingerprint(x.certificate_sha256);
  if(fingerprints.has(fp)&&fingerprints.get(fp)!==node)fail("VOICE_CERT_NODE_CONFLICT");
  fingerprints.set(fp,node);
  if(typeof x.key_id!=="string"||! /^[A-Za-z0-9_-]{1,64}$/.test(x.key_id))fail("VOICE_KEY_ID_INVALID");
  if(typeof x.secret!=="string"||! /^[A-Za-z0-9_-]{43}$/.test(x.secret)||Buffer.from(x.secret,"base64url").toString("base64url")!==x.secret)fail("VOICE_KEY_INVALID");
  if(typeof x.enabled!=="boolean"||!Number.isSafeInteger(x.valid_from)||!Number.isSafeInteger(x.valid_until)||x.valid_until<=x.valid_from)fail("VOICE_KEY_VALIDITY_INVALID");
  const k=node+":"+x.key_id;
  if(keys.has(k))fail("VOICE_KEY_DUPLICATE");
  keys.set(k,{node_id:node,key_id:x.key_id,enabled:x.enabled,secret:x.secret,valid_from:x.valid_from,valid_until:x.valid_until,certificate_sha256:fp});
 }
 return {bind_ipv4:raw.bind_ipv4,port:raw.port,cert_file:secretPath(raw.cert_file),key_file:secretPath(raw.key_file),ca_file:secretPath(raw.ca_file),keys};
}
export async function loadVoiceGatewayConfig(file){
 const bytes=await readPrivateVoiceFile(file);
 let raw;
 try{raw=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));}catch{fail("VOICE_GATEWAY_CONFIG_INVALID");}
 return validateVoiceGatewayConfig(raw);
}
