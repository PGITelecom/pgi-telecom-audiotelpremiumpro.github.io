// Fail-closed Vercel startup guard for the unified PGI release.
// Prevent a code-only rollout against Neon production still at migration 075.
// No schema writes, no automatic migrations, no access to customer rows.
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import postgres from "postgres";
import {PGI_REQUIRED_RELEASE_MIGRATIONS,auditPgiReleaseSchema} from "../backend/src/schema-release-audit.mjs";
const url=process.env.PGI_DATABASE_URL||process.env.DATABASE_URL;
if(!url)throw Error("PGI_RELEASE_DATABASE_NOT_CONFIGURED");
const sql=postgres(url,{max:1,prepare:false,ssl:"require",
 connect_timeout:8,idle_timeout:2});
try{
 const expected=PGI_REQUIRED_RELEASE_MIGRATIONS.map(version=>{
  const filename=path.join("database","migrations",version+".sql");
  const content=fs.readFileSync(filename,"utf8");
  return {version,checksum:createHash("sha256").update(content).digest("hex")};
 });
 const actual=await sql.unsafe(
  "SELECT version,checksum FROM schema_migrations WHERE version >= $1 ORDER BY version",
  [PGI_REQUIRED_RELEASE_MIGRATIONS[0]]
 );
 const audit=auditPgiReleaseSchema(expected,actual);
 if(!audit.ready){
  console.error("PGI_RELEASE_SCHEMA_NOT_READY",JSON.stringify(audit));
  process.exitCode=78; // configuration / schema incompatible, not a transient web success
 }else{
  console.log("PGI_RELEASE_SCHEMA_READY",audit.release_version,
   audit.required_count,"migration checksums verified");
 }
}catch(e){
 console.error("PGI_RELEASE_SCHEMA_CHECK_FAILED",String(e?.code||e?.name||"ERROR"));
 process.exitCode=78;
}finally{
 await sql.end({timeout:3});
}
