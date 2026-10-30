# WP06-C2 Staging membership foundation (unactivated)

**State:** Staging-only development branch. No database provisioned, no credentials deployed, no Airo modification, and no production changes.

## Architecture
- Existing Render staging Node HTTP service; existing research chat handler unchanged.
- Better Auth + `pg` direct PostgreSQL adapter, loaded only after explicit opt-in.
- Auth route: `/api/auth/*` (separate from existing research chat).
- One independent staging Postgres required; do not use Airo managed MySQL.
- Exact Airo preview origin; unknown and production-origin mutation blocked.
- Verified email and password reset via Resend; no email delivery configured yet.
- Cross-site cookies for preview only. Before production: adopt same-site custom auth host and separate session/cookie configuration.

## Required staging-only env vars (DO NOT set until approved)
`MEMBERSHIP_ENABLED=true`
`MEMBERSHIP_ENV=staging`
`MEMBERSHIP_DATABASE_ROLE=staging`
`MEMBERSHIP_PREVIEW_ORIGIN=https://g2uectlusc.preview.c37.airoapp.ai`
`BETTER_AUTH_URL=https://vanguardbio-peptide-advisor-staging.onrender.com`
`DATABASE_URL=postgresql://...` (must be independently verified as staging)
`BETTER_AUTH_SECRET=...` (>=32 random chars, staging only)
`RESEND_API_KEY=...`
`MEMBERSHIP_EMAIL_FROM=...` (verified sender domain)

## Approval gates
1. Confirm exact paid PostgreSQL compute + storage estimate and obtain **separate spending authorization**. Do not create chargeable resources before this.
2. Provision staging DB with its own credentials and confirm its instance ID/hostname is NOT production's. Inspect actual connection target before migrations.
3. Configure staging-only secret values without logging them.
4. Verify email provider sender domain and budget. Confirm no production domains/users involved.
5. Generate, review and apply Better Auth schema to **staging DB only**; never auto-migrate on server startup.
6. Test verified email, login/logout, password reset, sessions, CSRF/CORS, and owner-scoped protected endpoints against synthetic users; the current branch only contains initial configuration/route tests.
7. Obtain explicit authorization before switching the existing staging Render service to this branch and deploying. Production release remains separately gated.

**Not yet tested:** actual DB auth flows, email delivery, browser cookie behavior, protected member resource ownership, restoration drill. Do not present as complete.
