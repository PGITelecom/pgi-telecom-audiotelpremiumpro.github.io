import test from 'node:test';
import assert from 'node:assert/strict';
import {previewAudiotelStripeEntry,previewAudiotelStripeClearing} from '../backend/src/audiotel-stripe-accounting-preview.mjs';
const chart={accounts_receivable:'411100',subscription_revenue:'706100',vat_output:'445710',stripe_clearing:'467100',psp_fee_expense:'627100',bank:'512100'};
const core={business_unit:'audiotel_platform',currency:'EUR',source_reference:'invoice_1234567',evidence_reference:'evidence_1234567',chart,tax_policy_approved:true,account_map_approved:true};
test('VAT-inclusive 4.90 EUR subscription yields balanced preparatory entries',()=>{
 const x=previewAudiotelStripeEntry({...core,event:'subscription_invoice',gross_minor:490,vat_minor:82});
 assert.equal(x.debit_minor,490);assert.equal(x.credit_minor,490);
 assert.equal(x.lines.find(y=>y.account_num==='706100').credit_minor,408);
 assert.equal(x.posted,false);assert.equal(x.invoice_emitted,false);
});
test('Stripe fee and bank settlement are separate movements',()=>{
 const fee=previewAudiotelStripeEntry({...core,event:'stripe_fee',amount_minor:20});
 const payout=previewAudiotelStripeEntry({...core,event:'stripe_payout',amount_minor:470});
 assert.equal(fee.lines[0].account_num,'627100');
 assert.equal(payout.lines[0].account_num,'512100');
 assert.equal(fee.stripe_verified,false);assert.equal(payout.bank_verified,false);
});
test('wrong business unit and unapproved VAT setup are rejected',()=>{
 assert.throws(()=>previewAudiotelStripeEntry({...core,event:'subscription_invoice',gross_minor:490,vat_minor:82,business_unit:'direct_sva'}),/APP_LEDGER_INVALID_SCOPE/);
 assert.throws(()=>previewAudiotelStripeEntry({...core,event:'subscription_invoice',gross_minor:490,vat_minor:82,tax_policy_approved:false}),/APP_LEDGER_TAX_POLICY_NOT_APPROVED/);
});
test('balanced Stripe clearing is never mistaken for verified bank evidence',()=>{
 const s=previewAudiotelStripeClearing({business_unit:'audiotel_platform',currency:'EUR',period_reference:'APP-2026-11-01',opening_clearing_minor:0,payments:[{reference:'charge_1234567',amount_minor:490}],fees:[{reference:'fee_123456789',amount_minor:20}],payouts:[{reference:'payout_1234567',amount_minor:470}],reported_closing_clearing_minor:0});
 assert.equal(s.difference_minor,0);assert.equal(s.bank_verified,undefined);
 assert.equal(s.reconciled_with_verified_stripe_and_bank,false);
});
