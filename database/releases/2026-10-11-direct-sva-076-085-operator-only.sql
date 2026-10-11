-- PGI Telecom Distribution: OPERATOR-ONLY PostgreSQL migration bundle.
-- VERSION 2026-10-11 | migrations 076..085, exactly as in GitHub prep/pgi-direct-sva-operator-2026-10-10
-- DO NOT run from Vercel build/startup or automatically on production.
-- Run ONCE with explicitly approved PostgreSQL administrator access on the Neon
-- production database, after independently validating destination and backup.
-- It does not move or assign telephone numbers, launch payments or enable routing.
-- This script intentionally includes two editorial CHECK constraint changes in 085.
-- Atomic transaction: on any error, ROLLBACK; never mark unapplied versions as done.
-- Source checksums are matched against the already verified isolated preparation DB.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL idle_in_transaction_session_timeout = '120s';
SELECT pg_advisory_xact_lock(hashtext('pgi_telecom_schema_migrations_v1'));

DO $pgi_preflight$
DECLARE
  expected_versions text[] := ARRAY['072_referral_email_invitations','073_direct_sva_operator_business_unit','074_single_company_two_business_units','075_direct_sva_customer_and_automation_foundation'];
  applied_versions text[];
BEGIN
  SELECT array_agg(version ORDER BY version) INTO applied_versions
  FROM public.schema_migrations WHERE version >= '072';
  IF applied_versions IS DISTINCT FROM expected_versions THEN
    RAISE EXCEPTION 'Unexpected schema ledger: expected exactly 072..075, stop and review';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.schema_migrations WHERE version='072_referral_email_invitations' AND trim(checksum)='2a62df4a9f3e30998c926c9d3e7233852cf7895425e1a20034e40ae52d860a52') THEN
    RAISE EXCEPTION 'Checksum drift: 072_referral_email_invitations';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.schema_migrations WHERE version='073_direct_sva_operator_business_unit' AND trim(checksum)='0a04745ca54271f486b72eafb6d420308238099e693bd0716660f0f3ee24ac1c') THEN
    RAISE EXCEPTION 'Checksum drift: 073_direct_sva_operator_business_unit';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.schema_migrations WHERE version='074_single_company_two_business_units' AND trim(checksum)='119bbe99f1b47b46196a301973170bad3dad68cac457a44c910798a5d31c8f22') THEN
    RAISE EXCEPTION 'Checksum drift: 074_single_company_two_business_units';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.schema_migrations WHERE version='075_direct_sva_customer_and_automation_foundation' AND trim(checksum)='c0780d563eafaf57bffde6ef9af431da84c88f6630c55ff2939df8d6fc1e3e57') THEN
    RAISE EXCEPTION 'Checksum drift: 075_direct_sva_customer_and_automation_foundation';
  END IF;
  IF (SELECT count(*) FROM public.pgi_company_business_units WHERE unit_code IN ('audiotel_platform','direct_sva')) <> 2 THEN
    RAISE EXCEPTION 'Business-unit protection precheck failed';
  END IF;
END;
$pgi_preflight$;


-- START 076_direct_sva_admin_switches
-- Two separate administrator switches for PGI direct SVA distribution.
-- First switch controls PRIVATE administrative interface preview only.
-- Second switch is structurally locked OFF until a later independently reviewed
-- regulatory, financial and operational release migration.
-- This migration does not change existing Audiotel tables or activate any route.

CREATE TABLE IF NOT EXISTS direct_sva_admin_switches (
 id smallint PRIMARY KEY DEFAULT 1 CHECK (id=1),
 interface_preview_enabled boolean NOT NULL DEFAULT false,
 commercial_operation_enabled boolean NOT NULL DEFAULT false
   CHECK (commercial_operation_enabled=false),
 last_changed_at timestamptz NOT NULL DEFAULT now(),
 last_changed_by_hash char(64)
   CHECK (last_changed_by_hash IS NULL OR last_changed_by_hash ~ '^[0-9a-f]{64}$')
);
INSERT INTO direct_sva_admin_switches(id) VALUES(1) ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS direct_sva_admin_switch_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 switch_name text NOT NULL CHECK(switch_name IN ('interface_preview','commercial_operation')),
 previous_value boolean NOT NULL,
 requested_value boolean NOT NULL,
 resulting_value boolean NOT NULL,
 result text NOT NULL CHECK(result IN ('applied','unchanged','refused')),
 actor_hash char(64) NOT NULL CHECK(actor_hash ~ '^[0-9a-f]{64}$'),
 evidence_reference text NOT NULL CHECK(length(btrim(evidence_reference)) BETWEEN 8 AND 240),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS direct_sva_admin_switch_audit_recent_idx
 ON direct_sva_admin_switch_audit(occurred_at DESC,id DESC);

CREATE FUNCTION direct_sva_guard_admin_switch_audit_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Direct SVA administration history is append-only';
END;
$$;
CREATE TRIGGER direct_sva_guard_admin_switch_audit_immutable
 BEFORE UPDATE OR DELETE ON direct_sva_admin_switch_audit
 FOR EACH ROW EXECUTE FUNCTION direct_sva_guard_admin_switch_audit_immutable();

-- Safety invariant: switching ON the first control neither changes legal status
-- nor activates client permissions, provisioning, payments, CRM or analytics.
-- The second control can only be unlocked by a future migration and approval.

