import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {gzipSync,brotliCompressSync,constants as zlibConstants} from "node:zlib";
import {isDirectSvaPath,isDirectSvaPublicAsset,directSvaPublicPagePath,visibleDistributionMarketingHome,publishedDistributionHtml,publishedDistributionSitemap,publishedDistributionRobots} from "./direct-sva-public-site.mjs";
import {isDirectSvaPrivatePortalPath} from "./direct-sva-private-portal.mjs";

const PRIVATE_CSP="default-src 'self'; script-src 'self' https://accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://lh3.googleusercontent.com; connect-src 'self' https://accounts.google.com https://www.googleapis.com; frame-src https://accounts.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests";
const COCKPIT_CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests";
const VALIDATOR_CACHE=new Map();
const PUBLIC_ENCODING_LIMIT=256*1024;
const PUBLIC_ENCODING_CACHE=new Map();
const PUBLIC_ENCODING_CACHE_LIMIT=64;

function preferredPublicEncoding(header){
  const values=new Map();
  for(const entry of String(header||"").toLowerCase().split(",")){
    const [name,...params]=entry.trim().split(";");
    const quality=params.find(x=>/^\s*q\s*=/.test(x));
    const q=quality?Number(quality.split("=")[1]):1;
    if(name&&Number.isFinite(q)&&q>=0&&q<=1)values.set(name,q);
  }
  const br=values.get("br")??values.get("*")??0;
  const gzip=values.get("gzip")??values.get("*")??0;
  return br>0&&br>=gzip?"br":gzip>0?"gzip":null;
}
function sendPublicBuffer(req,res,body,{cacheKey}={}){
  const previous=String(res.getHeader("Vary")||"");
  if(!previous.split(",").some(x=>x.trim().toLowerCase()==="accept-encoding"))
    res.setHeader("Vary",previous?previous+", Accept-Encoding":"Accept-Encoding");
  const encoding=body.length>=1024&&body.length<=PUBLIC_ENCODING_LIMIT?preferredPublicEncoding(req.headers?.["accept-encoding"]):null;
  let output=body;
  if(encoding){
    const key=cacheKey?cacheKey+":"+encoding:null;
    let encoded=key?PUBLIC_ENCODING_CACHE.get(key):null;
    if(!encoded){
      encoded=encoding==="br"?brotliCompressSync(body,{params:{[zlibConstants.BROTLI_PARAM_QUALITY]:4}}):gzipSync(body,{level:4});
      if(key){
        if(PUBLIC_ENCODING_CACHE.size>=PUBLIC_ENCODING_CACHE_LIMIT)PUBLIC_ENCODING_CACHE.delete(PUBLIC_ENCODING_CACHE.keys().next().value);
        PUBLIC_ENCODING_CACHE.set(key,encoded);
      }
    }
    if(encoded.length<body.length){output=encoded;res.setHeader("Content-Encoding",encoding);}
  }
  res.setHeader("Content-Length",String(output.length));
  res.writeHead(200);
  res.end(String(req.method||"GET").toUpperCase()==="HEAD"?undefined:output);
}

// CDN cache is deliberately limited to build-time, identical-for-everyone
// editorial landing pages. Homepage, Distribution, forms, account and payment
// routes remain uncached because their visibility/state may change at runtime.
const PUBLIC_EDITORIAL_CACHE_SLUGS=new Set([
  "solutions-audiotel","business-live-audiotel","audiotel-sans-siret",
  "changer-operateur-audiotel","monetiser-ses-appels",
  "combien-rapporte-numero-surtaxe","audiotel-voyance",
  "audiotel-independants","audiotel-coaching","audiotel-professionnels",
  "reversement-audiotel","numero-sva","portabilite-numero-sva",
  "portabilite-prioritaire","parrainage-audiotel","numero-surtaxe-08",
  "tarif-numero-sva","comparateur-audiotel","paiement-cb-audiotel",
  "guide-audiotel-sva"
]);
const PUBLIC_EDITORIAL_CACHE="public, max-age=0, s-maxage=120, stale-while-revalidate=30";

const PUBLIC_CSP="default-src 'self'; script-src 'self' 'unsafe-inline' https://*.hs-scripts.com https://*.hs-analytics.net https://*.hubspot.com https://*.usemessages.com https://js-eu1.hs-banner.com https://js-eu1.hscollectedforms.net https://www.googletagmanager.com; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.hubspot.com https://forms-eu1.hsforms.com https://www.google-analytics.com; connect-src 'self' https://*.hubspot.com https://*.hubapi.com https://*.hsforms.com https://forms-eu1.hscollectedforms.net https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com; frame-src https://*.hubspot.com; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests";

