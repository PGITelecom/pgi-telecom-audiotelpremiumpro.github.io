// Read-only startup release contract. It MUST NOT perform a migration or
// repair a database. Audiotel production remains served by its current image
// until operators apply all approved schema changes through an allowed path.
export const PGI_REQUIRED_RELEASE_MIGRATIONS=Object.freeze([
 "072_referral_email_invitations",
 "073_direct_sva_operator_business_unit",
 "074_single_company_two_business_units",
 "075_direct_sva_customer_and_automation_foundation",
 "076_direct_sva_admin_switches",
 "077_existing_customer_provider_transition_preparation",
 "078_direct_sva_complaint_inbox_preparation",
 "079_direct_sva_automation_rehearsals",
 "080_pgi_telecom_distribution_brand",
 "081_direct_sva_collection_preparation",
 "082_direct_sva_financial_cycle_fences",
 "083_direct_sva_bank_event_deduplication",
 "084_direct_sva_website_visibility",
 "085_direct_sva_admin_editorial_release"
]);
export function auditPgiReleaseSchema(expected=[],actual=[]){
 if(!Array.isArray(expected)||!Array.isArray(actual))
  throw new TypeError("PGI_RELEASE_SCHEMA_INVALID_INPUT");
 const expectedByVersion=new Map(),actualByVersion=new Map();
 const invalid=[],duplicate=[];
 const ingest=(source,target,label)=>{
  for(const record of source){
   const version=record?.version,checksum=String(record?.checksum||"").trim();
   if(typeof version!=="string"||!/^0[789][0-9]_[a-z0-9_]+$/.test(version)||
      !/^[0-9a-f]{64}$/.test(checksum)){invalid.push(label);continue;}
   if(target.has(version)){duplicate.push(version);continue;}
   target.set(version,checksum);
  }
 };
 ingest(expected,expectedByVersion,"expected");
 ingest(actual,actualByVersion,"actual");
 const missingManifest=PGI_REQUIRED_RELEASE_MIGRATIONS.filter(v=>!expectedByVersion.has(v));
 const missingApplied=PGI_REQUIRED_RELEASE_MIGRATIONS.filter(v=>!actualByVersion.has(v));
 const mismatch=PGI_REQUIRED_RELEASE_MIGRATIONS.filter(v=>
  expectedByVersion.has(v)&&actualByVersion.has(v)&&expectedByVersion.get(v)!==actualByVersion.get(v));
 const unexpected=Array.from(actualByVersion.keys()).filter(v=>!PGI_REQUIRED_RELEASE_MIGRATIONS.includes(v));
 const ready=missingManifest.length===0&&missingApplied.length===0&&mismatch.length===0&&
   unexpected.length===0&&invalid.length===0&&duplicate.length===0&&
   expectedByVersion.size===PGI_REQUIRED_RELEASE_MIGRATIONS.length&&
   actualByVersion.size===PGI_REQUIRED_RELEASE_MIGRATIONS.length;
 return Object.freeze({
  ready,release_version:"085_direct_sva_admin_editorial_release",
  required_count:PGI_REQUIRED_RELEASE_MIGRATIONS.length,
  applied_count:actualByVersion.size,
  missing_manifest:Object.freeze(missingManifest),
  missing_applied:Object.freeze(missingApplied),
  checksum_mismatch:Object.freeze(mismatch),
  unexpected_versions:Object.freeze(unexpected),
  invalid_records:invalid.length,
  duplicate_versions:Object.freeze(duplicate),
  external_payments_activated:false
 });
}
