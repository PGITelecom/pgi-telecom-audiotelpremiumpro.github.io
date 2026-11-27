import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {signVoiceMachineRequest,authenticateVoiceMachineRequest} from "../backend/src/voice-machine-auth.mjs";
import {createPrivateVoiceGateway} from "../backend/src/private-voice-gateway.mjs";
const now=()=>1795824000;
const node="voice-1",keyId="key-v1",secret=Buffer.alloc(32,23).toString("base64url");
const call_id="12345678-1234-4234-8234-123456789abc";
const resolveKey=async(n,k)=>({node_id:n,key_id:k,enabled:n===node&&k===keyId,valid_from:now()-1000,valid_until:now()+1000,secret});
function request(path="/voice/v1/reserve",payload={call_id,sva_number:"0890000000"},extra={}){
 const q={node,keyId,timestamp:now(),nonce:randomUUID(),path,body:Buffer.from(JSON.stringify(payload)),...extra};
 return {...q,signature:signVoiceMachineRequest(q,secret)};
}
function nonces(){const used=new Set();return async q=>{const key=[q.node_id,q.key_id,q.nonce].join(":");if(used.has(key))return false;used.add(key);return true;};}
test("per-node authentication binds exact path and body and rejects replay, tampering, expiry and unknown nodes",async()=>{
 const deps={resolveKey,consumeNonce:nonces(),now};
 const req=request();
 const verified=await authenticateVoiceMachineRequest(req,deps);
 assert.equal(verified.authenticatedNode,node);
 assert.equal(verified.payload.call_id,call_id);
 await assert.rejects(authenticateVoiceMachineRequest(req,deps),/VOICE_MACHINE_REPLAY/);
 await assert.rejects(authenticateVoiceMachineRequest({...request(),body:Buffer.from('{"call_id":"changed"}')},deps),/VOICE_MACHINE_AUTH_FAILED/);
 await assert.rejects(authenticateVoiceMachineRequest({...request(),path:"/voice/v1/observe"},deps),/VOICE_MACHINE_AUTH_FAILED/);
 await assert.rejects(authenticateVoiceMachineRequest(request(undefined,undefined,{timestamp:now()-61}),deps),/VOICE_MACHINE_REQUEST_EXPIRED/);
 await assert.rejects(authenticateVoiceMachineRequest(request(undefined,undefined,{node:"other-node"}),deps),/VOICE_MACHINE_AUTH_FAILED/);
});
test("gateway ignores browser-supplied tenant/destination, requires exclusive lane and drains without blocking closure",async()=>{
 let mode="enabled",existing=false,exclusive=true,observations=0,reservations=0;
 const sql={};
 const gateway=createPrivateVoiceGateway({sql,resolveKey,consumeNonce:nonces(),now,
  resolveMode:async()=>mode,
  admitReservation:async input=>{
   assert.deepEqual(input,{node_id:node,call_id,sva_number:"0890000000"});
   return {allowed:true,exclusive,existing,node_id:node,call_id,tenant_id:"10",sva_number_id:"11",destination_id:"12"};
  },
  operations:{
   reserve:async(db,payload,ctx)=>{reservations++;assert.equal(db,sql);assert.equal(ctx.authenticatedNode,node);assert.deepEqual(payload,{call_id,tenant_id:"10",sva_number_id:"11",destination_id:"12"});return {reserved:true};},
   observe:async(db,payload,ctx)=>{observations++;assert.equal(ctx.authenticatedNode,node);assert.equal(payload.state,"terminal");return {released:true};}
  }
 });
 await gateway(request(undefined,{call_id,sva_number:"0890000000",tenant_id:"999",destination_id:"999"}));
 exclusive=false;await assert.rejects(gateway(request()),/VOICE_ROUTE_NOT_AUTHORIZED/);exclusive=true;
 mode="draining";await assert.rejects(gateway(request()),/VOICE_GATEWAY_NOT_ACCEPTING_CALLS/);
 existing=true;await gateway(request());existing=false;
 await gateway(request("/voice/v1/observe",{call_id,generation:randomUUID(),sequence:4,state:"terminal"}));
 mode="disabled";await assert.rejects(gateway(request()),/VOICE_GATEWAY_NOT_ACCEPTING_CALLS/);
 await gateway(request("/voice/v1/observe",{call_id,generation:randomUUID(),sequence:5,state:"terminal"}));
 assert.equal(reservations,2);assert.equal(observations,2);
});
test("schema defaults disabled, uses durable anti-replay and excludes legacy active destinations",async()=>{
 const ddl=await readFile(new URL("../telephony/sql/voice-reservations.prepare.sql",import.meta.url),"utf8");
 const store=await readFile(new URL("../backend/src/voice-reservation-store.mjs",import.meta.url),"utf8");
 assert.ok(ddl.includes("VALUES(true,'disabled')"));
 assert.ok(ddl.includes("PRIMARY KEY (node_id,key_id,nonce)"));
 assert.equal((ddl.match(/\$pgi\$/g)||[]).length,4);
 assert.ok(ddl.includes("VOICE_GATEWAY_LEGACY_ROUTE_FORBIDDEN"));
 assert.ok(ddl.includes("SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp"));
 assert.ok(store.includes("voice_gateway_control WHERE singleton=true FOR SHARE"));
 assert.ok(store.includes("g.node_id=$4 FOR UPDATE OF d"));
 assert.ok(store.includes("d.status='testing'"));
});
