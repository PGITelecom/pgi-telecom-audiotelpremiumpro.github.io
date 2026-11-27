import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {assertContinuityPlanSafe} from "../assets/carrier-continuity-console.js";
import {prepareSipContinuityPreview} from "../backend/carriers/sip-continuity-preview.mjs";

function fakeReport(){
 return prepareSipContinuityPreview({
  number:"+33890123456",authorizedNumbers:["+33890123456"],
  currentRouteId:"route_primary",routes:[
   {routeId:"route_primary",carrierCode:"CARRIER_A",type:"primary",state:"active",health:"down",priority:0},
   {routeId:"route_backup_a",carrierCode:"CARRIER_A",type:"same_carrier_backup",state:"standby",health:"up",priority:1},
   {routeId:"route_backup_b",carrierCode:"CARRIER_B",type:"alternate_carrier",state:"ready",health:"up",priority:2}
  ]
 });
}
test("client boundary refuses a continuity result that implies a real action",()=>{
 const r=fakeReport();
 assert.equal(assertContinuityPlanSafe(r),r);
 for(const key of ["automatic_failover_enabled","can_change_sip_route","can_trigger_portability","can_activate_089","external_actions_executed","access_to_089_independently_verified"]){
  assert.throws(()=>assertContinuityPlanSafe({...r,[key]:true}),/CONTINUITY_RESPONSE_UNSAFE/);
 }
 assert.throws(()=>assertContinuityPlanSafe({...r,business_unit:"audiotel_platform"}),/CONTINUITY_RESPONSE_UNSAFE/);
});
test("server continuity endpoint is private, admin-only and requires CSRF",()=>{
 const src=fs.readFileSync(new URL("../backend/server.mjs",import.meta.url),"utf8");
 const pos=src.indexOf('pathname==="/api/v1/platform/carrier-autonomy/continuity-preview"');
 assert.ok(pos>0);
 const block=src.slice(pos,pos+1600);
 assert.match(block,/requireRole\(actor,\["admin"\]\)/);
 assert.match(block,/requireCsrf\(req,actor,config\)/);
 assert.match(block,/prepareSipContinuityPreview/);
 assert.match(block,/authorizedNumbers:\[scenario\.number\]/);
 assert.doesNotMatch(block,/store\.sql|store\.readSql|writeSql|transfer|activate_logical_carrier_route/);
});
test("optional cockpit is hidden unless explicitly enabled and built into static site",()=>{
 const entry=fs.readFileSync(new URL("../assets/direct-sva-cockpit-entry.js",import.meta.url),"utf8");
 const ui=fs.readFileSync(new URL("../assets/carrier-continuity-console.js",import.meta.url),"utf8");
 const builder=fs.readFileSync(new URL("../scripts/build-static.mjs",import.meta.url),"utf8");
 assert.match(entry,/carrierContinuityPreviewEnabled!==true/);
 assert.match(entry,/user\?\.role!=="admin"/);
 assert.match(entry,/import\("\.\/carrier-continuity-console\.js"\)/);
 assert.match(builder,/"assets\/carrier-continuity-console\.js"/);
 assert.match(ui,/credentials:"include"/);
 assert.match(ui,/__Host-pgi_csrf/);
 assert.match(ui,/Aucun appel n’est modifié/);
 assert.doesNotMatch(ui,/innerHTML\s*=/);
});
