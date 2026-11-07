// Pure advisory policy: never opens an Arcep sub-block or reserves a number.
// ARCEP September 2026: utilisation >=80% within a 1,000-number sub-block
// before opening another sub-block of the same category.
const RATE=80;
const fail=code=>{const error=new TypeError(code);error.code=code;throw error;};
function count(value,name){
 if(!Number.isSafeInteger(value)||value<0||value>1000)fail('INVALID_'+name);
 return value;
}
export function planSvaSubblockOpening({category,subblocks}={}){
 if(!['081','082','089'].includes(category))fail('INVALID_CATEGORY');
 if(!Array.isArray(subblocks)||subblocks.length>1000)fail('INVALID_SUBBLOCKS');
 const visited=new Set();const verified=[];const blocking=[];
 for(const b of subblocks){
  if(!b||typeof b!=='object'||Array.isArray(b)||typeof b.id!=='string'||!/^[-_a-zA-Z0-9]{1,80}$/.test(b.id)||visited.has(b.id))
   fail('INVALID_OR_DUPLICATE_SUBBLOCK_ID');
  visited.add(b.id);
  if(b.category!==category)fail('CROSS_CATEGORY_BLOCK');
  if(b.capacity!==1000)fail('REQUIRES_1000_NUMBER_SUBBLOCK');
  const allocated=count(b.assigned_count,'ASSIGNED_COUNT');
  const opened=b.opened_for_assignment===true;
  if(typeof b.opened_for_assignment!=='boolean')fail('INVALID_OPEN_STATUS');
  if(b.regulatory_status!=='granted'||b.independent_evidence_verified!==true){
    blocking.push('UNVERIFIED_ARCEP_SUBBLOCK:'+b.id);continue;
  }
  verified.push({...b,assigned_count:allocated});
  if(opened&&allocated<RATE*10)blocking.push('OPEN_SUBBLOCK_BELOW_80_PERCENT:'+b.id);
  if(!opened&&allocated>0)blocking.push('UNOPENED_SUBBLOCK_HAS_ASSIGNMENTS:'+b.id);
 }
 const candidates=verified.filter(x=>!x.opened_for_assignment)
  .sort((a,b)=>a.id.localeCompare(b.id,'en'));
 const eligible=blocking.length===0&&candidates.length>0;
 return Object.freeze({
  category,policy:'arcep_80_percent_per_1000_subblock',
  eligible_for_independent_opening_review:eligible,
  candidate_subblock_id:eligible?candidates[0].id:null,
  blockers:Object.freeze([
    ...blocking,
    ...(!candidates.length?['NO_VERIFIED_UNOPENED_SUBBLOCK']:[])
  ]),
  authority_confirmation_required:true,can_assign_number:false,
  automatic_opening_authorized:false
 });
}
