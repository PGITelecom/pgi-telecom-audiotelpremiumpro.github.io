import test from "node:test";
import assert from "node:assert/strict";
import {createInboundSipAdapter} from "../telephony/webrtc/inbound-sip-adapter.mjs";
const now=()=>Date.parse("2026-01-01T00:00:00Z");
const base={enabled:true,wss_url:"wss://sip.example.invalid/ws",username:"agent1",password:"placeholder-for-local-test",aor:"sip:agent1@sip.example.invalid",expires_at:"2026-01-01T00:05:00Z",ice_servers:[{urls:"turns:turn.example.invalid:5349?transport=tcp",username:"temp",credential:"test-only"}]};
function setup(grant=base){
 let instance;
 class Mock{
  constructor(url,options){this.options=options;instance=this;}
  async connect(){this.options.delegate.onServerConnect();}
  async register(){this.options.delegate.onRegistered();}
  async answer(){this.options.delegate.onCallAnswered();}
  async decline(){this.options.delegate.onCallHangup();}
  async hangup(){this.options.delegate.onCallHangup();}
  async unregister(){this.options.delegate.onUnregistered();}
  async disconnect(){this.options.delegate.onServerDisconnect();}
  mute(){}unmute(){}
 }
 const adapter=createInboundSipAdapter({SimpleUser:Mock,grant,expectedWss:base.wss_url,expectedSipDomain:"sip.example.invalid",remoteAudio:{},now});
 return {adapter,instance};
}
test("incoming calls require manual answer and browser disconnect is ambiguous",async()=>{
 const {adapter,instance}=setup();
 await adapter.start();assert.equal(adapter.snapshot().state,"available");
 instance.options.delegate.onCallReceived();assert.equal(adapter.snapshot().state,"incoming");
 await adapter.answer();assert.equal(adapter.snapshot().state,"connected");
 await adapter.toggleMute();assert.equal(adapter.snapshot().muted,true);
 instance.options.delegate.onServerDisconnect();assert.equal(adapter.snapshot().state,"uncertain");
 instance.options.delegate.onCallHangup();assert.equal(adapter.snapshot().occupied,true);
 await assert.rejects(adapter.close(),/SIP_ACTION_NOT_ALLOWED/);
 assert.equal(adapter.snapshot().authoritative,false);
 assert.equal("call" in adapter,false);
});
test("reject unauthorized, mismatched and expired grants",()=>{
 assert.throws(()=>setup({...base,enabled:false}),/SIP_NOT_AUTHORIZED/);
 assert.throws(()=>setup({...base,wss_url:"wss://other.example.invalid/ws"}),/SIP_GATEWAY_INVALID/);
 assert.throws(()=>setup({...base,expires_at:"2025-12-31T23:59:59Z"}),/SIP_GRANT_EXPIRY_INVALID/);
 assert.throws(()=>setup({...base,ice_servers:[]}),/SIP_ICE_REQUIRED/);
});
