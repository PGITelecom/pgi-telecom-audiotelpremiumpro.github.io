import {createHmac,createHash,randomBytes,scryptSync,timingSafeEqual} from "node:crypto";

export function parseCookies(header=""){
  const out={};
  for(const part of String(header).split(";")){
    const i=part.indexOf("=");
    if(i<1)continue;
    const k=part.slice(0,i).trim();
    const v=part.slice(i+1).trim();
    try{out[k]=decodeURIComponent(v);}catch{out[k]=v;}
  }
  return out;
}

export function hashPassword(password){
  if(typeof password!=="string"||password.length<12||password.length>8192)throw new Error("password must contain 12 to 8192 characters");
  const salt=randomBytes(16);
  const N=16384,r=8,p=1;
  const digest=scryptSync(password,salt,64,{N,r,p,maxmem:64*1024*1024});
  return ["scrypt",N,r,p,salt.toString("base64url"),digest.toString("base64url")].join("$");
}

export function verifyPassword(password,encoded){
  try{
    // Reject malformed or attacker-inflated hash parameters before running synchronous scrypt.
    if(typeof password!=="string"||password.length>8192||typeof encoded!=="string"||encoded.length>256)return false;
    const parts=encoded.split("$");
    if(parts.length!==6)return false;
    const [kind,n,r,p,saltB64,digestB64]=parts;
    if(kind!=="scrypt"||n!=="16384"||r!=="8"||p!=="1")return false;
    if(!/^[A-Za-z0-9_-]+$/.test(saltB64)||!/^[A-Za-z0-9_-]+$/.test(digestB64))return false;
    const salt=Buffer.from(saltB64,"base64url");
    const expected=Buffer.from(digestB64,"base64url");
    if(salt.length!==16||expected.length!==64)return false;
    const actual=scryptSync(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
    return timingSafeEqual(expected,actual);
  }catch{return false;}
}

export function issueSession({secret,user,ttlSeconds}){
  if(!secret)throw new Error("session secret required");
  const now=Math.floor(Date.now()/1000);
  const csrf=randomBytes(24).toString("base64url");
  const payload={sub:String(user.id),role:user.role,name:user.name,iat:now,exp:now+ttlSeconds,csrf};
  for(const key of ["actor_type","tenant_id","tenant_public_id","customer_role","authorization_version","session_version"]){
    if(user[key]!=null)payload[key]=user[key];
  }
  const encoded=Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig=createHmac("sha256",secret).update(encoded).digest("base64url");
  return {token:encoded+"."+sig,csrf,payload};
}

export function verifySession(token,secret){
  try{
    // Enforce one canonical HMAC envelope; never accept extra dot-separated segments.
    if(typeof token!=="string"||token.length>8192||!secret)return null;
    const parts=token.split(".");
    if(parts.length!==2)return null;
    const [encoded,sig]=parts;
    if(!encoded||!sig||!/^[A-Za-z0-9_-]+$/.test(encoded)||!/^[A-Za-z0-9_-]+$/.test(sig))return null;
    const expected=createHmac("sha256",secret).update(encoded).digest();
    const actual=Buffer.from(sig,"base64url");
    if(actual.toString("base64url")!==sig||expected.length!==actual.length||!timingSafeEqual(expected,actual))return null;
    const payload=JSON.parse(Buffer.from(encoded,"base64url").toString("utf8"));
    const now=Math.floor(Date.now()/1000);
    if(!payload||typeof payload!=="object"||Array.isArray(payload)||
      !Number.isSafeInteger(payload.iat)||!Number.isSafeInteger(payload.exp)||
      payload.iat>now+60||payload.exp<=payload.iat||payload.exp<=now||
      typeof payload.sub!=="string"||!payload.sub||payload.sub.length>128)return null;
    return payload;
  }catch{return null;}
}

export function constantTimeTokenEqual(a,b){
  if(typeof a!=="string"||typeof b!=="string"||!a||!b)return false;
  const ah=createHash("sha256").update(a).digest();
  const bh=createHash("sha256").update(b).digest();
  return timingSafeEqual(ah,bh);
}

export function sessionCookie(token,maxAge){
  return "__Host-pgi_session="+encodeURIComponent(token)+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age="+maxAge;
}
export function csrfCookie(token,maxAge){
  return "__Host-pgi_csrf="+encodeURIComponent(token)+"; Path=/; Secure; SameSite=Strict; Max-Age="+maxAge;
}
export function clearSessionCookies(){
  return [
    "__Host-pgi_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
    "__Host-pgi_csrf=; Path=/; Secure; SameSite=Strict; Max-Age=0"
  ];
}
export function customerSessionCookie(token,maxAge){
  return "__Host-pgi_customer_session="+encodeURIComponent(token)+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age="+maxAge;
}
export function customerCsrfCookie(token,maxAge){
  return "__Host-pgi_customer_csrf="+encodeURIComponent(token)+"; Path=/; Secure; SameSite=Strict; Max-Age="+maxAge;
}
export function clearCustomerSessionCookies(){
  return [
    "__Host-pgi_customer_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
    "__Host-pgi_customer_csrf=; Path=/; Secure; SameSite=Strict; Max-Age=0"
  ];
}
