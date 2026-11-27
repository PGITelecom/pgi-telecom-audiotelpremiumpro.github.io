// Calculate the economics of negotiated volume tiers without vendor software.
// Amounts in integer micro-EUR HT. Scenarios only, no contract or tariff changes.
import {APP_SVA_TARIFF_CAPS_MILLIEUR_PER_MIN} from "./audiotel-margin-safety.mjs";
function fail(code){const e=new Error(code);e.code=code;e.status=400;throw e;}
function int(v,k,min=0,max=1_000_000_000_000){if(!Number.isSafeInteger(v)||v<min||v>max)fail("TIER_INVALID_"+k);return v;}
function safe(n){if(n>BigInt(Number.MAX_SAFE_INTEGER)||n< -BigInt(Number.MAX_SAFE_INTEGER))fail("TIER_OVERFLOW");return Number(n);}
const GATES=["signed_quote","costs_verified","publisher_terms_verified","tariff_verified","minimum_commitment_verified","tier_rules_verified"];
export function evaluateWholesaleTiers(input={}){
 if(input?.business_unit!=="audiotel_platform"||input.currency!=="EUR"||input.billing_basis!=="minute")fail("TIER_SCOPE");
 if(!Object.hasOwn(APP_SVA_TARIFF_CAPS_MILLIEUR_PER_MIN,input.category))fail("TIER_INVALID_CATEGORY");
 const retail=int(input.retail_service_micro_eur_per_min,"RETAIL",1,APP_SVA_TARIFF_CAPS_MILLIEUR_PER_MIN[input.category]*1000);
 const publisher=int(input.publisher_micro_eur_per_min,"PUBLISHER",0,1000000);
 const network=int(input.other_variable_micro_eur_per_min,"VARIABLE",0,1000000);
 const target=int(input.target_contribution_micro_eur_per_min,"TARGET",0,1000000);
 const monthlyFee=int(input.monthly_fixed_micro_eur,"FIXED");
 const minSpend=int(input.minimum_network_spend_micro_eur,"MINIMUM");
 const setup=int(input.one_off_micro_eur,"ONE_OFF");
 const months=int(input.horizon_months,"HORIZON",1,60);
 const volumes=[int(input.low_monthly_minutes,"LOW",1,100000000),int(input.base_monthly_minutes,"BASE",1,100000000),int(input.high_monthly_minutes,"HIGH",1,100000000)];
 if(volumes[0]>volumes[1]||volumes[1]>volumes[2])fail("TIER_VOLUME_ORDER");
 if(!["marginal","retroactive"].includes(input.tier_mode))fail("TIER_INVALID_MODE");
 if(!Array.isArray(input.tiers)||!input.tiers.length||input.tiers.length>30)fail("TIER_INVALID_LIST");
 const tiers=input.tiers.map((t,i)=>{
  const from=int(t?.from_minutes,"START",0,100000000);
  if(i===0?from!==0:from<=input.tiers[i-1].from_minutes)fail("TIER_INVALID_ORDER");
  return {from_minutes:from,operator_net_micro_eur_per_min:int(t?.operator_net_micro_eur_per_min,"RATE",0,retail),network_micro_eur_per_min:int(t?.network_micro_eur_per_min,"NETWORK",0,1000000)};
 });
 const scenarios=volumes.map(v=>{
  let revenue=0n,carrierCost=0n;
  const active=tiers.filter(t=>t.from_minutes<v);
  if(input.tier_mode==="retroactive"){
   const t=active.at(-1);revenue=BigInt(v)*BigInt(t.operator_net_micro_eur_per_min);carrierCost=BigInt(v)*BigInt(t.network_micro_eur_per_min);
  }else{
   for(let i=0;i<active.length;i++){const t=active[i],qty=Math.min(v,tiers[i+1]?.from_minutes??v)-t.from_minutes;revenue+=BigInt(qty)*BigInt(t.operator_net_micro_eur_per_min);carrierCost+=BigInt(qty)*BigInt(t.network_micro_eur_per_min);}
  }
  const topup=carrierCost<BigInt(minSpend)?BigInt(minSpend)-carrierCost:0n;
  const monthly=revenue-carrierCost-topup-BigInt(monthlyFee)-BigInt(v)*BigInt(publisher+network);
  const horizon=monthly*BigInt(months)-BigInt(setup);
  const required=BigInt(v)*BigInt(months)*BigInt(target);
  return {monthly_minutes:v,operator_revenue_micro_eur:safe(revenue),network_charge_micro_eur:safe(carrierCost),minimum_commitment_topup_micro_eur:safe(topup),monthly_contribution_micro_eur:safe(monthly),horizon_contribution_micro_eur:safe(horizon),target_met:horizon>=required,shortfall_to_target_micro_eur:safe(horizon<required?required-horizon:0n)};
 });
 const blocked=GATES.filter(k=>input.evidence?.[k]!==true).map(k=>"missing_"+k);
 if(scenarios.some(s=>!s.target_met))blocked.push("target_not_met_in_all_scenarios");
 return {schema_version:"pgi-wholesale-tiers/1",currency:"EUR",tier_mode:input.tier_mode,scenarios,status:blocked.length?"blocked":"candidate_for_independent_review",blocked_reasons:blocked,scenario_only:true,tariff_change_authorized:false,contract_authorized:false,payout_authorized:false};
}
