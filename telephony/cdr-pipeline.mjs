// One run on a private voice host; systemd can invoke this existing delivery service.
// Staging problems must not prevent already durable pending CDRs from being delivered.
import {pathToFileURL} from "node:url";
import {stageNativeCdrs} from "./cdr-native-stage.mjs";
import {cdrDeliveryConfig,deliverSpool} from "./cdr-spool-delivery.mjs";
export async function runCdrPipeline(env=process.env,{stage=stageNativeCdrs,deliver=deliverSpool}={}){
 const config=cdrDeliveryConfig(env);
 let staging,delivery;
 try{staging=await stage({source:env.PGI_CDR_NATIVE_DIR,spool:config.spool});}
 catch(e){staging={error:e.code||"STAGING_UNAVAILABLE"};}
 try{delivery=await deliver(config);}
 catch(e){delivery={error:e.code||"DELIVERY_UNAVAILABLE"};}
 return {staging,delivery,healthy:!staging.error&&!staging.requires_review&&!delivery.error&&!delivery.busy&&!delivery.stopped&&!delivery.retry&&!delivery.quarantined};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const result=await runCdrPipeline();
  console.log(JSON.stringify(result));
  if(!result.healthy)process.exitCode=1;
 }catch(e){console.error("CDR pipeline failed:",e.code||"CONFIG_OR_RUNTIME_ERROR");process.exitCode=1;}
}
