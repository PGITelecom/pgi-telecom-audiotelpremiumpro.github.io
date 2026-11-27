// Direct, read-only SFTP collection and normalization of one contracted carrier export.
// No external ETL, SDK, password prompt, remote deletion or payment action.
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {lstat,realpath,mkdtemp,readFile,writeFile,rename,rm} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {normalizeCarrierCsv} from "../backend/src/carrier-csv-import.mjs";
function fail(code){const e=new Error(code);e.code=code;throw e;}
function safePath(v){return typeof v==="string"&&/^\/[A-Za-z0-9._/-]{1,250}$/.test(v)&&!v.split("/").includes("..")&&!v.split("/").includes(".")&&!v.includes("//");}
async function privatePath(p,dir){
 if(!safePath(p)||await realpath(p)!==p)fail("SFTP_PRIVATE_PATH");
 const s=await lstat(p);
 if((dir?!s.isDirectory():!s.isFile())||s.isSymbolicLink()||s.uid!==process.getuid()||(s.mode&0o077)!==0)fail("SFTP_PRIVATE_PATH");
 return s;
}
export async function collectCarrierExport(input,{spawn=spawnSync}={}){
 if(input?.business_unit!=="audiotel_platform"||input.currency!=="EUR"||input.evidence?.contract_verified!==true||input.evidence?.read_only_account_verified!==true||input.evidence?.host_key_independently_verified!==true||input.evidence?.bounded_private_volume_verified!==true)fail("SFTP_EVIDENCE_REQUIRED");
 const host=input.host,user=input.username,port=input.port,remote=input.remote_path;
 if(typeof host!=="string"||! /^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/.test(host)||typeof user!=="string"||! /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/.test(user)||!Number.isSafeInteger(port)||port<1||port>65535||!safePath(remote)||!remote.endsWith(".csv"))fail("SFTP_INVALID_ENDPOINT");
 await privatePath(input.identity_file,false);await privatePath(input.known_hosts_file,false);await privatePath(input.output_dir,true);
 const temp=await mkdtemp(path.join(input.output_dir,".collect-"));
 try{
  // Restrict output to a named file inside the private temporary directory.
  const args=["-F","/dev/null","-b","-","-oBatchMode=yes","-oStrictHostKeyChecking=yes","-oGlobalKnownHostsFile=/dev/null","-oUserKnownHostsFile="+input.known_hosts_file,"-oIdentitiesOnly=yes","-oPasswordAuthentication=no","-oKbdInteractiveAuthentication=no","-oForwardAgent=no","-oConnectTimeout=10","-oServerAliveInterval=5","-oServerAliveCountMax=2","-i",input.identity_file,"-P",String(port),user+"@"+host];
  const r=spawn("/usr/bin/sftp",args,{cwd:temp,input:"get "+remote+" export.csv\n",encoding:"utf8",timeout:30000,maxBuffer:65536,stdio:["pipe","ignore","pipe"]});
  if(r.error||r.status!==0)fail("SFTP_DOWNLOAD_FAILED");
  const file=path.join(temp,"export.csv"),s=await lstat(file);
  if(!s.isFile()||s.isSymbolicLink()||s.size<1||s.size>180000)fail("SFTP_EXPORT_SIZE");
  const raw=await readFile(file);let csv;
  try{csv=new TextDecoder("utf-8",{fatal:true}).decode(raw);}catch{fail("SFTP_UTF8_REQUIRED");}
  const result=normalizeCarrierCsv({business_unit:"audiotel_platform",currency:"EUR",provider_key:input.provider_key,delimiter:input.delimiter,decimal_separator:input.decimal_separator,field_mapping:input.field_mapping,csv});
  const digest=createHash("sha256").update(raw).digest("hex");
  // Only minimized canonical data is kept. The remote original is untouched.
  const canonical=JSON.stringify(result,null,2)+"\n";
  const manifest={schema_version:"pgi-sftp-collection/1",provider_key:input.provider_key,source_sha256:digest,canonical_sha256:createHash("sha256").update(canonical).digest("hex"),source_transport:"sftp_pinned_host_key",source_contract_independently_verified:false,bank_receipt_verified:false,ledger_write_authorized:false,payout_authorized:false};
  await writeFile(path.join(temp,"canonical.json"),canonical,{mode:0o600,flag:"wx"});
  await writeFile(path.join(temp,"manifest.json"),JSON.stringify(manifest,null,2)+"\n",{mode:0o600,flag:"wx"});
  const {unlink}=await import("node:fs/promises");await unlink(file);
  const packageId=createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
  await rename(temp,path.join(input.output_dir,packageId));
  return {package_id:packageId,row_count:result.row_count,ledger_write_authorized:false};
 }finally{await rm(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==3)fail("USAGE_PRIVATE_CONFIG_JSON");
  await privatePath(process.argv[2],false);const s=await lstat(process.argv[2]);if(s.size>65536)fail("SFTP_CONFIG_SIZE");
  console.log(JSON.stringify(await collectCarrierExport(JSON.parse(await readFile(process.argv[2],"utf8")))));
 }catch(e){console.error("Carrier collection failed:",e.code||"CONFIG_OR_RUNTIME_ERROR");process.exitCode=1;}
}
