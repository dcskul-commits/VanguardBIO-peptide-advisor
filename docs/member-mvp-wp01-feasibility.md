# VanguardBio-You Membership MVP — WP01 Feasibility & Release Gates

Status: planning and design only. No Airo, database, Render or production deployment changes.

## Confirmed on 2026-10-26

- The connected GitHub repository is the Node.js Render research API, not the GoDaddy Airo frontend application.
- This repository contains `server.js`, `package.json`, and research-safety modules.
- `src/pages/chat/index.tsx` and `src/pages/index.tsx` are not present in this repository.
- The Airo database UI currently shows zero tables, per owner inspection.
- VanguardBio-You has no implemented member registration, authentication, or member accounts, per owner.
- The existing six-question chat and PDF must remain publicly usable without registration.
- Registration eligibility is consumer and professional; professional role is self-declared, not verified.
- First deployment is restricted to invited testers; rollout will be gated.
- Analytics should be first-party, consent-aware, privacy-minimized and independent from research content.

## Required Airo read-only checks (blocking)

1. Confirm actual Airo frontend runtime, routes and server-side execution capabilities.
2. Obtain a redacted directory/file-name list for the Airo project, including any API/server folders; do not copy secrets or customer data.
3. Confirm which Airo preview/staging workflow is isolated from the production site and whether database changes in preview affect production.
4. Confirm whether an identity provider can issue server-verifiable sessions to protected Airo routes, or whether member APIs require separately hosted backend.
5. Verify how environment variables and callback URLs are configured and how deployments can be rolled back.
6. Confirm Airo database data-access authorization and backup/restore facilities.
7. Decide whether storage of potentially health-related saved reports in Airo is contractually/legally appropriate before provisioning tables.
8. Review the deployed chat frontend PDF generation and capture of the final *completed* reply; keep the existing Render /api/chat contract unchanged.

## Architecture decision (provisional)

- Identity: vetted managed authentication with email verification, secure sessions, admin MFA, invitation controls and deletion workflows; provider not selected.
- Member portal: Airo frontend, using protected server endpoints.
- App data: member_profiles, saved_reports metadata, consent_records, pilot_invitations, security audit and data requests; authentication provider owns credentials and session store.
- Saved report bodies: encrypted, access-controlled private storage and explicit opt-in only; do not automatically save six-question transcripts.
- Analytics: separate allowlisted metadata pipeline, isolated from identity and report content.
- Science: existing Render research backend unchanged; report saving is separate and authenticated.
- Role: declaration cannot set professional verification or administrative authorization.

## Implementation and approval gates

### WP01: Feasibility and threat model
Deliver verified Airo runtime map, identity-provider decision matrix, storage/processing assessment, staging and rollback plan, and a reviewed threat model. No user data, credentials, code or production changes.

### WP02: Staging authentication foundation
Implement invite-only registration, email verification, login, logout, recovery, session revocation and profile access in **isolated staging only**. Fail closed on all protected routes. Public /chat unaffected. Release gate: security/privacy review and synthetic-user tests.

### WP03: Saved research library
Implement opt-in saving of completed report, protected owner-only listing/retrieval/deletion, PDF export and export/deletion workflows. Do not modify existing /api/chat. Release gate: cross-account access tests, secure storage, deletion/backup lifecycle, no raw transcript by default.

### WP04: Privacy-minimized analytics
Instrument consented frontend interaction events via allowlisted ingestion. No raw chat/report/clinical details, no ads pixels, no member email in events. Analytics outages must not break chat or PDF. Release gate: consent/withdrawal, schema, retention and reconciliation tests.

### WP05: Invitation-only pilot
Run synthetic test cases, then invited user research and accessibility tests. Audit scientific reports and regulatory claims independently. No open signup or commerce launch. Release gate: documented sign-off and rollback rehearsal.

### WP06: Adaptive interaction (separate approval)
Analyze pilot data before building audience-aware intakes and report-depth variants.

## Baseline invariant tests (all phases)

1. Anonymous six-question intake completes with report and PDF.
2. Existing PubMed/ClinicalTrials/Europe PMC evidence and FDA/WADA guardrails remain.
3. No unverified professional role is treated as a credential.
4. No cross-member access to reports or preferences.
5. No analytics collection before necessary permission, and no raw conversation in telemetry.
6. Analytics/auth outages do not change existing public chat behavior.
7. No production changes without explicit release approval.

## Open blockers

Airo source/runtime read-only inspection; auth provider compatibility; staging isolation; data hosting/privacy assessment; secure storage choice; whether pilot can be limited to invitation-only without exposing protected APIs.

Do not deploy a membership implementation from this document alone.
