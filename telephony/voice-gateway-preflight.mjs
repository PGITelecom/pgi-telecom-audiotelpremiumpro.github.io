// Read-only local host and PostgreSQL preflight. Does not listen or activate.
import {X509Certificate,createPrivateKey} from "node:crypto";
import {pathToFileURL} from "node:url";
import {loadVoiceGatewayConfig,readPrivateVoiceFile} from "./voice-gateway-config.mjs";
const MIN_CERT_MS=7*86400000;
function fail(code){const e=new Error(code);e.code=code;throw e;}
export function checkVoiceCertificate(certBytes,keyBytes,{now=Date.now()}={}){
 const cert=new X509Certificate(certBytes);
 const key=createPrivateKey(keyBytes);
 if(!cert.checkPrivateKey(key))fail("VOICE_CERT_KEY_MISMATCH");
 if(Date.parse(cert.validFrom)>now||Date.parse(cert.validTo)-now<MIN_CERT_MS)fail("VOICE_CERT_EXPIRY_REVIEW");
 return {certificate_key_match:true,certificate_validity_ok:true};
}
export async function inspectVoiceDatabase(sql){
 const schema=(await sql.unsafe("SELECT current_user AS role,current_database() AS database, to_regclass('public.voice_gateway_control') IS NOT NULL AS control, to_regclass('public.voice_gateway_destinations') IS NOT NULL AS destinations, to_regclass('public.voice_call_reservations') IS NOT NULL AS reservations, to_regclass('public.voice_machine_nonces') IS NOT NULL AS nonces"))[0];
 const blockers=[];
 if(!schema||!["control","destinations","reservations","nonces"].every(k=>schema[k]===true))return {ready_for_review:false,blockers:["VOICE_SCHEMA_NOT_READY"]};
 const rights=(await sql.unsafe("SELECT r.rolsuper,r.rolbypassrls, EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('voice_gateway_control','voice_gateway_destinations','voice_call_reservations','voice_machine_nonces') AND pg_has_role(current_user,c.relowner,'MEMBER')) AS owns_tables FROM pg_roles r WHERE r.rolname=current_user"))[0];
 if(!rights||rights.rolsuper||rights.rolbypassrls||rights.owns_tables)blockers.push("VOICE_DATABASE_ROLE_TOO_PRIVILEGED");
 const counts=(await sql.unsafe("SELECT (SELECT mode FROM voice_gateway_control WHERE singleton=true) AS mode,(SELECT count(*)::text FROM voice_call_reservations WHERE state<>'released') AS open_reservations,(SELECT count(*)::text FROM voice_gateway_destinations) AS dedicated_destinations,(SELECT count(*)::text FROM voice_gateway_destinations g JOIN tenant_call_destinations d ON d.id=g.destination_id WHERE d.status NOT IN ('testing','disabled') OR d.active_calls<>0 OR d.destination_type<>'sip' OR d.max_concurrent_calls IS NULL) AS legacy_collisions"))[0];
 const triggers=(await sql.unsafe("SELECT count(*)::int AS enabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND ((c.relname='tenant_call_destinations' AND t.tgname='voice_gateway_legacy_destination_guard') OR (c.relname='voice_gateway_destinations' AND t.tgname='voice_gateway_bind_destination_guard'))"))[0];
 if(Number(triggers?.enabled)!==2)blockers.push("VOICE_ISOLATION_TRIGGERS_MISSING");
 if(counts?.mode!=="disabled")blockers.push("VOICE_GATEWAY_NOT_DISABLED");
 if(counts?.open_reservations!=="0")blockers.push("VOICE_OPEN_RESERVATIONS");
 if(counts?.legacy_collisions!=="0")blockers.push("VOICE_LEGACY_COLLISION");
 if(counts?.dedicated_destinations==="0")blockers.push("VOICE_NO_DEDICATED_DESTINATION");
 return {ready_for_review:blockers.length===0,blockers,mode:counts?.mode||"unknown",open_reservations:counts?.open_reservations,dedicated_destinations:counts?.dedicated_destinations,legacy_collisions:counts?.legacy_collisions,activation_authorized:false};
}
async function main(){
 const config=await loadVoiceGatewayConfig(process.env.PGI_VOICE_GATEWAY_CONFIG_FILE||"");
 const [cert,key,ca]=await Promise.all([config.cert_file,config.key_file,config.ca_file].map(file=>readPrivateVoiceFile(file)));
 const certCheck=checkVoiceCertificate(cert,key);
 // Validate parseability only; full peer-chain acceptance requires live mTLS.
 new X509Certificate(ca);
 const time=Math.floor(Date.now()/1000);
 const currentKeys=[...config.keys.values()].filter(k=>k.enabled&&time>=k.valid_from&&time<k.valid_until).length;
 if(!currentKeys)fail("VOICE_NO_VALID_MACHINE_KEYS");
 const url=new URL(process.env.PGI_VOICE_DATABASE_URL||"");
 if(!["postgres:","postgresql:"].includes(url.protocol)||!url.hostname||!url.username||!url.password||!url.pathname.slice(1)||url.hash||url.search)fail("VOICE_DATABASE_INVALID");
 const {default:postgres}=await import("postgres");
 const sql=postgres(url.href,{ssl:{rejectUnauthorized:true},max:1,connect_timeout:10,connection:{statement_timeout:8000}});
 try{
  const result=await inspectVoiceDatabase(sql);
  console.log(JSON.stringify({local_configuration_valid:true,...certCheck,current_key_count:currentKeys,database:result,live_sip_verified:false,live_media_verified:false,activation_authorized:false}));
  if(!result.ready_for_review)process.exitCode=1;
 }finally{await sql.end({timeout:5});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(e=>{console.error("Voice preflight failed:",/^VOICE_[A-Z0-9_]+$/.test(e?.code||"")?e.code:"VOICE_PREFLIGHT_UNAVAILABLE");process.exitCode=1;});
}
