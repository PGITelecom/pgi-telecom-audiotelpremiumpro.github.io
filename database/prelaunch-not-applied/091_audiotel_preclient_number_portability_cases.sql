-- Audiotel Premium Pro pre-client requests, FR-only. NOT a production migration.
-- Dependence: apply existing dormant 090 APP draft schema FIRST on disposable CI DB.
-- NO commercial activation, NO operator commands, NO Vercel/Neon production writes.
-- Reuse existing tenants, tenant_portability_requests, app_number_order_intents.
-- This staging layer bridges unauthenticated prospects into authenticated cases
-- only after contact verification, KYB, mandate and explicit authorized handoff.

CREATE TABLE app_prelaunch_service_cases (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'audiotel_platform'
   CHECK (business_unit='audiotel_platform'),
 public_reference text NOT NULL UNIQUE CHECK (public_reference ~ '^APP-CASE-[A-Za-z0-9_-]{12,90}$'),
 secure_contact_ref text NOT NULL CHECK(length(secure_contact_ref) BETWEEN 8 AND 180),
 request_key text NOT NULL CHECK(length(request_key) BETWEEN 16 AND 180),
 request_fingerprint char(64) NOT NULL CHECK(request_fingerprint ~ '^[0-9a-f]{64}$'),
 tenant_id bigint REFERENCES tenants(id),
 country_code char(2) NOT NULL DEFAULT 'FR' CHECK(country_code='FR'),
 request_kind text NOT NULL CHECK(request_kind IN ('portability','new_number')),
 number_category text NOT NULL CHECK(number_category IN ('081','082','089')),
 requested_e164 text CHECK (requested_e164 ~ '^\+338[129][0-9]{7}$'),
 source_operator_label text CHECK (length(source_operator_label) <= 90),
 source_operator_ref text,
 stage text NOT NULL DEFAULT 'received'
   CHECK (stage IN ('received','awaiting_documents','eligibility_review','contract_review',
     'operator_packet_prepared','awaiting_operator_agreement','handoff_ready',
     'on_hold','rejected','cancelled')),
 -- Values are only for recording staged handoff review, not assigning any number.
 prepared_order_id bigint REFERENCES app_number_order_intents(id),
 prepared_portability_request_id bigint REFERENCES tenant_portability_requests(id),
 contact_verified boolean NOT NULL DEFAULT false,
 customer_account_auto_created boolean NOT NULL DEFAULT false CHECK(customer_account_auto_created=false),
 carrier_request_sent boolean NOT NULL DEFAULT false CHECK(carrier_request_sent=false),
 number_provisioned boolean NOT NULL DEFAULT false CHECK(number_provisioned=false),
 number_ported boolean NOT NULL DEFAULT false CHECK(number_ported=false),
 routing_activated boolean NOT NULL DEFAULT false CHECK(routing_activated=false),
 subscription_charged boolean NOT NULL DEFAULT false CHECK(subscription_charged=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(secure_contact_ref,request_key),
 CHECK ((request_kind='portability' AND requested_e164 IS NOT NULL AND
         '0'||substring(requested_e164 from 4 for 2)=number_category)
    OR (request_kind='new_number' AND requested_e164 IS NULL)),
 CHECK (prepared_order_id IS NULL OR tenant_id IS NOT NULL),
 CHECK (prepared_portability_request_id IS NULL OR tenant_id IS NOT NULL),
 CHECK (prepared_order_id IS NULL OR prepared_portability_request_id IS NULL)
);
CREATE UNIQUE INDEX app_prelaunch_active_portability_number
 ON app_prelaunch_service_cases(requested_e164)
 WHERE request_kind='portability' AND stage NOT IN ('cancelled','rejected');
CREATE INDEX app_prelaunch_cases_queue
 ON app_prelaunch_service_cases(stage,created_at,id);
CREATE INDEX app_prelaunch_cases_tenant
 ON app_prelaunch_service_cases(tenant_id,created_at DESC)
 WHERE tenant_id IS NOT NULL;

-- Stored values are PRIVATE object-store REFERENCES, not uploads, e-mail,
-- plaintext identity scans or raw RIO. The owner encrypts at the provider.
CREATE TABLE app_prelaunch_case_documents (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 case_id bigint NOT NULL REFERENCES app_prelaunch_service_cases(id),
 document_kind text NOT NULL CHECK(document_kind IN
  ('business_registration','holder_mandate','existing_invoice','rio_reference',
   'contract','kyb_report','operator_ack','tariff_evidence',
   'route_acceptance','other_verified_reference')),
 protected_object_ref text NOT NULL CHECK(length(protected_object_ref) BETWEEN 8 AND 180),
 source_sha256 char(64) NOT NULL CHECK(source_sha256 ~ '^[0-9a-f]{64}$'),
 retention_until date NOT NULL,
 review_status text NOT NULL DEFAULT 'unverified' CHECK(review_status IN ('unverified','verified','rejected')),
 reviewed_at timestamptz,
 review_reference text,
 CHECK (review_status='unverified' OR (reviewed_at IS NOT NULL AND review_reference IS NOT NULL AND length(review_reference)>=8)),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(case_id,document_kind,source_sha256)
);
CREATE INDEX app_prelaunch_documents_case ON app_prelaunch_case_documents(case_id);

-- Case event log is append-only. No PII/secret/RIO text in attributes.
CREATE TABLE app_prelaunch_case_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 case_id bigint NOT NULL REFERENCES app_prelaunch_service_cases(id),
 event_key text NOT NULL CHECK(event_key IN ('case_prepared','case_review_requested',
  'documents_required','document_reference_added','document_reviewed','eligibility_checked',
  'contract_reviewed','operator_packet_prepared','operator_agreement_pending',
  'handoff_prepared','case_paused','case_rejected','case_cancelled')),
 stage_from text,
 stage_to text,
 actor_fingerprint char(64) NOT NULL CHECK(actor_fingerprint ~ '^[0-9a-f]{64}$'),
 source_reference text NOT NULL CHECK(length(source_reference) BETWEEN 8 AND 180),
 happened_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(case_id,event_key,source_reference)
);
CREATE INDEX app_prelaunch_events_case_time
 ON app_prelaunch_case_events(case_id,happened_at,id);

