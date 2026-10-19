import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {randomUUID} from "node:crypto";
import {pathToFileURL} from "node:url";
import {loadConfig} from "./src/config.mjs";
import {createVercelLazyServer} from "./src/vercel-lazy-server.mjs";

const execFileAsync=promisify(execFile);

// The exact same schema guard formerly run on every container boot remains
// mandatory, but runs once only if the request actually needs PostgreSQL.
async function createVerifiedBackend(){
  const result=await execFileAsync(process.execPath,["scripts/verify-deployment-schema.mjs"],{
    cwd:process.cwd(),env:process.env,timeout:20000,maxBuffer:128*1024
  });
  if(result.stdout)process.stdout.write(result.stdout);
  const {createDefaultBackend}=await import("./server.mjs");
  return createDefaultBackend();
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
