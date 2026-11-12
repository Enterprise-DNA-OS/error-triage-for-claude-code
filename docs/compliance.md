# Record checks and their limits

Checked 12 November 2026. These are record controls for application fault handling. They do not certify security, privacy compliance, clinical safety or financial correctness.

- P05: missing or overdue access-review date. The NZ Privacy Commissioner's [Principle 5](https://www.privacy.org.nz/privacy-principles/5/) requires reasonable safeguards for personal information. A date records a review commitment; the software cannot prove that the safeguards exist.
- P09: missing processing purpose or overdue retention review. [Principle 9](https://www.privacy.org.nz/privacy-principles/9/) limits retention to the period needed for a lawful purpose.
- P09-RET: events older than the project's chosen retention period. Thirty days is a demo house rule, not a statutory period. The command flags records for review and authorised disposal; it does not delete them. A database administrator must arrange deletion, archive handling and backup expiry after the operator authorises the policy. Append-only triggers must be handled in that controlled maintenance process.
- T01: active issue without an owner. T02: missed fix due date. T03: no captured event in the last day. These are house rules. No events means collection is unknown, not that the app is healthy.

Run npm run triage -- compliance. Review the evidence, then use review-privacy to record the actual purpose and dates. Event intake keeps a small field allowlist and scrubs common patterns. Review error messages and filenames before capture because free text can contain personal data. The local capture helper initially writes the exception message to a private file; arrange removal of source files as well as database retention. Never put passwords, payment data or patient records in exceptions.

Database controls prevent ordinary updates to occurrences, notes, release evidence and audit history. Administrators can change these controls. Audit actor values are operator-supplied labels, not verified identities. For shared use, set database roles, host access, encryption, backups and recovery checks with the responsible operator. The demo does not provide an authentication service.

For Australian records, the operator must assess applicable Australian obligations before deployment. No claim of Australian compliance follows from these NZ record prompts.