CREATE FUNCTION app_prelaunch_event_immutable() RETURNS trigger
 LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'APP prelaunch event log is append-only';
END;
$$;
CREATE TRIGGER app_prelaunch_events_protect
 BEFORE UPDATE OR DELETE ON app_prelaunch_case_events
 FOR EACH ROW EXECUTE FUNCTION app_prelaunch_event_immutable();

-- Outbox is inert and cannot send e-mail or create CRM records until a
-- separately reviewed and approved release migration replaces these checks.
CREATE TABLE app_prelaunch_notification_drafts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 case_id bigint NOT NULL REFERENCES app_prelaunch_service_cases(id),
 event_key text NOT NULL,
 template_key text NOT NULL,
 source_reference text NOT NULL,
 dispatch_status text NOT NULL DEFAULT 'not_authorized'
   CHECK(dispatch_status='not_authorized'),
 send_enabled boolean NOT NULL DEFAULT false CHECK(send_enabled=false),
 external_provider_message_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(case_id,event_key,source_reference),
 CHECK(external_provider_message_id IS NULL)
);

-- Network handoff intent is a draft; not a real portability command.
CREATE TABLE app_prelaunch_network_handoff_drafts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 case_id bigint NOT NULL REFERENCES app_prelaunch_service_cases(id),
 action_kind text NOT NULL CHECK(action_kind IN
   ('portability_eligibility','portability_submit','portability_status',
    'portability_cancel','number_stock_check','number_reservation',
    'routing_preparation','call_acceptance')),
 operator_reference text,
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
 dispatch_status text NOT NULL DEFAULT 'not_authorized'
   CHECK(dispatch_status='not_authorized'),
 execution_enabled boolean NOT NULL DEFAULT false CHECK(execution_enabled=false),
 operator_ack_verified boolean NOT NULL DEFAULT false CHECK(operator_ack_verified=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(case_id,action_kind,request_digest)
);

-- Deny PUBLIC/anonymous and do not expose as customer-scoped views yet.
REVOKE ALL ON TABLE
 app_prelaunch_service_cases,app_prelaunch_case_documents,
 app_prelaunch_case_events,app_prelaunch_notification_drafts,
 app_prelaunch_network_handoff_drafts FROM PUBLIC;
REVOKE ALL ON SEQUENCE
 app_prelaunch_service_cases_id_seq,app_prelaunch_case_documents_id_seq,
 app_prelaunch_case_events_id_seq,app_prelaunch_notification_drafts_id_seq,
 app_prelaunch_network_handoff_drafts_id_seq FROM PUBLIC;

COMMENT ON TABLE app_prelaunch_service_cases IS
 'FR only Audiotel prospect intake. No direct customer login, carrier request, portage or number provisioning permitted in preparation.';
COMMENT ON TABLE app_prelaunch_network_handoff_drafts IS
 'No SIP/API carrier command may be executed. Reuse tenant_portability_requests after verified and separately authorized handoff.';
