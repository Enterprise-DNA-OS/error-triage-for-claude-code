# Error Triage for Claude Code

Own the daily error triage desk: captured exceptions, release evidence, fix ownership and recurrence checks in one database. MIT-licensed software by Enterprise DNA. Works with Claude Code, Codex, OpenCode or Cursor.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free source. Install, import and run the daily triage. | Your grouping rules, error sources and release papers. [Get your version built](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_campaign=rollbar). | Installed, connected and operated through Omni by Enterprise DNA. One setup fee, then a retainer. [Book a call](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_campaign=rollbar). |

## What it replaces

The error review and follow-up workflow around an application: bring in occurrences, group them, assign responsibility, record a fix and see whether it recurs. [Rollbar's published pricing](https://rollbar.com/pricing-for-agents) lists Advanced at US$1,749 a month for five million monthly occurrences, or US$20,988 for twelve monthly payments. Annual billing has a separate discount. Checked 12 November 2026. This is a published tier example, not a customer invoice or a throughput claim for this repo. Rollbar also has much smaller plans and includes unlimited users.

The base is an independent triage system with local file intake. It does not replace Rollbar's hosted collection fleet, session replay, SDK coverage, source maps or service guarantees. Keep an ongoing collector, or have Enterprise DNA build and operate your own collection path. No claim is made that Rollbar cannot answer the same questions or accept custom fields.

## Quick start

Node 22.15 or newer. The local demo needs no account or service.

```bash
git clone https://github.com/Enterprise-DNA-OS/error-triage-for-claude-code.git
cd error-triage-for-claude-code
npm install
npm test
npm run demo
npm run triage -- morning-triage
npm run triage -- regressions
npm run triage -- overdue
npm run view
npm run docs
```

The fictional Harbour demo includes a late critical fix, a post-fix recurrence, an unowned warning, an old retained event and a project with no fresh capture. Re-running seed is idempotent. Do not seed production. Shared database seeding requires --demo-database.

Without DATABASE_URL the database is PGlite under .data/db or DATA_DIR. With DATABASE_URL it uses Postgres and the same migration. Run npm run migrate for an empty operational database. Public privileges are revoked and row security is enabled; use a trusted operator and provision shared roles, host protection and recovery before production. Actor names are audit labels, not logins.

## Weekly rituals

- /morning-triage: rank active faults and show ownership and volume.
- /release-review: inspect errors tagged with each release.
- /regressions: find occurrences after a recorded resolution.
- /overdue: follow up on named fix commitments.
- /weekly-review: write the engineering review from those records and compliance checks.

35 recipes ship in .claude/commands, including /customise and /new-view. The CLI exposes 33 commands including help. [Complete syntax](docs/cli.md). Every command supports --json. Exact IDs, unique prefixes and case-insensitive names work; ambiguity lists candidates and exits 1.

## Ten questions to ask

These combine captured events with your own commitments and evidence. They are implemented today, not an assertion that the incumbent lacks a comparable feature.

1. Which urgent faults have no owner? `unowned`
2. Which promised fixes are already late? `overdue`
3. Which failures returned after their recorded fix? `regressions`
4. Which release has captured errors on issues still active? `release-review`
5. Which release labels arrived without a deployment record? `release-gaps`
6. Which owner has the most overdue fix commitments? `workload`
7. Which old faults are still active despite a quiet week? `quiet-issues`
8. Which recurring warnings consume the most captured events? `noise-review`
9. What exact evidence supported the last fix? `fix-evidence`
10. Which projects need an access or retention review? `compliance`

## Your first hour: ten things to ask for

1. Put our name, logo and colours in brand.json.
2. Show the fictional morning triage.
3. Read the evidence behind the recurring invoice fault.
4. Generate the fix brief and release review paper.
5. Add our application project and its accountable owner.
6. Test a saved Rollbar occurrence export without writing.
7. Reconcile its source count, retained fields and grouping.
8. Record our actual release and assign a fix due date.
9. Capture a controlled local test error and ingest it.
10. Add our own review field through /customise and prove backup recovery.

## Data and evidence

[Switching guide](docs/replace-rollbar.md). Import full occurrence JSON with one command. Dry runs roll back all writes. Duplicate events skip, conflicting IDs abort, and malformed records stop the entire batch. Source file hashes and row counts remain alongside sanitised event fields. Original files are not copied into the database. Request details, people, telemetry and custom payloads are excluded. Review free text before capture; pattern scrubbing is not complete privacy detection.

Grouping is local and deterministic. Historical events cannot reopen a fix unless their actual occurrence time is after the resolution. Ignored issues remain ignored until the operator changes them. Missing or delayed events mean coverage is unknown. Reports count captured events, never application-wide failure rates.

## Papers and views

Change brand.json once. npm run docs creates one investigation brief per issue and one release review per recorded release. npm run view creates the weekly read-only dashboard. /weekly-review and /draft-fix-brief write private HTML drafts. All data is escaped. [Why no front end](docs/why-no-front-end.md).

## Record checks

[Compliance sources](docs/compliance.md) maps access and retention prompts to NZ privacy principles and separates them from house rules. It flags overdue reviews, old records, unowned errors and missing capture. Passing means the listed record checks passed; it does not certify legal compliance or production health. Retention deletion is a separate authorised administration task.

Occurrence, note, release and audit records are append-only for normal operations. Database administrators can alter those controls. Export contains seven record collections for inspection, not automatic restore. Operational use requires actual backups and tested recovery.

## Validation

npm test creates a temporary database, clears inherited production configuration and exercises every CLI command. It checks parsing, identifier ambiguity, rollback, duplicate/conflicting IDs, historical imports, post-fix recurrence, environment separation, privacy filtering, immutable evidence, document output and HTML escaping. CI runs Node 22 and 24 on Linux and Windows and PostgreSQL 16. TRIAGE_TEST_POSTGRES_URL must name an empty disposable test database. High-volume collection has not been benchmarked.

Independent software, not affiliated with Rollbar. MIT. Copyright 2026 Enterprise DNA.
