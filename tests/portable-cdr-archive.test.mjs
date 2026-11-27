import test from "node:test";
import assert from "node:assert/strict";
import {previewCarrierCdrBatch} from "../backend/carriers/cdr-normalizer.mjs";
import {createPortableCdrArchive,verifyPortableCdrArchive} from "../backend/carriers/portable-cdr-archive.mjs";
const adapter={
 schemaVersion:1,carrier:{code:"SAMPLE_CARRIER"},
 capabilities:{cdr:true},
 cdr:{delivery:"file",fields:{
  rowId:"external_call_id",dialed:"called_number",
  start:"started_at",stop:"ended_at",talk:"conversation_seconds",
  eligible:"payout_eligible_seconds"
 }}
};
const preview=()=>previewCarrierCdrBatch({
 adapter,authorizedNumbers:["+33890123456"],
 rows:[{rowId:"CALL-ARCHIVE-001",dialed:"+33890123456",
  start:"2026-11-27T10:00:00+01:00",stop:"2026-11-27T10:02:00+01:00",
  talk:120,eligible:120,caller_phone:"+33600000000"}]
});
test("portable archive round trips without sensitive carrier-specific fields",()=>{
 const a=createPortableCdrArchive(preview());
 const result=verifyPortableCdrArchive(JSON.stringify(a));
 assert.equal(result.valid,true);
 assert.equal(result.record_count,1);
 assert.equal(result.source_authenticated,false);
 assert.equal(result.database_import_authorized,false);
 assert.equal(result.payout_authorized,false);
 assert.equal(JSON.stringify(a).includes("33600000000"),false);
});
test("archive detects altered content and duplicate call ids",()=>{
 const a=createPortableCdrArchive(preview());
 const modified={...a,rows:[{...a.rows[0],called_number:"+33890123457"}]};
 assert.throws(()=>verifyPortableCdrArchive(modified),/ARCHIVE_CHECKSUM_INVALID/);
 assert.throws(()=>verifyPortableCdrArchive({...a,rows:[a.rows[0],a.rows[0]],record_count:2}),/ARCHIVE_CALL_ID_INVALID/);
});
test("invalid schema, extra fields, and malformed JSON are rejected",()=>{
 const a=createPortableCdrArchive(preview());
 assert.throws(()=>verifyPortableCdrArchive("not JSON"),/ARCHIVE_JSON_INVALID/);
 assert.throws(()=>createPortableCdrArchive({canonical_rows:[]}),/ARCHIVE_PREVIEW_INVALID/);
 assert.throws(()=>verifyPortableCdrArchive({...a,rows:[{...a.rows[0],bank_iban:"FR123"}]}),/ARCHIVE_ROW_FIELDS_INVALID/);
});
