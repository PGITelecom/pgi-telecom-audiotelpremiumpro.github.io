// Fail-closed Vercel startup guard for the unified PGI release.
// Prevent a code-only rollout against Neon production still at migration 075.
// No schema writes, no automatic migrations, no access to customer rows.
import postgres from "postgres";
import {verifyDeploymentSchema} from "../backend/src/verify-deployment-schema.mjs";
const url=process.env.PGI_DATABASE_URL||process.env.DATABASE_URL;
if(!url)throw Error("PGI_RELEASE_DATABASE_NOT_CONFIGURED");
const sql=postgres(url,{max:1,prepare:false,ssl:"require",
 connect_timeout:8,idle_timeout:2});
try{
 const audit=await verifyDeploymentSchema(sql);
 console.log("PGI_RELEASE_SCHEMA_READY",audit.release_version,
  audit.required_count,"migration checksums verified");
}catch(e){
 console.error("PGI_RELEASE_SCHEMA_CHECK_FAILED",String(e?.code||e?.name||"ERROR"));
 process.exitCode=78;
}finally{
 await sql.end({timeout:3});
}
