/**
 * Audiotel Premium Pro: independent SVA cash/commission reconciliation.
 * No external API, database writes, bank transfers, identity documents,
 * publisher payment commands or regulatory permissions.
 *
 * The company may own its business logic without owning the access network.
 * An operator must still provide French SVA call origination/collection.
 *
 * IMPORTANT: company_clearing is a hypothetical cash-flow model, not an
 * authorization to receive, safeguard, or redistribute third-party funds.
 * Raw bank entries and carrier statements are not authenticated here.
 */
import {createHash} from "node:crypto";

export const APP_CASH_MODELS = Object.freeze({
  collector_split: "collector_split",
  company_clearing: "company_clearing"
});
const MONEY_LIMIT = 1_000_000_000_000;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{7,159}$/;
const MONTH_PATTERN = /^20[2-9][0-9]-(0[1-9]|1[0-2])$/;
const keys = {
  input: ["business_unit", "currency", "period", "model", "statement",
    "bank_receipts", "collector_publisher_transfers"],
  statement: ["operator_reference", "statement_reference", "period", "currency", "rows"],
  line: ["line_reference", "publisher_reference", "gross_service_minor",
    "carrier_fee_minor", "adjustment_minor", "audiotel_commission_minor",
    "publisher_due_minor"],
  bank: ["bank_entry_reference", "statement_reference", "amount_minor", "currency"],
  transfer: ["provider_transfer_reference", "publisher_reference", "amount_minor", "currency"]
};
function fail(code) {
  const err = new Error("APP_CASH_" + code);
  err.code = err.message;
  err.status = 422;
  throw err;
}
function record(value, allowed, name) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) fail("INVALID_" + name);
  if (Object.keys(value).some(key => !allowed.includes(key)))
    fail("UNEXPECTED_" + name + "_FIELD");
  return value;
}
function reference(value, label) {
  if (typeof value !== "string" || !ID_PATTERN.test(value))
    fail("INVALID_" + label);
  return value;
}
function money(value, label, positive = false) {
  if (!Number.isSafeInteger(value) || value < 0 ||
      value > MONEY_LIMIT || (positive && value === 0))
    fail("INVALID_" + label);
  return value;
}
function add(a, b) {
  const n = a + b;
  if (!Number.isSafeInteger(n) || n > MONEY_LIMIT) fail("AMOUNT_OVERFLOW");
  return n;
}
function list(value, limit, label) {
  if (!Array.isArray(value) || value.length > limit)
    fail("INVALID_" + label);
  return value;
}
function hash(v) {
  return createHash("sha256").update(JSON.stringify(v)).digest("hex");
}
function frozenRows(items) {
  return Object.freeze(items.map(row => Object.freeze(row)));
}
function sum(items, field) {
  return items.reduce((total, item) => add(total, item[field]), 0);
}

/**
 * This is a DRAFT financial control, scoped to Audiotel Premium Pro only.
 *
 * collector_split:
 *  - an authorized network collector pays Audiotel's own commission to its IBAN;
 *  - that collector settles publisher balances using its approved legal route;
 *  - no publisher funds are assumed to pass through Audiotel's bank.
 *
 * company_clearing:
 *  - operator hypothetically credits commission + publisher funds to Audiotel;
 *  - this may constitute regulated receipt/holding of money for third parties;
 *  - the model remains BLOCKED until legal/payment permissions actually exist.
 *
 * No untrusted input flag may assert KYC, fund verification or authorization.
 * Identifiers intentionally exclude IBAN, caller identity and bank credentials.
 */
