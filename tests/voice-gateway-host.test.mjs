import test from "node:test";
import assert from "node:assert/strict";
import {privateVoiceBind,validateVoiceGatewayConfig} from "../telephony/voice-gateway-config.mjs";
import {inspectVoiceDatabase} from "../telephony/voice-gateway-preflight.mjs";
const fp=Array(32).fill("12").join(":");
const base={enabled:true,bind_ipv4:"10.1.2.3",port:8443,cert_file:"/etc/pgi/cert.pem",key_file:"/etc/pgi/key.pem",ca_file:"/etc/pgi/ca.pem",nodes:[{node_id:"voice-1",certificate_sha256:fp,key_id:"v1",secret:Buffer.alloc(32,23).toString("base64url"),enabled:true,valid_from:1,valid_until:100}]};
test("gateway host accepts only explicit private binds and distinct certificate identities",()=>{
 assert.equal(privateVoiceBind("127.0.0.1"),true);
 assert.equal(privateVoiceBind("172.31.0.1"),true);
 assert.equal(privateVoiceBind("172.32.0.1"),false);
 assert.equal(privateVoiceBind("0.0.0.0"),false);
 assert.equal(privateVoiceBind("8.8.8.8"),false);
 assert.equal(validateVoiceGatewayConfig(base).keys.size,1);
 assert.throws(()=>validateVoiceGatewayConfig({...base,enabled:false}),/VOICE_GATEWAY_CONFIG_DISABLED/);
 assert.throws(()=>validateVoiceGatewayConfig({...base,bind_ipv4:"0.0.0.0"}),/VOICE_PRIVATE_BIND_REQUIRED/);
 assert.throws(()=>validateVoiceGatewayConfig({...base,nodes:[...base.nodes,{...base.nodes[0],node_id:"voice-2"}]}),/VOICE_CERT_NODE_CONFLICT/);
});
test("preflight is read-only and never authorizes activation",async()=>{
 let i=0;
 const sql={unsafe:async query=>{assert.match(query,/^SELECT /);return [[{control:true,destinations:true,reservations:true,nonces:true}],[{rolsuper:false,rolbypassrls:false,owns_tables:false}],[{mode:"disabled",open_reservations:"0",dedicated_destinations:"1",legacy_collisions:"0"}],[{enabled:2}]][i++];}};
 const result=await inspectVoiceDatabase(sql);
 assert.equal(result.ready_for_review,true);assert.equal(result.activation_authorized,false);
 const missing=await inspectVoiceDatabase({unsafe:async()=>[{control:false}]});
 assert.equal(missing.ready_for_review,false);
});
