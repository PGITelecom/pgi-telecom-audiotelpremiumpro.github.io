import test from "node:test";
import assert from "node:assert/strict";
import {prepareDirectInterconnectionPreview} from "../backend/carriers/direct-interconnection-readiness.mjs";

test("direct connection can be planned but never self-certified",()=>{
 const p=prepareDirectInterconnectionPreview({mode:"bilateral_direct",peerCodes:["ORANGE","FREE"]});
 assert.equal(p.mode,"bilateral_direct");
 assert.equal(p.declared_counterparty_count,2);
 assert.equal(p.ready_to_interconnect,false);
 assert.equal(p.arcep_allocation_verified,false);
 assert.equal(p.operator_contracts_verified,false);
 assert.equal(p.payment_permissions_verified,false);
 assert.equal(p.tariff_compliance_verified,false);
 assert.equal(p.live_routes_created,false);
 assert.equal(p.external_actions_executed,false);
 assert.equal(p.zero_external_network_cost_assumed,false);
 assert.ok(p.missing_independent_evidence.some(g=>g.key==="origin_reachability"));
 assert.ok(p.missing_independent_evidence.some(g=>g.key==="collection_and_settlement"));
 assert.ok(p.missing_independent_evidence.every(g=>g.status==="independent_evidence_required"));
});
test("wholesale bridge is also an unactivated preparation option",()=>{
 const p=prepareDirectInterconnectionPreview({mode:"wholesale_bridge",peerCodes:[]});
 assert.equal(p.declared_counterparty_count,0);
 assert.equal(p.ready_to_interconnect,false);
 assert.equal(p.requires_operator_agreements,true);
});
test("fail closed on invalid, duplicate, oversized or secret-bearing input",()=>{
 const previews=[
  null,[],{mode:"arbitrary",peerCodes:[]},
  {mode:"bilateral_direct",peerCodes:["A"]},
  {mode:"bilateral_direct",peerCodes:["ORANGE","ORANGE"]},
  {mode:"bilateral_direct",peerCodes:Array.from({length:13},(_,i)=>"PEER_"+i)},
  {mode:"bilateral_direct",peerCodes:[],sipSecret:"do_not_store"},
  {mode:"bilateral_direct",peerCodes:["SECRET=VALUE"]},
  {mode:"bilateral_direct",peerCodes:[null]},
  {mode:"bilateral_direct",peerCodes:null}
 ];
 for(const v of previews)assert.throws(()=>prepareDirectInterconnectionPreview(v),/DIRECT_INTERCONNECT_/);
});
test("declaration of a peer never activates financial or network permissions",()=>{
 const a=prepareDirectInterconnectionPreview({mode:"bilateral_direct",peerCodes:["ORANGE","SFR","BOUYGUES","FREE"]});
 assert.equal(a.ready_to_interconnect,false);
 assert.equal(a.payout_authorized,false);
 assert.equal(a.production_changes_authorized,false);
 assert.equal(a.financial_margin_verified,false);
});
