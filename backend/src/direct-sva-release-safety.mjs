// Pure, read-only prepublication controls. Not an activation interface.
// Site editorial visibility is owned by the cockpit and may legitimately be ON.
const REQUIRED_DB_GUARDS=Object.freeze([
 ["direct_sva_admin_switches",/commercial_operation_enabled\s*=\s*false/i],
 ["direct_sva_operator_controls",/number_activation_enabled\s*=\s*false/i],
 ["direct_sva_operator_controls",/payouts_enabled\s*=\s*false/i],
 ["direct_sva_website_visibility",/commercial_calls_to_action_enabled\s*=\s*false/i]
]);
export function evaluateDirectSvaReleaseSafety({units,controls,switches,website,constraints,counters}={}){
 const failures=[];
 const object=x=>x&&typeof x==="object"&&!Array.isArray(x);
 const hasSingleton=x=>Array.isArray(x)&&x.length===1&&x[0]?.id===1;
 if(!Array.isArray(units)||units.length!==2)failures.push("BUSINESS_UNIT_COUNT");
 const audiotel=units?.find?.(x=>x?.unit_code==="audiotel_platform");
 const distribution=units?.find?.(x=>x?.unit_code==="direct_sva");
 if(!audiotel||audiotel.display_name!=="Audiotel Premium Pro"||
    audiotel.cost_center!=="APP"||audiotel.analytics_namespace!=="audiotel"||
    audiotel.lifecycle_status!=="existing"||
    audiotel.direct_distribution_sync_enabled!==false||
    audiotel.separate_legal_fec!==false)failures.push("AUDIOTEL_BUSINESS_UNIT_CHANGED");
 if(!distribution||distribution.display_name!=="PGI Telecom Distribution"||
    distribution.cost_center!=="DSVA"||
    distribution.analytics_namespace!=="distribution_directe"||
    distribution.lifecycle_status!=="preparation"||
    distribution.direct_distribution_sync_enabled!==false||
    distribution.separate_legal_fec!==false)failures.push("DISTRIBUTION_BUSINESS_UNIT_INVALID");
 if(!audiotel||!distribution||
    audiotel.legal_accounting_profile_id!==distribution.legal_accounting_profile_id)
  failures.push("LEGAL_ACCOUNTING_PROFILE_MISMATCH");
 if(!hasSingleton(controls)||controls[0]?.operator_mode!=="preparation"||
    controls[0]?.number_activation_enabled!==false||
    controls[0]?.payouts_enabled!==false)
  failures.push("DISTRIBUTION_OPERATOR_OR_PAYOUTS_NOT_LOCKED");
 if(!hasSingleton(switches)||switches[0]?.commercial_operation_enabled!==false)
  failures.push("DISTRIBUTION_COMMERCIAL_NOT_LOCKED");
 if(!hasSingleton(website)||website[0]?.commercial_calls_to_action_enabled!==false||
    (website[0]?.navigation_enabled===true&&website[0]?.public_content_authorized!==true)||
    typeof website[0]?.public_content_authorized!=="boolean"||
    typeof website[0]?.navigation_enabled!=="boolean")
  failures.push("DISTRIBUTION_WEBSITE_INVALID");
 // Published pages remain visible after menu navigation goes OFF.
 if(!Array.isArray(constraints))failures.push("DATABASE_GUARD_CATALOG_UNAVAILABLE");
 else for(const [table,pattern] of REQUIRED_DB_GUARDS){
  if(!constraints.some(x=>x?.table_name===table&&
     typeof x.definition==="string"&&pattern.test(x.definition.replace(/[()]/g," "))))
   failures.push("DATABASE_CHECK_MISSING_"+table+"_"+pattern.source);
 }
 if(!object(counters)||!["customers","numbers","journal","workflows"].every(key=>
    Number.isSafeInteger(Number(counters[key]))&&Number(counters[key])>=0))
  failures.push("RECORD_COUNTERS_INVALID");
 const audit=Object.freeze({
  ready:failures.length===0,business_unit:"direct_sva",
  commercial_activation_permitted:false,number_activation_permitted:false,
  payouts_permitted:false,
  editorial_publication_observed:website?.[0]?.public_content_authorized===true,
  navigation_observed:website?.[0]?.navigation_enabled===true,
  counts:object(counters)?Object.freeze({
   customers:Number(counters.customers)||0,
   numbers:Number(counters.numbers)||0,
   journal:Number(counters.journal)||0,
   workflows:Number(counters.workflows)||0
  }):null,
  failures:Object.freeze(failures)
 });
 return audit;
}
