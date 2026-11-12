---
description: "Import for the error triage desk"
---

# import

Bring saved Rollbar occurrence JSON into the local database after a dry run.

Run:

```bash
npm run triage -- import rollbar --project=SHOP --file=occurrences.json --actor="Your name" --dry-run
```

Read docs/cli.md for arguments. Replace examples with the operator's actual facts and dates. Read the issue and its history before changing its state. Never invent an actor, owner, source or evidence. If a name is ambiguous, show the candidates and ask for the identifier. Imports must be checked with --dry-run first, then run without that flag when the mapping and scope are correct. Report captured counts as captured counts, never as the application's complete error rate. Drafts remain local and nothing sends from this system.
