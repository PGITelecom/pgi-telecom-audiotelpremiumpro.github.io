// Provider-neutral wholesale comparison. All amounts are HT in integer micro-EUR.
 // Estimates only: no provisioning, contract execution, billing, or cash movement.
const MAX=1_000_000_000_000;
function fail(code){const e=new Error(code);e.code=code;e.status=400;throw e;}
function integer(v,name,min=0,max=MAX){if(!Number.isSafeInteger(v)||v<min||v>max)fail("WHOLESALE_INVALID_"+name);return v;}
function key(v){if(typeof v!=="string"||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/.test(v))fail("WHOLESALE_INVALID_PROVIDER");return v;}
function checked(n){if(!Number.isSafeInteger(n))fail("WHOLESALE_AMOUNT_OVERFLOW");return n;}
const COSTS=Object.freeze(["network","payment","other","intermediary"]);
const FIXED=Object.freeze(["monthly_fee","minimum_commitment_topup","setup_fee","switching_fee","termination_fee"]);
const GATES=Object.freeze(["signed_offer","numbering_authority","interconnection","portability","cdr_access","settlement_access","payment_compliance","technical_acceptance"]);
export function compareWholesaleOffers(input={}){
 if(input.business_unit!=="audiotel_platform"||input.currency!=="EUR"||input.billing_basis!=="minute")fail("WHOLESALE_INVALID_SCOPE");
 const minutes=integer(input.monthly_minutes,"MINUTES",1,100_000_000);
 const horizon=integer(input.horizon_months,"HORIZON",1,60);
 const target=integer(input.minimum_margin_micro_eur_per_min??70_000,"MARGIN_TARGET",70_000,1_000_000);
 const publisher=integer(input.publisher_micro_eur_per_min,"PUBLISHER_RATE",0,1_000_000);
 if(!Array.isArray(input.offers)||input.offers.length<1||input.offers.length>30)fail("WHOLESALE_INVALID_OFFERS");
 const seen=new Set(),periodMinutes=checked(minutes*horizon);
 const offers=input.offers.map(o=>{
  if(!o||typeof o!=="object"||Array.isArray(o))fail("WHOLESALE_INVALID_OFFER");
  const provider=key(o.provider_key);
  if(seen.has(provider))fail("WHOLESALE_DUPLICATE_PROVIDER");seen.add(provider);
  const rate=integer(o.operator_net_micro_eur_per_min,"OPERATOR_RATE",0,1_000_000);
  const variable=Object.fromEntries(COSTS.map(k=>[k,integer(o.variable_cost_micro_eur_per_min?.[k],"COST_"+k.toUpperCase(),0,1_000_000)]));
  const fixed=Object.fromEntries(FIXED.map(k=>[k,integer(o.fixed_cost_micro_eur?.[k],"FIXED_"+k.toUpperCase())]));
  const unit=rate-publisher-Object.values(variable).reduce((a,b)=>a+b,0);
  const totalFixed=checked((fixed.monthly_fee+fixed.minimum_commitment_topup)*horizon+fixed.setup_fee+fixed.switching_fee+fixed.termination_fee);
  const total=checked(checked(unit*periodMinutes)-totalFixed);
  const effective=Math.floor(total/periodMinutes);
  const reasons=GATES.filter(k=>o.evidence?.[k]!==true).map(k=>"missing_"+k);
  if(o.costs_verified!==true)reasons.push("costs_unverified");
  if(input.publisher_contract_verified!==true)reasons.push("publisher_contract_unverified");
  if(effective<target)reasons.push("margin_below_floor");
  return Object.freeze({provider_key:provider,operator_net_micro_eur_per_min:rate,variable_margin_micro_eur_per_min:unit,
   effective_margin_micro_eur_per_min:effective,total_fixed_micro_eur:totalFixed,total_contribution_micro_eur:total,
   monthly_average_contribution_micro_eur:Math.floor(total/horizon),variable_cost_micro_eur_per_min:Object.freeze(variable),
   fixed_cost_micro_eur:Object.freeze(fixed),status:reasons.length?"blocked":"candidate_for_independent_review",blocked_reasons:Object.freeze(reasons)});
 }).sort((a,b)=>b.total_contribution_micro_eur-a.total_contribution_micro_eur||a.provider_key.localeCompare(b.provider_key));
 const current=input.current_provider_key==null?null:offers.find(o=>o.provider_key===input.current_provider_key);
 if(input.current_provider_key!=null&&!current)fail("WHOLESALE_CURRENT_PROVIDER_MISSING");
 const candidates=offers.filter(o=>o.status==="candidate_for_independent_review");
 return Object.freeze({schema_version:"pgi-wholesale-comparison/1",business_unit:"audiotel_platform",currency:"EUR",unit:"micro_eur",
  monthly_minutes:minutes,horizon_months:horizon,minimum_margin_micro_eur_per_min:target,publisher_micro_eur_per_min:publisher,
  offers:Object.freeze(offers.map(o=>Object.freeze({...o,incremental_contribution_micro_eur:current?checked(o.total_contribution_micro_eur-current.total_contribution_micro_eur):null}))),
  candidate_provider_key:candidates[0]?.provider_key??null,scenario_only:true,automatic_switch_authorized:false,payout_authorized:false,
  number_assignment_authorized:false,customer_rate_change_authorized:false});
}