INSERT INTO public.schema_migrations(version,checksum) VALUES ('076_direct_sva_admin_switches','962ddf061e2603ba964e4d796070c555e763462499df69cff8aaf705c124a13e');
-- END 076_direct_sva_admin_switches

-- START 077_existing_customer_provider_transition_preparation
-- Preserve existing Audiotel customers and number identities during a future
-- change of upstream hosting/distribution. PREPARATION ONLY, no porting or routing.
-- Additive, with no UPDATE to tenants, assignments, customer subscriptions or calls.

CREATE TABLE IF NOT EXISTS direct_sva_existing_customer_transition_plans (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id bigint NOT NULL REFERENCES tenants(id),
 assignment_id bigint NOT NULL REFERENCES tenant_number_assignments(id),
 revision_no integer NOT NULL CHECK(revision_no>=1),
 sva_number_id bigint NOT NULL REFERENCES sva_numbers(id),
 e164_snapshot text NOT NULL CHECK (length(e164_snapshot)=12 AND left(e164_snapshot,5) IN ('+3381','+3382','+3389') AND substring(e164_snapshot,6) ~ '^[0-9]{7}$'),
 source_host_carrier_id bigint NOT NULL REFERENCES carriers(id),
 target_mode text NOT NULL CHECK(target_mode IN ('partner','direct_sva')),
 target_host_carrier_id bigint REFERENCES carriers(id),
 planned_cutover_at timestamptz,
 state text NOT NULL DEFAULT 'prepared' CHECK(state='prepared'),
 customer_account_preserved boolean NOT NULL DEFAULT true CHECK(customer_account_preserved=true),
 number_identity_preserved boolean NOT NULL DEFAULT true CHECK(number_identity_preserved=true),
 existing_contract_unchanged_by_preparation boolean NOT NULL DEFAULT true
   CHECK(existing_contract_unchanged_by_preparation=true),
 routing_authorized boolean NOT NULL DEFAULT false CHECK(routing_authorized=false),
 portability_authorized boolean NOT NULL DEFAULT false CHECK(portability_authorized=false),
 money_transfer_authorized boolean NOT NULL DEFAULT false CHECK(money_transfer_authorized=false),
 client_terms_review_status text NOT NULL DEFAULT 'pending' CHECK(client_terms_review_status='pending'),
 notice_review_status text NOT NULL DEFAULT 'pending' CHECK(notice_review_status='pending'),
 cdr_cutover_reconciled boolean NOT NULL DEFAULT false CHECK(cdr_cutover_reconciled=false),
 actor_hash char(64) NOT NULL CHECK (actor_hash ~ '^[0-9a-f]{64}$'),
 evidence_reference text NOT NULL CHECK (length(btrim(evidence_reference)) BETWEEN 8 AND 240),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(assignment_id,revision_no),
 CHECK ((target_mode='direct_sva' AND target_host_carrier_id IS NULL) OR
        (target_mode='partner' AND target_host_carrier_id IS NOT NULL AND
         target_host_carrier_id<>source_host_carrier_id))
);
CREATE INDEX IF NOT EXISTS direct_sva_transition_assignment_history_idx
 ON direct_sva_existing_customer_transition_plans(assignment_id,revision_no DESC);
CREATE INDEX IF NOT EXISTS direct_sva_transition_tenant_idx
 ON direct_sva_existing_customer_transition_plans(tenant_id,id DESC);
CREATE INDEX IF NOT EXISTS direct_sva_transition_source_idx
 ON direct_sva_existing_customer_transition_plans(source_host_carrier_id,id DESC);

CREATE TABLE IF NOT EXISTS direct_sva_existing_customer_transition_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 plan_id bigint NOT NULL REFERENCES direct_sva_existing_customer_transition_plans(id),
 event_type text NOT NULL CHECK(event_type='prepared'),
 actor_hash char(64) NOT NULL CHECK (actor_hash ~ '^[0-9a-f]{64}$'),
 evidence_reference text NOT NULL CHECK (length(btrim(evidence_reference)) BETWEEN 8 AND 240),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
-- Database guard: never accept a snapshot fabricated for another client/number.
-- An existing legal allocation and the real current hosting record are required.
CREATE FUNCTION direct_sva_validate_transition_snapshot()
RETURNS trigger LANGUAGE plpgsql AS $pgi_transition$
DECLARE
 current_tenant bigint;
 current_number bigint;
 current_e164 text;
 host_count bigint;
 actual_host bigint;
BEGIN
 SELECT a.tenant_id,a.sva_number_id,n.e164
   INTO current_tenant,current_number,current_e164
   FROM tenant_number_assignments a
   JOIN sva_numbers n ON n.id=a.sva_number_id
   WHERE a.id=NEW.assignment_id AND a.status='active' AND n.status='active'
   FOR SHARE OF a,n;
 IF current_tenant IS NULL OR current_tenant<>NEW.tenant_id
   OR current_number<>NEW.sva_number_id OR current_e164<>NEW.e164_snapshot THEN
   RAISE EXCEPTION 'direct SVA transition must preserve the existing customer and E164';
 END IF;
 SELECT count(*),max(carrier_id) INTO host_count,actual_host
   FROM number_carrier_assignments
   WHERE sva_number_id=NEW.sva_number_id
     AND assignment_status='active'
     AND valid_from<=now() AND (valid_to IS NULL OR valid_to>now());
 IF host_count<>1 OR actual_host<>NEW.source_host_carrier_id THEN
   RAISE EXCEPTION 'direct SVA transition source provider not uniquely verified';
 END IF;
 RETURN NEW;
