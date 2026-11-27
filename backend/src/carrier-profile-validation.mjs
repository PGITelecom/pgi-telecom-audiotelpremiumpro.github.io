// Strict provider-neutral profiles, without a proprietary SDK or schema library.
// Validation is documentary; never opens a trunk or authorizes a live connection.
const own=(o,k)=>Object.hasOwn(o,k);
const plain=o=>o!==null&&typeof o==="object"&&!Array.isArray(o)&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
function fail(code){const e=new Error(code);e.code=code;e.status=400;throw e;}
function shape(o,required,optional=[]){
 if(!plain(o)||required.some(k=>!own(o,k))||Object.keys(o).some(k=>![...required,...optional].includes(k)))fail("CARRIER_PROFILE_SHAPE");
}
function choice(v,values){if(!values.includes(v))fail("CARRIER_PROFILE_ENUM");}
function match(v,re){if(typeof v!=="string"||!re.test(v))fail("CARRIER_PROFILE_FORMAT");}
function mapping(o,required){
 if(!plain(o)||Object.keys(o).length>64)fail("CARRIER_PROFILE_MAPPING");
 const seen=new Set();
 for(const [k,v] of Object.entries(o)){
  if(!k||k.length>100||/[\u0000-\u001f]/.test(k)||["__proto__","prototype","constructor"].includes(k)||!required.includes(v)||seen.has(v))fail("CARRIER_PROFILE_MAPPING");
  seen.add(v);
 }
 if(required.some(k=>!seen.has(k)))fail("CARRIER_PROFILE_MAPPING_INCOMPLETE");
}
const CDR=["external_call_id","started_at","ended_at","conversation_seconds","payout_eligible_seconds","confirmed_payout_ht"];
const SETTLEMENT=["statement_reference","period_start","period_end","confirmed_amount_ht","paid_amount_ht"];
export function validateCarrierProfile(p){
 shape(p,["schemaVersion","adapterKey","carrier","capabilities","sip","cdr","settlement"]);
 if(p.schemaVersion!==1)fail("CARRIER_PROFILE_VERSION");
 match(p.adapterKey,/^[a-z0-9][a-z0-9_-]{1,63}$/);
 shape(p.carrier,["code","displayName"]);match(p.carrier.code,/^[A-Z0-9_-]{2,32}$/);
 match(p.carrier.displayName,/^[^\u0000-\u001f]{1,120}$/);
 const caps=["directSip","cdr","settlements","portability"],optional=["secondarySbc","tls","srtp"];
 shape(p.capabilities,caps,optional);
 if(Object.values(p.capabilities).some(v=>typeof v!=="boolean"))fail("CARRIER_PROFILE_CAPABILITY");
 shape(p.sip,["transport","authMode","dnIsFormat","cliFormat","dtmf","codecs"],["secretRef"]);
 choice(p.sip.transport,["udp","tcp","tls"]);
 choice(p.sip.authMode,["ip_acl","digest","mtls","other"]);
 choice(p.sip.dnIsFormat,["e164","national","custom"]);
 choice(p.sip.cliFormat,["e164","national","anonymous_allowed","custom"]);
 choice(p.sip.dtmf,["rfc2833","sip_info","inband","other"]);
 if(!Array.isArray(p.sip.codecs)||!p.sip.codecs.length||p.sip.codecs.length>16||new Set(p.sip.codecs).size!==p.sip.codecs.length)fail("CARRIER_PROFILE_CODECS");
 for(const c of p.sip.codecs)match(c,/^[A-Za-z0-9_-]{1,32}$/);
 if(p.sip.secretRef!=null)match(p.sip.secretRef,/^PGI_CARRIER_[A-Z0-9_]{3,80}$/);
 if(["digest","mtls"].includes(p.sip.authMode)&&!p.sip.secretRef)fail("CARRIER_PROFILE_SECRET_REFERENCE_REQUIRED");
 if(p.sip.authMode==="mtls"&&p.sip.transport!=="tls")fail("CARRIER_PROFILE_MTLS_REQUIRES_TLS");
 if(p.sip.transport==="tls"&&p.capabilities.tls!==true)fail("CARRIER_PROFILE_TLS_INCONSISTENT");
 shape(p.cdr,["delivery","timezone","fields"]);
 choice(p.cdr.delivery,["api","sftp","webhook","file","none"]);
 try{if(typeof p.cdr.timezone!=="string"||!p.cdr.timezone)throw Error();new Intl.DateTimeFormat("en",{timeZone:p.cdr.timezone});}catch{fail("CARRIER_PROFILE_TIMEZONE");}
 if(p.capabilities.cdr!==(p.cdr.delivery!=="none"))fail("CARRIER_PROFILE_CDR_INCONSISTENT");
 mapping(p.cdr.fields,p.capabilities.cdr?CDR:[]);
 shape(p.settlement,["delivery","currency","fields"]);
 choice(p.settlement.delivery,["api","sftp","email_file","manual_file","none"]);
 if(p.settlement.currency!=="EUR")fail("CARRIER_PROFILE_CURRENCY");
 if(p.capabilities.settlements!==(p.settlement.delivery!=="none"))fail("CARRIER_PROFILE_SETTLEMENT_INCONSISTENT");
 mapping(p.settlement.fields,p.capabilities.settlements?SETTLEMENT:[]);
 const missing=[];
 if(!p.capabilities.directSip)missing.push("direct_sip");
 if(!p.capabilities.cdr)missing.push("cdr");
 if(!p.capabilities.settlements)missing.push("settlement");
 if(!p.capabilities.portability)missing.push("portability");
 if(p.sip.transport!=="tls"||!p.capabilities.srtp)missing.push("encrypted_transport_review");
 return {schema_version:"pgi-carrier-profile-review/1",adapter_key:p.adapterKey,valid:true,review_items:missing,
  contract_verified:false,network_activation_authorized:false,payout_authorized:false};
}
