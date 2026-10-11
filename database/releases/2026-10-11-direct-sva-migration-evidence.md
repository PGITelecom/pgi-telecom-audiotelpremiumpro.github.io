# PGI Telecom Distribution: migration 076–085, production evidence

Date: 2026-10-11 (Europe/Paris)

## Result
- Neon production project: `silent-waterfall-98567339`, primary branch `main`.
- Existing production versions 072–075 verified with matching checksums before execution.
- New versions 076–085 applied atomically using `run_sql_transaction` with 81 parser-safe SQL statements.
- Source: `database/releases/2026-10-11-direct-sva-076-085-operator-only.sql`.
- Post-execution: versions 072–085 all present (14 distinct versions, 14 checksums).
- Existing Audiotel Premium Pro business unit, brand, cost centre `APP`, and analytics namespace `audiotel` retained.
- Direct Distribution business unit `PGI Telecom Distribution` in lifecycle status `preparation`, separate cost centre `DSVA`.
- Four database CHECK guards independently verified: commercial operations, payout activation, number activation, and commercial website actions locked off.
- Distribution customer accounts, number assignments, journal entries, and automation jobs: 0.
- Legacy counts remained 1 tenant, 0 calls, 0 SVA numbers during intervention.
- Backup branch preserved: `backup-prod-before-076-085-2026-10-11`, from production immediately before migration. Neon snapshot quota prevented a new snapshot; the separate branch is the fallback.
- Vercel production deployment untouched, last observed deployment `dpl_2dtQwVaGGE7sgAgFhE72ZigycT34`, ref `main`.
- Recent Vercel production logs: no error/fatal events found in the queried one-hour window. This is not a substitute for full end-to-end service validation.

## Publication decision
No change to the public deployment, production routes, billing or customer-facing navigation was authorized or executed by this migration. The code release must follow its own deployment approval and operational readiness checks.

## Execution note
The Neon single-query and automatic migration preparation connectors did not accept multiple commands inside one prepared statement, including PL/pgSQL dollar-quoted bodies. To avoid partial execution, the approved 39 KB SQL bundle was lexed on SQL statement boundaries (respecting quoted strings, dollar-quoted functions, and comments), then sent in one database transaction. The production transaction committed and a separate read-back verified all results.
