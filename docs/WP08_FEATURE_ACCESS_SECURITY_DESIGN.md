# WP08 — Feature Access, Data Isolation and Release Gates (design only)
Date: 2026-10-31
Status: PROPOSED, not a deployment, and not a grant of permission to modify Airo or production.

## Evidence and boundary
- Current Render staging has Better Auth verification, sessions and an `/api/membership/workspace` gate. It returns `paidFeatures:false`; no billing entitlement exists.
- The 2026-10-27 user-provided `VanguardBio_You.zip` export has public React routes `/`, `/library`, `/library/:slug`, `/stacks`, `/stacks/:slug`, `/research`, `/research/:slug`, `/about`, `/chat`. This is an *earlier snapshot*, not a current private-preview dump.
- User-reported WP07-B Safari acceptance passed sign-in, `/member`, refresh, navigation, logout and post-logout denial in private Airo preview. There is no evidence yet that saved reports are stored under user ownership or that authorization exists for existing research/PDF features.
- Airo preview and published variants may share app settings/secrets. Render staging DB is separate and is the only approved membership DB.
- No changes to the Airo app, production Render, billing, or DB schema are authorized by this design.

## Proposed access matrix

| Resource / action | Anonymous | Verified free member | Paid member | Server enforcement / notes |
| --- | --- | --- | --- | --- |
| Home, about and public marketing | Allow | Allow | Allow | Public, no private data |
| Peptide library index and scientific profiles | Allow | Allow | Allow | Public research, maintain safety/evidence framing |
| Research index and published summaries | Allow | Allow | Allow | Public citations; not user-specific |
| Comparisons / `stacks` pages | Allow | Allow | Allow | Public educational comparison; do not imply prescriptions, individualized dosing, sourcing, administration or regimens |
| Educational advisor chat, existing public use | Allow subject to existing limits | Allow | Allow | Preserve validated `POST /api/chat` behavior; do not silently make public chat private or promise saved chats |
| Local browser PDF generation from current chat | Allow | Allow | Allow | Local export only; no server persistence without explicit opt-in |
| Sign up, verify email, login, password recovery | Allow | Allow | Allow | Auth routes; rate limits and generic error responses |
| `/member` and `/api/membership/workspace` | Deny | Allow | Allow | Verified live session; verified account is not a subscription |
| Save a report to account (new capability) | Deny | **Proposed allow after approval** | Same as free | Not currently implemented; requires privacy consent, storage and ownership controls |
| List, read, download, delete own saved reports (new) | Deny | **Proposed allow after approval** | Same as free | Owner-scoped database lookup; no direct object-store URLs |
| Another user's saved report | Deny | Deny | Deny | 404 or generic 403 regardless of guessed identifier |
| Admin / content moderation / evidence publication | Deny | Deny | Deny | Separate administrative identity + explicit role, never email or client-supplied role |
| Billing plans, purchase, premium features | No grant | No grant | Not implemented | No billing entitlements, webhooks or production payment infrastructure yet |
| Real user COA upload / personal health file analysis | Deny | Deny | Deny | Separate legal/privacy/scientific and security review required |

**Product decision pending:** free members may save reports; paid tier remains a later product decision. Never treat authenticated = paid.

## Authorization and privacy architecture (proposed)