const MIME=Object.freeze({
  ".html":"text/html; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".xml":"application/xml; charset=utf-8",
  ".webmanifest":"application/manifest+json; charset=utf-8",
  ".png":"image/png",
  ".webp":"image/webp",
  ".svg":"image/svg+xml",
  ".ico":"image/x-icon",
  ".txt":"text/plain; charset=utf-8"
});

export function createStaticSiteHandler(rootDir,{getDirectSvaWebsiteState}={}){
  async function visibility(){
    if(typeof getDirectSvaWebsiteState!=="function")return null;
    try{return await getDirectSvaWebsiteState();}catch{return null;}
  }
  const root=String(rootDir||"").trim()?path.resolve(String(rootDir)):null;
  // Immutable within one deployment; refreshed if the underlying file changes.
  let homepageRenderCache=null;
  return async function serveStaticSite(req,res,pathname){
    if(!root)return false;
    const method=String(req?.method||"GET").toUpperCase();
    if(method!=="GET"&&method!=="HEAD")return false;
    if(pathname==="/metrics"||String(pathname||"").startsWith("/api/"))return false;

    if(String(pathname||"")==="/ai.txt"){
      res.writeHead(308,{"Location":"/llms.txt","Cache-Control":"public, max-age=86400"});
      res.end();
      return true;
    }

    // Once content is separately approved for publication, it must remain
    // crawlable even when the operator hides the navigation link.
    let directSvaPath=String(pathname||"");
    try{directSvaPath=decodeURIComponent(directSvaPath).replace(/\/+/g,"/");}catch{
      res.writeHead(400,{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow, noarchive"});
      res.end();return true;
    }
    // The future customer portal is never part of the public editorial release.
    if(isDirectSvaPrivatePortalPath(directSvaPath)){
      res.writeHead(404,{"Cache-Control":"no-store",
        "X-Robots-Tag":"noindex, nofollow, noarchive"});
      res.end();return true;
    }
    if(isDirectSvaPath(directSvaPath)){
      const state=await visibility();
      if(state?.publication_authorized!==true){
        // On database/readiness uncertainty a temporary 503 avoids teaching
        // search engines that an already published page has been removed.
        if(!state||state.status){
          res.writeHead(503,{"Cache-Control":"no-store","Retry-After":"300"});
        }else{
          res.writeHead(404,{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow, noarchive"});
        }
        res.end();return true;
      }
      if(directSvaPath==="/distribution-sva/sitemap.xml"){
        const xml=publishedDistributionSitemap(state);
        if(!xml)throw Error("DIRECT_SVA_SITEMAP_NOT_AUTHORIZED");
        const body=Buffer.from(xml,"utf8");
        res.writeHead(200,{"Content-Type":"application/xml; charset=utf-8",
          "Cache-Control":"no-store, must-revalidate","Content-Length":String(body.length)});
        res.end(method==="HEAD"?undefined:body);return true;
      }
      if(directSvaPath==="/distribution-sva"){
        res.writeHead(308,{"Location":"/distribution-sva/","Cache-Control":"no-store"});
        res.end();return true;
      }
      const target=directSvaPublicPagePath(directSvaPath);
      if(target){
        const file=await resolveStaticFile(root,"/"+target.replace(/^\/+/,""));
        if(!file){
          res.writeHead(503,{"Cache-Control":"no-store","Retry-After":"300"});
          res.end();return true;
        }
        const source=await fs.promises.readFile(file,"utf8");
        const published=publishedDistributionHtml(source,state);
        if(!published)throw Error("DIRECT_SVA_CONTENT_NOT_AUTHORIZED");
        const body=Buffer.from(published,"utf8");
        res.writeHead(200,{"Content-Type":"text/html; charset=utf-8",
          "Content-Security-Policy":PUBLIC_CSP,"Cache-Control":"no-store, must-revalidate",
          "Content-Length":String(body.length)});
        res.end(method==="HEAD"?undefined:body);return true;
      }
      if(!isDirectSvaPublicAsset(directSvaPath)){
        res.writeHead(404,{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow, noarchive"});
        res.end();return true;
      }
    }

    // A separate sitemap is announced to crawlers only when editorial
    // publication is independently approved. The Audiotel rules remain as-is.
    if(String(pathname||"")==="/robots.txt"){
      const state=await visibility();
      if(state?.publication_authorized===true){
        const robotsFile=await resolveStaticFile(root,"/robots.txt");
        if(!robotsFile){
          res.writeHead(503,{"Cache-Control":"no-store","Retry-After":"300"});
          res.end();return true;
        }
        const original=await fs.promises.readFile(robotsFile,"utf8");
        const text=publishedDistributionRobots(original,state);
        const body=Buffer.from(text,"utf8");
        res.writeHead(200,{"Content-Type":"text/plain; charset=utf-8",
         "Cache-Control":"no-store, must-revalidate","Content-Length":String(body.length)});
        res.end(method==="HEAD"?undefined:body);
        return true;
      }
    }

    if(["/favicon.ico","/favicon.png"].includes(String(pathname||""))){
      res.writeHead(308,{"Location":"/assets/audiotel-brand-icon-v33.png","Cache-Control":"public, max-age=86400"});
      res.end();
      return true;
    }
    if(["/site","/site/","/site/index.html","/index.html"].includes(String(pathname||""))){
      res.writeHead(308,{"Location":"/","Cache-Control":"no-store"});
      res.end();
      return true;
    }
    if(["/admin","/admin/","/admin.html"].includes(String(pathname||""))){
      res.writeHead(308,{"Location":"/cockpit","Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow, noarchive"});
      res.end();
      return true;
    }
    if(String(pathname||"")==="/cockpit/"){
      res.writeHead(308,{"Location":"/cockpit","Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow, noarchive"});
      res.end();
      return true;
    }

    const rawPath=String(pathname||"");
    const publicPageMatch=rawPath.match(/^\/([^/]+?)(?:\.html)?$/);
    if(publicPageMatch){
      const canonicalIndex=path.resolve(root,publicPageMatch[1],"index.html");
      if(canonicalIndex.startsWith(root+path.sep)){
        try{
          const canonicalStat=await fs.promises.stat(canonicalIndex);
          if(canonicalStat.isFile()){
            res.writeHead(308,{"Location":"/"+publicPageMatch[1]+"/","Cache-Control":"no-store"});
            res.end();
            return true;
          }
        }catch{}
      }
    }

    const requestedPath=String(pathname||"")==="/cockpit"?"/cockpit.html":pathname;
    const file=await resolveStaticFile(root,requestedPath);
    if(!file)return false;

    const stat=await fs.promises.stat(file);
    const ext=path.extname(file).toLowerCase();
    const runtimeConfig=/\/assets\/(?:config|client-config)\.js$/.test(file);
    const html=ext===".html";
    const requestPath=String(pathname||"");
    const clientUi=requestPath==="/client.html"||/^\/distribution-sva\/espace-client(?:\/|$)/i.test(requestPath);
    const cockpitUi=["/cockpit","/cockpit/","/cockpit.html"].includes(requestPath);
    const privateUi=clientUi||cockpitUi;
    const editorialHtml=html&&/^\/[a-z0-9-]+\/$/.test(requestPath)&&
      PUBLIC_EDITORIAL_CACHE_SLUGS.has(requestPath.slice(1,-1));
    const staticAsset=!runtimeConfig&&!html&&/\.(?:css|js|png|webp|svg|ico)$/i.test(requestPath);
    const publicSearchIndex=requestPath==="/site-search-index.json";
    const versionedAsset=(staticAsset||publicSearchIndex)&&/[?&]v=[A-Za-z0-9._-]{1,32}(?:&|$)/.test(String(req?.url||""));
    res.setHeader("Content-Type",MIME[ext]||"application/octet-stream");
    const serviceWorker=requestPath==="/service-worker.js";
    if(runtimeConfig||privateUi)res.setHeader("Cache-Control","no-store");
    else if(serviceWorker)res.setHeader("Cache-Control","no-store, must-revalidate");
    else if(editorialHtml)res.setHeader("Cache-Control",PUBLIC_EDITORIAL_CACHE);
    else if(html)res.setHeader("Cache-Control","no-store, must-revalidate");
    // Keep private/dynamic responses uncached. Cache only public static assets at Vercel edge.
    // Vercel requires s-maxage for CDN caching; max-age alone primarily caches browsers.
    else if(versionedAsset)res.setHeader("Cache-Control","public, max-age=31536000, s-maxage=31536000, immutable");
    else if(staticAsset||publicSearchIndex)res.setHeader("Cache-Control","public, max-age=300, s-maxage=300, stale-while-revalidate=60");
    else res.setHeader("Cache-Control","public, max-age=300, stale-while-revalidate=60");
    if(clientUi)res.setHeader("Content-Security-Policy",PRIVATE_CSP);
    else if(cockpitUi)res.setHeader("Content-Security-Policy",COCKPIT_CSP);
    else if(html)res.setHeader("Content-Security-Policy",PUBLIC_CSP);
    if(privateUi)res.setHeader("X-Robots-Tag","noindex, nofollow, noarchive");

    if(!runtimeConfig&&!privateUi&&!serviceWorker&&(!html||editorialHtml)){
      const {etag,lastModified}=await publicValidators(file,stat);
      res.setHeader("ETag",etag);
      res.setHeader("Last-Modified",lastModified);
      if(isNotModified(req,etag,stat.mtimeMs)){
        res.writeHead(304);
        res.end();
        return true;
      }
    }

    if(String(pathname||"")==="/"&&html){
      const key=file+":"+stat.size+":"+stat.mtimeMs;
      if(homepageRenderCache?.key!==key){
        const source=await fs.promises.readFile(file,"utf8");
        homepageRenderCache={
          key,
          hidden:Buffer.from(visibleDistributionMarketingHome(source,null),"utf8"),
          visible:Buffer.from(visibleDistributionMarketingHome(source,{
            publication_authorized:true,navigation_visible:true
          }),"utf8")
        };
      }
      // Only cache the immutable HTML bytes, never database visibility state.
      // Every request still checks the real editorial publication/navigation switches.
      const prepared=homepageRenderCache;
      const state=await visibility();
      const visible=state?.publication_authorized===true&&state?.navigation_visible===true;
      const body=visible?prepared.visible:prepared.hidden;
      sendPublicBuffer(req,res,body,{cacheKey:prepared.key+":"+(visible?"visible":"hidden")});
      return true;
    }
    res.setHeader("Content-Length",String(stat.size));
    if(method==="HEAD"){res.writeHead(200);res.end();return true;}
    res.writeHead(200);
    await new Promise((resolve,reject)=>{
      const stream=fs.createReadStream(file);
      stream.on("error",reject);
      res.on("close",resolve);
      stream.on("end",resolve);
      stream.pipe(res);
    });
    return true;
  };
}

async function resolveStaticFile(root,pathname){
  let decoded;
  try{decoded=decodeURIComponent(String(pathname||"/"));}
  catch{return null;}
  if(!decoded.startsWith("/")||decoded.includes("\0"))return null;
  if(decoded==="/")decoded="/index.html";
  if(decoded.endsWith("/"))decoded+="index.html";

  const segments=decoded.split("/");
  if(segments.some(x=>x===".."||x==="."))return null;
  const candidate=path.resolve(root,"."+decoded);
  if(candidate!==root&&!candidate.startsWith(root+path.sep))return null;
  try{
    const stat=await fs.promises.stat(candidate);
    if(!stat.isFile())return null;
    return candidate;
  }catch{return null;}
}


async function publicValidators(file,stat){
  const key=file+":"+stat.size+":"+Math.trunc(stat.mtimeMs);
  const cached=VALIDATOR_CACHE.get(key);
  if(cached)return cached;
  const digest=createHash("sha256").update(await fs.promises.readFile(file)).digest("hex");
  const value={etag:'"sha256-'+digest+'"',lastModified:stat.mtime.toUTCString()};
  VALIDATOR_CACHE.set(key,value);
  return value;
}

function isNotModified(req,etag,mtimeMs){
  const noneMatch=String(req?.headers?.["if-none-match"]||"").trim();
  if(noneMatch){
    if(noneMatch==="*")return true;
    return noneMatch.split(",").map(x=>x.trim().replace(/^W\//,"")).includes(etag);
  }
  const modifiedSince=String(req?.headers?.["if-modified-since"]||"").trim();
  if(!modifiedSince)return false;
  const timestamp=Date.parse(modifiedSince);
  if(!Number.isFinite(timestamp))return false;
  return Math.floor(Number(mtimeMs)/1000)*1000<=timestamp;
}
