import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import {createStaticSiteHandler} from "../backend/src/static-site.mjs";
import {isDirectSvaPublicAsset} from "../backend/src/direct-sva-public-site.mjs";

const approved=["style.css","brand.css","parity.css","unified.css","telecom-hero.webp","pgi-telecom-supervision-infrastructure-reseau.webp","site.js","measurement.js"];
const forbidden=["index.html","admin.js","billing.js","secret.env","../index.html","private.png","preview.zip"];

test("public Distribution asset policy allows all actually linked CSS and photo files, but no arbitrary files",()=>{
  for(const n of approved)assert.equal(isDirectSvaPublicAsset("/site/distribution-sva/"+n),true,n);
  for(const n of forbidden)assert.equal(isDirectSvaPublicAsset("/site/distribution-sva/"+n),false,n);
});

test("an HTTP client can actually load the real SVA parity CSS, branded CSS and local telecom photograph",async()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"pgi-direct-sva-assets-"));
  const root=path.join(tmp,"site","distribution-sva");
  fs.mkdirSync(root,{recursive:true});
  try{
    const page=fs.readFileSync(new URL("../site/distribution-sva/index.html",import.meta.url));
    fs.writeFileSync(path.join(root,"index.html"),page);
    for(const filename of [...approved,"telecom-hero.webp"]){
      if(!fs.existsSync(path.join(root,filename)))fs.copyFileSync(new URL("../site/distribution-sva/"+filename,import.meta.url),path.join(root,filename));
    }
    const handler=createStaticSiteHandler(tmp,{getDirectSvaWebsiteState:async()=>({
      publication_authorized:true,navigation_visible:true,commercial_requests_enabled:false
    })});
    const server=http.createServer(async(req,res)=>{
      try{
        const handled=await handler(req,res,new URL(req.url,"http://local").pathname);
        if(!handled){res.writeHead(404);res.end("not found");}
      }catch(error){res.writeHead(500);res.end(error.message);}
    });
    await new Promise(r=>server.listen(0,"127.0.0.1",r));
    try{
      const base="http://127.0.0.1:"+server.address().port;
      const h=await fetch(base+"/distribution-sva/");
      assert.equal(h.status,200);
      const html=await h.text();
      for(const name of ["style.css","brand.css","parity.css","telecom-hero.webp","pgi-telecom-supervision-infrastructure-reseau.webp"]){
        assert.ok(html.includes("/site/distribution-sva/"+name),"page must reference "+name);
        const response=await fetch(base+"/site/distribution-sva/"+name);
        assert.equal(response.status,200,name+" should never be a 404");
        assert.match(response.headers.get("content-type"),name.endsWith(".css")?/text\/css/:/image\/webp/);
        const buffer=Buffer.from(await response.arrayBuffer());
        assert.ok(buffer.length>200,name+" empty");
        if(name.endsWith(".webp")){
          assert.equal(buffer.toString("ascii",0,4),"RIFF");
          assert.equal(buffer.toString("ascii",8,12),"WEBP");
          assert.equal(buffer.readUInt32LE(4)+8,buffer.length,"WebP bytes must be complete");
          if(name==="pgi-telecom-supervision-infrastructure-reseau.webp")assert.ok(buffer.length>150000,"image quality regression");
        }
      }
      assert.equal((await fetch(base+"/site/distribution-sva/index.html")).status,404,"raw page source must not leak");
      assert.equal((await fetch(base+"/site/distribution-sva/admin.js")).status,404);
    }finally{await new Promise(r=>server.close(r));}
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});

test("small phone gets SVA five-column fixed bottom bar and legible lighter links",()=>{
 const parity=fs.readFileSync(new URL("../site/distribution-sva/parity.css",import.meta.url),"utf8");
 assert.match(parity,/\.ds-parity \.revenue-quick-nav\{position:fixed!important/);
 assert.match(parity,/background:rgba\(42,45,49,\.985\)!important/);
 assert.match(parity,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
 assert.match(parity,/font-weight:550!important/);
 assert.match(parity,/@media\(max-width:360px\)/);
});
