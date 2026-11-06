import test from 'node:test';
import assert from 'node:assert/strict';
import {introductoryCurrentMonthFree} from '../backend/src/audiotel-billing-calendar.mjs';
test('free current calendar month ends at midnight Paris in winter',()=>{
 const r=introductoryCurrentMonthFree('2026-11-06T15:00:00Z');
 assert.equal(r.trial_ends_at,'2026-11-30T23:00:00.000Z');
 assert.equal(r.charge_authorized,false);
 assert.equal(r.invoice_generated,false);
});
test('free current calendar month respects Paris summer time',()=>{
 const r=introductoryCurrentMonthFree('2026-06-12T12:00:00Z');
 assert.equal(r.trial_ends_at,'2026-06-30T22:00:00.000Z');
});
test('invalid date is rejected rather than making chargeable period',()=>{
 assert.throws(()=>introductoryCurrentMonthFree('not-a-date'),/BILLING_START_INVALID/);
});