END;
$pgi_transition$;
CREATE TRIGGER direct_sva_transition_existing_customer_gate
 BEFORE INSERT ON direct_sva_existing_customer_transition_plans
 FOR EACH ROW EXECUTE FUNCTION direct_sva_validate_transition_snapshot();

CREATE FUNCTION direct_sva_guard_customer_transition_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'direct SVA preparatory transition records are immutable';
END;
$$;
CREATE TRIGGER direct_sva_transition_immutable
 BEFORE UPDATE OR DELETE ON direct_sva_existing_customer_transition_plans
 FOR EACH ROW EXECUTE FUNCTION direct_sva_guard_customer_transition_immutable();
CREATE TRIGGER direct_sva_transition_audit_immutable
 BEFORE UPDATE OR DELETE ON direct_sva_existing_customer_transition_audit
 FOR EACH ROW EXECUTE FUNCTION direct_sva_guard_customer_transition_immutable();

INSERT INTO public.schema_migrations(version,checksum) VALUES ('077_existing_customer_provider_transition_preparation','3df09ea7e33f80ecdbcdb1bfa0fad60dc2d45fd30922cb1f91b1296292c006e6');
-- END 077_existing_customer_provider_transition_preparation

-- START 078_direct_sva_complaint_inbox_preparation
-- Direct SVA complaints, isolated from the existing Audiotel helpdesk.
-- Preparation ONLY: no live intake, email sending, CRM mutation or automatic
-- decisions on refunds, porting, contractual obligations or third-party funds.
CREATE TABLE IF NOT EXISTS direct_sva_complaint_cases (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 public_reference text NOT NULL UNIQUE
  CHECK(public_reference ~ '^DSVA-RCL-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$'),
 receipt_id uuid NOT NULL UNIQUE,
 source text NOT NULL CHECK(source IN ('public_web','verified_provider_email')),
 customer_tenant_id bigint REFERENCES tenants(id),
 email text NOT NULL CHECK (length(email) BETWEEN 5 AND 320),
 email_sha256 char(64) NOT NULL CHECK(email_sha256 ~ '^[0-9a-f]{64}$'),
 category text NOT NULL CHECK(category IN ('billing','payout','number','call','fraud','privacy','other')),
 priority text NOT NULL CHECK(priority IN ('normal','high')),
 subject text NOT NULL CHECK(length(subject) BETWEEN 5 AND 180),
 customer_message text NOT NULL CHECK(length(customer_message) BETWEEN 15 AND 8000),
 customer_identity_verified boolean NOT NULL DEFAULT false CHECK(customer_identity_verified=false),
 status text NOT NULL DEFAULT 'prepared' CHECK(status='prepared'),
 external_processing_authorized boolean NOT NULL DEFAULT false CHECK(external_processing_authorized=false),
 crm_ticket_authorized boolean NOT NULL DEFAULT false CHECK(crm_ticket_authorized=false),
 compensation_authorized boolean NOT NULL DEFAULT false CHECK(compensation_authorized=false),
 number_change_authorized boolean NOT NULL DEFAULT false CHECK(number_change_authorized=false),
 first_response_target_at timestamptz NOT NULL,
 resolution_review_target_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(first_response_target_at>=created_at-interval '5 minutes'),
 CHECK(resolution_review_target_at>first_response_target_at)
);
CREATE INDEX IF NOT EXISTS dsva_complaint_created_idx
 ON direct_sva_complaint_cases(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS dsva_complaint_category_idx
 ON direct_sva_complaint_cases(category,priority,created_at DESC);

CREATE TABLE IF NOT EXISTS direct_sva_complaint_delivery_queue (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 complaint_id bigint NOT NULL REFERENCES direct_sva_complaint_cases(id),
 delivery_kind text NOT NULL CHECK(delivery_kind IN ('internal_gmail','customer_receipt','hubspot_ticket','safe_reply_draft')),
 idempotency_key text NOT NULL UNIQUE CHECK(length(idempotency_key) BETWEEN 12 AND 180),
 delivery_state text NOT NULL DEFAULT 'blocked_release' CHECK(delivery_state='blocked_release'),
 external_execution_allowed boolean NOT NULL DEFAULT false CHECK(external_execution_allowed=false),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts=0),
 provider_reference text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(complaint_id,delivery_kind),
 CHECK(provider_reference IS NULL)
);

CREATE TABLE IF NOT EXISTS direct_sva_complaint_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 complaint_id bigint NOT NULL REFERENCES direct_sva_complaint_cases(id),
 event_kind text NOT NULL CHECK(event_kind IN ('registered_preparation','classified_preparation')),
 audit_detail text NOT NULL CHECK(length(audit_detail) BETWEEN 6 AND 200),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION direct_sva_guard_complaint_audit_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'direct SVA complaint audit is immutable';