1. **Identity source:** Better Auth server-side session resolved on Render; require `session.session`, `session.user.id`, `session.user.emailVerified === true`. Ignore client-supplied user ID, role, plan, email and subscription flags. No auth based on React route alone.
2. **Proxy:** Airo `/api/preview-membership/:operation` server proxy only in the private staging app / approved preview host, with exact host and mutating-request Origin checks; sanitized route allowlist; no open proxy, upstream arbitrary URLs or spoofable forwarded identity. Only forward approved cookie and necessary headers; do not log credentials, tokens or request bodies. Public production must not reach staging auth by spoofing Host or any forwarded host.
3. **Resources:** proposed Render staging endpoints `GET /api/member/reports`, `POST /api/member/reports`, `GET /api/member/reports/:id`, `DELETE /api/member/reports/:id` and optional `GET /api/member/reports/:id/download`, all protected. No route is currently implemented. For every read, update or delete, derive `owner_id` from server session and query `WHERE id=$1 AND owner_id=$2`. Return no cross-user content. Use opaque randomly generated IDs; these do not replace authorization.
4. **Storage:** if saving reports is approved, stage schema in the *existing* isolated staging Postgres only after separate schema approval. Prefer encrypted server-side data at rest (provider native encryption + application-level crypto if required by data classification); do not use Airo managed DB. Keep minimal report title, timestamps, owner ID and explicitly saved content; no health-history intake or raw chat saved by default. Define retention and delete/export process before go-live. No raw chat in logs, analytics, URLs or third-party monitoring. Treat all chat and reports as potentially sensitive.
5. **Request safety:** CSRF protection for mutating cookie-authenticated operations (Origin/Fetch Metadata and, if necessary, CSRF tokens), bounded JSON size, schema validation, HTML/text escaping, per-user rate limits, secure cookies, appropriate SameSite, cache-control `private, no-store`, no external indexable pages and no PII in telemetry.
6. **Entitlements:** future paid roles are server-side DB-backed and webhook-validated; no `paidFeatures:true` until payment/refund/cancellation flow is verified. Account membership and scientific content assurances are separate.
7. **Analytics:** disable click text, URL or page metadata collection on membership, account, report and private analysis routes; no third-party advertising trackers there. Review consent logic before rollout.
8. **Evidence:** existing public peptide library and comparisons must be reviewed independently for potentially prescriptive wording, references and dosing/sourcing claims; access control must not be used as a substitute for medical safety compliance.

## Test matrix, phased
- A. Anonymous GET workspace/reports -> 401. Unknown Origin -> 403. Unsupported method -> 405. Malformed body -> 400/413. No leaked PII.
- B. Verified free member -> workspace 200; no paid entitlement, no admin routes. Unverified account -> 401/403. Logout and password reset revoke sessions.
- C. **Two synthetic verified users only**, if report storage is approved: each can create/read/delete own report; cross-user ID lookup and download rejected; concurrent requests, guessed IDs and cached responses cannot disclose data. Test lifecycle and deletion.
- D. Safari/Chrome in private Airo staging preview: sign-in, refresh/navigation persistence, logout, clear cookies, stale session, password reset, blocked third-party cookies, no auth leakage into published custom domain.
- E. Airo preview isolation: test published host cannot reach staging auth even with forged Host or forwarded headers, inspect trusted proxy configuration and connected secrets, no staging API keys exposed to browser.
- F. Regression: public /chat intake/PDF, public library/research/comparison routes, privacy analytics exclusions, Render backend output-safety checks and content citations.

## Decision gates
**Gate WP08-A (current):** this matrix and threat model reviewed; no code/schema/publishing implied.
**Gate WP08-B:** approve an explicit data-storage scope (none vs opt-in saved reports), retention period, owner data model, and any staged migration; only then implement resource authorization on Render staging and isolated CI.
**Gate WP08-C:** separately authorize Airo preview integration for new resource actions; run both-account browser acceptance and route isolation checks. Existing WP07-B auth may remain stable.
**Gate WP08-D:** independent privacy/security review, support confirmation on preview/production isolation, production domain and cookies plan, production database and deployment plan, rollback and explicit publishing approval.

## Known risks and unresolved details
- Source export is dated and may not include latest /account/research/:id, membership or saved-report routes. Verify current Airo code *read-only* before modifying them.
- User reported Safari WP07-B tests for one account, not multi-user data isolation, account deletion, or production behavior.
- No actual persisted reports schema/endpoints have been audited or approved here.
- Browser-generated PDF may contain sensitive conversation data; public download does not authorize server storage.
- Preview/private can still share configuration with published Airo app; restrict credentials at service level and do not install Airo database/auth skills.
- Not all lint and full test suites on Airo were green; platform-owned failures require baseline comparisons rather than blanket dismissal.

## Recommended implementation order
1. Confirm feature matrix and storage policy in product review.
2. Implement only server-side `GET /api/member/capabilities` or similar read-only policy metadata **if needed**, while preserving already-tested `/api/membership/workspace`. This is optional; don't add endpoints for decorative UI.
3. If saved reports are explicitly approved, stage separately scoped schema and owner-filtered CRUD API behind Better Auth, test with two synthetic users in isolated CI, then live staging.
4. Integrate Airo preview (only after code and schema approval), keep changes limited and visual branding intact, test Safari/Chrome, then review production plan.
