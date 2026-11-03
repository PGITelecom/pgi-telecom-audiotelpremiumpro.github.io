// Dormant customer portal. Public Pôle SEO publication never unlocks it.
// A separately approved, tested release will have to change these guards.
export function isDirectSvaPrivatePortalPath(value){
 if(typeof value!=="string")return false;
 let p=value;
 try{p=decodeURIComponent(p);}catch{return true;}
 p=p.replace(/\\/g,"/");
 return /^\/distribution-sva\/espace-client(?:\/|$)/i.test(p)||
  /^\/site\/distribution-sva\/espace-client(?:\/|$)/i.test(p)||
  /^\/site\/distribution-sva\/client-portal\.(?:js|css)(?:\/|$)/i.test(p);
}
export const DIRECT_SVA_CUSTOMER_PORTAL_RELEASE=Object.freeze({
 business_unit:"direct_sva",
 public_portal_enabled:false,
 customer_login_entry_enabled:false,
 customer_self_registration_enabled:false,
 public_navigation_enabled:false,
 readiness:"separate_owner_release_and_carrier_legal_security_checks_required"
});
