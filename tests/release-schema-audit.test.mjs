import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createHash} from "node:crypto";
import {auditPgiReleaseSchema,PGI_REQUIRED_RELEASE_MIGRATIONS} from "../backend/src/schema-release-audit.mjs";
const manifest=PGI_REQUIRED_RELEASE_MIGRATIONS.map(version=>({
 version,checksum:createHash("sha256").update(
  fs.readFileSync("database/migrations/"+version+".sql","utf8")).digest("hex")
}));
test("all 14 SQL migrations are present in the unified release manifest",()=>{
 assert.equal(manifest.length,14);
 assert.equal(manifest[0].version,"072_referral_email_invitations");
 assert.equal(manifest.at(-1).version,"085_direct_sva_admin_editorial_release");
 assert.ok(manifest.every(x=>x.checksum.length===64));
});
test("release startup requires every exact migration checksum, without a schema write",()=>{
 const result=auditPgiReleaseSchema(manifest,manifest);
 assert.equal(result.ready,true);
 assert.equal(result.required_count,14);
 assert.equal(result.external_payments_activated,false);
});
test("production 075 is refused; no premature publication against missing schema",()=>{
 const audit=auditPgiReleaseSchema(manifest,manifest.filter(x=>Number(x.version.slice(0,3))<=75));
 assert.equal(audit.ready,false);
 assert.equal(audit.applied_count,4);
 assert.equal(audit.missing_applied.length,10);
 assert.ok(audit.missing_applied.includes("076_direct_sva_admin_switches"));
 assert.ok(audit.missing_applied.includes("085_direct_sva_admin_editorial_release"));
});
test("any missing file, altered checksum, duplicate or unrecognized version fails closed",()=>{
 assert.equal(auditPgiReleaseSchema(manifest.slice(1),manifest).ready,false);
 assert.equal(auditPgiReleaseSchema(manifest,manifest.slice(0,-1)).ready,false);
 assert.equal(auditPgiReleaseSchema(manifest,[...manifest,{...manifest[0]}]).ready,false);
 assert.equal(auditPgiReleaseSchema(manifest,manifest.map((x,i)=>i===3?{...x,checksum:"0".repeat(64)}:x)).ready,false);
 assert.equal(auditPgiReleaseSchema(manifest,[...manifest,{version:"086_unapproved",checksum:"0".repeat(64)}]).ready,false);
});
test("Vercel startup checks schema before starting web server, without running migration",()=>{
 const start=fs.readFileSync("scripts/start-vercel.sh","utf8");
 const docker=fs.readFileSync("Dockerfile.vercel","utf8");
 const before=start.indexOf("node scripts/verify-deployment-schema.mjs");
 const server=start.indexOf("exec node backend/server.mjs");
 assert.ok(before>=0&&server>before);
 assert.doesNotMatch(start,/node backend\/migrate\.mjs/);
 assert.match(docker,/scripts\/verify-deployment-schema\.mjs/);
});
