/**
 * Audiotel Premium Pro: direct-ARCEP resource planning only.
 * A block is a candidate; this module neither owns nor assigns a number.
 * Operates without database, network, files, payments or external contact.
 */
const E164=/^\+338[129]\d{7}$/;
const REF=/^[A-Za-z0-9_.:/-]{6,140}$/;
const isObject=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
function reject(code){throw Object.assign(new Error("APP_BLOCK_"+code),{code:"APP_BLOCK_"+code,status:422});}
function shape(x,keys,name){
 if(!isObject(x)||Object.keys(x).some(k=>!keys.includes(k)))reject("INVALID_"+name);
}
function canonical(v){return typeof v==="string"&&E164.test(v);}
function minor(n,name){if(!Number.isSafeInteger(n)||n<0||n>1000000000)reject("INVALID_"+name);return n;}
const STATUS=new Set(["simulated_reserved","simulated_allocated","simulated_blocked","released"]);
const occupied=s=>s!=="released";
const trustedBlocks=new WeakSet();

export function planAudiotelArcepBlock(input={}){
 shape(input,["business_unit","mode","block_start_e164","block_reference",
  "assignments","annual_regulatory_fee_minor"],"INPUT");
 if(input.business_unit!=="audiotel_platform"||input.mode!=="offline_simulation")
  reject("OFFLINE_ONLY");
 if(!canonical(input.block_start_e164)||!input.block_start_e164.endsWith("000"))
  reject("INVALID_BLOCK_START");
 if(typeof input.block_reference!=="string"||!REF.test(input.block_reference))
  reject("INVALID_BLOCK_REFERENCE");
 const fee=input.annual_regulatory_fee_minor??2000;
 minor(fee,"REGULATORY_FEE");
 if(!Array.isArray(input.assignments)||input.assignments.length>1000)
  reject("INVALID_ASSIGNMENTS");
 const used=new Set(),released=new Set();
 const byStatus={simulated_reserved:0,simulated_allocated:0,simulated_blocked:0,released:0};
 for(const row of input.assignments){
  shape(row,["number_e164","status","tenant_reference"],"ASSIGNMENT");
  if(!canonical(row.number_e164)||!row.number_e164.startsWith(input.block_start_e164.slice(0,-3)))
   reject("NUMBER_OUTSIDE_BLOCK");
  if(used.has(row.number_e164))reject("DUPLICATE_NUMBER");
  used.add(row.number_e164);
  if(!STATUS.has(row.status))reject("INVALID_ASSIGNMENT_STATUS");
  if(row.status==="released")released.add(row.number_e164);
  if(occupied(row.status)){
   if(typeof row.tenant_reference!=="string"||!REF.test(row.tenant_reference))
    reject("MISSING_TENANT_REFERENCE");
  }else if(row.tenant_reference!=null)reject("RELEASED_NUMBER_WITH_TENANT");
  byStatus[row.status]++;
 }
 const reserved=byStatus.simulated_reserved;
 const allocated=byStatus.simulated_allocated;
 const blocked=byStatus.simulated_blocked;
 const unavailable=reserved+allocated+blocked;
 const start=input.block_start_e164.slice(0,-3);
 let next=null;
 for(let i=0;i<1000;i++){
  const number=start+String(i).padStart(3,"0");
  if(!used.has(number)||released.has(number)){
   next=number;break;
  }
 }
 const snapshot=Object.freeze({
  business_unit:"audiotel_platform",
  mode:"offline_simulation",block_reference:input.block_reference,
  block_start_e164:input.block_start_e164,block_capacity:1000,
  simulated_reserved:reserved,simulated_allocated:allocated,
  simulated_blocked:blocked,simulated_released:byStatus.released,
  available_candidate_count:1000-unavailable,
  candidate_for_next_allocation:next,
  // Technical occupancy is not the Arcep regulatory utilisation proof.
  occupied_percent:unavailable/10,
  simulated_allocated_percent:allocated/10,
  eighty_percent_planning_threshold_reached:allocated>=800,
  official_arcep_utilisation_criteria_checked:false,
  next_subblock_regulatory_approval_verified:false,
  annual_regulatory_fee_reference_minor:fee,
  estimated_monthly_regulatory_amortization_minor:Math.round(fee/12),
  fee_is_regulatory_reference_not_operator_quote:true,
  no_minimum_minutes_required_of_professionals:true,
  arcep_attribution_verified:false,
  numbering_resources_owned:false,
  number_activation_authorized:false,
  portability_authorized:false,
  external_number_order_authorized:false
 });
 trustedBlocks.add(snapshot);
 return snapshot;
}

/** A deterministic candidate preview. This never performs an allocation. */
export function previewAudiotelNumberRequest(blocks,{category}={}){
 if(!Array.isArray(blocks)||blocks.length>10000)reject("INVALID_BLOCKS");
 if(!["081","082","089"].includes(category))reject("INVALID_CATEGORY");
 for(const block of blocks){
  if(!isObject(block)||!trustedBlocks.has(block)||block.mode!=="offline_simulation"||
     block.business_unit!=="audiotel_platform"||
     block.numbering_resources_owned!==false||
     block.number_activation_authorized!==false)reject("UNTRUSTED_BLOCK");
 }
 const options=blocks.filter(b=>b.block_start_e164.startsWith("+33"+category.slice(1))&&
  b.available_candidate_count>0&&b.candidate_for_next_allocation)
  .sort((a,b)=>a.block_reference.localeCompare(b.block_reference));
 const chosen=options[0]??null;
 return Object.freeze({
  business_unit:"audiotel_platform",
  status:chosen?"candidate_only":"no_candidate_available",
  number_e164:chosen?.candidate_for_next_allocation??null,
  block_reference:chosen?.block_reference??null,
  no_minimum_minutes:true,
  independent_arcep_authorization_required:true,
  number_reserved:false,number_assigned:false,order_submitted:false,
  telephone_service_enabled:false
 });
}
