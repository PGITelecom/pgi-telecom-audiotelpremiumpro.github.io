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
COMMIT;
