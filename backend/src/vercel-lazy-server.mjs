import http from "node:http";
import {randomUUID} from "node:crypto";
import {createStaticSiteHandler} from "./static-site.mjs";
import {isDirectSvaPrivatePortalPath} from "./direct-sva-private-portal.mjs";
import {securityHeaders} from "./http.mjs";

// Ordinary public files can bypass Neon. All Distribution pages AND
// /site/distribution-sva/* assets require the same DB-backed publication gate.
// Otherwise the static-only handler has no visibility resolver and responds
// 503 to the two homepage WebP photos, stylesheets, and scripts.
export function requiresDatabaseBackedSiteState(pathname){
  return pathname==="/"||pathname==="/robots.txt"||
    pathname==="/distribution-sva"||pathname.startsWith("/distribution-sva/")||
    pathname==="/site/distribution-sva"||pathname.startsWith("/site/distribution-sva/");
}

export function createVercelLazyServer({staticDir,initializeBackend}){
  if(typeof initializeBackend!=="function")throw new TypeError("initializeBackend required");
  const serveStatic=createStaticSiteHandler(staticDir);
  let backendPromise=null,backend=null;
  const getBackend=()=>{
    if(!backendPromise){
      backendPromise=Promise.resolve().then(initializeBackend).then(app=>{
        if(!app?.server||typeof app.server.emit!=="function")
          throw new Error("Expected full HTTP backend");
        backend=app;
        return app;
      }).catch(err=>{backendPromise=null;throw err;});
    }
    return backendPromise;
  };
  const server=http.createServer(async(req,res)=>{
    const method=String(req.method||"GET").toUpperCase();
    let pathname;
    try{pathname=new URL(req.url||"/","http://localhost").pathname;}
    catch{res.writeHead(400,{"Cache-Control":"no-store"});res.end();return;}
    // Return 404 without opening Neon, regardless of Pôle informational SEO status.
    if(isDirectSvaPrivatePortalPath(pathname)){
      securityHeaders(res,randomUUID());
      res.writeHead(404,{"Cache-Control":"no-store",
        "X-Robots-Tag":"noindex, nofollow, noarchive"});
      res.end();return;
    }
    const publicRead=method==="GET"||method==="HEAD";
    if(publicRead&&!requiresDatabaseBackedSiteState(pathname)&&
      !pathname.startsWith("/api/")&&pathname!=="/metrics"){
      securityHeaders(res,randomUUID());
      try{
        if(await serveStatic(req,res,pathname))return;
      }catch(err){
        if(res.headersSent){res.destroy(err);return;}
        res.writeHead(503,{"Cache-Control":"no-store","Retry-After":"60"});
        res.end();return;
      }
      // Known WordPress/PHP probes are not part of this Node application.
      // Reject these without creating a database connection on every scan.
      if(/\.php(?:$|\/)/i.test(pathname)||/^\/wp-(?:admin|content|includes)(?:\/|$)/i.test(pathname)){
        res.writeHead(404,{"Cache-Control":"no-store"});
        res.end();return;
      }
    }
    try{
      const app=await getBackend();
      app.server.emit("request",req,res);
    }catch(err){
      // Record only the failure code, never connection strings or DB secrets.
      process.stderr.write(JSON.stringify({level:"error",event:"deferred_backend_bootstrap_failed",
        code:String(err?.code||err?.name||"ERROR").replace(/[^A-Za-z0-9_]/g,"").slice(0,40)})+"\n");
      if(res.headersSent){res.destroy();return;}
      securityHeaders(res,randomUUID());
      res.writeHead(503,{"Content-Type":"application/json; charset=utf-8",
        "Cache-Control":"no-store","Retry-After":"60"});
      res.end(JSON.stringify({error:{code:"SERVICE_UNAVAILABLE",message:"Service temporarily unavailable"}}));
    }
  });
  server.keepAliveTimeout=5000;
  server.headersTimeout=6500;
  server.maxRequestsPerSocket=1000;
  return {
    server,
    get initialized(){return Boolean(backend);},
    async close(){
      if(server.listening)await new Promise(resolve=>server.close(resolve));
      if(backend&&typeof backend.close==="function")await backend.close();
    }
  };
}
