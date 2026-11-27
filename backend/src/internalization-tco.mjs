// Incremental telecom total-cost comparison, not a procurement or deployment action.
// Mandatory explicit costs, including internal labour and free-tier overflow.
const FIXED=["license","hosting","maintenance","security_backup","compliance","support","other"];
const ONE_OFF=["setup","migration","exit","parallel_run","hardware"];
const GATES=["costs_verified","license_commercial_use_verified","capacity_verified","quality_verified","security_verified","continuity_verified","regulatory_verified","exit_plan_verified"];
const MAX=1_000_000_000_000;
function fail(code){const e=new Error(code);e.code=code;e.status=400;throw e;}
function integer(v,k,min=0,max=MAX){if(!Number.isSafeInteger(v)||v<min||v>max)fail("TCO_INVALID_"+k);return v;}
function safe(n){if(n>BigInt(Number.MAX_SAFE_INTEGER)||n< -BigInt(Number.MAX_SAFE_INTEGER))fail("TCO_OVERFLOW");return Number(n);}
function costs(o,fields){return fields.reduce((s,k)=>s+BigInt(integer(o?.[k],k.toUpperCase())),0n);}
function compute(o,volumes,months){
 if(!o||typeof o!=="object")fail("TCO_INVALID_OPTION");
 const fixed=costs(o.monthly_cost_micro_eur,FIXED),one=costs(o.one_off_cost_micro_eur,ONE_OFF);
 const free=integer(o.included_monthly_units,"INCLUDED",0,100_000_000);
 const rate=integer(o.excess_unit_micro_eur,"EXCESS",0,1_000_000);
 const capacity=integer(o.verified_monthly_capacity,"CAPACITY",1,100_000_000);
 const labour=BigInt(integer(o.internal_monthly_minutes,"LABOUR_MINUTES",0,1_000_000))*BigInt(integer(o.internal_hourly_cost_micro_eur,"LABOUR_COST",0,1_000_000_000));
 const recurring=fixed+(labour+59n)/60n;
 const cases=volumes.map(v=>{
  const monthly=recurring+BigInt(Math.max(0,v-free))*BigInt(rate);
  return {monthly_units:v,monthly_cost_micro_eur:safe(monthly),horizon_cost_micro_eur:safe(monthly*BigInt(months)+one),within_capacity:v<=capacity};
 });
 return {cases,one_off_micro_eur:safe(one),monthly_labour_micro_eur:safe((labour+59n)/60n),missing_evidence:GATES.filter(k=>o.evidence?.[k]!==true)};
}
export function compareInternalizationTco(input={}){
 if(input.business_unit!=="audiotel_platform"||input.currency!=="EUR")fail("TCO_SCOPE");
 const months=integer(input.horizon_months,"HORIZON",1,60);
 const volumes=[integer(input.low_monthly_units,"LOW",0,100_000_000),integer(input.base_monthly_units,"BASE",1,100_000_000),integer(input.high_monthly_units,"HIGH",1,100_000_000)];
 if(volumes[0]>volumes[1]||volumes[1]>volumes[2])fail("TCO_VOLUME_ORDER");
 if(!["minute","call","file","announcement","number"].includes(input.unit))fail("TCO_INVALID_UNIT");
 const baseline=compute(input.current,volumes,months),alternative=compute(input.alternative,volumes,months);
 const scenarios=volumes.map((v,i)=>({monthly_units:v,current:baseline.cases[i],alternative:alternative.cases[i],horizon_saving_micro_eur:safe(BigInt(baseline.cases[i].horizon_cost_micro_eur)-BigInt(alternative.cases[i].horizon_cost_micro_eur))}));
 const reasons=[...baseline.missing_evidence.map(k=>"current_"+k),...alternative.missing_evidence.map(k=>"alternative_"+k)];
 if(scenarios.some(s=>!s.current.within_capacity||!s.alternative.within_capacity))reasons.push("capacity_not_sufficient");
 if(scenarios.some(s=>s.horizon_saving_micro_eur<=0))reasons.push("saving_not_positive_in_all_scenarios");
 return {schema_version:"pgi-internalization-tco/1",currency:"EUR",unit:input.unit,horizon_months:months,current:baseline,alternative,scenarios,
  status:reasons.length?"blocked":"candidate_for_independent_review",blocked_reasons:reasons,
  estimates_only:true,procurement_authorized:false,deployment_authorized:false,provider_cancellation_authorized:false};
}
