# Move the error triage desk from Rollbar

## Export the actual history

Rollbar documents [downloading items and occurrences](https://docs.rollbar.com/docs/download-items-occurrences). Its [occurrence view](https://docs.rollbar.com/docs/viewing-rollbar-occurrence-data) offers a raw JSON view. Save that JSON for a trial import. For a full migration, your authorised Rollbar administrator uses the documented export/API to retrieve full occurrences for every required project and reporting period. The [occurrence-list endpoint](https://docs.rollbar.com/reference/get_api-1-item-item-id-instances) is paginated. Retrieve every page, then full occurrence details where a listing lacks the body. The [single-occurrence endpoint](https://docs.rollbar.com/reference/get_api-1-instance-instance-id) returns the raw occurrence representation. Do not treat one page or an item summary as a complete archive. No vendor credentials are needed by this repo.

## One import command

Create the project with add-project. Save full exported occurrences as one JSON array or load each saved file separately.

```bash
npm run triage -- import rollbar --project=SHOP --file=occurrences.json --actor="Your name" --dry-run
```

Check the received and inserted counts, test representative trace and message records, then remove --dry-run to load. Repeat files skip identical occurrences. Conflicting source IDs abort the batch. Test coverage uses synthetic fixtures based on the documented shape, not a private customer export. Validate the actual export before cancelling a service.

## Mapping

- environment goes to the issue's environment.
- UUID or occurrence ID becomes the local deduplication key.
- timestamp becomes the original occurrence time.
- code_version becomes the release label.
- level becomes severity; the issue keeps its highest observed level.
- trace exception class/message and frame filenames/methods become local grouping evidence.
- message.body becomes the error title for message events.
- fingerprint, when present, becomes the local grouping basis.

Full bodies are required. Usage CSVs, item summary counts, trace chains and native crash reports are not silently converted. Rollbar assignments, states, comments, deploys, source maps and replay recordings are outside this importer. Request data, personal records, custom fields and telemetry are deliberately excluded. Only the source file hash, not its original bytes, is retained in the database.

## Continuing capture

The free base works with locally produced occurrence files as well as saved exports. See examples/capture-error.mjs and scripts/lib/capture.mjs: call captureError from your application's existing error-handling path, then ingest its output with the CLI. The helper captures the error name and message, environment, release, timestamp and ID; it does not parse stack traces. A collector can supply documented frames. File delivery, scheduling, retries, production monitoring and operational access are installation work. Keep your existing collector until an ongoing replacement feed and recovery path have been tested. This repo has no hosted receiver, session replay, symbol server or mobile SDK.

## First-day checklist

Run the demo and tests. Import a representative export into an empty database. Reconcile project, period and event counts; inspect grouping and privacy filtering. Record deployments, assign fixes and generate the release review. Prove the new capture path delivers a controlled test error. Arrange access, retention and backup recovery. Switch only the workflows this exercise proves.

Enterprise DNA can map your exports, connect ongoing collection and operate the desk through Omni by Enterprise DNA. One setup fee, then a retainer. [Book Sam's 30-minute call](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_campaign=rollbar). Independent software, not affiliated with Rollbar.
