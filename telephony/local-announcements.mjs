// Offline, content-addressed SVI announcement preparation on the voice host.
// No remote TTS API, no shell interpolation and no live dialplan modification.
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {readFile,mkdtemp,writeFile,rename,rm,lstat,realpath} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {validateVoiceFlow} from "../backend/src/voice-studio-domain.mjs";
const VOICES=Object.freeze({"fr-FR":"fr","en-GB":"en-gb","en-US":"en-us","de-DE":"de","it-IT":"it","es-ES":"es","sv-SE":"sv"});
function fail(code){const e=new Error(code);e.code=code;throw e;}
export function planLocalAnnouncements(input){
 const check=validateVoiceFlow(input);
 if(!check.valid||!check.flow.entry)fail("VOICE_FLOW_INVALID");
 const assets=new Map(),references=[];
 for(const node of check.flow.nodes){
  const fields=node.type==="tts"||node.type==="announcement"?["text"]:node.type==="menu"||node.type==="direct_dial"?["prompt"]:[];
  for(const field of fields){
   const text=String(node[field]||"").trim(),locale=node.locale||check.flow.default_locale;
   if(!text||text.length>1500||!Object.hasOwn(VOICES,locale)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))fail("VOICE_LOCAL_PROMPT_INVALID");
   const key=createHash("sha256").update(JSON.stringify({version:1,locale,text,rate:155})).digest("hex");
   assets.set(key,{key,voice:VOICES[locale],text});
   references.push({node_id:node.id,field,asset:key+".wav"});
  }
 }
 if(!assets.size||assets.size>100)fail("VOICE_LOCAL_PROMPT_LIMIT");
 return {assets:[...assets.values()],references};
}
export function validPcmWave(buf){
 if(!Buffer.isBuffer(buf)||buf.length<44||buf.length>16*1024*1024||buf.toString("ascii",0,4)!=="RIFF"||buf.toString("ascii",8,12)!=="WAVE"||buf.readUInt32LE(4)!==buf.length-8)return false;
 let fmt=false,data=false;
 for(let p=12;p+8<=buf.length;){
  const tag=buf.toString("ascii",p,p+4),size=buf.readUInt32LE(p+4),start=p+8;
  if(start+size>buf.length)return false;
  if(tag==="fmt "){if(size<16||buf.readUInt16LE(start)!==1||buf.readUInt16LE(start+2)!==1||buf.readUInt16LE(start+14)!==16)return false;const rate=buf.readUInt32LE(start+4);if(rate<8000||rate>48000)return false;fmt=true;}
  if(tag==="data"&&size>0&&size%2===0)data=true;
  p=start+size+(size%2);
 }
 return fmt&&data;
}
export async function renderLocalAnnouncements(flow,root,{spawn=spawnSync}={}){
 const planned=planLocalAnnouncements(flow);
 const dir=path.resolve(root),st=await lstat(dir);
 if(!st.isDirectory()||st.isSymbolicLink()||st.uid!==process.getuid()||(st.mode&0o077)!==0||await realpath(dir)!==dir)fail("VOICE_PRIVATE_DIRECTORY_REQUIRED");
 const temp=await mkdtemp(path.join(dir,".render-"));
 const results=[];
 try{
  for(const a of planned.assets){
   const output=path.join(temp,a.key+".wav");
   const result=spawn("/usr/bin/espeak-ng",["--stdin","-v",a.voice,"-s","155","-w",output],{input:a.text,encoding:"utf8",timeout:20000,maxBuffer:16384,stdio:["pipe","ignore","pipe"]});
   if(result.error||result.status!==0)fail("VOICE_LOCAL_SYNTHESIS_FAILED");
   const wav=await readFile(output);if(!validPcmWave(wav))fail("VOICE_INVALID_WAVE");
   results.push({file:a.key+".wav",sha256:createHash("sha256").update(wav).digest("hex"),bytes:wav.length});
  }
  // Publish a complete isolated package, never replace a live dialplan.
  const manifest={schema_version:"pgi-local-announcements/1",engine:"espeak-ng",assets:results,references:planned.references,network_activation_authorized:false};
  await writeFile(path.join(temp,"manifest.json"),JSON.stringify(manifest,null,2)+"\n",{mode:0o600,flag:"wx"});
  const packageId=createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
  await rename(temp,path.join(dir,packageId));
  return {package_id:packageId,asset_count:results.length,network_activation_authorized:false};
 }finally{await rm(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==4)fail("USAGE_FLOW_JSON_AND_PRIVATE_OUTPUT_DIR");
  const source=await lstat(process.argv[2]);if(!source.isFile()||source.size>262144)fail("VOICE_FLOW_FILE_INVALID");
  const result=await renderLocalAnnouncements(JSON.parse(await readFile(process.argv[2],"utf8")),process.argv[3]);
  console.log(JSON.stringify(result));
 }catch(e){console.error("Local announcement preparation failed:",e.code||"LOCAL_RUNTIME_ERROR");process.exitCode=1;}
}
