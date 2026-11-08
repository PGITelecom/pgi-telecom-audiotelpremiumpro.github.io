-- Audiotel Premium Pro: financial workflow DRAFTS ONLY, independent of direct_sva.
-- Run ONLY on disposable GitHub CI PostgreSQL after the existing migrations.
-- NEVER apply to Neon production without explicit future owner approval.
-- No actual bank/Stripe/telecom API, payment, tax entry or subscriber activation.
CREATE TABLE app_fin_contract_terms_drafts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'audiotel_platform' CHECK(business_unit='audiotel_platform'),
 tenant_id bigint NOT NULL REFERENCES tenants(id),
 contract_reference text NOT NULL CHECK(length(contract_reference) BETWEEN 8 AND 180),
 version_reference text NOT NULL CHECK(length(version_reference) BETWEEN 8 AND 180),
 contract_model text NOT NULL CHECK(contract_model IN
  ('commission_agent','professional_services','direct_operator')),
 fee_bps integer NOT NULL CHECK(fee_bps BETWEEN 0 AND 10000),
 fee_minor_per_min integer NOT NULL DEFAULT 0 CHECK(fee_minor_per_min BETWEEN 0 AND 1000000000),
 fixed_fee_minor_per_call integer NOT NULL DEFAULT 0 CHECK(fixed_fee_minor_per_call BETWEEN 0 AND 1000000000),
 currency char(3) NOT NULL DEFAULT 'EUR' CHECK(currency='EUR'),
 contract_document_ref text,
 contract_signed_verified boolean NOT NULL DEFAULT false CHECK(contract_signed_verified=false),
 tax_model_approved boolean NOT NULL DEFAULT false CHECK(tax_model_approved=false),
 payment_services_approved boolean NOT NULL DEFAULT false CHECK(payment_services_approved=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,contract_reference,version_reference)
);
CREATE INDEX app_fin_contract_terms_tenant ON app_fin_contract_terms_drafts(tenant_id,id DESC);

CREATE TABLE app_fin_operator_statement_drafts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'audiotel_platform' CHECK(business_unit='audiotel_platform'),
 operator_reference text NOT NULL CHECK(length(operator_reference) BETWEEN 8 AND 180),
 statement_reference text NOT NULL CHECK(length(statement_reference) BETWEEN 8 AND 180),
 period_reference text NOT NULL CHECK(length(period_reference) BETWEEN 8 AND 180),
 document_sha256 char(64) NOT NULL CHECK(document_sha256 ~ '^[0-9a-f]{64}$'),
 claimed_total_minor bigint NOT NULL CHECK(claimed_total_minor BETWEEN 0 AND 1000000000000),
 currency char(3) NOT NULL DEFAULT 'EUR' CHECK(currency='EUR'),
 external_statement_authenticated boolean NOT NULL DEFAULT false CHECK(external_statement_authenticated=false),
 cdr_operator_authenticated boolean NOT NULL DEFAULT false CHECK(cdr_operator_authenticated=false),
 bank_receipt_confirmed boolean NOT NULL DEFAULT false CHECK(bank_receipt_confirmed=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(operator_reference,statement_reference),
 UNIQUE(id,operator_reference)
);

CREATE TABLE app_fin_call_allocation_drafts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'audiotel_platform' CHECK(business_unit='audiotel_platform'),
 statement_id bigint NOT NULL,
 operator_reference text NOT NULL,
 tenant_id bigint NOT NULL REFERENCES tenants(id),
 contract_terms_id bigint NOT NULL REFERENCES app_fin_contract_terms_drafts(id),
 call_reference text NOT NULL CHECK(length(call_reference) BETWEEN 8 AND 180),
 eligible_seconds bigint NOT NULL CHECK(eligible_seconds BETWEEN 0 AND 1000000000),
 operator_gross_minor bigint NOT NULL CHECK(operator_gross_minor BETWEEN 0 AND 1000000000000),
 carrier_fee_minor bigint NOT NULL CHECK(carrier_fee_minor BETWEEN 0 AND 1000000000000),
 processor_fee_minor bigint NOT NULL CHECK(processor_fee_minor BETWEEN 0 AND 1000000000000),
 audiotel_fee_preview_minor bigint NOT NULL CHECK(audiotel_fee_preview_minor BETWEEN 0 AND 1000000000000),
 publisher_due_preview_minor bigint NOT NULL CHECK(publisher_due_preview_minor BETWEEN 0 AND 1000000000000),
 record_state text NOT NULL CHECK(record_state IN ('operator_reported','provisional','disputed','rejected')),
 cdr_verified boolean NOT NULL DEFAULT false CHECK(cdr_verified=false),
 eligible_for_payout boolean NOT NULL DEFAULT false CHECK(eligible_for_payout=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(statement_id,operator_reference)
  REFERENCES app_fin_operator_statement_drafts(id,operator_reference),
 UNIQUE(operator_reference,call_reference),
 CHECK(carrier_fee_minor+processor_fee_minor+
       audiotel_fee_preview_minor+publisher_due_preview_minor<=operator_gross_minor),
 CHECK(record_state='operator_reported' OR
       (audiotel_fee_preview_minor=0 AND publisher_due_preview_minor=0))
);
CREATE INDEX app_fin_alloc_tenant ON app_fin_call_allocation_drafts(tenant_id,created_at DESC);
CREATE INDEX app_fin_alloc_statement ON app_fin_call_allocation_drafts(statement_id,created_at DESC);

