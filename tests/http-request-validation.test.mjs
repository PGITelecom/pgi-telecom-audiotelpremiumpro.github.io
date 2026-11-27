import test from "node:test";
import assert from "node:assert/strict";
import {Readable} from "node:stream";
import {readJson} from "../backend/src/http.mjs";

function request(headers, ...chunks) {
  return Object.assign(Readable.from(chunks.map(x=>Buffer.from(x))), {headers});
}

test("JSON requests accept the correct media type with or without length", async()=>{
  assert.deepEqual(await readJson(request({"content-type":"Application/JSON; charset=utf-8"},'{"ok":', 'true}'),1024),{ok:true});
  assert.deepEqual(await readJson(request({"content-type":"application/json","content-length":"2"},"{}"),1024),{});
  assert.deepEqual(await readJson(request({}),1024),{});
});

test("non-JSON media types are rejected even with streamed request bodies", async()=>{
  for(const headers of [{},{"content-type":"text/plain"},{"content-type":"application/json-invalid"},{"content-type":"application/json-invalid","content-length":"2"}]){
    await assert.rejects(readJson(request(headers,"{}"),1024),{status:415,code:"UNSUPPORTED_MEDIA_TYPE"});
  }
});

test("request size and JSON syntax limits remain enforced", async()=>{
  await assert.rejects(readJson(request({"content-type":"application/json","content-length":"10"},"{}"),4),{status:413,code:"BODY_TOO_LARGE"});
  await assert.rejects(readJson(request({"content-type":"application/json"},"{","    ","}"),4),{status:413,code:"BODY_TOO_LARGE"});
  await assert.rejects(readJson(request({"content-type":"application/json"},"{"),1024),{status:400,code:"INVALID_JSON"});
});
