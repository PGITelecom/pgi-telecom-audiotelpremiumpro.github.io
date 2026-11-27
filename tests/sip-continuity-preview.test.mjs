import test from "node:test";
import assert from "node:assert/strict";
import {prepareSipContinuityPreview} from "../backend/carriers/sip-continuity-preview.mjs";
const original={
 number:"+33890123456",
 authorizedNumbers:["+33890123456"],
 currentRouteId:"route_primary",
 routes:[
  {routeId:"route_primary",carrierCode:"CARRIER_A",type:"primary",state:"active",health:"down",priority:0},
  {routeId:"route_backup_a",carrierCode:"CARRIER_A",type:"same_carrier_backup",state:"standby",health:"up",priority:2},
  {routeId:"route_backup_b",carrierCode:"CARRIER_B",type:"alternate_carrier",state:"ready",health:"up",priority:1}
 ]
};
const plan=changes=>prepareSipContinuityPreview({...original,...changes});

test("prefers same-carrier SIP backup but cannot claim 089 access or enact a switch",()=>{
 const r=plan();
 assert.equal(r.decision,"same_carrier_sip_backup");
 assert.equal(r.proposed_route.route_id,"route_backup_a");
 assert.equal(r.other_reported_candidate_count,1);
 assert.equal(r.access_to_089_independently_verified,false);
 assert.equal(r.can_change_sip_route,false);
 assert.equal(r.automatic_failover_enabled,false);
 assert.equal(r.external_actions_executed,false);
});

test("healthy primary remains unchanged even with lower-priority available backups",()=>{
 const routes=structuredClone(original.routes);
 routes[0].health="up";
 const r=plan({routes});
 assert.equal(r.decision,"keep_primary");
 assert.equal(r.proposed_route,null);
});

test("alternate carrier is only a proposal when no same-carrier SIP route exists",()=>{
 const routes=structuredClone(original.routes);
 routes[1].health="down";
 const r=plan({routes});
 assert.equal(r.decision,"alternate_carrier_proposal");
 assert.equal(r.proposed_route.carrier_code,"CARRIER_B");
 assert.equal(r.operator_agreements_verified,false);
 assert.equal(r.can_trigger_portability,false);
});

test("never fabricates a route if every viable route has failed",()=>{
 const routes=original.routes.map(r=>({...r,health:"unknown"}));
 const r=plan({routes});
 assert.equal(r.decision,"no_route");
 assert.equal(r.proposed_route,null);
});

test("scope and route identities fail closed, without writes",()=>{
 assert.throws(()=>plan({authorizedNumbers:[]}),/SIP_PREVIEW_UNAUTHORIZED_NUMBER_SCOPE/);
 assert.throws(()=>plan({authorizedNumbers:["+33890123457"]}),/SIP_PREVIEW_UNAUTHORIZED_NUMBER_SCOPE/);
 assert.throws(()=>plan({routes:[]}),/SIP_PREVIEW_INVALID_ROUTES/);
 assert.throws(()=>plan({currentRouteId:"missing_id"}),/SIP_PREVIEW_PRIMARY_MISSING/);
 assert.throws(()=>plan({routes:[...original.routes,structuredClone(original.routes[1])]}),/SIP_PREVIEW_DUPLICATE_ROUTE/);
});

test("invalid and cross-carrier backup routes are never eligible",()=>{
 const routes=structuredClone(original.routes);
 routes[1].carrierCode="CARRIER_Z";
 const r=plan({routes});
 assert.equal(r.proposed_route.route_id,"route_backup_b");
 assert.throws(()=>plan({routes:[{...original.routes[0],priority:-1}]}),/SIP_PREVIEW_INVALID_ROUTE/);
});

test("stable recommendation for equal-priority candidates",()=>{
 const routes=[original.routes[0],
 {routeId:"route_second",carrierCode:"CARRIER_A",type:"same_carrier_backup",state:"ready",health:"up",priority:1},
 {routeId:"route_first",carrierCode:"CARRIER_A",type:"same_carrier_backup",state:"ready",health:"up",priority:1}];
 const r=plan({routes});
 assert.equal(r.proposed_route.route_id,"route_first");
 assert.equal(plan({routes:[...routes].reverse()}).proposed_route.route_id,"route_first");
});
