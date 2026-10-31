# WP08-B — Staging Saved Reports Implementation and Acceptance
Date: 2026-10-31
State: Staging database migration completed; staging-only API enabled. Airo preview not yet integrated; no public/production release.

## User-approved policy
- Saving a report requires explicit user action (`explicitSave: true`); no default auto-save of conversations.
- Verified free members can store, list, retrieve, and delete their own reports.
- Reports remain until explicitly deleted or the member account is removed; backup-specific retention/deletion schedule requires production review.
- No paid entitlement is implied.
- Testing uses synthetic report bodies only.

## Deployed staging-only implementation
- Existing Render staging service: `srv-dbib14gm7kps73cd1440`, branch `wp04-g3-output-safety-20261030`.
- Existing isolated PostgreSQL database: `dpg-dbihntl9fdbs73dmumrg-a`, database `vanguardbio_membership_staging`.
- Migration: `WP08_STAGING_SCHEMA {"status":"initialized"}` confirmed in Render deploy `dep-dbj658ss728c738udcj0`. FK `owner_id` references auth `user.id`, with ON DELETE CASCADE.
- Migration trigger explicitly reset: `WP08_APPLY_SCHEMA=disabled`.
- Staging feature flag explicitly enabled: `WP08_SAVED_REPORTS_ENABLED=true`.
- Active staging deployment: `dep-dbj65qetlv9c73cbciu0`, commit `7b2cc160d4ec3f319dd1f450ff59b7e8025b5b6e`.
- **No Airo frontend integration**, no new paid DB, and no changes to production.

## Staging API contract
All paths are under the existing Render staging origin, protected by Better Auth session and verified email, with exact trusted-origin controls:
- `POST /api/member/reports` with JSON `{ "title": "...", "body": "...", "explicitSave": true }` creates a report, returning metadata only (201).
- `GET /api/member/reports` lists the current owner's report metadata without bodies (200).
- `GET /api/member/reports/:uuid` retrieves the owner's report (200), or 404 for an unknown/non-owned ID.
- `DELETE /api/member/reports/:uuid` permanently deletes the current owner's report (204), or returns 404 otherwise.
- Anonymous or unverified users cannot access; client-supplied owner identity fields rejected. Limits: title 120 characters, body 40,000 characters, 45,000-byte HTTP request, 30 reports max per list response.
- This feature is currently a staging API only; it has not been exposed through Airo's same-origin preview proxy, and the live staging API has not yet been exercised with a real authenticated browser session.

## Verification
- Isolated disposable PostgreSQL with two synthetic users: **18/18 integration checks passed**; no test report remained after cleanup. GitHub workflow: https://github.com/dcskul-commits/VanguardBIO-peptide-advisor/actions/runs/41245304427
- Existing branch validation: GitHub build/test job previously passed, and prior WP06 staging auth smoke tests continued to pass.
- Live staging negative access smoke **7/7 passed** after second deploy completed. A first smoke attempt during the rollout hit the old inactive configuration and received 404; rerun on live deployment passed: https://github.com/dcskul-commits/VanguardBIO-peptide-advisor/actions/runs/41245569263
- Production Render deployment remains live at the unchanged SHA `e42329c683548152ccae2cd89a3ebded6d3a562e`.

## Outstanding gates
1. Read-only review of current Airo preview proxy and frontend source; design exact allowlisted report API operations.
2. Separate approval for Airo preview-only changes (new report save/list/view/delete UI), preserve six-question chat, existing PDF, public pages and navy/gold branding.
3. Safari preview authenticated create/read/delete acceptance with synthetic content; confirm cross-member isolation from a second staging account, no unwanted analytics capture.
4. Formal retention policy for backups, data export/erasure, consent notices and account deletion before production approval.
5. Dedicated release plan, rollback, security/privacy review and explicit production/publish authorization.
