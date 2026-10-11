import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Distribution controls mount only in the primary Cockpit after administrator login",()=>{
 const cockpit=read("index.html"),app=read("assets/app.js"),entry=read("assets/direct-sva-cockpit-entry.js"),acct=read("assets/accounting-cockpit.js");
 assert.match(cockpit,/id="view-overview"/);
 assert.match(entry,/document\.getElementById\("view-overview"\)/);
 assert.match(entry,/user\?\.role!=="admin"/);
 assert.match(entry,/overview\.prepend\(host\)/);
 assert.match(entry,/host\.id="direct-sva-cockpit-controls"/);
 assert.match(app,/import\("\.\/direct-sva-cockpit-entry\.js"\)/);
 assert.match(entry,/import\("\.\/direct-sva-switches\.js"\)/);
 assert.match(entry,/pgi:direct-sva-preview-change/);
 assert.match(acct,/refreshPreviewStatus/);
 assert.match(acct,/pgi:direct-sva-preview-change/);
 assert.doesNotMatch(acct,/data-direct-sva-admin-switches/);
});

test("mobile toggles are physically tappable and publication remains separate from private preview",()=>{
 const ui=read("assets/direct-sva-switches.js");
 assert.match(ui,/data-dss-preview/);
 assert.match(ui,/data-dss-website/);
 assert.match(ui,/data-dss-commercial/);
 assert.match(ui,/disabled aria-disabled="true"/);
 assert.match(ui,/dss-advanced/);
 assert.match(ui,/<details class="dss-advanced"/);
 assert.match(ui,/min-height:66px/);
 assert.match(ui,/min-height:48px/);
 assert.match(ui,/min-height:52px/);
 assert.match(ui,/@media\(max-width:680px\)/);
 assert.match(ui,/@media\(max-width:340px\)/);
 assert.match(ui,/touch-action:manipulation/);
 assert.match(ui,/X-CSRF-Token/);
 assert.match(ui,/expected_enabled:expected/);
 assert.match(ui,/commercial_operation_enabled!==false/);
 assert.match(ui,/side_effects_executed!==false/);
});

test("Business Live and its schedule stay accessible on 320px and other phone widths",()=>{
 const live=read("assets/live-finance.js");
 const css=read("assets/live-finance.css");
 const dialog=read("assets/business-live-reset-schedule.css");
 const global=read("assets/cockpit-touch.css");
 assert.ok(live.indexOf('<div class="lj-actions">')<live.indexOf('<div class="lj-ranking">'));
 assert.doesNotMatch(live,/stabilizeLanding|landOnBusinessLive/);
 assert.match(css,/\.lj-actions\{display:flex/);
 assert.match(global,/@media\(max-width:520px\)/);
 assert.match(global,/min-height:52px/);
 assert.match(global,/overflow-wrap:anywhere/);
 assert.match(dialog,/max-height:calc\(100dvh/);
 assert.match(dialog,/overflow-y:auto/);
 assert.match(dialog,/position:sticky/);
 assert.match(dialog,/min-height:52px/);
 assert.match(global,/@media\(max-width:340px\)/);
 assert.match(global,/@media\(max-width:520px\)/);
 assert.match(global,/\.main\{overflow-x:clip\}/);
});

test("distribution cockpit tables scroll inside their panels, never beyond the mobile viewport",()=>{
 const direct=read("assets/direct-sva-cockpit.js");
 assert.match(direct,/overscroll-behavior-x:contain/);
 assert.match(direct,/-webkit-overflow-scrolling:touch/);
 assert.match(direct,/@media\(max-width:340px\)/);
 assert.match(direct,/\.ds-actions>\*\{width:100%;min-width:0\}/);
});
