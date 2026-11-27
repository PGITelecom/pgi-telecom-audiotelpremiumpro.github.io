// Plan de continuité SIP indépendant des opérateurs, sans action réseau.
// Une route SIP de secours chez le même collecteur ne garantit pas l'accès
// au 089 si le collecteur ou le réseau public de collecte est indisponible.
const E164_089=/^\+3389[0-9]{7}$/;
const KEY=/^[a-z][a-z0-9_-]{2,63}$/;
const CARRIER=/^[A-Z0-9_-]{2,32}$/;
const STATES=new Set(["active","standby","ready","configured","draining","disabled"]);
const HEALTH=new Set(["up","degraded","down","unknown"]);
const TYPES=new Set(["primary","same_carrier_backup","alternate_carrier"]);
function invalid(code){const e=new Error(code);e.code=code;e.status=422;throw e;}
function plain(x){return x!==null&&typeof x==="object"&&!Array.isArray(x);}
function validate(input){
 if(!plain(input))invalid("SIP_PREVIEW_INVALID_PAYLOAD");
 const {number,authorizedNumbers,currentRouteId,routes}=input;
 if(typeof number!=="string"||!E164_089.test(number))invalid("SIP_PREVIEW_INVALID_NUMBER");
 // Caller MUST populate this from a tenant-scoped authenticated DB query;
 // it is never independently authenticated by this pure function.
 if(!Array.isArray(authorizedNumbers)||authorizedNumbers.length<1||
    authorizedNumbers.length>10000||
    authorizedNumbers.some(n=>typeof n!=="string"||!E164_089.test(n))||
    new Set(authorizedNumbers).size!==authorizedNumbers.length||
    !authorizedNumbers.includes(number))invalid("SIP_PREVIEW_UNAUTHORIZED_NUMBER_SCOPE");
 if(typeof currentRouteId!=="string"||!KEY.test(currentRouteId))
  invalid("SIP_PREVIEW_INVALID_CURRENT_ROUTE");
 if(!Array.isArray(routes)||routes.length<1||routes.length>30)
  invalid("SIP_PREVIEW_INVALID_ROUTES");
 const seen=new Set();
 for(const route of routes){
  if(!plain(route)||typeof route.routeId!=="string"||!KEY.test(route.routeId)||
     typeof route.carrierCode!=="string"||!CARRIER.test(route.carrierCode)||
     !TYPES.has(route.type)||!STATES.has(route.state)||!HEALTH.has(route.health)||
     !Number.isSafeInteger(route.priority)||route.priority<0||route.priority>1000)
    invalid("SIP_PREVIEW_INVALID_ROUTE");
  if(seen.has(route.routeId))invalid("SIP_PREVIEW_DUPLICATE_ROUTE");
  seen.add(route.routeId);
 }
 const primary=routes.find(r=>r.routeId===currentRouteId);
 if(!primary||primary.type!=="primary")invalid("SIP_PREVIEW_PRIMARY_MISSING");
 if(routes.filter(r=>r.type==="primary").length!==1)
  invalid("SIP_PREVIEW_MULTIPLE_PRIMARY_ROUTES");
 return primary;
}
const viable=r=>["ready","standby","active"].includes(r.state)&&r.health==="up";
const precedence=r=>r.type==="same_carrier_backup"?0:1;
function sanitize(r){return Object.freeze({
 route_id:r.routeId,carrier_code:r.carrierCode,
 route_type:r.type,reported_health:r.health,reported_state:r.state
});}

/**
 * Dry-run only. All state/health fields are snapshots, not independently
 * verified evidence. No SIP commands, no persistence and no host failover
 * are authorized by this result, even when an alternative is suggested.
 */
export function prepareSipContinuityPreview(input){
 const primary=validate(input);
 const current=viable(primary);
 const alternatives=input.routes.filter(r=>r.routeId!==primary.routeId&&viable(r)&&
  (r.type==="same_carrier_backup"?r.carrierCode===primary.carrierCode:
   r.type==="alternate_carrier"&&r.carrierCode!==primary.carrierCode));
 alternatives.sort((a,b)=>precedence(a)-precedence(b)||
   a.priority-b.priority||a.routeId.localeCompare(b.routeId,"en"));
 const candidate=current?null:alternatives[0]||null;
 const category=current?"keep_primary":candidate===null?"no_route":
  candidate.type==="same_carrier_backup"?"same_carrier_sip_backup":"alternate_carrier_proposal";
 const advisory=current?"Aucun changement de route recommande":
  candidate===null?"Aucune route SIP de secours utilisable declaree":
  candidate.type==="same_carrier_backup"?
   "Route SIP secondaire du meme operateur a examiner, sans garantie de collecte 089":
   "Changement d'operateur a etudier: contrats, routage national 089 et portabilite obligatoires";
 return Object.freeze({
  schema_version:"audiotel-sip-continuity-preview/1",
  business_unit:"direct_sva",
  called_number:input.number,
  primary:sanitize(primary),
  decision:category,
  proposed_route:candidate?sanitize(candidate):null,
  other_reported_candidate_count:Math.max(0,alternatives.length-(candidate?1:0)),
  note:advisory,
  input_health_independently_verified:false,
  access_to_089_independently_verified:false,
  tenant_authorization_verified_by_this_function:false,
  operator_agreements_verified:false,
  automatic_failover_enabled:false,
  can_change_sip_route:false,
  can_trigger_portability:false,
  can_activate_089:false,
  external_actions_executed:false
 });
}
