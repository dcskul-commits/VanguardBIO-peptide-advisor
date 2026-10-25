# VanguardBio Stage 2 — disabled-by-default integration

Based on the exact `server.js` supplied on 2026-10-25 (44,728 bytes).

## Files
- `server.js`: full copy with small feature-flagged additions.
- `server.patch`: exact unified diff for review.
- `research-sources.js`: Stage 1 module (unchanged).
- `research-sources.test.js`: Stage 1 tests (unchanged).

## Safe rollout
1. **Do not deploy immediately.** Review `server.patch` against your current GitHub `server.js`.
2. In a separate test directory, run `npm test` and `node --check server.js`.
3. Keep the new module next to `server.js` (the relative import requires it).
4. Only after review, commit `server.js` and `research-sources.js` together.
5. In Render, leave `ENABLE_EXPANDED_RESEARCH` **unset** (or set to `false`). This means the existing chat behavior is preserved; there are no new retrieval calls.
6. For a controlled test later, enable the flag in a **separate staging Render service**, not the live production service. Verify complete intake, PDF, citations, API latency and failure behavior.
7. Rollback: set `ENABLE_EXPANDED_RESEARCH=false` (or remove it). For a code rollback, revert the two-file commit.

## Scope and limitations
This is metadata-only retrieval, not PMC full-text ingestion. It adds ClinicalTrials.gov study records and Europe PMC publication links as supplemental discovery context, only when enabled. A posted-results flag is **not** a clinical outcome. Source text is untrusted and must not override system policy. Existing PubMed PMID validation is retained. When enabled, retrieval adds latency and the existing 30-second OpenAI request timeout remains; test on staging first.

**No files were deployed or modified in your GitHub/Render accounts by creating this package.**
