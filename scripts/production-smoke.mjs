// Read-only synthetic checks. No credentials, writes, payments or production migrations.
import {pathToFileURL} from "node:url";
const MAX_BODY=1024*1024;
const MAX_REDIRECTS=3;
const redirectStatuses=new Set([301,302,303,307,308]);

export function productionOrigin(raw){
  const u=new URL(raw);
  if(u.protocol!=="https:"||u.username||u.password||u.pathname!=="/"||u.search||u.hash)
    throw Error("INVALID_PRODUCTION_ORIGIN");
  return u.origin;
}
async function boundedBody(response){
  if(Number(response.headers.get("content-length"))>MAX_BODY){
    await response.body?.cancel().catch(()=>{});
    throw Error("BODY_LIMIT");
  }
  if(!response.body)return "";
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let total=0,text="";
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>MAX_BODY)throw Error("BODY_LIMIT");
      text+=decoder.decode(value,{stream:true});
    }
    return text+decoder.decode();
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
async function getSameOrigin(base,path,fetchImpl,signal){
  let target=new URL(path,base);
  for(let n=0;n<=MAX_REDIRECTS;n++){
    if(target.origin!==base||target.username||target.password)throw Error("UNEXPECTED_REDIRECT");
    const response=await fetchImpl(target.href,{method:"GET",redirect:"manual",cache:"no-store",
      headers:{"User-Agent":"PGI-Production-Smoke/2","Accept":"*/*"},signal});
    if(!redirectStatuses.has(response.status))return response;
    const location=response.headers.get("location");
    await response.body?.cancel().catch(()=>{});
    if(!location||n===MAX_REDIRECTS)throw Error("REDIRECT_LIMIT");
    target=new URL(location,target);
  }
  throw Error("REDIRECT_LIMIT");
}
export async function inspectProbe(base,spec,{fetchImpl=fetch,timeoutMs=12000}={}){
  const {name,path,expected,tokens=[],jsonCheck=null,contentType=null,security=false}=spec;
  const start=performance.now();
  let status=null;
  try{
    const response=await getSameOrigin(base,path,fetchImpl,AbortSignal.timeout(timeoutMs));
    status=response.status;
    const type=(response.headers.get("content-type")||"").toLowerCase();
    const text=await boundedBody(response);
    let json=null;
    if(jsonCheck&&type.includes("application/json"))try{json=JSON.parse(text);}catch{}
    const missing=tokens.filter(t=>!text.includes(t));
    const validJson=jsonCheck?Boolean(jsonCheck(json)):true;
    const validType=!contentType||type.includes(contentType);
    const validSecurity=!security||(/max-age=[1-9][0-9]*/i.test(response.headers.get("strict-transport-security")||"")&&
      response.headers.get("x-content-type-options")==="nosniff"&&response.headers.get("x-frame-options")==="DENY");
    const pass=status===expected&&!missing.length&&validJson&&validType&&validSecurity;
    const code=pass?"OK":status!==expected?"HTTP_STATUS":!validType?"CONTENT_TYPE":missing.length?"CONTENT_MISMATCH":!validJson?"JSON_CONTRACT":"SECURITY_HEADERS";
    return {name,path,pass,status,code,latency_ms:Math.round(performance.now()-start),missing_count:missing.length};
  }catch(e){
    const safe=["BODY_LIMIT","REDIRECT_LIMIT","UNEXPECTED_REDIRECT"].includes(e?.message)?e.message:
      ["TimeoutError","AbortError"].includes(e?.name)?"TIMEOUT":"NETWORK_ERROR";
    return {name,path,pass:false,status,code:safe,latency_ms:Math.round(performance.now()-start)};
  }
}
export async function checkWithConfirmation(base,spec,opts={}){
  const first=await inspectProbe(base,spec,opts);
  if(first.pass)return {...first,attempts:1,classification:"healthy"};
  await (opts.pause||((ms)=>new Promise(resolve=>setTimeout(resolve,ms))))(1000);
  const second=await inspectProbe(base,spec,opts);
  return {...second,attempts:2,first_code:first.code,first_status:first.status,
    classification:second.pass?"transient":"confirmed_failure"};
}
export async function runProductionSmoke({target=process.env.PGI_PRODUCTION_URL||"https://audiotel-premium-pro.com",...opts}={}){
 const base=productionOrigin(target),specs=[];
 function fetchCheck(name,path,expected,tokens=[],jsonCheck=null,contentType=null,security=false){
   specs.push({name,path,expected,tokens,jsonCheck,contentType,security});
 }
fetchCheck("site.home","/",200,["Commencer ma demande","/demande-ouverture/","client.html"]);
fetchCheck("site.application","/demande-ouverture/",200,["id=\"order-form\""]);
fetchCheck("site.application.logic","/site/site.js",200,["/api/v1/public/hubspot/lead","client.html?opening=","sessionStorage"]);
fetchCheck("site.client","/client.html",200,["id=\"customer-login-form\"","id=\"client-billing-start\"","id=\"portability-open\"","id=\"service-incident-open\""]);
fetchCheck("site.cockpit","/cockpit.html",200,["id=\"auth-form\"","ACCÈS PRODUCTION"]);
fetchCheck("site.terms","/conditions-abonnement/",200,["4,90 € TTC par mois","durée indéterminée","résiliation à tout moment","2026-10-06-b2b-b2c-v5"]);
fetchCheck("site.privacy","/confidentialite/",200,["Politique de confidentialité","RGPD"]);
fetchCheck("site.legal","/mentions-legales/",200,["Mentions légales"]);
fetchCheck("site.terms-of-use","/conditions-utilisation/",200,["Conditions générales d’utilisation"]);
fetchCheck("site.cookies","/cookies-traceurs/",200,["Cookies et traceurs"]);
fetchCheck("site.cancellation","/resilier-contrat/",200,["Résilier votre contrat","client.html?action=cancel-subscription","cesse de se renouveler"]);
fetchCheck("site.withdrawal","/retractation/",200,["14 jours","Fonctionnalité en ligne obligatoire","id=\"withdrawal-form\""]);
fetchCheck("withdrawal.status","/api/v1/public/withdrawal/status",200,[],b=>b&&b.available===true);
fetchCheck("referral.status","/api/v1/public/referral-program",200,[],b=>b&&typeof b.enabled==="boolean"&&Number.isFinite(Number(b.reward_minor))&&typeof b.currency==="string");
fetchCheck("site.sitemap","/sitemap.xml",200,["<loc>https://audiotel-premium-pro.com/</loc>","/parrainage-audiotel/","/portabilite-prioritaire/"]);
fetchCheck("api.health","/api/v1/health",200,[],b=>b&&b.status==="ok"&&b.mode==="production");
fetchCheck("auth.boundary","/api/v1/customer/auth/me",401,["AUTH_REQUIRED"]);
fetchCheck("billing.boundary","/api/v1/customer/billing/status",401,["AUTH_REQUIRED"]);
fetchCheck("asset.client.logic","/assets/client-portal.js",200,["showApp","loadPortal"],null,"javascript");
fetchCheck("asset.client.styles","/assets/client-portal.css",200,[".cp-header",".cp-main"],null,"text/css");
fetchCheck("asset.cockpit.logic","/assets/app.js",200,["window.scrollTo"],null,"javascript");
fetchCheck("asset.site.styles","/site/site.css",200,[".site-header"],null,"text/css");
fetchCheck("security.headers","/",200,[],null,"text/html",true);
// A bounded pool preserves output order and keeps a total outage within the
// existing five-minute runner budget, without adding scheduled database wakes.
const checks=Array(specs.length);
let cursor=0;
await Promise.all(Array.from({length:3},async()=>{
  while(cursor<specs.length){
    const i=cursor++;
    checks[i]=await checkWithConfirmation(base,specs[i],opts);
  }
}));
const failed=checks.filter(x=>!x.pass);
const transient=checks.filter(x=>x.classification==="transient");
return {target:base,checked_at:new Date().toISOString(),status:failed.length?"failed":transient.length?"degraded":"passed",
  scope:"public_read_only",failed_keys:failed.map(x=>x.name),transient_keys:transient.map(x=>x.name),checks};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const report=await runProductionSmoke();
 console.log(JSON.stringify(report,null,2));
 if(report.status==="failed")process.exitCode=1;
}
