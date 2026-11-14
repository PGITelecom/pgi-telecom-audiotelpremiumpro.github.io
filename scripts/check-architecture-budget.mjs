/**
 * Architectural size budget for existing large modules.
 * Guardrail only: no source files are modified, bundled or deployed.
 * Changes exceeding 5% of their original size require a deliberate
 * modularization plan and an explicit baseline review.
 *
 * Baselines refreshed after the verified domain extraction; every domain is bounded.
 */
import {statSync} from "node:fs";
import {fileURLToPath} from "node:url";

const root=new URL("../",import.meta.url);
const limits=Object.freeze([
 ["backend/src/store-postgres.mjs",709399],
 ["backend/src/store-postgres-financial-insights.mjs",14156],
 ["backend/src/store-postgres-network-insights.mjs",31423],
 ["backend/server.mjs",237832],
 ["backend/src/http-observability.mjs",6266],
 ["assets/app.js",84780],
 ["assets/client-portal.js",54805]
]);
let failed=false;
for(const [path,baseline] of limits){
 const bytes=statSync(fileURLToPath(new URL(path,root))).size;
 const allowed=Math.ceil(baseline*1.05);
 if(bytes>allowed){
  failed=true;
  console.error("ARCHITECTURE_BUDGET_EXCEEDED",path,"size",bytes,"max",allowed);
 }else{
  console.log("ARCHITECTURE_BUDGET_OK",path,bytes,"/",allowed);
 }
}
if(failed)process.exitCode=1;
