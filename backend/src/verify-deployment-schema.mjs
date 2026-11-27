// Shared release guard: one read-only query on the same connection used by the app.
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {PGI_REQUIRED_RELEASE_MIGRATIONS,auditPgiReleaseSchema} from "./schema-release-audit.mjs";

export async function verifyDeploymentSchema(sql,{cwd=process.cwd()}={}){
  const expected=PGI_REQUIRED_RELEASE_MIGRATIONS.map(version=>{
    const content=fs.readFileSync(path.join(cwd,"database","migrations",version+".sql"),"utf8");
    return {version,checksum:createHash("sha256").update(content).digest("hex")};
  });
  const actual=await sql.unsafe(
    "SELECT version,checksum FROM schema_migrations WHERE version >= $1 ORDER BY version",
    [PGI_REQUIRED_RELEASE_MIGRATIONS[0]]
  );
  const audit=auditPgiReleaseSchema(expected,actual);
  if(!audit.ready){
    const error=new Error("PGI_RELEASE_SCHEMA_NOT_READY");
    error.code="PGI_RELEASE_SCHEMA_NOT_READY";
    error.audit=audit;
    throw error;
  }
  return audit;
}
