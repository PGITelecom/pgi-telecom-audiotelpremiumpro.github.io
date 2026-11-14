import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as rollups from "../backend/src/store-postgres-rollups.mjs";

const names=[
  "writeExperienceRollup",
  "writeTenantDailyRollup",
  "writeVoiceCarrierHealthRollup",
  "writeTenantVoiceDailyRollup",
  "writeSipCodeRollup",
  "writeQualityRollup",
  "writeDashboardDimensionRollups",
  "writeHourlyRollup",
  "refreshHourlyRollupsForCalls"
];

test("PostgreSQL rollup writers stay available from their dedicated module",()=>{
  const source=fs.readFileSync("backend/src/store-postgres.mjs","utf8");
  const moduleSource=fs.readFileSync("backend/src/store-postgres-rollups.mjs","utf8");
  assert.match(source,/from "\.\/store-postgres-rollups\.mjs"/);
  for(const name of names){
    assert.equal(typeof rollups[name],"function",name);
    assert.ok(source.includes(name),"legacy store keeps "+name+" call sites");
    assert.ok(moduleSource.includes("export async function "+name+"("),name);
    assert.equal(new RegExp("^async function "+name+"\\(","m").test(source),false,name+" is extracted");
  }
});

test("rollup writers retain parameterized statements within the supplied transaction",async()=>{
  for(const name of names){
    const statements=[];
    const tx={unsafe:async(sql,params)=>{
      assert.equal(typeof sql,"string",name);
      assert.ok(sql.length>20,name);
      assert.ok(sql.includes("$1"),name+" must parameterize call context");
      assert.deepEqual(params,[name==="refreshHourlyRollupsForCalls"?"[]":7919]);
      statements.push(sql);
      return [];
    }};
    await rollups[name](tx,name==="refreshHourlyRollupsForCalls"?"[]":7919);
    assert.ok(statements.length>0,name+" emits SQL through caller transaction");
  }
});
