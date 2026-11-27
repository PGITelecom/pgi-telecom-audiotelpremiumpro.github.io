// Economic routing advice only. Never reserve a channel, override customer
// priorities, alter an assignment, or connect to a telephony provider.
function fail(code,status=400){const e=new Error(code);e.code=code;e.status=status;throw e;}
function int(v,k,min=0,max=1_000_000_000){if(!Number.isSafeInteger(v)||v<min||v>max)fail("ROUTE_INVALID_"+k);return v;}
function safeBig(n){if(n>BigInt(Number.MAX_SAFE_INTEGER)||n<0n)fail("ROUTE_COST_OVERFLOW");return Number(n);}
function ceil(a,b){return (a+b-1n)/b;}
export function calculateTerminationCost(input={}){
 const duration=int(input.duration_seconds,"DURATION",0,604800);
 const minimum=int(input.minimum_billable_seconds,"MINIMUM",0,3600);
 const increment=int(input.billing_increment_seconds,"INCREMENT",1,3600);
 const rate=int(input.rate_micro_eur_per_min,"RATE",0,1000000);
 const connection=int(input.connection_fee_micro_eur,"CONNECTION_FEE",0,1000000);
 const connected=input.connected;
 if(typeof connected!=="boolean"||(!connected&&duration!==0))fail("ROUTE_INVALID_CONNECTED");
 const billed=connected?Math.max(minimum,Math.ceil(duration/increment)*increment):0;
 const cost=connected?safeBig(ceil(BigInt(billed)*BigInt(rate),60n)+BigInt(connection)):0;
 return Object.freeze({duration_seconds:duration,billed_seconds:billed,estimated_cost_micro_eur:cost,
  rounding_policy:"round_duration_up_then_apply_minimum_round_micro_eur_up",scenario_only:true});
}
export async function planEconomicRouting(store,input={}){
 if(input.business_unit!=="audiotel_platform"||input.currency!=="EUR")fail("ROUTE_INVALID_SCOPE");
 if(typeof input.tenant_public_id!=="string"||!input.tenant_public_id)fail("ROUTE_INVALID_TENANT");
 const number=int(input.sva_number_id,"NUMBER",1,Number.MAX_SAFE_INTEGER);
 const seconds=int(input.typical_call_seconds,"DURATION",1,604800);
 if(typeof store?.simulateTenantRouting!=="function")fail("ROUTE_STORE_UNAVAILABLE",503);
 if(!Array.isArray(input.quotes)||input.quotes.length<1||input.quotes.length>100)fail("ROUTE_INVALID_QUOTES");
 const quotes=new Map();
 for(const q of input.quotes){
  const k=int(q?.destination_id,"DESTINATION",1,Number.MAX_SAFE_INTEGER);
  if(quotes.has(k))fail("ROUTE_DUPLICATE_QUOTE");
  quotes.set(k,q);
 }
 const sim=await store.simulateTenantRouting(input.tenant_public_id,{sva_number_id:number});
 const selected=sim.selected;
 if(!selected)return Object.freeze({status:"no_available_destination",selected_destination_id:null,candidate_destination_id:null,routing_change_authorized:false});
 // Only alternatives already available for the same number, at the same
 // customer-defined priority and number specificity. No cross-tenant routing.
 const eligible=sim.candidates.filter(x=>x.eligible===true&&x.priority===selected.priority&&
   (x.sva_number_id==null)===(selected.sva_number_id==null));
 const ids=new Set(sim.candidates.map(x=>x.id));
 for(const k of quotes.keys())if(!ids.has(k))fail("ROUTE_QUOTE_OUTSIDE_TENANT_OR_NUMBER");
 const rows=eligible.map(d=>{
  const q=quotes.get(d.id);
  if(!q||q.cost_verified!==true||q.quality_verified!==true||q.customer_consent_verified!==true)
   return {destination_id:d.id,destination_type:d.destination_type,status:"unverified",estimated_cost_micro_eur:null};
  const cost=calculateTerminationCost({...q,duration_seconds:seconds,connected:true});
  return {destination_id:d.id,destination_type:d.destination_type,status:"candidate",estimated_cost_micro_eur:cost.estimated_cost_micro_eur,billed_seconds:cost.billed_seconds};
 });
 const current=rows.find(x=>x.destination_id===selected.id);
 const candidates=rows.filter(x=>x.status==="candidate").sort((a,b)=>a.estimated_cost_micro_eur-b.estimated_cost_micro_eur||a.destination_id-b.destination_id);
 const best=current?.status==="candidate"&&candidates[0]?.estimated_cost_micro_eur<current.estimated_cost_micro_eur?candidates[0]:null;
 return Object.freeze({schema_version:"pgi-economic-route-review/1",currency:"EUR",typical_call_seconds:seconds,
  selected_destination_id:selected.id,candidate_destination_id:best?.destination_id??null,
  estimated_saving_per_call_micro_eur:best?current.estimated_cost_micro_eur-best.estimated_cost_micro_eur:null,
  candidates:Object.freeze(rows.map(Object.freeze)),customer_priority_preserved:true,quotes_independently_verified:false,
  routing_change_authorized:false,network_activation_authorized:false});
}