export function previewAudiotelDirectCashControl(input = {}) {
  record(input, keys.input, "INPUT");
  if (input.business_unit !== "audiotel_platform" ||
      input.currency !== "EUR" ||
      typeof input.period !== "string" ||
      !MONTH_PATTERN.test(input.period))
    fail("WRONG_BUSINESS_UNIT_CURRENCY_OR_PERIOD");
  if (!Object.hasOwn(APP_CASH_MODELS, input.model))
    fail("INVALID_COLLECTION_MODEL");
  const mode = input.model;
  const statement = record(input.statement, keys.statement, "STATEMENT");
  const operator = reference(statement.operator_reference, "OPERATOR_REFERENCE");
  const statementId = reference(statement.statement_reference, "STATEMENT_REFERENCE");
  if (statement.period !== input.period || statement.currency !== "EUR")
    fail("STATEMENT_SCOPE_MISMATCH");
  const inputLines = list(statement.rows, 10000, "STATEMENT_ROWS");
  if (inputLines.length === 0) fail("EMPTY_STATEMENT");
  const calls = new Set();
  const publishers = new Map();
  const canonical = inputLines.map(raw => {
    const row = record(raw, keys.line, "LINE");
    const id = reference(row.line_reference, "LINE_REFERENCE");
    const publisher = reference(row.publisher_reference, "PUBLISHER_REFERENCE");
    if (calls.has(id)) fail("DUPLICATE_LINE_REFERENCE");
    calls.add(id);
    const amounts = Object.fromEntries(
      keys.line.slice(2).map(key => [key, money(row[key], key)])
    );
    const parts = ["carrier_fee_minor", "adjustment_minor",
      "audiotel_commission_minor", "publisher_due_minor"];
    const allocated = parts.reduce((total, key) => add(total, amounts[key]), 0);
    if (amounts.gross_service_minor === 0 || allocated !== amounts.gross_service_minor)
      fail("UNBALANCED_OPERATOR_LINE");
    const entry = publishers.get(publisher) || {
      publisher_reference: publisher, call_rows: 0,
      publisher_due_minor: 0, collector_transfer_reported_minor: 0
    };
    entry.call_rows = add(entry.call_rows, 1);
    entry.publisher_due_minor = add(entry.publisher_due_minor,
      amounts.publisher_due_minor);
    publishers.set(publisher, entry);
    return { line_reference: id, publisher_reference: publisher, ...amounts };
  }).sort((a, b) => a.line_reference.localeCompare(b.line_reference, "en"));
  const receipts = list(input.bank_receipts ?? [], 1000, "BANK_RECEIPTS");
  const bankSeen = new Set();
  const bank = receipts.map(raw => {
    const r = record(raw, keys.bank, "BANK_RECEIPT");
    const bankId = reference(r.bank_entry_reference, "BANK_ENTRY_REFERENCE");
    if (bankSeen.has(bankId)) fail("DUPLICATE_BANK_ENTRY");
    bankSeen.add(bankId);
    if (reference(r.statement_reference, "BANK_STATEMENT_REFERENCE") !== statementId ||
        r.currency !== "EUR") fail("BANK_RECEIPT_SCOPE_MISMATCH");
    return {bank_entry_reference: bankId, statement_reference: statementId,
      amount_minor: money(r.amount_minor, "BANK_AMOUNT", true), currency: "EUR"};
  }).sort((a, b) => a.bank_entry_reference.localeCompare(b.bank_entry_reference, "en"));
  const transfers = list(input.collector_publisher_transfers ?? [], 1000,
    "COLLECTOR_PUBLISHER_TRANSFERS");
  if (mode === APP_CASH_MODELS.company_clearing && transfers.length)
    fail("COMPANY_CLEARING_CANNOT_ASSUME_COLLECTOR_SPLIT");
  const transferSeen = new Set();
  const reportedTransfers = transfers.map(raw => {
    const t = record(raw, keys.transfer, "TRANSFER");
    const transferId = reference(t.provider_transfer_reference, "PROVIDER_TRANSFER_REFERENCE");
    const publisher = reference(t.publisher_reference, "TRANSFER_PUBLISHER_REFERENCE");
    if (transferSeen.has(transferId)) fail("DUPLICATE_TRANSFER");
    transferSeen.add(transferId);
    if (!publishers.has(publisher) || t.currency !== "EUR")
      fail("TRANSFER_SCOPE_MISMATCH");
    const amount = money(t.amount_minor, "TRANSFER_AMOUNT", true);
    const entry = publishers.get(publisher);
    entry.collector_transfer_reported_minor =
      add(entry.collector_transfer_reported_minor, amount);
    if (entry.collector_transfer_reported_minor > entry.publisher_due_minor)
      fail("TRANSFER_EXCEEDS_PUBLISHER_DUE");
    return {provider_transfer_reference: transferId,
      publisher_reference: publisher, amount_minor: amount, currency: "EUR"};
  }).sort((a, b) => a.provider_transfer_reference.localeCompare(b.provider_transfer_reference, "en"));

  const total = field => sum(canonical, field);
  const gross = total("gross_service_minor");
  const fee = total("carrier_fee_minor");
  const adjustment = total("adjustment_minor");
  const commission = total("audiotel_commission_minor");
  const publisherDue = total("publisher_due_minor");
  const companyExpected = mode === APP_CASH_MODELS.collector_split
    ? commission : add(commission, publisherDue);
  const bankReported = sum(bank, "amount_minor");
  const providerReported = sum(reportedTransfers, "amount_minor");
  const publisherBalances = frozenRows(
    [...publishers.values()].sort((a, b) =>
      a.publisher_reference.localeCompare(b.publisher_reference, "en"))
      .map(row => ({
        ...row,
        publisher_transfer_unverified_minor: row.collector_transfer_reported_minor,
        publisher_outstanding_reported_minor:
          row.publisher_due_minor - row.collector_transfer_reported_minor,
        beneficiary_verification: "not_verified",
        settlement_verification: "not_verified",
        payout_authorized: false
      }))
  );
  const gaps = [];
  if (bankReported !== companyExpected) gaps.push("OPERATOR_TO_COMPANY_BANK_DIFFERENCE");
  if (mode === APP_CASH_MODELS.collector_split &&
      providerReported !== publisherDue) gaps.push("PUBLISHER_SPLIT_NOT_FULLY_REPORTED");
  if (mode === APP_CASH_MODELS.company_clearing)
    gaps.push("THIRD_PARTY_FUNDS_LICENSE_AND_SAFEGUARDING_NOT_ESTABLISHED");
  gaps.push("OPERATOR_STATEMENT_NOT_AUTHENTICATED");
  gaps.push("BANK_RECORDS_NOT_AUTHENTICATED");
  gaps.push("PUBLISHER_TRANSFER_RECORDS_NOT_AUTHENTICATED");
  gaps.push("CONTRACT_TAX_KYB_AND_PSP_STATUS_NOT_VERIFIED");

  const fingerprint = hash({business_unit: "audiotel_platform", period: input.period,
    model: mode, operator, statementId, rows: canonical, bank, reportedTransfers});
  return Object.freeze({
    schema_version: "audiotel-direct-cash-control-preview/1",
    business_unit: "audiotel_platform",
    period: input.period, currency: "EUR", collection_model: mode,
    operator_reference: operator, statement_reference: statementId,
    idempotency_fingerprint: fingerprint,
    call_rows: canonical.length, publisher_count: publisherBalances.length,
    gross_service_reported_minor: gross, carrier_fees_reported_minor: fee,
    adjustments_reported_minor: adjustment,
    audiotel_commission_estimate_minor: commission,
    publisher_liabilities_estimate_minor: publisherDue,
    company_bank_expected_minor: companyExpected,
    company_bank_reported_unverified_minor: bankReported,
    company_bank_difference_minor: companyExpected - bankReported,
    collector_publisher_transfers_reported_unverified_minor: providerReported,
    publisher_unsettled_reported_minor: publisherDue - providerReported,
    own_funds_available_verified_minor: 0,
    real_bank_balance_verified: false,
    original_statement_verified: false,
    publisher_transfer_verified: false,
    company_bank_can_hold_publisher_funds: false,
    company_clearance_approved: false,
    publisher_balances: publisherBalances,
    blockers: Object.freeze(gaps),
    net_company_profit_after_tax_minor: null,
    bookkeeping_authorized: false, bank_transfer_authorized: false,
    publisher_payout_authorized: false, funds_collected_verified: false,
    external_integrations_enabled: false, external_actions_executed: false,
    mode: "isolated_read_only_preparation",
    next_action: mode === APP_CASH_MODELS.collector_split
      ? "Obtenir preuves contractuelles des paiements séparés à Audiotel et aux éditeurs"
      : "Faire confirmer le statut réglementaire de collecte pour compte de tiers avant tout fonds ou virement"
  });
}
