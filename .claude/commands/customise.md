---
description: "Customise for the error triage desk"
---

# Customise

Read CLAUDE.md and the operator's request. Inspect the schema and relevant recipe. Add a numbered migration for a new field, stage or rule; never rewrite an applied migration. Update the CLI, relevant view or document and its recipe. Add a test that proves the requested behaviour. Run npm test in its temporary database, then apply the migration to the authorised database with npm run migrate. Show the changed result. Changes that delete data, send messages or alter a deployed application require the operator's explicit approval.
