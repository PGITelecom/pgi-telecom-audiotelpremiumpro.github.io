// Portable CDR archive preview only. Pure functions: no file, database, network or payment writes.
// A SHA-256 checksum detects accidental alteration, not the identity of the sender.
import {createHash} from "node:crypto";

const FORMAT="audiotel-cdr-portable/1";
const CODE=/^[A-Z0-9_-]{2,32}$/;
const NUMBER=/^\+3389[0-9]{7}$/;
const REF=/^[A-Za-z0-9][A-Za-z0-9_.:/-]{5,127}$/;
const KEYS=["external_call_id","called_number","started_at","ended_at",
  "conversation_seconds","payout_eligible_seconds","source_carrier_code","unique_source_key"];
function fail(code){const e=new Error(code);e.code=code;e.status=422;throw e;}
function plain(x){return x!==null&&typeof x==="object"&&!Array.isArray(x);}
const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
function checkRow(row,carrier,seen){
  if(!plain(row)||Object.keys(row).length!==KEYS.length||
     KEYS.some(k=>!Object.hasOwn(row,k)))fail("ARCHIVE_ROW_FIELDS_INVALID");
  const id=row.external_call_id;
  if(typeof id!=="string"||!REF.test(id)||seen.has(id))fail("ARCHIVE_CALL_ID_INVALID");
  seen.add(id);
  if(typeof row.called_number!=="string"||!NUMBER.test(row.called_number)||
     row.source_carrier_code!==carrier||row.unique_source_key!==carrier+":"+id)
    fail("ARCHIVE_CARRIER_OR_NUMBER_INVALID");
  const start=Date.parse(row.started_at),end=Date.parse(row.ended_at);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>end||
     new Date(start).toISOString()!==row.started_at||
     new Date(end).toISOString()!==row.ended_at)fail("ARCHIVE_TIME_INVALID");
  const secs=row.conversation_seconds,eligible=row.payout_eligible_seconds;
  if(!Number.isSafeInteger(secs)||secs<0||secs>86400||
     !Number.isSafeInteger(eligible)||eligible<0||eligible>secs||
     secs*1000>end-start+1000)fail("ARCHIVE_DURATION_INVALID");
  return Object.fromEntries(KEYS.map(k=>[k,row[k]]));
}
function payload(carrier,rows){
  if(typeof carrier!=="string"||!CODE.test(carrier))fail("ARCHIVE_CARRIER_INVALID");
  if(!Array.isArray(rows)||rows.length<1||rows.length>5000)fail("ARCHIVE_ROWS_INVALID");
  const seen=new Set();
  return {format:FORMAT,source_carrier_code:carrier,record_count:rows.length,
    rows:rows.map(row=>checkRow(row,carrier,seen))};
}
/** Create a small, provider-neutral JSON archive from a previously validated preview. */
export function createPortableCdrArchive(preview){
  if(!plain(preview)||preview.schema_version!=="audiotel-carrier-neutral-cdr-preview/1"||
     preview.record_count!==preview.canonical_rows?.length)
    fail("ARCHIVE_PREVIEW_INVALID");
  const data=payload(preview.source_carrier_code,preview.canonical_rows);
  return Object.freeze({...data,checksum_sha256:hash(data)});
}
/** Verify a saved JSON archive. Does not authenticate its sender or authorize importing it. */
export function verifyPortableCdrArchive(input){
  let archive=input;
  if(typeof input==="string"){
    if(Buffer.byteLength(input,"utf8")>8000000)fail("ARCHIVE_TOO_LARGE");
    try{archive=JSON.parse(input);}catch{fail("ARCHIVE_JSON_INVALID");}
  }
  if(!plain(archive)||Object.keys(archive).length!==5||
     archive.format!==FORMAT||typeof archive.checksum_sha256!=="string"||
     !/^[a-f0-9]{64}$/.test(archive.checksum_sha256))
    fail("ARCHIVE_FORMAT_INVALID");
  const data=payload(archive.source_carrier_code,archive.rows);
  if(archive.record_count!==data.record_count)fail("ARCHIVE_COUNT_INVALID");
  if(hash(data)!==archive.checksum_sha256)fail("ARCHIVE_CHECKSUM_INVALID");
  return Object.freeze({valid:true,record_count:data.record_count,
    source_carrier_code:data.source_carrier_code,checksum_sha256:archive.checksum_sha256,
    integrity_checked:true,source_authenticated:false,tenant_access_verified:false,
    database_import_authorized:false,payout_authorized:false,external_actions_executed:false});
}
