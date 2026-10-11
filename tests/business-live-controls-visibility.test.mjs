import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("administrateur retrouve les commandes manuelle et automatique avant les classements Business Live",()=>{
  const ui=readFileSync(new URL("../assets/live-finance.js",import.meta.url),"utf8");
  const controls=ui.indexOf('<div class="lj-actions">');
  const ranking=ui.indexOf('<div class="lj-ranking">');
  assert.ok(controls>=0&&ranking>controls,"commands must precede client ranking on mobile");
  assert.match(ui,/id="live-jackpot-reset"[^>]*>Remettre Business Live à zéro/);
  assert.match(ui,/id="live-jackpot-schedule"[^>]*>Automatiser/);
  assert.match(ui,/can_reset/);
  assert.match(ui,/can_schedule/);
  assert.match(ui,/openBusinessLiveResetSchedule\(\{scope:"platform"/);
});
