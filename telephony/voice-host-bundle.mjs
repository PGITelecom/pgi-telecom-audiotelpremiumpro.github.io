// Generate an isolated, reproducible configuration package; never install or activate it.
import {createHash} from "node:crypto";
import {lstat,realpath,mkdtemp,writeFile,rename,rm} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {planVoiceEdge} from "./voice-edge-plan.mjs";
function fail(code){const e=new Error(code);e.code=code;throw e;}
export function buildVoiceHostFiles(input){
 const plan=planVoiceEdge(input);
 if(plan.status!=="candidate_for_independent_review")fail("VOICE_HOST_PLAN_BLOCKED");
 // This fixed-peer TLS-only starter profile intentionally excludes public WebRTC.
 if(plan.signaling.transport!=="tls")fail("VOICE_HOST_TLS_REQUIRED");
 const a=plan.signaling.peer_ipv4,m=plan.media.peer_ipv4,p=plan.signaling.port,start=plan.media.port_start,end=plan.media.port_end;
 const aclName="pgi_carrier_"+plan.adapter_key;
 const acl='<list name="'+aclName+'" default="deny">\n'+a.map(ip=>'  <node type="allow" cidr="'+ip+'/32"/>').join("\n")+'\n</list>\n';
 const profile='<param name="apply-inbound-acl" value="'+aclName+'"/>\n<param name="disable-register" value="true"/>\n';
 // Standalone dedicated-host input filter. Policy accept leaves all unrelated
 // services to the site's existing firewall; it is not a full host firewall.
 const firewall=[
  "table inet pgi_voice_edge {",
  " chain input {",
  "  type filter hook input priority -10; policy accept;",
  "  ip saddr { "+a.join(", ")+" } tcp dport "+p+" accept",
  "  tcp dport "+p+" drop",
  "  udp dport "+p+" drop",
  "  ip saddr { "+m.join(", ")+" } udp dport "+start+"-"+end+" accept",
  "  udp dport "+start+"-"+end+" drop",
  "  iifname != \"lo\" tcp dport 8021 drop",
  " }","}",""
 ].join("\n");
 const files={"carrier-acl.fragment.xml":acl,"sip-profile.fragment.xml":profile,"voice-edge.nft":firewall,"capacity.json":JSON.stringify(plan.capacity,null,2)+"\n"};
 const manifest={schema_version:"pgi-voice-host-bundle/1",adapter_key:plan.adapter_key,files:Object.fromEntries(Object.entries(files).map(([name,value])=>[name,createHash("sha256").update(value).digest("hex")])),status:"review_required",network_activation_authorized:false,limitations:["fixed_ipv4_peers_only","not_a_full_sip_profile","no_public_webrtc","not_a_complete_host_firewall","not_installed"]};
 return {...files,"manifest.json":JSON.stringify(manifest,null,2)+"\n"};
}
export async function writeVoiceHostBundle(input,output){
 const files=buildVoiceHostFiles(input),dir=path.resolve(output),s=await lstat(dir);
 if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==process.getuid()||(s.mode&0o077)!==0||await realpath(dir)!==dir)fail("VOICE_HOST_PRIVATE_DIRECTORY_REQUIRED");
 const id=createHash("sha256").update(files["manifest.json"]).digest("hex"),temp=await mkdtemp(path.join(dir,".voice-"));
 try{for(const [name,value] of Object.entries(files))await writeFile(path.join(temp,name),value,{flag:"wx",mode:0o600});await rename(temp,path.join(dir,id));return {package_id:id,file_count:Object.keys(files).length,network_activation_authorized:false};}
 finally{await rm(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==4)fail("USAGE_PRIVATE_PLAN_AND_OUTPUT_DIRECTORY");
  const {readFile}=await import("node:fs/promises");
  const input=await lstat(process.argv[2]);if(!input.isFile()||input.size>65536)fail("VOICE_HOST_INPUT_INVALID");
  console.log(JSON.stringify(await writeVoiceHostBundle(JSON.parse(await readFile(process.argv[2],"utf8")),process.argv[3])));
 }catch(e){console.error("Voice package failed:",e.code||"CONFIG_OR_RUNTIME_ERROR");process.exitCode=1;}
}