CREATE TABLE app_fin_payout_instruction_drafts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'audiotel_platform' CHECK(business_unit='audiotel_platform'),
 statement_id bigint NOT NULL REFERENCES app_fin_operator_statement_drafts(id),
 tenant_id bigint NOT NULL REFERENCES tenants(id),
 provider_key text NOT NULL CHECK(provider_key IN
  ('carrier_direct','regulated_psp','stripe_connect','revolut_own_funds')),
 payout_reference text NOT NULL CHECK(payout_reference ~ '^APP-PAYOUT-[0-9a-f]{32}$'),
 recipient_token_reference text NOT NULL CHECK(length(recipient_token_reference) BETWEEN 8 AND 180),
 claimed_amount_minor bigint NOT NULL CHECK(claimed_amount_minor BETWEEN 0 AND 1000000000000),
 contract_reference text NOT NULL CHECK(length(contract_reference) BETWEEN 8 AND 180),
 instruction_digest char(64) NOT NULL UNIQUE CHECK(instruction_digest ~ '^[0-9a-f]{64}$'),
 dispatch_status text NOT NULL DEFAULT 'not_authorized' CHECK(dispatch_status='not_authorized'),
 payout_sent boolean NOT NULL DEFAULT false CHECK(payout_sent=false),
 payout_paid boolean NOT NULL DEFAULT false CHECK(payout_paid=false),
 funds_for_third_parties_approved boolean NOT NULL DEFAULT false
  CHECK(funds_for_third_parties_approved=false),
 bank_account_coordinates text CHECK(bank_account_coordinates IS NULL),
 external_payment_id text CHECK(external_payment_id IS NULL),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(statement_id,tenant_id,provider_key,contract_reference),
 CHECK(claimed_amount_minor>0)
);
CREATE INDEX app_fin_payout_tenant ON app_fin_payout_instruction_drafts(tenant_id,id DESC);

CREATE TABLE app_fin_reconciliation_drafts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'audiotel_platform' CHECK(business_unit='audiotel_platform'),
 statement_id bigint NOT NULL REFERENCES app_fin_operator_statement_drafts(id),
 source_key text NOT NULL CHECK(source_key IN ('operator_payment_advice','bank_receipt','psp_payout_advice')),
 source_reference text NOT NULL CHECK(length(source_reference) BETWEEN 8 AND 180),
 claimed_amount_minor bigint NOT NULL CHECK(claimed_amount_minor BETWEEN 0 AND 1000000000000),
 evidence_sha256 char(64) NOT NULL CHECK(evidence_sha256 ~ '^[0-9a-f]{64}$'),
 independently_reconciled boolean NOT NULL DEFAULT false CHECK(independently_reconciled=false),
 statutory_posting_permitted boolean NOT NULL DEFAULT false CHECK(statutory_posting_permitted=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_key,source_reference)
);

CREATE TABLE app_fin_audit_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'audiotel_platform' CHECK(business_unit='audiotel_platform'),
 statement_id bigint NOT NULL REFERENCES app_fin_operator_statement_drafts(id),
 event_key text NOT NULL CHECK(event_key IN
  ('statement_drafted','cdr_drafted','hold_added','dispute_recorded',
  'contract_version_drafted','provider_instruction_prepared',
  'statement_reconciliation_drafted','payment_failed_draft')),
 event_source_reference text NOT NULL CHECK(length(event_source_reference) BETWEEN 8 AND 180),
 actor_fingerprint char(64) NOT NULL CHECK(actor_fingerprint ~ '^[0-9a-f]{64}$'),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(statement_id,event_key,event_source_reference)
);
CREATE FUNCTION app_fin_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Audiotel financial prelaunch audit is append-only';
END; $$;
CREATE TRIGGER app_fin_audit_immutable_guard
 BEFORE UPDATE OR DELETE ON app_fin_audit_events
 FOR EACH ROW EXECUTE FUNCTION app_fin_audit_immutable();

-- Only the future, separately reviewed service role can access the tables.
REVOKE ALL ON TABLE
 app_fin_contract_terms_drafts,app_fin_operator_statement_drafts,
 app_fin_call_allocation_drafts,app_fin_payout_instruction_drafts,
 app_fin_reconciliation_drafts,app_fin_audit_events FROM PUBLIC;
REVOKE ALL ON SEQUENCE
 app_fin_contract_terms_drafts_id_seq,app_fin_operator_statement_drafts_id_seq,
 app_fin_call_allocation_drafts_id_seq,app_fin_payout_instruction_drafts_id_seq,
 app_fin_reconciliation_drafts_id_seq,app_fin_audit_events_id_seq FROM PUBLIC;

COMMENT ON TABLE app_fin_payout_instruction_drafts IS
 'Immutable-destination-free payment draft. No live payout, IBAN, transfer, execution or financial authority.';
