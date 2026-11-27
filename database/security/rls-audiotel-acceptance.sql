-- Audiotel Premium Pro: isolated acceptance prototype, NOT an automatic migration.
-- Execute only on an isolated CI database with synthetic data.
-- Do not apply to a live database or grant the runtime owner membership.
BEGIN;
DO $$
BEGIN
 IF current_setting('pgi.isolated_rls_test',true) IS DISTINCT FROM 'approved'
 THEN RAISE EXCEPTION 'Isolated security acceptance only'; END IF;
END $$;
CREATE ROLE pgi_app_rls_fixture_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE SCHEMA pgi_app_rls_fixture;
REVOKE ALL ON SCHEMA pgi_app_rls_fixture FROM PUBLIC;
CREATE TABLE pgi_app_rls_fixture.payments (
 id bigint PRIMARY KEY, tenant_id bigint NOT NULL, amount_minor bigint NOT NULL CHECK(amount_minor>0)
);
INSERT INTO pgi_app_rls_fixture.payments VALUES (1,101,490),(2,202,990);
GRANT USAGE ON SCHEMA pgi_app_rls_fixture TO pgi_app_rls_fixture_reader;
GRANT SELECT ON pgi_app_rls_fixture.payments TO pgi_app_rls_fixture_reader;
ALTER TABLE pgi_app_rls_fixture.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pgi_app_rls_fixture.payments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read_only ON pgi_app_rls_fixture.payments FOR SELECT TO pgi_app_rls_fixture_reader
 USING(tenant_id = NULLIF(current_setting('pgi.tenant_id',true),'')::bigint);
SET LOCAL ROLE pgi_app_rls_fixture_reader;
DO $$
BEGIN
 IF current_user <> 'pgi_app_rls_fixture_reader' OR
    EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolbypassrls OR rolsuper))
 THEN RAISE EXCEPTION 'Reader role not isolated'; END IF;
 IF (SELECT count(*) FROM pgi_app_rls_fixture.payments) <> 0
 THEN RAISE EXCEPTION 'Missing tenant context must deny all rows'; END IF;
 PERFORM set_config('pgi.tenant_id','101',true);
 IF (SELECT array_agg(id) FROM pgi_app_rls_fixture.payments) IS DISTINCT FROM ARRAY[1::bigint]
 THEN RAISE EXCEPTION 'Tenant A isolation failed'; END IF;
 IF EXISTS(SELECT 1 FROM pgi_app_rls_fixture.payments WHERE id=2)
 THEN RAISE EXCEPTION 'Cross-tenant lookup disclosed data'; END IF;
 BEGIN
   UPDATE pgi_app_rls_fixture.payments SET amount_minor=1 WHERE id=1;
   RAISE EXCEPTION 'Read-only role unexpectedly wrote data';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('pgi.tenant_id','202',true);
 IF (SELECT array_agg(id) FROM pgi_app_rls_fixture.payments) IS DISTINCT FROM ARRAY[2::bigint]
 THEN RAISE EXCEPTION 'Tenant B isolation failed'; END IF;
 PERFORM set_config('pgi.tenant_id','',true);
 IF (SELECT count(*) FROM pgi_app_rls_fixture.payments) <> 0
 THEN RAISE EXCEPTION 'Reset context must deny all rows'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
