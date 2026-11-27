#!/usr/bin/env bash
# Full offsite backup recovery drill to a LOCAL isolated PostgreSQL database.
# Never connects to or writes to Neon. No decrypted dump is written to disk.
set -euo pipefail
umask 077

fail(){ printf 'NEON_RESTORE_DRILL_FAILED: %s\n' "$1" >&2; exit 1; }
: "${PGI_BACKUP_ARCHIVE:?PGI_BACKUP_ARCHIVE is required}"
: "${PGI_BACKUP_AGE_IDENTITY_FILE:?PGI_BACKUP_AGE_IDENTITY_FILE is required}"
: "${PGI_RESTORE_LOCAL_USER:?PGI_RESTORE_LOCAL_USER is required}"
: "${PGI_RESTORE_LOCAL_PASSWORD:?PGI_RESTORE_LOCAL_PASSWORD is required}"
: "${PGI_RESTORE_LOCAL_PORT:=5432}"

for cmd in age createdb dropdb pg_restore psql sha256sum stat; do
 command -v "$cmd" >/dev/null 2>&1 || fail "missing required tool: $cmd"
done
[[ "$PGI_RESTORE_LOCAL_USER" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]] ||
 fail "invalid local database role"
[[ "$PGI_RESTORE_LOCAL_PORT" =~ ^[1-9][0-9]{0,4}$ ]] &&
 ((PGI_RESTORE_LOCAL_PORT<=65535)) || fail "invalid local port"
[[ "$PGI_BACKUP_ARCHIVE" == /* && -f "$PGI_BACKUP_ARCHIVE" && -s "$PGI_BACKUP_ARCHIVE" && ! -L "$PGI_BACKUP_ARCHIVE" ]] ||
 fail "encrypted archive must be an existing absolute regular file"
[[ "$PGI_BACKUP_ARCHIVE" == *.dump.age ]] || fail "wrong archive extension"
[[ -f "$PGI_BACKUP_AGE_IDENTITY_FILE" && ! -L "$PGI_BACKUP_AGE_IDENTITY_FILE" ]] ||
 fail "age recovery identity unavailable or symlinked"
identity_mode="$(stat -c '%a' "$PGI_BACKUP_AGE_IDENTITY_FILE")"
[[ "$identity_mode" =~ ^[0-7]+$ && $((8#$identity_mode & 8#077)) -eq 0 ]] ||
 fail "age identity file permissions must exclude other users"

# Prevent untrusted libpq environment variables redirecting a local restore.
unset PGDATABASE PGHOSTADDR PGSERVICE PGSERVICEFILE PGOPTIONS PGREQUIRESSL
export PGHOST=127.0.0.1
export PGHOSTADDR=127.0.0.1
export PGPORT="$PGI_RESTORE_LOCAL_PORT"
export PGUSER="$PGI_RESTORE_LOCAL_USER"
export PGPASSWORD="$PGI_RESTORE_LOCAL_PASSWORD"
export PGSSLMODE=disable
unset PGI_RESTORE_LOCAL_PASSWORD

archive="$PGI_BACKUP_ARCHIVE"
archive_base="${archive##*/}"
sumfile="$archive.sha256"
[[ -f "$sumfile" && ! -L "$sumfile" ]] ||
 fail "matching SHA-256 manifest required"
read -r expected_digest expected_name < "$sumfile" ||
 fail "invalid checksum manifest"
[[ "$expected_digest" =~ ^[0-9a-f]{64}$ && "$expected_name" == "$archive_base" ]] ||
 fail "checksum manifest does not match archive"
(cd "${archive%/*}" && sha256sum --check --status "$archive_base.sha256") ||
 fail "checksum verification failed"

name="pgi_restore_drill_$(date -u +%Y%m%d%H%M%S)_${RANDOM}_${RANDOM}"
[[ "$name" =~ ^[a-z0-9_]+$ ]] || fail "invalid temporary database name"
created=false
cleanup(){
 if [[ "$created" == true ]]; then
  dropdb --if-exists --host=127.0.0.1 --port="$PGPORT" --username="$PGUSER" "$name" >/dev/null 2>&1 || :
 fi
}
trap cleanup EXIT
if ! createdb --host=127.0.0.1 --port="$PGPORT" --username="$PGUSER" "$name" >/dev/null 2>&1; then
 fail "unable to create isolated local database"
fi
created=true

# Never persist plaintext. Suppress restore diagnostics that may contain PII.
if ! (age -d -i "$PGI_BACKUP_AGE_IDENTITY_FILE" "$archive" 2>/dev/null |
       pg_restore --exit-on-error --single-transaction --no-owner --no-acl \
         --host=127.0.0.1 --port="$PGPORT" --username="$PGUSER" \
         --dbname="$name" >/dev/null 2>/dev/null); then
 fail "encrypted archive could not be fully restored to isolated database"
fi

# Confirm core application tables without printing any customer data.
schema_ok="$(psql --no-psqlrc --host=127.0.0.1 --port="$PGPORT" \
 --username="$PGUSER" --dbname="$name" --no-align --tuples-only \
 --set ON_ERROR_STOP=1 --command \
 "SELECT (to_regclass('public.calls') IS NOT NULL AND
          to_regclass('public.experts') IS NOT NULL AND
          to_regclass('public.outbox_events') IS NOT NULL)::text;" 2>/dev/null)" ||
 fail "isolated schema verification failed"
[[ "$schema_ok" == t || "$schema_ok" == true ]] ||
 fail "required core tables are missing"

printf 'NEON_RESTORE_DRILL: isolated restore and schema verified; no Neon write\n'
printf 'NEON_RESTORE_DRILL: temporary local database removed on exit\n'
