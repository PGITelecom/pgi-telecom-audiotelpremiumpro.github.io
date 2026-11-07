/**
 * Internal-only SVA documentary register. NEVER an operator approval engine.
 * Contract and regulator evidence must be checked outside this database.
 */
import {createHash} from 'node:crypto';

export const SVA_ADMIN_TOPICS = Object.freeze([
 'legal_entity','legal_operator_review','ce_identifier','arcep_numbers',
 'af2m_cgs','af2m_2026_rules','apnf_rsva','collection_contract',
 'network_acceptance','portability','editor_kyc','identity_document_vault',
 'tariff_message','anti_fraud','psp_payments','accounting_tax',
 'gdpr_security','recovery_backup','release_approval'
]);
export const SVA_ADMIN_STAGES = Object.freeze([
 'not_started','preparing','awaiting_external_party','document_received',
 'internal_review','internally_checked'
]);
const TOPICS = new Set(SVA_ADMIN_TOPICS),STAGES = new Set(SVA_ADMIN_STAGES);
function error(code,status=400){const e=new Error(code);e.code=code;e.status=status;throw e;}
function admin(actor){
 if(actor?.role!=='admin'||typeof actor.sub!=='string'||!actor.sub.trim())
  error('SVA_ADMINISTRATIVE_ADMIN_ONLY',403);
 return createHash('sha256').update('audiotel-sva-review:'+actor.sub).digest('hex');
}
function writeStore(store){
 if(!store?.sql?.unsafe||!store?.sql?.begin)error('SVA_ADMINISTRATIVE_POSTGRES_REQUIRED',503);
 return store.sql;
}
function readableStore(store){
 const sql=store?.readSql?.unsafe?store.readSql:store?.sql;
 if(typeof sql?.unsafe!=='function')error('SVA_ADMINISTRATIVE_POSTGRES_REQUIRED',503);
 return sql;
}
export function validateSvaAdministrativeUpdate(input={}){
 const key=String(input.action_key||'');
 const stage=String(input.stage||'');
 if(!TOPICS.has(key))error('SVA_ADMINISTRATIVE_TOPIC_INVALID');
 if(!STAGES.has(stage))error('SVA_ADMINISTRATIVE_STAGE_INVALID');
 const evidence=String(input.evidence_reference||'').trim()||null;
 // Opaque reference only: no uploaded identity papers, URL tokens or bank details.
 if(evidence&&(!/^[A-Za-z0-9._:/-]{8,200}$/.test(evidence)||
   /^(?:https?:|sk_|rk_|whsec_)/i.test(evidence)))error('SVA_ADMINISTRATIVE_EVIDENCE_REF_INVALID');
 if(stage==='internally_checked'&&!evidence)error('SVA_ADMINISTRATIVE_EVIDENCE_REQUIRED');
 const source=String(input.source_organization||'').trim()||null;
 if(source&&(source.length>120||/[\r\n@]/.test(source)))error('SVA_ADMINISTRATIVE_SOURCE_INVALID');
 const date=value=>{
  if(value===undefined||value===null||value==='')return null;
  const s=String(value);
  if(!/^20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(s)||
      new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)
   error('SVA_ADMINISTRATIVE_DATE_INVALID');
  return s;
 };
 const validUntil=date(input.valid_until),nextReview=date(input.next_review_at);
 if(stage==='internally_checked'&&!source)error('SVA_ADMINISTRATIVE_ISSUER_REQUIRED');
 return Object.freeze({key,stage,evidence,source,validUntil,nextReview});
}
export function evaluateSvaAdministrativeReadiness(rows=[],asOf=new Date()){
 if(!Array.isArray(rows)||!Number.isFinite(new Date(asOf).getTime()))error('SVA_ADMINISTRATIVE_READINESS_INPUT_INVALID');
 const now=Date.parse(new Date(asOf).toISOString().slice(0,10)+'T00:00:00Z');
 const found=new Map();
 for(const r of rows){
  const key=String(r.action_key||'');
  if(!TOPICS.has(key)||found.has(key))error('SVA_ADMINISTRATIVE_READINESS_ROWS_INVALID',503);
  found.set(key,r);
 }
 const actions=SVA_ADMIN_TOPICS.map(key=>{
  const r=found.get(key),stage=STAGES.has(String(r?.stage))?r.stage:'not_started';
  const expired=Boolean(r?.valid_until&&Date.parse(String(r.valid_until).slice(0,10)+'T00:00:00Z')<now);
  const due=Boolean(r?.next_review_at&&Date.parse(String(r.next_review_at).slice(0,10)+'T00:00:00Z')<=now);
  const evidence=Boolean(r?.evidence_reference);
  const internallyChecked=stage==='internally_checked'&&evidence&&!expired;
  return Object.freeze({action_key:key,stage,expired,review_due:due,
   evidence_reference_present:evidence,internally_checked:internallyChecked,
   valid_until:r?.valid_until||null,next_review_at:r?.next_review_at||null});
 });
 const completed=actions.filter(x=>x.internally_checked).length;
 const external=actions.filter(x=>x.stage==='awaiting_external_party').length;
 const overdue=actions.filter(x=>x.expired||x.review_due).length;
 return Object.freeze({schema_version:'audiotel-direct-sva-admin-prelaunch/1',
  checklist_count:SVA_ADMIN_TOPICS.length,internally_checked_count:completed,
  awaiting_external_party_count:external,review_attention_count:overdue,
  operator_licensed:false,number_allocation_confirmed:false,
  carrier_interconnection_confirmed:false,payout_authorized:false,
  automatic_activation_authorized:false,ready_to_launch:false,
  note:'Documentary register only: internal checks never replace official acts or launch approval.',
  actions:Object.freeze(actions)});
}
export async function directSvaAdministrativeOverview(store){
 const sql=readableStore(store);
 const rows=await sql.unsafe('SELECT action_key,stage,evidence_reference,valid_until,next_review_at'+
  ' FROM direct_sva_administrative_actions ORDER BY action_key');
 return evaluateSvaAdministrativeReadiness(rows);
}
export async function updateSvaAdministrativeAction(store,actor,input={}){
 const actorHash=admin(actor),v=validateSvaAdministrativeUpdate(input),sql=writeStore(store);
 return sql.begin(async tx=>{
  const rows=await tx.unsafe(
   'SELECT id,stage,valid_until FROM direct_sva_administrative_actions WHERE action_key=$1 FOR UPDATE',[v.key]);
  const before=rows[0];
  if(!before)error('SVA_ADMINISTRATIVE_MIGRATION_REQUIRED',503);
  if(before.stage==='internally_checked'&&v.stage==='not_started')
   error('SVA_ADMINISTRATIVE_REVIEW_RESET_REQUIRED',409);
  await tx.unsafe('UPDATE direct_sva_administrative_actions SET stage=$2,evidence_reference=$3,'+
   'source_organization=$4,reviewed_at=CASE WHEN $2=$5 THEN now() ELSE NULL END,'+
   'valid_until=$6,next_review_at=$7,last_actor_hash=$8,updated_at=now() WHERE id=$1',
   [before.id,v.stage,v.evidence,v.source,'internally_checked',v.validUntil,v.nextReview,actorHash]);
  await tx.unsafe('INSERT INTO direct_sva_administrative_action_events'+
   '(action_id,from_stage,to_stage,evidence_reference,actor_hash) VALUES($1,$2,$3,$4,$5)',
   [before.id,before.stage,v.stage,v.evidence,actorHash]);
  return Object.freeze({action_key:v.key,stage:v.stage,logged:true,
   operator_licensed:false,number_allocation_confirmed:false,launch_authorized:false,
   payments_enabled:false,number_activated:false});
 });
}
