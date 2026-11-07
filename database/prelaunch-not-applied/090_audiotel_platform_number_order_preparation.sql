-- Audiotel Premium Pro only. NOT AN AUTOMATIC PRODUCTION MIGRATION.
-- Prepared APP orders and evidence claims; no payment or provisioning authority.
-- Apply only on disposable CI database until release review.
CREATE TABLE IF NOT EXISTS app_number_order_intents (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'audiotel_platform' CHECK(business_unit='audiotel_platform'),
 tenant_id bigint NOT NULL REFERENCES tenants(id),
 request_key text NOT NULL CHECK(length(request_key) BETWEEN 8 AND 180),
 request_fingerprint char(64) NOT NULL CHECK(request_fingerprint ~ '^[0-9a-f]{64}$'),
 request_kind text NOT NULL CHECK(request_kind IN ('new_number','portability')),
 preferred_category text NOT NULL CHECK(preferred_category IN ('081','082','089')),
 price_version_id bigint NOT NULL REFERENCES service_plan_price_versions(id),
 stage text NOT NULL DEFAULT 'pending_evidence' CHECK(stage IN ('pending_evidence','manual_review','on_hold','withdrawn')),
 approved_for_customer_delivery boolean NOT NULL DEFAULT false CHECK(approved_for_customer_delivery=false),
 automatically_activate_network boolean NOT NULL DEFAULT false CHECK(automatically_activate_network=false),
 automatically_charge_customer boolean NOT NULL DEFAULT false CHECK(automatically_charge_customer=false),
 automatically_payout_publisher boolean NOT NULL DEFAULT false CHECK(automatically_payout_publisher=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,request_key)
);
CREATE INDEX IF NOT EXISTS app_number_order_tenant_time_idx
 ON app_number_order_intents(tenant_id,created_at DESC,id DESC);

CREATE TABLE IF NOT EXISTS app_number_order_evidence_drafts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id bigint NOT NULL REFERENCES app_number_order_intents(id),
 gate_key text NOT NULL CHECK(gate_key IN (
 'customer_identity','service_eligibility','commercial_contract','regulatory_assignor',
 'operator_contract','service_tariff_mgit','subscription_entitlement',
 'destination_approved','carrier_assignment','routing_acceptance','independent_release')),
 external_reference text NOT NULL CHECK(length(external_reference) BETWEEN 8 AND 180),
 evidence_source text NOT NULL CHECK(length(evidence_source) BETWEEN 4 AND 60),
 review_state text NOT NULL DEFAULT 'unverified' CHECK(review_state='unverified'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id,gate_key,external_reference)
);

CREATE TABLE IF NOT EXISTS app_number_order_action_drafts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id bigint NOT NULL REFERENCES app_number_order_intents(id),
 action_key text NOT NULL CHECK(action_key IN (
 'carrier_hold','operator_assignment','sip_configuration','inbound_acceptance',
 'customer_delivery','cdr_ingestion','billing_reconcile','publisher_payout_review')),
 idempotency_key text NOT NULL UNIQUE CHECK(length(idempotency_key) BETWEEN 16 AND 180),
 dispatch_status text NOT NULL DEFAULT 'not_authorized' CHECK(dispatch_status='not_authorized'),
 network_execution_enabled boolean NOT NULL DEFAULT false CHECK(network_execution_enabled=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id,action_key)
);

CREATE TABLE IF NOT EXISTS app_number_order_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id bigint NOT NULL REFERENCES app_number_order_intents(id),
 event_type text NOT NULL CHECK(event_type IN (
 'request_prepared','evidence_submitted','review_opened','hold_recorded','withdrawal_requested')),
 source_reference text NOT NULL CHECK(length(source_reference) BETWEEN 8 AND 180),
 actor_hash char(64) NOT NULL CHECK(actor_hash ~ '^[0-9a-f]{64}$'),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id,event_type,source_reference)
);
CREATE FUNCTION app_number_order_audit_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'APP order audit is append-only';
END;
$$;
CREATE TRIGGER app_number_order_audit_no_mutation
 BEFORE UPDATE OR DELETE ON app_number_order_audit
 FOR EACH ROW EXECUTE FUNCTION app_number_order_audit_immutable();

CREATE TABLE IF NOT EXISTS app_accounting_reconciliation_drafts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id bigint REFERENCES app_number_order_intents(id),
 period_reference text NOT NULL CHECK(length(period_reference) BETWEEN 8 AND 180),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 review_json jsonb NOT NULL CHECK(jsonb_typeof(review_json)='object'),
 business_unit text NOT NULL DEFAULT 'audiotel_platform' CHECK(business_unit='audiotel_platform'),
 statutory_posting_authorized boolean NOT NULL DEFAULT false CHECK(statutory_posting_authorized=false),
 funds_transfer_authorized boolean NOT NULL DEFAULT false CHECK(funds_transfer_authorized=false),
 verified_sources_present boolean NOT NULL DEFAULT false CHECK(verified_sources_present=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(period_reference,source_digest)
);

REVOKE ALL ON TABLE
 app_number_order_intents,app_number_order_evidence_drafts,
 app_number_order_action_drafts,app_number_order_audit,
 app_accounting_reconciliation_drafts FROM PUBLIC;