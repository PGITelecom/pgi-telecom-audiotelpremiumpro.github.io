/**
 * Audiotel Premium Pro: presentation-only adaptation policy for the two portals.
 * INPUTS MUST COME FROM AUTHENTICATED SERVER CONTEXT. Never import browser claims
 * as membership, consent, entitlement, pricing or regulatory evidence.
 *
 * No API, DB, Stripe, provisioning, billing, transfer or network side effects.
 * No permission is granted by this policy: server routes remain authoritative.
 */
export const CUSTOMER_PORTAL_PRESENTATION_CONTRACT = 'audiotel-customer-portal/1';
export const CUSTOMER_PORTAL_BUSINESS_UNITS = Object.freeze(['audiotel_platform','direct_sva']);

const MODULES=Object.freeze({
  overview:{label:'Tableau de bord',permission:'overview.read'},
  dossiers:{label:'Mes dossiers',permission:'overview.read'},
  numbers:{label:'Mes numéros',permission:'routing.read'},
  portability:{label:'Portabilité',permission:'routing.read'},
  business_live:{label:'Business Live',permission:'analytics.read'},
  billing:{label:'Abonnements et factures',permission:'billing.manage'},
  settlements:{label:'Relevés et reversements',permission:'finance.read'},
  documents:{label:'Documents et contrats',permission:'overview.read'},
  support:{label:'Assistance',permission:'incidents.read'},
  team:{label:'Utilisateurs et accès',permission:'team.read'}
});
export const CUSTOMER_PORTAL_MODULE_KEYS=Object.freeze(Object.keys(MODULES));
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const validRevision=n=>Number.isSafeInteger(n)&&n>=1;
const isoDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(x)&&Number.isFinite(Date.parse(x));
const safePermissions=p=>Array.isArray(p)&&p.every(x=>typeof x==='string'&&x.length<100)?new Set(p):new Set();
function blocked(reason,unit){
  return Object.freeze({
    schema_version:CUSTOMER_PORTAL_PRESENTATION_CONTRACT,
    business_unit:CUSTOMER_PORTAL_BUSINESS_UNITS.includes(unit)?unit:null,
    status:'blocked',reason,revision:null,
    modules:Object.freeze(CUSTOMER_PORTAL_MODULE_KEYS.map(key=>Object.freeze({key,label:MODULES[key].label,visible:false,available:false,action_authorized:false}))),
    customer_financial_data_authorized:false,
    number_activation_authorized:false,payout_authorized:false,
    any_write_authorized:false
  });
}
/**
 * Evaluates the *display plan* from signed-in, tenant-verified backend facts.
 * `capabilities` are explicitly issued by the server, never read from storage
 * or user-supplied query params. Missing/unknown features are OFF by default.
 */
