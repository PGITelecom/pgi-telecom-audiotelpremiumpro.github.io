import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("SIP edge example never permits public SIP listening or relay",()=>{
 const cfg=read("telephony/prelaunch-not-active/kamailio.loopback-deny.cfg.example");
 assert.match(cfg,/listen=udp:127\.0\.0\.1:5099/);
 assert.match(cfg,/sl_send_reply\("503", "Audiotel Prelaunch Disabled"\)/);
 assert.doesNotMatch(cfg,/\b(t_relay|forward|sethost|ds_select_dst)\s*\(/);
 assert.deepEqual([...cfg.matchAll(/^listen=(.+)$/gm)].map(x=>x[1]),["udp:127.0.0.1:5099"]);
 assert.doesNotMatch(cfg,/password=|api_key|REAL_OPERATOR_IP/);
});
test("FreeSWITCH prelaunch context cannot bridge or originate calls",()=>{
 const xml=read("telephony/prelaunch-not-active/freeswitch.deny-context.xml.example");
 assert.match(xml,/context name="audiotel_prelaunch_disabled"/);
 assert.match(xml,/application="hangup" data="CALL_REJECTED"/);
 assert.doesNotMatch(xml,/application="(?:bridge|originate|transfer|socket|httapi|curl)"/);
 assert.doesNotMatch(xml,/sofia\/gateway\//);
});
test("new telecom modules are isolated and not imported from live backend or site",()=>{
 const backend=read("backend/server.mjs");
 const app=read("assets/app.js");
 const client=read("assets/client-portal.js");
 for(const content of [backend,app,client]){
  assert.doesNotMatch(content,/prelaunch-not-active\/network-core/);
  assert.doesNotMatch(content,/prelaunch-not-active\/cdr-reconciliation/);
 }
});
