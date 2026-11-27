import test from "node:test";
import assert from "node:assert/strict";
import {mediaObservation,reservationHealth,voiceCallId} from "../backend/src/voice-reservation-lifecycle.mjs";
const call_id="12345678-1234-4234-8234-123456789abc";
const generation="12345678-4321-4321-8321-123456789abc";
const node_id="voice-1";
const initial={call_id,node_id,generation,state:"reserved",sequence:0,last_observation:null,created_at:"2026-01-01T00:00:00Z"};
function observe(row,state,sequence,extra={}){
 return mediaObservation(row,{call_id,node_id,generation,state,sequence,...extra});
}
function apply(row,event){return {...row,...event};}
test("reserve, connect, network unknown, recover, terminal; only terminal releases capacity",()=>{
 let row=initial;
 for(const [state,sequence,expected] of [["dialing",1,"dialing"],["connected",2,"connected"],["unknown",3,"uncertain"],["connected",4,"connected"],["terminal",5,"released"]]){
  const event=observe(row,state,sequence);assert.equal(event.state,expected);
  assert.equal(event.release_capacity,state==="terminal");
  row=apply(row,event);
 }
 const duplicate=observe(row,"terminal",5);assert.equal(duplicate.applied,false);assert.equal(duplicate.release_capacity,false);
 const late=observe(row,"connected",6);assert.equal(late.state,"released");assert.equal(late.applied,false);
});
test("duplicate events, old messages and stale fencing never double release",()=>{
 const row=apply(initial,observe(initial,"connected",2));
 assert.equal(observe(row,"dialing",1).applied,false);
 assert.equal(observe(row,"connected",2).applied,false);
 assert.throws(()=>observe(row,"terminal",2),/VOICE_SEQUENCE_CONFLICT/);
 assert.throws(()=>observe(row,"terminal",3,{generation:"wrong"}),/FENCE_MISMATCH/);
 assert.throws(()=>observe(row,"terminal",3,{node_id:"voice-2"}),/FENCE_MISMATCH/);
 assert.throws(()=>observe(row,"browser_disconnected",3),/OBSERVATION_INVALID/);
 assert.throws(()=>voiceCallId("invalid"),/CALL_ID_INVALID/);
});
test("stale connected reservation stays occupied; no timeout-based release",()=>{
 const now=Date.parse("2026-01-01T01:00:00Z");
 const row=apply(initial,observe(initial,"connected",1));
 const health=reservationHealth(row,now);
 assert.equal(health.stale,true);assert.equal(health.needs_media_reconciliation,true);
 assert.equal(health.occupies_capacity,true);assert.equal(health.release_authorized,false);
 const final=apply(row,observe(row,"terminal",2));
 assert.equal(reservationHealth(final,now).occupies_capacity,false);
});