export function resolveCustomerPortalPresentation(input={}){
  if(!isObject(input))return blocked('INVALID_CONTEXT',null);
  const unit=input.business_unit;
  if(!CUSTOMER_PORTAL_BUSINESS_UNITS.includes(unit))return blocked('UNKNOWN_BUSINESS_UNIT',null);
  if(input.schema_version!==CUSTOMER_PORTAL_PRESENTATION_CONTRACT)return blocked('UNSUPPORTED_CONTRACT',unit);
  if(!validRevision(input.revision))return blocked('INVALID_REVISION',unit);
  const principal=input.principal;
  if(!isObject(principal)||principal.authenticated!==true||principal.tenant_scope_verified!==true||principal.membership_verified!==true)
    return blocked('UNVERIFIED_CUSTOMER_SCOPE',unit);
  if(principal.business_unit!==unit)return blocked('CROSS_BUSINESS_CONTEXT',unit);
  if(!isObject(input.capabilities))return blocked('MISSING_SERVER_CAPABILITIES',unit);

  // The Pôle's informative website visibility NEVER releases its client portal.
  // No client can infer an entitlement solely from a role in Audiotel.
  if(unit==='direct_sva'){
    const release=input.release,enrollment=input.enrollment;
    if(!isObject(release)||release.customer_portal_enabled!==true||
       release.commercial_operation_enabled!==true||release.operator_mode!=='active'||
       !isObject(enrollment)||enrollment.business_unit!=='direct_sva'||
       enrollment.access_state!=='active'||enrollment.dashboard_enabled!==true||
       enrollment.client_contract_accepted!==true)
      return blocked('DIRECT_SVA_NOT_RELEASED',unit);
  }
  const now=input.now===undefined?new Date():new Date(input.now);
  if(!Number.isFinite(now.getTime()))return blocked('INVALID_AS_OF',unit);
  if(input.effective_from!==undefined){
    if(!isoDate(input.effective_from)||Date.parse(input.effective_from)>now.getTime())
      return blocked('CAPABILITIES_NOT_EFFECTIVE',unit);
  }
  if(input.effective_until!==undefined&&input.effective_until!==null){
    if(!isoDate(input.effective_until)||Date.parse(input.effective_until)<=now.getTime())
      return blocked('CAPABILITIES_EXPIRED',unit);
  }
  const permissions=safePermissions(principal.permissions);
  const can=key=>permissions.has('*')||permissions.has(key);
  const modules=CUSTOMER_PORTAL_MODULE_KEYS.map(key=>{
    const catalog=input.capabilities[key];
    const approved=isObject(catalog)&&catalog.enabled===true&&catalog.source==='server_verified'&&
      ['available','announced','maintenance'].includes(catalog.state);
    const permitted=can(MODULES[key].permission);
    const visible=approved&&permitted;
    return Object.freeze({key,label:MODULES[key].label,
      visible,available:visible&&catalog.state==='available',
      status:visible?catalog.state:'hidden',
      // The presentation layer NEVER authorizes a mutation or a financial flow.
      action_authorized:false});
  });
  return Object.freeze({
    schema_version:CUSTOMER_PORTAL_PRESENTATION_CONTRACT,
    business_unit:unit,status:'display_only',reason:null,revision:input.revision,
    modules:Object.freeze(modules),
    customer_financial_data_authorized:false,
    number_activation_authorized:false,payout_authorized:false,
    any_write_authorized:false
  });
}

/** Compare two versioned commercial/presentation snapshots before publication.
 * Does not change or approve a historical contract, price or entitlement.
 */
export function assessCustomerPortalChange(current,proposed,{consent_verified=false}={}){
  if(!isObject(current)||!isObject(proposed))return Object.freeze({safe_to_prepare:false,requires_review:true,issues:['INVALID_SNAPSHOT']});
  const issues=[];
  if(current.schema_version!==CUSTOMER_PORTAL_PRESENTATION_CONTRACT||proposed.schema_version!==CUSTOMER_PORTAL_PRESENTATION_CONTRACT)
    issues.push('INCOMPATIBLE_API_CONTRACT');
  if(!CUSTOMER_PORTAL_BUSINESS_UNITS.includes(current.business_unit)||current.business_unit!==proposed.business_unit)
    issues.push('CROSS_BUSINESS_CHANGE_FORBIDDEN');
  if(!validRevision(current.revision)||!validRevision(proposed.revision)||proposed.revision<=current.revision)
    issues.push('REVISION_MUST_INCREASE');
  if(!isObject(current.capabilities)||!isObject(proposed.capabilities))issues.push('INVALID_CAPABILITIES');
  const oldPrice=current.price_version_id??null,newPrice=proposed.price_version_id??null;
  const contractualChange=oldPrice!==newPrice||current.contract_version!==proposed.contract_version;
  if(contractualChange&&!consent_verified)issues.push('CONTRACT_OR_PRICE_REQUIRES_REVIEW_AND_CONSENT');
  if(contractualChange&&(!isoDate(proposed.effective_from)||Date.parse(proposed.effective_from)<=Date.now()))
    issues.push('CONTRACT_CHANGE_MUST_BE_FUTURE_DATED');
  // No arbitrary capability may activate telephony or money movements.
  for(const forbidden of ['telecom_activation','payout_execution','collect_third_party_funds']){
    if(proposed.capabilities?.[forbidden]?.enabled===true)issues.push('FORBIDDEN_CAPABILITY_'+forbidden.toUpperCase());
  }
  if(current.business_unit==='direct_sva'&&proposed.customer_portal_enabled===true)
    issues.push('DIRECT_SVA_SEPARATE_RELEASE_REQUIRED');
  return Object.freeze({
    safe_to_prepare:issues.length===0,
    requires_review:contractualChange||current.business_unit==='direct_sva'||issues.length>0,
    keeps_existing_contract_unchanged:true,
    automatically_releases_service:false,
    issues:Object.freeze(issues)
  });
}
