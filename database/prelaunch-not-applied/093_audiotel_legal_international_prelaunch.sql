-- Audiotel Premium Pro: legal optimization and international growth PREPARATION ONLY.
-- NEVER execute in Neon production. Disposable CI PostgreSQL only.
-- Existing operating_markets and tenant_market_profiles remain authoritative;
-- foreign market entries here are research drafts, not activated countries.

CREATE TABLE app_legal_monthly_monitor_drafts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'audiotel_platform' CHECK(business_unit='audiotel_platform'),
 month_reference text NOT NULL CHECK(month_reference ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 country_code char(2) NOT NULL DEFAULT 'FR' CHECK(country_code='FR'),
 activity_category text NOT NULL CHECK(activity_category IN ('bic_services','bnc_nonregulated')),
 own_receipts_minor bigint NOT NULL CHECK(own_receipts_minor BETWEEN 0 AND 1000000000000),
 partner_collections_minor bigint NOT NULL CHECK(partner_collections_minor BETWEEN 0 AND 1000000000000),
 partner_payouts_minor bigint NOT NULL CHECK(partner_payouts_minor BETWEEN 0 AND 1000000000000),
 variable_cost_minor bigint NOT NULL CHECK(variable_cost_minor BETWEEN 0 AND 1000000000000),
 fixed_cost_minor bigint NOT NULL CHECK(fixed_cost_minor BETWEEN 0 AND 1000000000000),
 source_document_digest char(64) NOT NULL CHECK(source_document_digest ~ '^[0-9a-f]{64}$'),
 source_reference text NOT NULL CHECK(length(source_reference) BETWEEN 8 AND 180),
 declared_turnover_minor bigint CHECK(declared_turnover_minor IS NULL),
 tax_basis_legally_verified boolean NOT NULL DEFAULT false CHECK(tax_basis_legally_verified=false),
 reporter_dispatched boolean NOT NULL DEFAULT false CHECK(reporter_dispatched=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(month_reference,source_document_digest),
 CHECK(partner_payouts_minor<=partner_collections_minor)
);
CREATE INDEX app_legal_monitor_month ON app_legal_monthly_monitor_drafts(month_reference,id DESC);

CREATE TABLE app_legal_form_scenario_drafts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'audiotel_platform' CHECK(business_unit='audiotel_platform'),
 month_reference text NOT NULL CHECK(month_reference ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 candidate_form text NOT NULL CHECK(candidate_form IN ('micro','eurl_is','sasu_is','ei_real')),
 assumption_reference text NOT NULL CHECK(length(assumption_reference) BETWEEN 8 AND 180),
 cash_available_preview_minor bigint NOT NULL CHECK(cash_available_preview_minor BETWEEN 0 AND 1000000000000),
 setup_cost_minor bigint NOT NULL CHECK(setup_cost_minor BETWEEN 0 AND 1000000000000),
 annual_compliance_cost_minor bigint NOT NULL CHECK(annual_compliance_cost_minor BETWEEN 0 AND 1000000000000),
 tax_advisor_confirmed boolean NOT NULL DEFAULT false CHECK(tax_advisor_confirmed=false),
 legal_action_authorized boolean NOT NULL DEFAULT false CHECK(legal_action_authorized=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(month_reference,candidate_form,assumption_reference)
);

CREATE TABLE app_legal_entity_transition_drafts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'audiotel_platform' CHECK(business_unit='audiotel_platform'),
 proposal_reference text NOT NULL UNIQUE CHECK(length(proposal_reference) BETWEEN 8 AND 180),
 from_form text NOT NULL CHECK(from_form IN ('micro_ei','eurl_is','sasu_is','ei_real')),
 to_form text NOT NULL CHECK(to_form IN ('micro_ei','eurl_is','sasu_is','ei_real')),
 workflow_status text NOT NULL DEFAULT 'internal_preparation'
  CHECK(workflow_status='internal_preparation'),
 contract_novation_executed boolean NOT NULL DEFAULT false CHECK(contract_novation_executed=false),
 arcep_rights_transferred boolean NOT NULL DEFAULT false CHECK(arcep_rights_transferred=false),
 carrier_agreements_transferred boolean NOT NULL DEFAULT false CHECK(carrier_agreements_transferred=false),
 stripe_account_migrated boolean NOT NULL DEFAULT false CHECK(stripe_account_migrated=false),
 revolut_account_migrated boolean NOT NULL DEFAULT false CHECK(revolut_account_migrated=false),
 incorporation_filed boolean NOT NULL DEFAULT false CHECK(incorporation_filed=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(from_form<>to_form)
);

-- Existing operating_markets is NOT populated: no foreign market activation.
CREATE TABLE app_international_market_entry_drafts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'audiotel_platform' CHECK(business_unit='audiotel_platform'),
 country_code char(2) NOT NULL UNIQUE CHECK(country_code IN ('FR','ES','IT','GB','US')),
 market_id bigint REFERENCES operating_markets(id),
 regulator_reference text NOT NULL CHECK(length(regulator_reference) BETWEEN 2 AND 180),
 operator_model text NOT NULL CHECK(operator_model IN
   ('attributary_candidate','partner_local_candidate','undecided')),
 research_status text NOT NULL DEFAULT 'research_only' CHECK(research_status='research_only'),
 currency char(3) NOT NULL CHECK(currency IN ('EUR','GBP','USD')),
 regulatory_document_sha256 char(64),
 numbering_authorized boolean NOT NULL DEFAULT false CHECK(numbering_authorized=false),
 carrier_interconnection_active boolean NOT NULL DEFAULT false CHECK(carrier_interconnection_active=false),
 commercial_market_active boolean NOT NULL DEFAULT false CHECK(commercial_market_active=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(regulatory_document_sha256 IS NULL OR regulatory_document_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE TABLE app_international_portability_drafts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'audiotel_platform' CHECK(business_unit='audiotel_platform'),
 country_code char(2) NOT NULL CHECK(country_code IN ('FR','ES','IT','GB','US')),
 customer_tenant_id bigint REFERENCES tenants(id),
 request_reference text NOT NULL UNIQUE CHECK(length(request_reference) BETWEEN 8 AND 180),
 number_e164 text NOT NULL CHECK(number_e164 ~ '^\+[1-9][0-9]{7,14}$'),
 holder_secure_ref text NOT NULL CHECK(length(holder_secure_ref) BETWEEN 8 AND 180),
 carrier_secure_ref text,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN
  ('draft','identity_pending','documents_pending','regulatory_review',
   'carrier_agreement_pending','preparing_route','awaiting_operator_confirmation',
   'on_hold','rejected','cancelled')),
 national_portability_confirmed boolean NOT NULL DEFAULT false
   CHECK(national_portability_confirmed=false),
 operator_request_sent boolean NOT NULL DEFAULT false CHECK(operator_request_sent=false),
 actual_number_ported boolean NOT NULL DEFAULT false CHECK(actual_number_ported=false),
 routing_activated boolean NOT NULL DEFAULT false CHECK(routing_activated=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(carrier_secure_ref IS NULL OR length(carrier_secure_ref) BETWEEN 8 AND 180)
);
CREATE INDEX app_intl_port_tenant ON app_international_portability_drafts(customer_tenant_id,id DESC);

CREATE TABLE app_international_quote_drafts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'audiotel_platform' CHECK(business_unit='audiotel_platform'),
 country_code char(2) NOT NULL CHECK(country_code IN ('FR','ES','IT','GB','US')),
 operator_model text NOT NULL CHECK(operator_model IN
  ('attributary_candidate','partner_local_candidate')),
 quote_reference text NOT NULL CHECK(length(quote_reference) BETWEEN 8 AND 180),
 quote_digest char(64) NOT NULL CHECK(quote_digest ~ '^[0-9a-f]{64}$'),
 currency char(3) NOT NULL CHECK(currency IN ('EUR','GBP','USD')),
 assumed_seconds bigint NOT NULL CHECK(assumed_seconds BETWEEN 0 AND 1000000000),
 gross_minor bigint NOT NULL CHECK(gross_minor BETWEEN 0 AND 1000000000000),
 publisher_minor bigint NOT NULL CHECK(publisher_minor BETWEEN 0 AND 1000000000000),
 variable_cost_minor bigint NOT NULL CHECK(variable_cost_minor BETWEEN 0 AND 1000000000000),
 setup_cost_minor bigint NOT NULL CHECK(setup_cost_minor BETWEEN 0 AND 1000000000000),
 validated_by_carrier boolean NOT NULL DEFAULT false CHECK(validated_by_carrier=false),
 commercial_activated boolean NOT NULL DEFAULT false CHECK(commercial_activated=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(country_code,quote_digest)
);
CREATE INDEX app_intl_quote_country ON app_international_quote_drafts(country_code,id DESC);

CREATE TABLE app_strategy_monthly_runner_config_drafts (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'audiotel_platform' CHECK(business_unit='audiotel_platform'),
 schedule_proposal text NOT NULL DEFAULT 'first_business_day_monthly_09_Europe_Paris'
  CHECK(schedule_proposal='first_business_day_monthly_09_Europe_Paris'),
 enabled boolean NOT NULL DEFAULT false CHECK(enabled=false),
 notification_enabled boolean NOT NULL DEFAULT false CHECK(notification_enabled=false),
 legal_auto_change_enabled boolean NOT NULL DEFAULT false CHECK(legal_auto_change_enabled=false),
 external_api_enabled boolean NOT NULL DEFAULT false CHECK(external_api_enabled=false),
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_strategy_audit_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_unit text NOT NULL DEFAULT 'audiotel_platform' CHECK(business_unit='audiotel_platform'),
 event_kind text NOT NULL CHECK(event_kind IN
  ('monthly_snapshot_drafted','scenario_drafted','legal_transition_drafted',
   'market_research_updated','foreign_portability_drafted',
   'foreign_quote_prepared','regulatory_gap_detected')),
 event_reference text NOT NULL CHECK(length(event_reference) BETWEEN 8 AND 180),
 actor_sha256 char(64) NOT NULL CHECK(actor_sha256 ~ '^[0-9a-f]{64}$'),
 event_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(event_kind,event_reference)
);
CREATE FUNCTION app_strategy_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'APP strategy audit is append-only';
END; $$;
CREATE TRIGGER app_strategy_audit_protect
 BEFORE UPDATE OR DELETE ON app_strategy_audit_events
 FOR EACH ROW EXECUTE FUNCTION app_strategy_audit_immutable();

REVOKE ALL ON TABLE
 app_legal_monthly_monitor_drafts,app_legal_form_scenario_drafts,
 app_legal_entity_transition_drafts,app_international_market_entry_drafts,
 app_international_portability_drafts,app_international_quote_drafts,
 app_strategy_monthly_runner_config_drafts,app_strategy_audit_events FROM PUBLIC;
REVOKE ALL ON SEQUENCE
 app_legal_monthly_monitor_drafts_id_seq,app_legal_form_scenario_drafts_id_seq,
 app_legal_entity_transition_drafts_id_seq,app_international_market_entry_drafts_id_seq,
 app_international_portability_drafts_id_seq,app_international_quote_drafts_id_seq,
 app_strategy_monthly_runner_config_drafts_id_seq,app_strategy_audit_events_id_seq FROM PUBLIC;
