# CLI reference

One entry: npm run triage -- <command>. All commands accept --json. Flags use --name=value. Unknown, repeated flags and extra positional arguments are rejected. Writes require a named --actor; this is an audit label, not authentication. Exact IDs, unique ID prefixes, case-insensitive project codes and unique partial titles resolve records. Ambiguity lists candidates and exits 1. Read commands exit 0 even when the record checks find work to do.

## projects

projects

```bash
npm run triage -- projects
```

## morning-triage

Start the daily error triage: severity, ownership, captured volume and commitments.

```bash
npm run triage -- morning-triage
```

## issues

issues

```bash
npm run triage -- issues
```

## unowned

Assign responsibility for active errors with no owner.

```bash
npm run triage -- unowned
```

## overdue

Find fix commitments whose due dates have passed.

```bash
npm run triage -- overdue
```

## regressions

Check failures captured after a recorded fix.

```bash
npm run triage -- regressions
```

## quiet-issues

quiet issues

```bash
npm run triage -- quiet-issues
```

## release-review

Review the events tagged with each recorded release.

```bash
npm run triage -- release-review
```

## release-gaps

release gaps

```bash
npm run triage -- release-gaps
```

## workload

workload

```bash
npm run triage -- workload
```

## environment-review

environment review

```bash
npm run triage -- environment-review
```

## noise-review

noise review

```bash
npm run triage -- noise-review
```

## fix-evidence

fix evidence

```bash
npm run triage -- fix-evidence
```

## compliance

Review access, retention, ownership and collection gaps. A passing record check is not legal certification.

```bash
npm run triage -- compliance
```

## retention

retention

```bash
npm run triage -- retention
```

## imports

imports

```bash
npm run triage -- imports
```

## audit

audit

```bash
npm run triage -- audit
```

## help

help

```bash
npm run triage -- help
```

## issue

issue

```bash
npm run triage -- issue "<issue title or id>"
```

## history

history

```bash
npm run triage -- history "<issue title or id>"
```

## add-project

add project

```bash
npm run triage -- add-project --code=SHOP --name="Shop application" --owner="Release manager" --actor="Your name"
```

## import

Bring saved Rollbar occurrence JSON into the local database after a dry run.

```bash
npm run triage -- import rollbar --project=SHOP --file=occurrences.json --actor="Your name" --dry-run
```

## ingest

Load locally captured occurrence JSON into the same triage workflow.

```bash
npm run triage -- ingest --project=SHOP --file=captured-event.json --actor="Your name" --dry-run
```

## assign

assign

```bash
npm run triage -- assign --issue="<id>" --owner="Fix owner" --due=2026-12-01 --actor="Your name"
```

## resolve

Record verification evidence against a known release. Only active issues can be resolved.

```bash
npm run triage -- resolve --issue="<id>" --release=2.4.1 --evidence="Regression test and verification reference" --actor="Your name"
```

## reopen

Return a resolved or ignored issue to the active queue with a reason.

```bash
npm run triage -- reopen --issue="<id>" --reason="Further investigation" --actor="Your name"
```

## ignore

Set aside an issue with a named reason. Captured events continue to accumulate.

```bash
npm run triage -- ignore --issue="<id>" --reason="Known synthetic event" --actor="Your name"
```

## log

log

```bash
npm run triage -- log --issue="<id>" --body="Investigation evidence" --actor="Your name"
```

## add-release

add release

```bash
npm run triage -- add-release --project=SHOP --environment=production --version=2.4.1 --deployed=2026-11-12T08:00:00Z --evidence="Deployment record" --actor="Your name"
```

## review-privacy

Record the purpose, access review, retention period and next review dates.

```bash
npm run triage -- review-privacy --project=SHOP --purpose="Fault investigation" --days=30 --access-due=2026-12-12 --privacy-due=2026-12-12 --evidence="Roles and retention checked" --actor="Your name"
```

## weekly-review

Prepare the weekly engineering review from the triage queue, recurrences, overdue work, release results and record checks.

```bash
npm run triage -- weekly-review
```

## draft-fix-brief

Prepare a branded investigation paper with the issue and its notes.

```bash
npm run triage -- draft-fix-brief "<id>"
```

## export

export

```bash
npm run triage -- export --out=./exports/dated-archive
```

## Import and intake

A file can contain one raw occurrence, a data wrapper, a successful Rollbar response with result, an array of these, or an instances/occurrences array. Only complete trace or message bodies are supported. The occurrence needs environment and timestamp; missing dates are never filled with today's date. Timestamp is Unix seconds or ISO with timezone. Trace chains and native crash_report bodies require explicit conversion. Item summaries and usage CSVs are not occurrence history. Batches are limited to 10 MB and 10,000 events.

A source occurrence ID or UUID is unique within a project. An identical repeat skips; a reused ID with changed retained fields aborts the entire batch. If no ID exists, a hash of retained event content is the identity: indistinguishable events collapse. Preserve IDs for accurate counts. File hashes, filenames, actor, received count and inserted count are recorded per import. Only retained fields are saved. Request, person, custom, telemetry, locals, source context and access tokens are excluded; the original file remains the operator's responsibility. Common email and token patterns are scrubbed from messages and filenames. This is not a guarantee that free text contains no personal data.

Grouping is project plus environment plus an explicit fingerprint, or a hash of scrubbed title and frame filenames/methods. Line numbers are excluded from grouping. It is a local grouping rule, not Rollbar's grouping engine. Import does not copy Rollbar issue states, assignments, comments, deploys, custom grouping rules, sourcemaps or session replays.

## Resolution and recurrence

A fix requires a recorded release in the same project and environment, plus evidence. New events occurring after the last resolution reopen a resolved issue and increment its recurrence count once per reopening. Late imports of older events do not reopen it. Ignored issues stay ignored until explicitly reopened. Severity is the highest observed level. Review future clock skew, missing feeds and grouping before drawing conclusions.

## Outputs and backups

Drafts use unique names under drafts/. npm run view renders views/. npm run docs renders fix briefs and release reviews under docs-out/. OUTPUT_DIR relocates generated HTML, which tests use. Export writes seven collections in archive.json to a new private directory and refuses an existing path. This is an inspection archive, not a restore command. Back up the actual database and prove recovery before production use. No command sends email, calls Rollbar, changes application code or deletes records.
