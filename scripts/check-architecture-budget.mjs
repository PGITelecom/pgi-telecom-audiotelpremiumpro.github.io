/**
 * Architectural size budget for existing large modules.
 * Guardrail only: no source files are modified, bundled or deployed.
 * Changes exceeding 5% of their original size require a deliberate
 * modularization plan and an explicit baseline review.
 *
 * Baselines captured on the 2026-11-15 draft hardening branch.
 */
import {statSync} from "node:fs";
import {fileURLToPath} from "node:url";

const root=new URL("../",import.meta.url);
const limits=Object.freeze([
 ["backend/src/store-postgres.mjs",752809],
 ["backend/server.mjs",243783],
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
