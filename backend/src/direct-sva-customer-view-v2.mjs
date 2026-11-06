/**
 * Future customer portal contract v2. No auth: server must call only after
 * verifying principal, membership and all record provenance. All rows checked
 * for cross-tenant leakage before rendering even one row.
 * Presentation only: does not grant any right or toggle any business service.
 */
const invalid=c=>{const e=new Error(c);e.status=403;e.code=c;throw e;};
const positive=x=>Number.isSafeInteger(Number(x))&&Number(x)>0&&String(Number(x))===String(x);
const fnumber=/^\+33(?:81|82|89)[0-9]{7}$/;
export function buildDirectSvaCustomerViewV2(input={}){
 const {principal,release,account}=input;
 if(principal?.authenticated!==true||principal?.membership_verified!==true||principal?.tenant_scope_verified!==true||
  principal?.business_unit!=='direct_sva'||!positive(principal?.tenant_id))invalid('DSVA_CUSTOMER_UNVERIFIED_PRINCIPAL');
 const tenant=Number(principal.tenant_id);
 for(const field of ['cases','numbers','documents','statements']){
  if(!Array.isArray(input[field]))invalid('DSVA_CUSTOMER_INVALID_'+field.toUpperCase());
  // Fail the WHOLE response if one record belongs to a different tenant.
  for(const row of input[field])if(!row||!positive(row.tenant_id)||Number(row.tenant_id)!==tenant)
   invalid('DSVA_CUSTOMER_CROSS_TENANT_DATA_BLOCKED');
 }
 const active=release?.customer_portal_enabled===true&&release?.commercial_operation_enabled===true&&
  release?.operator_mode==='operational'&&release?.independent_owner_approval===true&&
  account?.business_unit==='direct_sva'&&Number(account?.tenant_id)===tenant&&
  account?.access_state==='active'&&account?.contract_valid===true&&account?.dashboard_enabled===true;
 const base={schema_version:'audiotel-direct-sva-customer/2',business_unit:'direct_sva',
  tenant_scope:'verified',commercial_actions_authorized:false,
  live_number_activation_authorized:false,bank_transfers_authorized:false,
  account_status:active?'customer_read_only':'prelaunch_locked'};
 if(!active)return Object.freeze({...base,cases:[],numbers:[],statements:[],documents:[],
  customer_message:'Cet espace client n\'est pas ouvert. Le compte Audiotel existant reste inchangé.'});
 const permissions=new Set(Array.isArray(principal.permissions)?principal.permissions:[]),can=p=>permissions.has('*')||permissions.has(p);
 const cases=can('overview.read')?input.cases.map(x=>Object.freeze({reference:String(x.public_reference||''),
  kind:String(x.request_kind||''),status:String(x.status||'pending')})):[];
 const numbers=can('routing.read')?input.numbers.map(x=>{
  const show=x.network_ack_verified===true&&x.legal_assignment_verified===true&&
    x.number_status==='active'&&release?.number_activation_enabled===true&&fnumber.test(String(x.e164||''));
  return Object.freeze({number:show?x.e164:null,status:show?'active':'not_activated',
   verified_carrier_activation:show});
 }):[];
 const statements=can('finance.read')?input.statements.map(x=>{
  const valid=x.settlement_verified===true&&x.bank_collection_verified===true&&x.currency==='EUR'&&
    Number.isSafeInteger(x.publisher_due_minor)&&x.publisher_due_minor>=0;
  return Object.freeze({period:String(x.period||''),currency:'EUR',
   publisher_due_minor:valid?x.publisher_due_minor:null,
   verification:valid?'verified':'pending_authoritative_reconciliation',
   payout_confirmed:false});
 }):[];
 const documents=can('overview.read')?input.documents.filter(x=>x.customer_access_authorized===true&&
  x.document_verified===true).map(x=>Object.freeze({kind:String(x.document_kind||''),
  reference:String(x.document_reference||''),
  // The actual file must be served by a separate authenticated download endpoint.
  public_download_url:null})):[];
 return Object.freeze({...base,cases:Object.freeze(cases),numbers:Object.freeze(numbers),
  statements:Object.freeze(statements),documents:Object.freeze(documents),
  customer_message:'Données confirmées uniquement. Aucun reversement n\'est déclenché depuis cet affichage.'});
}
