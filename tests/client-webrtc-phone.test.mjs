import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8");
const source=await read("assets/client-webrtc-phone.js");
const {browserVoiceReadiness}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
test("WebRTC local capability detection respects browser microphone policy",()=>{
 const base={secure:true,media:{getUserMedia(){}},peer:function(){},audio:function(){}};
 assert.deepEqual(browserVoiceReadiness({...base,policy:{allowsFeature:()=>true}}),{secure:true,webrtc:true,microphone:true,audio:true});
 assert.equal(browserVoiceReadiness({...base,policy:{allowsFeature:()=>false}}).microphone,false);
 assert.equal(browserVoiceReadiness({...base,secure:false}).secure,false);
 assert.equal(browserVoiceReadiness({...base,media:null}).microphone,false);
});
test("phone is included in portal and stays fail-closed without live transport",async()=>{
 const studio=await read("assets/client-voice-studio.js");
 const build=await read("scripts/build-static.mjs");
 const server=await read("backend/src/static-site.mjs");
 assert.match(studio,/mountVoicePhone\(\{getDemo\}\)/);
 assert.ok(build.includes('"assets/client-webrtc-phone.js"'));
 assert.ok(source.includes("NON RACCORDÉ"));
 assert.ok(source.includes('disabled>Décrocher'));
 assert.ok(source.includes('disabled>Raccrocher'));
 assert.doesNotMatch(source,/\b(fetch|WebSocket|MediaRecorder)\s*\(/);
 assert.ok(server.includes('if(requestPath==="/client.html"&&html)res.setHeader("Permissions-Policy","camera=(), microphone=(self), geolocation=()")'));
 assert.ok((await read("backend/src/http.mjs")).includes("camera=(), microphone=(), geolocation=()"));
});
