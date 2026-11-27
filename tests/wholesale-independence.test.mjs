import test from "node:test";
import assert from "node:assert/strict";
import {compareWholesaleOffers} from "../backend/src/wholesale-offer-comparison.mjs";
import {normalizeCarrierExport} from "../backend/src/carrier-export-normalizer.mjs";
const evidence=Object.fromEntries(["signed_offer","numbering_authority","interconnection","portability","cdr_access","settlement_access","payment_compliance","technical_acceptance"].map(k=>[k,true]));
const offer=(provider_key,rate,intermediary=0)=>({provider_key,operator_net_micro_eur_per_min:rate,
 variable_cost_micro_eur_per_min:{network:10000,payment:5000,other:5000,intermediary},
 fixed_cost_micro_eur:{monthly_fee:0,minimum_commitment_topup:0,setup_fee:0,switching_fee:0,termination_fee:0},evidence:{...evidence},costs_verified:true});
const scenario=(offers)=>({business_unit:"audiotel_platform",currency:"EUR",billing_basis:"minute",monthly_minutes:100000,horizon_months:12,publisher_micro_eur_per_min:400000,publisher_contract_verified:true,offers});
test("direct wholesale ranking includes intermediary and one-time exit costs",()=>{
 const old=offer("reseller",520000,20000),direct=offer("direct",550000);
 direct.fixed_cost_micro_eur.switching_fee=1200000000;
 const r=compareWholesaleOffers({...scenario([old,direct]),current_provider_key:"reseller"});
 assert.equal(r.candidate_provider_key,"direct");
 assert.equal(r.offers[0].effective_margin_micro_eur_per_min,129000);
 assert.equal(r.offers[0].incremental_contribution_micro_eur,58800000000);
 assert.equal(r.automatic_switch_authorized,false);
 assert.equal(r.payout_authorized,false);
});
test("higher rate is blocked when evidence is missing or fees erode margin",()=>{
 const direct=offer("direct",600000);direct.evidence.interconnection=false;
 const expensive=offer("expensive",550000);expensive.fixed_cost_micro_eur.monthly_fee=8000000000;
 const r=compareWholesaleOffers(scenario([direct,expensive,offer("ready",520000)]));
 assert.equal(r.candidate_provider_key,"ready");
 assert.ok(r.offers.find(x=>x.provider_key==="direct").blocked_reasons.includes("missing_interconnection"));
 assert.ok(r.offers.find(x=>x.provider_key==="expensive").blocked_reasons.includes("margin_below_floor"));
});
test("missing costs, duplicate offers, floating amounts and weakened margin floor fail closed",()=>{
 const a=offer("direct",550000);delete a.variable_cost_micro_eur_per_min.network;
 assert.throws(()=>compareWholesaleOffers(scenario([a])),/WHOLESALE_INVALID_COST_NETWORK/);
 assert.throws(()=>compareWholesaleOffers(scenario([offer("same",520000),offer("same",530000)])),/DUPLICATE/);
 assert.throws(()=>compareWholesaleOffers(scenario([offer("direct",550000.1)])),/OPERATOR_RATE/);
 assert.throws(()=>compareWholesaleOffers({...scenario([offer("direct",550000)]),minimum_margin_micro_eur_per_min:69999}),/MARGIN_TARGET/);
});
const mapping={id:"external_call_id",start:"started_at",stop:"ended_at",talk:"conversation_seconds",bill:"payout_eligible_seconds",amount:"confirmed_payout_ht"};
const row={id:"call-1",start:"2026-11-01T10:00:00+01:00",stop:"2026-11-01T10:01:00+01:00",talk:"60",bill:60,amount:"0.543210",caller:"sensitive"};
const batch=rows=>({business_unit:"audiotel_platform",currency:"EUR",provider_key:"carrier-a",field_mapping:mapping,rows});
test("carrier exports normalize precise amounts and drop unrelated personal fields",()=>{
 const r=normalizeCarrierExport(batch([row]));
 assert.equal(r.total_reported_payout_micro_eur,543210);
 assert.equal(r.rows[0].started_at,"2026-11-01T09:00:00.000Z");
 assert.equal(r.rows[0].caller,undefined);
 assert.equal(r.source_authenticated,false);
 assert.equal(r.ledger_write_authorized,false);
 assert.equal(r.payout_authorized,false);
 const second={...row,id:"call-2"};
 assert.equal(normalizeCarrierExport(batch([row,second])).canonical_digest,normalizeCarrierExport(batch([second,row])).canonical_digest);
});
test("carrier exports reject duplicate IDs, ambiguous dates, amounts and mapping collisions",()=>{
 assert.throws(()=>normalizeCarrierExport(batch([row,row])),/DUPLICATE/);
 assert.throws(()=>normalizeCarrierExport(batch([{...row,start:"2026-11-01T10:00:00"}])),/OFFSET/);
 assert.throws(()=>normalizeCarrierExport(batch([{...row,talk:61}])),/CHRONOLOGY/);
 assert.throws(()=>normalizeCarrierExport(batch([{...row,amount:0.54321}])),/DECIMAL_STRING/);
 assert.throws(()=>normalizeCarrierExport({...batch([row]),field_mapping:{...mapping,other:"external_call_id"}}),/MAPPING_INVALID/);
});
