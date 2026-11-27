-- Preparation only. NOT a production migration. Do not execute automatically.
-- Requires explicit review of runtime role, migration registry, backup and cutover.
BEGIN;
CREATE TABLE voice_call_reservations (
 call_id uuid PRIMARY KEY,
 node_id text NOT NULL CHECK (node_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'),
 generation uuid NOT NULL UNIQUE,
 tenant_id bigint NOT NULL REFERENCES tenants(id),
 sva_number_id bigint NOT NULL REFERENCES sva_numbers(id),
 destination_id bigint NOT NULL REFERENCES tenant_call_destinations(id),
 state text NOT NULL CHECK (state IN ('reserved','dialing','connected','uncertain','released')),
 sequence bigint NOT NULL DEFAULT 0 CHECK (sequence BETWEEN 0 AND 9007199254740991),
 last_observation text CHECK (last_observation IN ('dialing','connected','unknown','terminal')),
 created_at timestamptz NOT NULL DEFAULT now(),
 last_observed_at timestamptz NOT NULL DEFAULT now(),
 released_at timestamptz,
 CHECK ((state='released') = (released_at IS NOT NULL)),
 CHECK ((sequence=0) = (last_observation IS NULL))
);
CREATE INDEX voice_call_reservations_destination_open_idx
 ON voice_call_reservations(destination_id) WHERE state <> 'released';
CREATE INDEX voice_call_reservations_review_idx
 ON voice_call_reservations(last_observed_at) WHERE state <> 'released';
REVOKE ALL ON voice_call_reservations FROM PUBLIC;
-- Replay protection persists across gateway restarts and multiple instances.
CREATE TABLE voice_machine_nonces (
 node_id text NOT NULL CHECK (node_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}
),
 key_id text NOT NULL CHECK (key_id ~ '^[A-Za-z0-9_-]{1,64}
),
 nonce uuid NOT NULL,
 expires_at timestamptz NOT NULL,
 PRIMARY KEY (node_id,key_id,nonce)
);
CREATE INDEX voice_machine_nonces_expiry_idx ON voice_machine_nonces(expires_at);
REVOKE ALL ON voice_machine_nonces FROM PUBLIC;
-- Remove expired rows only via a private maintenance role, with a conservative
-- grace period and bounded batches; never delete valid replay protection.

-- Exclusive WebRTC lane: dedicated destinations must stay outside the legacy
-- status='active' selector. The default control state permits no reservations.
CREATE TABLE voice_gateway_control (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 mode text NOT NULL DEFAULT 'disabled' CHECK (mode IN ('disabled','draining','enabled')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO voice_gateway_control(singleton,mode) VALUES(true,'disabled');
CREATE TABLE voice_gateway_destinations (
 destination_id bigint PRIMARY KEY REFERENCES tenant_call_destinations(id),
 node_id text NOT NULL CHECK (node_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}
),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX voice_gateway_destinations_node_idx ON voice_gateway_destinations(node_id,destination_id);
REVOKE ALL ON voice_gateway_control,voice_gateway_destinations FROM PUBLIC;

-- Bind only a new, non-legacy destination. Lock its row before committing the
-- binding. Removal or rebinding requires a reviewed migration after drain.
CREATE FUNCTION voice_gateway_bind_destination() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $
DECLARE d public.tenant_call_destinations%ROWTYPE;
BEGIN
 IF TG_OP <> 'INSERT' THEN
  RAISE EXCEPTION 'VOICE_GATEWAY_BINDING_IMMUTABLE';
 END IF;
 SELECT * INTO d FROM public.tenant_call_destinations WHERE id=NEW.destination_id FOR UPDATE;
 IF NOT FOUND OR d.status <> 'testing' OR d.active_calls <> 0 OR
    d.destination_type <> 'sip' OR d.max_concurrent_calls IS NULL THEN
  RAISE EXCEPTION 'VOICE_GATEWAY_DESTINATION_NOT_EXCLUSIVE';
 END IF;
 RETURN NEW;
END;
$;
CREATE TRIGGER voice_gateway_bind_destination_guard
 BEFORE INSERT OR UPDATE OR DELETE ON voice_gateway_destinations
 FOR EACH ROW EXECUTE FUNCTION voice_gateway_bind_destination();

-- A future legacy UI action must not accidentally activate a dedicated route.
CREATE FUNCTION voice_gateway_guard_legacy_destination() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $
BEGIN
 IF EXISTS (SELECT 1 FROM public.voice_gateway_destinations WHERE destination_id=OLD.id) AND
    (NEW.status NOT IN ('testing','disabled') OR NEW.active_calls <> 0 OR
     NEW.destination_type <> 'sip' OR NEW.max_concurrent_calls IS NULL OR
     NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR
     NEW.sva_number_id IS DISTINCT FROM OLD.sva_number_id OR
     NEW.destination_uri IS DISTINCT FROM OLD.destination_uri) THEN
  RAISE EXCEPTION 'VOICE_GATEWAY_LEGACY_ROUTE_FORBIDDEN';
 END IF;
 RETURN NEW;
END;
$;
CREATE TRIGGER voice_gateway_legacy_destination_guard
 BEFORE UPDATE ON tenant_call_destinations
 FOR EACH ROW EXECUTE FUNCTION voice_gateway_guard_legacy_destination();
COMMIT;
