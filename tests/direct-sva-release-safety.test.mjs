import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {evaluateDirectSvaReleaseSafety} from "../backend/src/direct-sva-release-safety.mjs";
const fixture=()=>({
 units:[
  {unit_code:"audiotel_platform",legal_accounting_profile_id:1,analytics_namespace:"audiotel",cost_center:"APP",display_name:"Audiotel Premium Pro",lifecycle_status:"existing",direct_distribution_sync_enabled:false,separate_legal_fec:false},
  {unit_code:"direct_sva",legal_accounting_profile_id:1,analytics_namespace:"distribution_directe",cost_center:"DSVA",display_name:"PGI Telecom Distribution",lifecycle_status:"preparation",direct_distribution_sync_enabled:false,separate_legal_fec:false}
 ],
 controls:[{id:1,operator_mode:"preparation",number_activation_enabled:false,payouts_enabled:false}],
 switches:[{id:1,interface_preview_enabled:false,commercial_operation_enabled:false}],
 website:[{id:1,public_content_authorized:false,navigation_enabled:false,commercial_calls_to_action_enabled:false}],
 constraints:[
  {table_name:"direct_sva_admin_switches",definition:"CHECK ((commercial_operation_enabled = false))"},
  {table_name:"direct_sva_operator_controls",definition:"CHECK ((number_activation_enabled = false))"},
  {table_name:"direct_sva_operator_controls",definition:"CHECK ((payouts_enabled = false))"},
  {table_name:"direct_sva_website_visibility",definition:"CHECK ((commercial_calls_to_action_enabled = false))"}
 ],
 counters:{customers:"0",numbers:"0",journal:"0",workflows:"0"}
});
test("release staging keeps Audiotel APP and Distribution DSVA independent",()=>{
 const r=evaluateDirectSvaReleaseSafety(fixture());
 assert.equal(r.ready,true);
 assert.equal(r.commercial_activation_permitted,false);
 assert.equal(r.payouts_permitted,false);
});
test("cockpit editorial publication does not activate commercial operations",()=>{
 const x=fixture();x.website[0].public_content_authorized=true;x.website[0].navigation_enabled=true;
 const r=evaluateDirectSvaReleaseSafety(x);
 assert.equal(r.ready,true);
 assert.equal(r.editorial_publication_observed,true);
});
test("hidden navigation preserves prior publication in readiness",()=>{
 const x=fixture();x.website[0].public_content_authorized=true;
 const r=evaluateDirectSvaReleaseSafety(x);
 assert.equal(r.ready,true);
 assert.equal(r.navigation_observed,false);
});
test("reject navigation enabled without editorial publication",()=>{
 const x=fixture();x.website[0].navigation_enabled=true;
 assert.equal(evaluateDirectSvaReleaseSafety(x).ready,false);
});
test("reject cross-business financial or telecom activation or changed Audiotel name",()=>{
 for(const mutation of [
  x=>x.controls[0].payouts_enabled=true,
  x=>x.controls[0].number_activation_enabled=true,
  x=>x.switches[0].commercial_operation_enabled=true,
  x=>x.website[0].commercial_calls_to_action_enabled=true,
  x=>x.units[0].display_name="Distribution",
  x=>x.units[1].cost_center="APP",
  x=>x.units[1].direct_distribution_sync_enabled=true,
  x=>x.units[1].legal_accounting_profile_id=2
 ]){const x=fixture();mutation(x);assert.equal(evaluateDirectSvaReleaseSafety(x).ready,false);}
});
test("reject removal of each persistent PostgreSQL safety CHECK",()=>{
 for(let i=0;i<4;i++){const x=fixture();x.constraints.splice(i,1);
  assert.equal(evaluateDirectSvaReleaseSafety(x).ready,false);}
});
test("reject absent controls, unrecognized counters and missing commercial rows",()=>{
 for(const mutation of [
  x=>x.controls=[],
  x=>x.switches=[],
  x=>x.website=[],
  x=>x.units=[],
  x=>x.constraints=null,
  x=>x.counters.numbers=-1,
  x=>x.counters.journal="not-a-number"
 ]){const x=fixture();mutation(x);assert.equal(evaluateDirectSvaReleaseSafety(x).ready,false);}
});
test("prepublication operator audit has SELECT statements only",()=>{
 const src=fs.readFileSync("scripts/audit-direct-sva-production-release.mjs","utf8");
 assert.doesNotMatch(src,/\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\s+(?:TABLE|INTO|FROM|direct_sva|pgi_company)/i);
 assert.match(src,/evaluateDirectSvaReleaseSafety/);
 assert.match(src,/sql\.unsafe\("SELECT /);
});
