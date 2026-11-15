import {performance} from "node:perf_hooks";
import {PostgresStore} from "../backend/src/store-postgres.mjs";
import {EventBus} from "../backend/src/event-bus.mjs";

// CI-only: never connect to a remote or production database.
const rawUrl=process.env.PGI_TEST_DATABASE_URL||"";
let target;
try{target=new URL(rawUrl);}catch{throw new Error("PGI_TEST_DATABASE_URL must be the local CI PostgreSQL URL");}
if(!["localhost","127.0.0.1","[::1]"].includes(target.hostname)||
   target.pathname!=="/pgi_test"||decodeURIComponent(target.username)!=="pgi_test"){
  throw new Error("Refusing PostgreSQL performance test outside the isolated pgi_test database");
}
const config={
  mode:"production",databaseUrl:rawUrl,databasePoolMax:8,databaseSsl:"disable",
  callerHashKey:"k".repeat(32),requireCarrierContract:true,
  serviceRateTtcPerMin:.8,payoutRateHtPerMin:.46,expertCostHtPerMin:.18,reconciliationToleranceHt:.01
};
const profiles=[
  {scenario:"baseline",virtual_users:1,max_rps:8,duration_seconds:3},
  {scenario:"steady",virtual_users:8,max_rps:40,duration_seconds:4},
  {scenario:"peak",virtual_users:24,max_rps:80,duration_seconds:4}
];
const percentile=(xs,f)=>xs.length?xs[Math.max(0,Math.ceil(xs.length*f)-1)]:0;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const store=await PostgresStore.connect(config,new EventBus());
const dateTo=new Date().toISOString(),dateFrom=new Date(Date.now()-86400000).toISOString();
const workloads=[
  ["platform.summary",()=>store.summary(dateFrom,dateTo,null)],
  ["platform.live_finance",()=>store.liveFinancialSnapshot()]
];
async function profile(settings){
  const rows=[],deadline=Date.now()+settings.duration_seconds*1000;
  const gap=1000*settings.virtual_users/settings.max_rps;
  await Promise.all(Array.from({length:settings.virtual_users},async(_,index)=>{
    let seq=index;
    while(Date.now()<deadline){
      const [name,fn]=workloads[seq++%workloads.length];
      const start=performance.now();
      try{
        await fn();
        rows.push({name,ms:performance.now()-start,ok:true});
      }catch(error){
        rows.push({name,ms:performance.now()-start,ok:false,error:String(error?.code||error?.name||"QUERY_FAILED")});
      }
      const remaining=gap-(performance.now()-start);
      if(remaining>0)await sleep(remaining);
    }
  }));
  const timings=rows.map(r=>r.ms).sort((a,b)=>a-b),errors=rows.filter(r=>!r.ok);
  const per_path=Object.fromEntries(workloads.map(([name])=>{
    const group=rows.filter(x=>x.name===name),values=group.map(x=>x.ms).sort((a,b)=>a-b);
    return [name,{samples:group.length,errors:group.filter(x=>!x.ok).length,p95_ms:percentile(values,.95)}];
  }));
  return {...settings,samples:rows.length,errors:errors.length,error_rate:rows.length?errors.length/rows.length:1,p50_ms:percentile(timings,.5),p95_ms:percentile(timings,.95),p99_ms:percentile(timings,.99),per_path,first_error:errors[0]?.error||null};
}
const results=[];
try{
  for(const setting of profiles)results.push(await profile(setting));
}finally{
  await store.close();
}
const maxP95=2500,minSamples=10;
const passed=results.every(r=>r.samples>=minSamples&&r.errors===0&&r.p95_ms<=maxP95);
console.log(JSON.stringify({target:"isolated_ci_postgres",database:"pgi_test",data_kind:"synthetic_ci_fixture",workloads:workloads.map(x=>x[0]),thresholds:{max_p95_ms:maxP95,max_error_rate:0,min_samples:minSamples},status:passed?"passed":"failed",results},null,2));
if(!passed)process.exitCode=1;
