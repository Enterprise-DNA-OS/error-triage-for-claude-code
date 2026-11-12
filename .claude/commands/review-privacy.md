# review-privacy

Record the purpose, access review, retention period and next review dates.

Run:

```bash
npm run triage -- review-privacy --project=SHOP --purpose="Fault investigation" --days=30 --access-due=2026-12-12 --privacy-due=2026-12-12 --evidence="Roles and retention checked" --actor="Your name"
```

Read docs/cli.md for arguments. Replace examples with the operator's actual facts and dates. Read the issue and its history before changing its state. Never invent an actor, owner, source or evidence. If a name is ambiguous, show the candidates and ask for the identifier. Imports must be checked with --dry-run first, then run without that flag when the mapping and scope are correct. Report captured counts as captured counts, never as the application's complete error rate. Drafts remain local and nothing sends from this system.
