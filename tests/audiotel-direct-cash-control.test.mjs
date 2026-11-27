import test from "node:test";
import assert from "node:assert/strict";
import { previewAudiotelDirectCashControl, APP_CASH_MODELS }
  from "../backend/src/audiotel-direct-cash-control.mjs";

const line = Object.freeze({
  line_reference: "carrier-call-0001", publisher_reference: "publisher-0001",
  gross_service_minor: 10000, carrier_fee_minor: 1000,
  adjustment_minor: 500, audiotel_commission_minor: 1500,
  publisher_due_minor: 7000
});
const statement = {operator_reference: "carrier-primary-0001",
  statement_reference: "statement-202611-001", period: "2026-11",
  currency: "EUR", rows: [line]};
const common = {business_unit: "audiotel_platform", period: "2026-11",
  currency: "EUR", model: APP_CASH_MODELS.collector_split, statement};

test("collector split keeps only company commission in Audiotel bank", () => {
  const x = previewAudiotelDirectCashControl({...common,
    bank_receipts: [{bank_entry_reference: "bank-entry-00001",
      statement_reference: statement.statement_reference,
      amount_minor: 1500, currency: "EUR"}],
    collector_publisher_transfers: [{
      provider_transfer_reference: "carrier-transfer-0001",
      publisher_reference: "publisher-0001", amount_minor: 7000, currency: "EUR"
    }]
  });
  assert.equal(x.company_bank_expected_minor, 1500);
  assert.equal(x.company_bank_difference_minor, 0);
  assert.equal(x.publisher_liabilities_estimate_minor, 7000);
  assert.equal(x.publisher_unsettled_reported_minor, 0);
  assert.equal(x.real_bank_balance_verified, false);
  assert.equal(x.bank_transfer_authorized, false);
  assert.equal(x.publisher_payout_authorized, false);
  assert.equal(x.net_company_profit_after_tax_minor, null);
  assert.equal(x.blockers.includes("BANK_RECORDS_NOT_AUTHENTICATED"), true);
});

test("global company collection is a separate legally blocked hypothetical route", () => {
  const x = previewAudiotelDirectCashControl({...common,
    model: APP_CASH_MODELS.company_clearing,
    bank_receipts: [{bank_entry_reference: "bank-entry-gross01",
      statement_reference: statement.statement_reference,
      amount_minor: 8500, currency: "EUR"}]
  });
  assert.equal(x.company_bank_expected_minor, 8500);
  assert.equal(x.publisher_liabilities_estimate_minor, 7000);
  assert.equal(x.company_bank_can_hold_publisher_funds, false);
  assert.ok(x.blockers.includes("THIRD_PARTY_FUNDS_LICENSE_AND_SAFEGUARDING_NOT_ESTABLISHED"));
  assert.equal(x.bookkeeping_authorized, false);
});

test("company bank cash shortfall is exposed and not hidden in gross revenue", () => {
  const x = previewAudiotelDirectCashControl({...common,
    bank_receipts: [{bank_entry_reference: "bank-entry-short01",
      statement_reference: statement.statement_reference,
      amount_minor: 500, currency: "EUR"}]
  });
  assert.equal(x.company_bank_difference_minor, 1000);
  assert.ok(x.blockers.includes("OPERATOR_TO_COMPANY_BANK_DIFFERENCE"));
});

test("order-independent fingerprint and no caller or IBAN data in the result", () => {
  const second = {...line, line_reference: "carrier-call-0002"};
  const a = {...common,statement: {...statement,rows:[line,second]}};
  const b = {...common,statement: {...statement,rows:[second,line]}};
  assert.equal(previewAudiotelDirectCashControl(a).idempotency_fingerprint,
    previewAudiotelDirectCashControl(b).idempotency_fingerprint);
  assert.equal(JSON.stringify(previewAudiotelDirectCashControl(a)).includes("iban"), false);
});

test("duplicates and cross-operator bank mismatches reject the complete batch", () => {
  assert.throws(() => previewAudiotelDirectCashControl({...common,
    statement:{...statement,rows:[line,line]}}), /DUPLICATE_LINE_REFERENCE/);
  assert.throws(() => previewAudiotelDirectCashControl({...common,
    bank_receipts:[{bank_entry_reference:"bank-entry-00001",
      statement_reference:"different-statement",amount_minor:1500,currency:"EUR"}]}),
    /BANK_RECEIPT_SCOPE_MISMATCH/);
});

test("a collector cannot report publisher payments above liabilities", () => {
  assert.throws(() => previewAudiotelDirectCashControl({...common,
    collector_publisher_transfers:[{
      provider_transfer_reference:"carrier-transfer-0001",
      publisher_reference:"publisher-0001",amount_minor:7001,currency:"EUR"}]}),
    /TRANSFER_EXCEEDS_PUBLISHER_DUE/);
  assert.throws(() => previewAudiotelDirectCashControl({...common,
    model:APP_CASH_MODELS.company_clearing,
    collector_publisher_transfers:[{
      provider_transfer_reference:"carrier-transfer-0001",
      publisher_reference:"publisher-0001",amount_minor:7000,currency:"EUR"}]}),
    /COMPANY_CLEARING_CANNOT_ASSUME_COLLECTOR_SPLIT/);
});

test("forged authorizations, invalid cents and wrong business unit fail closed", () => {
  assert.throws(() => previewAudiotelDirectCashControl({...common,
    company_clearance_approved:true}), /UNEXPECTED_INPUT_FIELD/);
  assert.throws(() => previewAudiotelDirectCashControl({...common,
    business_unit:"direct_sva"}), /WRONG_BUSINESS_UNIT/);
  assert.throws(() => previewAudiotelDirectCashControl({...common,
    statement:{...statement,rows:[{...line,carrier_fee_minor:1000.5}]}}),
    /INVALID_carrier_fee_minor/);
  assert.throws(() => previewAudiotelDirectCashControl({...common,
    statement:{...statement,rows:[{...line,caller_number:"private"}]}}),
    /UNEXPECTED_LINE_FIELD/);
});

test("operator statement must fully balance and idempotent transfer IDs are unique", () => {
  assert.throws(() => previewAudiotelDirectCashControl({...common,
    statement:{...statement,rows:[{...line,audiotel_commission_minor:1400}]}}),
    /UNBALANCED_OPERATOR_LINE/);
  const transfer = {provider_transfer_reference:"carrier-transfer-0001",
    publisher_reference:"publisher-0001",amount_minor:1000,currency:"EUR"};
  assert.throws(() => previewAudiotelDirectCashControl({...common,
    collector_publisher_transfers:[transfer,transfer]}), /DUPLICATE_TRANSFER/);
});
