import fs from "node:fs";
import path from "node:path";
import {validateCarrierProfile} from "../backend/src/carrier-profile-validation.mjs";
const dir=path.resolve("config/carriers");
const failures=[],keys=new Set();
for(const name of fs.readdirSync(dir).filter(x=>x.endsWith(".json"))){
 try{
  const result=validateCarrierProfile(JSON.parse(fs.readFileSync(path.join(dir,name),"utf8")));
  if(keys.has(result.adapter_key))throw Error("CARRIER_PROFILE_DUPLICATE_ADAPTER");
  keys.add(result.adapter_key);
 }catch(e){failures.push(name+": "+(e.code||e.message));}
}
if(failures.length){failures.forEach(x=>console.error("FAIL:",x));process.exit(1);}
console.log("Carrier profiles: OK");
