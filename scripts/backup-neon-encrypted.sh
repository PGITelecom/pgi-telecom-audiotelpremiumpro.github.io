#!/usr/bin/env bash
# Export a Neon PostgreSQL database to a compressed, age-encrypted external file.
# No changes to PostgreSQL, Vercel, Neon branch metadata, or payment systems.
set -euo pipefail
umask 077

fail() { printf 'NEON_BACKUP_FAILED: %s\n' "$1" >&2; exit 1; }
: "${PGI_NEON_DATABASE_URL:?PGI_NEON_DATABASE_URL is required}"
: "${PGI_BACKUP_AGE_RECIPIENT:?PGI_BACKUP_AGE_RECIPIENT is required}"
: "${PGI_BACKUP_AGE_IDENTITY_FILE:?PGI_BACKUP_AGE_IDENTITY_FILE is required}"
: "${PGI_BACKUP_OUTDIR:?PGI_BACKUP_OUTDIR is required}"

for cmd in pg_dump pg_restore age sha256sum mktemp realpath stat; do
  command -v "$cmd" >/dev/null 2>&1 || fail "required tool unavailable: $cmd"
done
[[ "$PGI_BACKUP_AGE_RECIPIENT" =~ ^age1[0-9a-z]{20,120}$ ]] ||
  fail "age recipient must be an age1... public key"
[[ -f "$PGI_BACKUP_AGE_IDENTITY_FILE" && ! -L "$PGI_BACKUP_AGE_IDENTITY_FILE" ]] ||
  fail "age private identity file unavailable or symlinked"
identity_mode="$(stat -c '%a' "$PGI_BACKUP_AGE_IDENTITY_FILE")"
[[ "$identity_mode" =~ ^[0-7]+$ && $((8#$identity_mode & 8#077)) -eq 0 ]] ||
  fail "age private identity file must not be readable by group or other"
[[ "$PGI_BACKUP_OUTDIR" == /* ]] || fail "backup destination must be an absolute path"
mkdir -p -- "$PGI_BACKUP_OUTDIR"
[[ -d "$PGI_BACKUP_OUTDIR" && ! -L "$PGI_BACKUP_OUTDIR" ]] ||
  fail "backup destination must be a real directory"
outdir="$(realpath "$PGI_BACKUP_OUTDIR")"
repo_root="$(pwd -P)"
case "$outdir/" in "$repo_root/"*) fail "destination must be outside this repository";; esac
[[ -w "$outdir" ]] || fail "backup destination is not writable"

# Ignore potentially unsafe SSL settings embedded in a caller-supplied URL.
# Explicit verify-full is required for TLS authentication.
[[ "$PGI_NEON_DATABASE_URL" == postgresql://* || "$PGI_NEON_DATABASE_URL" == postgres://* ]] ||
  fail "PostgreSQL connection URI required"
case "$PGI_NEON_DATABASE_URL" in
  *"sslmode=disable"*|*"sslmode=allow"*|*"sslmode=prefer"*|*"sslmode=require"*|*"sslmode=verify-ca"*)
    fail "connection URI must use sslmode=verify-full (not a weaker value)" ;;
esac
export PGSSLMODE=verify-full
export PGDATABASE="$PGI_NEON_DATABASE_URL"
unset PGI_NEON_DATABASE_URL
# Prevent any command-line argument from disclosing the database password.

tmpdir="$(mktemp -d "$outdir/.audiotel-neon-XXXXXX")"
cleanup() { rm -rf -- "$tmpdir"; }
trap cleanup EXIT
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
nonce="${tmpdir##*/}"
base="audiotel-neon-${stamp}-${nonce#.audiotel-neon-}.dump.age"
partial="$tmpdir/$base"
# Custom format is compressed by pg_dump itself: do not gzip it again.
# Error streams are withheld to avoid leaking accidental connection details.
if ! (pg_dump --format=custom --compress=6 --no-owner --no-acl 2>"$tmpdir/dump.log" |
       age -r "$PGI_BACKUP_AGE_RECIPIENT" -o "$partial" 2>"$tmpdir/encrypt.log"); then
  fail "encrypted PostgreSQL export failed; no usable archive published"
fi
[[ -s "$partial" ]] || fail "encrypted export is empty"
# Verify that the private recovery identity can decrypt and pg_restore can
# parse the backup. A full isolated restore is still required before release.
if ! (age -d -i "$PGI_BACKUP_AGE_IDENTITY_FILE" "$partial" |
       pg_restore --list > /dev/null 2>"$tmpdir/restore.log"); then
  fail "archive decryption or PostgreSQL archive validation failed"
fi

hash="$(sha256sum "$partial")"
hash="${hash%% *}"
[[ "$hash" =~ ^[0-9a-f]{64}$ ]] || fail "encrypted checksum invalid"
printf '%s  %s\n' "$hash" "$base" > "$tmpdir/$base.sha256"
[[ ! -e "$outdir/$base" && ! -e "$outdir/$base.sha256" ]] ||
  fail "backup filename collision"
mv -- "$partial" "$outdir/$base"
mv -- "$tmpdir/$base.sha256" "$outdir/$base.sha256"
(cd "$outdir" && sha256sum --check --status "$base.sha256") ||
  fail "encrypted archive checksum mismatch"

printf 'NEON_BACKUP_ENCRYPTED_ARCHIVE_CREATED: %s\n' "$base"
printf 'NEON_BACKUP_VALIDATION: decrypt_and_pg_restore_list_passed; full_restore_not_tested\n'
printf 'NEON_BACKUP_RETENTION: no files deleted; copy to independent restricted storage\n'
