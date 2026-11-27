import {randomUUID} from "node:crypto";
import {pathToFileURL} from "node:url";
import {loadConfig} from "./src/config.mjs";
import {createVercelLazyServer} from "./src/vercel-lazy-server.mjs";
import {verifyDeploymentSchema} from "./src/verify-deployment-schema.mjs";

// Preserve the full checksum guard before opening any DB-backed route.
// Reuse the primary application pool rather than spawning a child Node process.
async function createVerifiedBackend(){
  const {createDefaultBackend}=await import("./server.mjs");
  return createDefaultBackend({verifySchema:async sql=>{
    const audit=await verifyDeploymentSchema(sql);
    console.log("PGI_RELEASE_SCHEMA_READY",audit.release_version,audit.required_count,"migration checksums verified");
  }});
}

export function createVercelEntry({initializeBackend=createVerifiedBackend,config=loadConfig()}={}){
  if(config.mode!=="production"||config.processRole!=="api")
    throw new Error("Vercel lazy entry requires production API mode");
  return createVercelLazyServer({staticDir:config.staticDir,initializeBackend});
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const app=createVercelEntry();
  const shutdown=async signal=>{
    process.stdout.write(JSON.stringify({level:"info",event:"shutdown",signal})+"\n");
    await app.close();process.exit(0);
  };
  process.on("SIGTERM",()=>shutdown("SIGTERM"));
  process.on("SIGINT",()=>shutdown("SIGINT"));
  app.server.listen(Number(process.env.PGI_BACKEND_PORT||process.env.PORT||8080),
    String(process.env.PGI_BACKEND_HOST||"0.0.0.0"),()=>{
      process.stdout.write(JSON.stringify({level:"info",event:"listening_static_first",
        address:app.server.address(),mode:"production",version:process.env.PGI_VERSION||null,
        release:process.env.PGI_RELEASE_ID||randomUUID()})+"\n");
    });
}