END;
$$;
CREATE TRIGGER direct_sva_complaint_audit_append_only
 BEFORE UPDATE OR DELETE ON direct_sva_complaint_audit
 FOR EACH ROW EXECUTE FUNCTION direct_sva_guard_complaint_audit_immutable();

INSERT INTO public.schema_migrations(version,checksum) VALUES ('078_direct_sva_complaint_inbox_preparation','76fc2406ba2bccd2ee33c28834781786a46c9579eca0073bb33fb6362d8cefee');
-- END 078_direct_sva_complaint_inbox_preparation

-- START 079_direct_sva_automation_rehearsals
-- Direct SVA workflow rehearsal, separate from Audiotel.
-- A simulation is never a carrier call, CRM write, GA4 emission or payment.
-- No legal status is needed to TEST a workflow with fictional non-personal facts.
CREATE TABLE IF NOT EXISTS direct_sva_automation_rehearsals (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'direct_sva' CHECK (business_unit='direct_sva'),
 workflow_key text NOT NULL CHECK (workflow_key IN (
  'lead_routing','compliance_check','contract_review','number_assignment','portability',
  'cdr_ingestion','settlement_reconciliation','accounting_draft','invoice_review',
  'publisher_payout','hubspot_sync','analytics_delivery','support_followup')),
 source_reference text NOT NULL CHECK (source_reference ~ '^DSVA-SIM-[A-Za-z0-9-]{8,80}$'),
 idempotency_key text NOT NULL UNIQUE CHECK (idempotency_key ~ '^[A-Za-z0-9:_-]{16,128}$'),
 input_digest char(64) NOT NULL CHECK (input_digest ~ '^[0-9a-f]{64}$'),
 result_status text NOT NULL CHECK (result_status IN (
  'ready_for_simulation','missing_inputs','retry_planned','manual_review')),
 attempt_number smallint NOT NULL CHECK (attempt_number BETWEEN 1 AND 5),
 failure_mode text NOT NULL CHECK (failure_mode IN ('none','timeout','rate_limit','validation_error')),
 missing_checks jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(missing_checks)='array'),
 checked_count smallint NOT NULL CHECK (checked_count BETWEEN 0 AND 50),
 next_simulation_at timestamptz,
 safe_plan jsonb NOT NULL CHECK (jsonb_typeof(safe_plan)='object'),
 actor_hash char(64) NOT NULL CHECK (actor_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (result_status='retry_planned' OR next_simulation_at IS NULL),
 CHECK ((result_status='retry_planned') = (next_simulation_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS direct_sva_rehearsals_overview_idx
 ON direct_sva_automation_rehearsals(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS direct_sva_rehearsals_workflow_idx
 ON direct_sva_automation_rehearsals(workflow_key,result_status,created_at DESC);
CREATE FUNCTION direct_sva_guard_rehearsal_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Direct SVA rehearsals are immutable. Record a new simulation.';
END;
$$;
CREATE TRIGGER direct_sva_guard_rehearsal_immutable
 BEFORE UPDATE OR DELETE ON direct_sva_automation_rehearsals
 FOR EACH ROW EXECUTE FUNCTION direct_sva_guard_rehearsal_immutable();

INSERT INTO public.schema_migrations(version,checksum) VALUES ('079_direct_sva_automation_rehearsals','d6145c38dda769a62eb88e08c7c06972e7a7075edad10b9f4e363fcfa7c0533b');
-- END 079_direct_sva_automation_rehearsals

-- START 080_pgi_telecom_distribution_brand
-- PGI Telecom Distribution: future distributor business-unit label only.
-- No edit to Audiotel Premium Pro, billing, customer numbers, or operations.
-- This additive presentation change affects only the direct_sva cost centre.
-- Commercial operation stays blocked by the existing database constraints.

UPDATE pgi_company_business_units
 SET display_name='PGI Telecom Distribution'
 WHERE unit_code='direct_sva'
   AND lifecycle_status='preparation'
   AND display_name IS DISTINCT FROM 'PGI Telecom Distribution';

INSERT INTO public.schema_migrations(version,checksum) VALUES ('080_pgi_telecom_distribution_brand','16045fc259206ebdf8908bebb79f942f936844de3cf6ca31940a172406dc658a');
-- END 080_pgi_telecom_distribution_brand

-- START 081_direct_sva_collection_preparation
-- PGI Telecom Distribution: append-only preparation of operator and cash receipt evidence.
-- NEVER asserts that money was collected; no posting, payout, Stripe or bank action.
-- Additive only, Audiotel Premium Pro schema and records remain unchanged.

CREATE TABLE IF NOT EXISTS direct_sva_collection_statements (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'direct_sva' CHECK (business_unit='direct_sva'),
 operator_reference text NOT NULL CHECK (length(operator_reference) BETWEEN 8 AND 120),
 statement_reference text NOT NULL CHECK (length(statement_reference) BETWEEN 8 AND 120),
 period_key char(7) NOT NULL CHECK (period_key ~ '^20[2-9][0-9]-(0[1-9]|1[0-2])$'),
 statement_fingerprint char(64) NOT NULL CHECK (statement_fingerprint ~ '^[0-9a-f]{64}$'),
 currency char(3) NOT NULL DEFAULT 'EUR' CHECK (currency='EUR'),
 upstream_minor bigint NOT NULL CHECK (upstream_minor>0 AND upstream_minor<=1000000000000),
 pgi_margin_minor bigint NOT NULL CHECK (pgi_margin_minor>=0),
 publisher_due_minor bigint NOT NULL CHECK (publisher_due_minor>=0),
 verification_state text NOT NULL DEFAULT 'unverified' CHECK(verification_state='unverified'),
 accounting_posting_authorized boolean NOT NULL DEFAULT false CHECK(accounting_posting_authorized=false),
 payout_authorized boolean NOT NULL DEFAULT false CHECK(payout_authorized=false),
 prepared_by_hash char(64) NOT NULL CHECK(prepared_by_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(operator_reference,statement_reference),
 CHECK(upstream_minor=pgi_margin_minor+publisher_due_minor)
);
CREATE INDEX IF NOT EXISTS direct_sva_collection_statement_period_idx
 ON direct_sva_collection_statements(period_key,created_at DESC);

CREATE TABLE IF NOT EXISTS direct_sva_collection_receipt_evidence (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 statement_id bigint NOT NULL REFERENCES direct_sva_collection_statements(id),
 receipt_reference text NOT NULL CHECK(length(receipt_reference) BETWEEN 8 AND 120),
 bank_statement_reference text NOT NULL CHECK(length(bank_statement_reference) BETWEEN 8 AND 120),
 booking_date date NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0 AND amount_minor<=1000000000000),
 currency char(3) NOT NULL DEFAULT 'EUR' CHECK(currency='EUR'),
 verification_state text NOT NULL DEFAULT 'unverified' CHECK(verification_state='unverified'),
 money_received_confirmed boolean NOT NULL DEFAULT false CHECK(money_received_confirmed=false),
 accounting_posting_authorized boolean NOT NULL DEFAULT false CHECK(accounting_posting_authorized=false),
 payout_authorized boolean NOT NULL DEFAULT false CHECK(payout_authorized=false),
 external_execution_enabled boolean NOT NULL DEFAULT false CHECK(external_execution_enabled=false),
 prepared_by_hash char(64) NOT NULL CHECK(prepared_by_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(statement_id,receipt_reference)
);
CREATE INDEX IF NOT EXISTS direct_sva_collection_receipt_statement_idx
 ON direct_sva_collection_receipt_evidence(statement_id,booking_date,created_at);

CREATE FUNCTION direct_sva_guard_collection_receipt_ceiling()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 maximum bigint;
 running_total numeric;
BEGIN
 SELECT upstream_minor INTO maximum
 FROM direct_sva_collection_statements WHERE id=NEW.statement_id FOR UPDATE;
 IF maximum IS NULL THEN
  RAISE EXCEPTION 'direct SVA collection statement required';
 END IF;
 SELECT COALESCE(SUM(amount_minor),0) INTO running_total
 FROM direct_sva_collection_receipt_evidence WHERE statement_id=NEW.statement_id;
 IF running_total+NEW.amount_minor>maximum THEN
  RAISE EXCEPTION 'direct SVA recorded receipts exceed the stated operator net';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER direct_sva_guard_collection_receipt_ceiling
BEFORE INSERT ON direct_sva_collection_receipt_evidence
FOR EACH ROW EXECUTE FUNCTION direct_sva_guard_collection_receipt_ceiling();

CREATE FUNCTION direct_sva_guard_collection_evidence_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'direct SVA preparatory financial evidence is immutable; correct with a new reviewed record';
END;
$$;
CREATE TRIGGER direct_sva_guard_collection_statement_immutable
BEFORE UPDATE OR DELETE ON direct_sva_collection_statements
FOR EACH ROW EXECUTE FUNCTION direct_sva_guard_collection_evidence_immutable();
CREATE TRIGGER direct_sva_guard_collection_receipt_immutable
BEFORE UPDATE OR DELETE ON direct_sva_collection_receipt_evidence
FOR EACH ROW EXECUTE FUNCTION direct_sva_guard_collection_evidence_immutable();

INSERT INTO public.schema_migrations(version,checksum) VALUES ('081_direct_sva_collection_preparation','eea55953067d23cc2185262d9fa2952b6862458dfa7ea4d61909c7d2f2e7f6e4');
-- END 081_direct_sva_collection_preparation

-- START 082_direct_sva_financial_cycle_fences
-- PGI Telecom Distribution only: financial cycle / publisher allocation / action fence.
-- Preparation schema, never a disbursement mechanism or statutory accounting export.
-- Additive to 081; Audiotel Premium Pro is not changed.
CREATE TABLE IF NOT EXISTS direct_sva_financial_cycle_previews (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'direct_sva' CHECK (business_unit='direct_sva'),
 cycle_reference text NOT NULL UNIQUE CHECK (cycle_reference ~ '^DSVA-CYCLE-[0-9a-f]{32}$'),
 cycle_fingerprint char(64) NOT NULL UNIQUE CHECK (cycle_fingerprint ~ '^[0-9a-f]{64}$'),
 source_statement_id bigint REFERENCES direct_sva_collection_statements(id),
 operator_reference text NOT NULL CHECK (length(operator_reference) BETWEEN 8 AND 120),
 statement_reference text NOT NULL CHECK (length(statement_reference) BETWEEN 8 AND 120),
 period_key char(7) NOT NULL CHECK (period_key ~ '^20[2-9][0-9]-(0[1-9]|1[0-2])$'),
 currency char(3) NOT NULL DEFAULT 'EUR' CHECK (currency='EUR'),
 operator_reported_minor bigint NOT NULL CHECK (operator_reported_minor BETWEEN 1 AND 1000000000000),
 pgi_margin_estimate_minor bigint NOT NULL CHECK (pgi_margin_estimate_minor BETWEEN 0 AND 1000000000000),
 publisher_liability_estimate_minor bigint NOT NULL CHECK (publisher_liability_estimate_minor BETWEEN 0 AND 1000000000000),
 receipts_reported_unverified_minor bigint NOT NULL DEFAULT 0 CHECK (receipts_reported_unverified_minor BETWEEN 0 AND 1000000000000),
 issuer_signature_verified boolean NOT NULL DEFAULT false CHECK (issuer_signature_verified=false),
 bank_reconciliation_verified boolean NOT NULL DEFAULT false CHECK (bank_reconciliation_verified=false),
 accounting_posting_authorized boolean NOT NULL DEFAULT false CHECK (accounting_posting_authorized=false),
 payout_authorized boolean NOT NULL DEFAULT false CHECK (payout_authorized=false),
 actual_funds_movement_minor bigint NOT NULL DEFAULT 0 CHECK (actual_funds_movement_minor=0),
 source_kind text NOT NULL DEFAULT 'untrusted_preparation' CHECK (source_kind='untrusted_preparation'),
 created_by_hash char(64) NOT NULL CHECK (created_by_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (operator_reported_minor=pgi_margin_estimate_minor+publisher_liability_estimate_minor),
 CHECK (receipts_reported_unverified_minor<=operator_reported_minor),
 UNIQUE (operator_reference,statement_reference)
);
CREATE INDEX IF NOT EXISTS direct_sva_financial_cycle_period_idx
 ON direct_sva_financial_cycle_previews(period_key,created_at DESC);

CREATE TABLE IF NOT EXISTS direct_sva_financial_publisher_previews (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 cycle_id bigint NOT NULL REFERENCES direct_sva_financial_cycle_previews(id),
 publisher_reference text NOT NULL CHECK (length(publisher_reference) BETWEEN 8 AND 120),
 calls integer NOT NULL CHECK (calls BETWEEN 1 AND 500),
 upstream_minor bigint NOT NULL CHECK (upstream_minor BETWEEN 0 AND 1000000000000),
 pgi_margin_minor bigint NOT NULL CHECK (pgi_margin_minor BETWEEN 0 AND 1000000000000),
 publisher_due_minor bigint NOT NULL CHECK (publisher_due_minor BETWEEN 0 AND 1000000000000),
 held_unverified_minor bigint NOT NULL DEFAULT 0 CHECK (held_unverified_minor BETWEEN 0 AND 1000000000000),
 collected_confirmed_minor bigint NOT NULL DEFAULT 0 CHECK (collected_confirmed_minor=0),
 paid_confirmed_minor bigint NOT NULL DEFAULT 0 CHECK (paid_confirmed_minor=0),
 beneficiary_kyb_verified boolean NOT NULL DEFAULT false CHECK (beneficiary_kyb_verified=false),
 payout_eligible boolean NOT NULL DEFAULT false CHECK (payout_eligible=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(cycle_id,publisher_reference),
 CHECK (upstream_minor=pgi_margin_minor+publisher_due_minor),
 CHECK (held_unverified_minor<=publisher_due_minor)
);
CREATE INDEX IF NOT EXISTS direct_sva_financial_publisher_ref_idx
 ON direct_sva_financial_publisher_previews(publisher_reference,cycle_id DESC);

CREATE TABLE IF NOT EXISTS direct_sva_financial_action_previews (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 cycle_id bigint NOT NULL REFERENCES direct_sva_financial_cycle_previews(id),
 action_key text NOT NULL CHECK (action_key IN (
  'cdr_import','statement_authenticity','bank_reconciliation','publisher_identity',
  'tax_model','funds_safeguards','accounting_draft','business_live',
  'payout_preparation','payout_execution','payment_confirmation','exceptions_and_alerts')),
 action_state text NOT NULL DEFAULT 'awaiting_authoritative_evidence'
  CHECK (action_state='awaiting_authoritative_evidence'),
 idempotency_key char(64) NOT NULL UNIQUE CHECK (idempotency_key ~ '^[0-9a-f]{64}$'),
 execution_authorized boolean NOT NULL DEFAULT false CHECK (execution_authorized=false),
 external_delivery_enabled boolean NOT NULL DEFAULT false CHECK (external_delivery_enabled=false),
 external_action_reference text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(cycle_id,action_key),
 CHECK(external_action_reference IS NULL)
);

CREATE TABLE IF NOT EXISTS direct_sva_financial_audit_previews (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 cycle_id bigint NOT NULL REFERENCES direct_sva_financial_cycle_previews(id),
 event_type text NOT NULL CHECK(event_type IN (
  'preview_prepared','amount_discrepancy','publisher_hold_declared','external_prerequisite_missing')),
 event_digest char(64) NOT NULL CHECK(event_digest ~ '^[0-9a-f]{64}$'),
 actor_hash char(64) NOT NULL CHECK(actor_hash ~ '^[0-9a-f]{64}$'),
 has_authoritative_evidence boolean NOT NULL DEFAULT false CHECK(has_authoritative_evidence=false),
 external_side_effect boolean NOT NULL DEFAULT false CHECK(external_side_effect=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(cycle_id,event_type,event_digest)
);
CREATE INDEX IF NOT EXISTS direct_sva_financial_audit_cycle_idx
 ON direct_sva_financial_audit_previews(cycle_id,id DESC);

CREATE FUNCTION direct_sva_guard_financial_preparation_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'PGI distribution financial previews are immutable; use reviewed correction records';
END;
$$;
CREATE TRIGGER direct_sva_guard_financial_cycle_immutable
 BEFORE UPDATE OR DELETE ON direct_sva_financial_cycle_previews
 FOR EACH ROW EXECUTE FUNCTION direct_sva_guard_financial_preparation_immutable();
CREATE TRIGGER direct_sva_guard_financial_publisher_immutable
 BEFORE UPDATE OR DELETE ON direct_sva_financial_publisher_previews
 FOR EACH ROW EXECUTE FUNCTION direct_sva_guard_financial_preparation_immutable();
CREATE TRIGGER direct_sva_guard_financial_action_immutable
 BEFORE UPDATE OR DELETE ON direct_sva_financial_action_previews
 FOR EACH ROW EXECUTE FUNCTION direct_sva_guard_financial_preparation_immutable();
CREATE TRIGGER direct_sva_guard_financial_audit_immutable
 BEFORE UPDATE OR DELETE ON direct_sva_financial_audit_previews
 FOR EACH ROW EXECUTE FUNCTION direct_sva_guard_financial_preparation_immutable();

INSERT INTO public.schema_migrations(version,checksum) VALUES ('082_direct_sva_financial_cycle_fences','9117fe3292307ba6e9f0eaea8c4bf0e7189fbd99ce4dbc28ab745f4f16833968');
-- END 082_direct_sva_financial_cycle_fences

-- START 083_direct_sva_bank_event_deduplication
-- PGI Telecom Distribution only. Global bank movement replay protection and
-- independent exception register, preparation stage with ZERO payment capability.
-- A bank reference can never be counted in two different operator statements.
CREATE TABLE IF NOT EXISTS direct_sva_bank_event_previews (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'direct_sva' CHECK(business_unit='direct_sva'),
 source_adapter text NOT NULL CHECK(source_adapter ~ '^[a-z_]{4,64}$'),
 external_movement_reference text NOT NULL CHECK(length(external_movement_reference) BETWEEN 8 AND 140),
 source_payload_digest char(64) NOT NULL CHECK(source_payload_digest ~ '^[0-9a-f]{64}$'),
 cycle_id bigint REFERENCES direct_sva_financial_cycle_previews(id),
 collection_statement_id bigint NOT NULL REFERENCES direct_sva_collection_statements(id),
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 1000000000000),
 currency char(3) NOT NULL DEFAULT 'EUR' CHECK(currency='EUR'),
 booking_date date NOT NULL,
 source_verification_state text NOT NULL DEFAULT 'unverified' CHECK(source_verification_state='unverified'),
 bank_money_confirmed boolean NOT NULL DEFAULT false CHECK(bank_money_confirmed=false),
 financial_posting_allowed boolean NOT NULL DEFAULT false CHECK(financial_posting_allowed=false),
 payout_allowed boolean NOT NULL DEFAULT false CHECK(payout_allowed=false),
 created_by_hash char(64) NOT NULL CHECK(created_by_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_adapter,external_movement_reference)
);
CREATE INDEX IF NOT EXISTS direct_sva_bank_event_statement_idx
 ON direct_sva_bank_event_previews(collection_statement_id,booking_date);

CREATE TABLE IF NOT EXISTS direct_sva_financial_exception_previews (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'direct_sva' CHECK(business_unit='direct_sva'),
 cycle_id bigint NOT NULL REFERENCES direct_sva_financial_cycle_previews(id),
 exception_reference text NOT NULL UNIQUE CHECK(length(exception_reference) BETWEEN 8 AND 120),
 exception_kind text NOT NULL CHECK(exception_kind IN (
  'duplicate_bank_event','settlement_difference','unattributed_publisher',
  'invalid_cdr','publisher_compliance','disputed_amount','bank_feed_unverified',
  'payment_provider_unavailable')),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 review_state text NOT NULL DEFAULT 'requires_independent_review'
  CHECK(review_state='requires_independent_review'),
 payout_release_allowed boolean NOT NULL DEFAULT false CHECK(payout_release_allowed=false),
 customer_message_sent boolean NOT NULL DEFAULT false CHECK(customer_message_sent=false),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS direct_sva_financial_exception_cycle_idx
 ON direct_sva_financial_exception_previews(cycle_id,created_at DESC);

CREATE TRIGGER direct_sva_guard_bank_event_preview_immutable
 BEFORE UPDATE OR DELETE ON direct_sva_bank_event_previews
 FOR EACH ROW EXECUTE FUNCTION direct_sva_guard_financial_preparation_immutable();
CREATE TRIGGER direct_sva_guard_financial_exception_preview_immutable
 BEFORE UPDATE OR DELETE ON direct_sva_financial_exception_previews
 FOR EACH ROW EXECUTE FUNCTION direct_sva_guard_financial_preparation_immutable();

INSERT INTO public.schema_migrations(version,checksum) VALUES ('083_direct_sva_bank_event_deduplication','a6f6d1da0571def9de5e457edfb92c5003b07374ece2070169bd873c5e9e3194');
-- END 083_direct_sva_bank_event_deduplication

-- START 084_direct_sva_website_visibility
-- Preparation only: SEO-preserving presentation switch, independent of commercial operation.
-- Content launch stays blocked by a structural CHECK until a separately reviewed migration.
CREATE TABLE IF NOT EXISTS direct_sva_website_visibility (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id=1),
  public_content_authorized boolean NOT NULL DEFAULT false CHECK(public_content_authorized=false),
  navigation_enabled boolean NOT NULL DEFAULT false,
  commercial_calls_to_action_enabled boolean NOT NULL DEFAULT false CHECK(commercial_calls_to_action_enabled=false),
  changed_at timestamptz NOT NULL DEFAULT now(),
  actor_hash char(64) CHECK(actor_hash IS NULL OR actor_hash ~ '^[0-9a-f]{64}$')
);
INSERT INTO direct_sva_website_visibility(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS direct_sva_website_visibility_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  changed_at timestamptz NOT NULL DEFAULT now(),
  switch_name text NOT NULL DEFAULT 'navigation_enabled' CHECK(switch_name='navigation_enabled'),
  previous_value boolean NOT NULL,
  requested_value boolean NOT NULL,
  result text NOT NULL CHECK(result IN ('applied','unchanged')),
  actor_hash char(64) NOT NULL CHECK(actor_hash ~ '^[0-9a-f]{64}$'),
  evidence_reference text NOT NULL CHECK(length(btrim(evidence_reference)) BETWEEN 8 AND 240)
);
CREATE FUNCTION direct_sva_website_visibility_audit_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Direct SVA website visibility history is append-only'; END;
$$;
CREATE TRIGGER direct_sva_website_visibility_audit_immutable
 BEFORE UPDATE OR DELETE ON direct_sva_website_visibility_audit
 FOR EACH ROW EXECUTE FUNCTION direct_sva_website_visibility_audit_immutable();

INSERT INTO public.schema_migrations(version,checksum) VALUES ('084_direct_sva_website_visibility','e61dec99991d6b01e95c2bf1db3b52dc4884ff7812dd443353657ded13309c8f');
-- END 084_direct_sva_website_visibility

-- START 085_direct_sva_admin_editorial_release
-- The site owner, not a hard-coded assistant gate, decides when editorial
-- distribution pages go public from the authenticated administration cockpit.
-- Keep telecom provisioning, client portal and third-party money movement separate.
-- Existing published URLs must remain available when navigation is hidden.
ALTER TABLE direct_sva_website_visibility
 DROP CONSTRAINT IF EXISTS direct_sva_website_visibility_public_content_authorized_check;
ALTER TABLE direct_sva_website_visibility_audit
 DROP CONSTRAINT IF EXISTS direct_sva_website_visibility_audit_switch_name_check;
ALTER TABLE direct_sva_website_visibility_audit
 ADD CONSTRAINT direct_sva_website_visibility_audit_switch_name_check
 CHECK (switch_name IN ('navigation_enabled','public_content_authorized'));

INSERT INTO public.schema_migrations(version,checksum) VALUES ('085_direct_sva_admin_editorial_release','881ca430c6cd0d7a172c0a3920d8a58b6da5dcbb7549e14c6b5e710c0982eb2b');
-- END 085_direct_sva_admin_editorial_release

DO $pgi_postflight$
BEGIN
 IF (SELECT count(*) FROM public.schema_migrations WHERE version >= '072' AND version <= '085_zz') <> 14 THEN
   RAISE EXCEPTION 'Migrations not complete, rolling back';
 END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.pgi_company_business_units
   WHERE unit_code='audiotel_platform' AND display_name='Audiotel Premium Pro' AND cost_center='APP'
 ) OR NOT EXISTS(
   SELECT 1 FROM public.pgi_company_business_units
   WHERE unit_code='direct_sva' AND display_name='PGI Telecom Distribution'
     AND lifecycle_status='preparation' AND cost_center='DSVA'
 ) THEN
   RAISE EXCEPTION 'Business-unit isolation violated, rolling back';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.direct_sva_admin_switches
   WHERE id=1 AND commercial_operation_enabled=false
 ) OR NOT EXISTS(
   SELECT 1 FROM public.direct_sva_operator_controls
   WHERE id=1 AND operator_mode='preparation' AND number_activation_enabled=false AND payouts_enabled=false
 ) OR NOT EXISTS(
   SELECT 1 FROM public.direct_sva_website_visibility
   WHERE id=1 AND public_content_authorized=false
     AND navigation_enabled=false AND commercial_calls_to_action_enabled=false
 ) THEN
   RAISE EXCEPTION 'Prelaunch commercial locks violated, rolling back';
 END IF;
END;
$pgi_postflight$;

COMMIT;
-- After commit, execute read-only:
-- node scripts/verify-deployment-schema.mjs
-- node scripts/audit-direct-sva-production-release.mjs
-- Then stage a production build without assigning custom domains.
