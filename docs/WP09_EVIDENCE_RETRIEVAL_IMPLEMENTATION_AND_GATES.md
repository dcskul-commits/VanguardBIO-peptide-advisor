# WP08-D3-D2A and WP09 — Research quality and retrieval work plan

Date: 2026-11-01
Status: staged implementation underway, NOT production ready.
User authorization: immediate cross-peptide safety/evidence correction, followed by reusable retrieval and citation verification.
No permission to modify production, published Airo, paid resources or databases.

## Discovery: reuse existing infrastructure

The Render staging service already contains:
- `pubmed.js`: NCBI E-utilities ESearch + EFetch, bounded cache and per-process pacing, metadata and abstracts; citation IDs checked against retrieved records.
- `research-sources.js`: ClinicalTrials.gov + Europe PMC discovery metadata, gated behind `ENABLE_EXPANDED_RESEARCH`; metadata is NOT trial efficacy evidence.
- `content-quality.js`: report language corrections and **diagnostic-only** citation metadata audit. Three specific historical PMID corrections are not general outcome verification.
- `server.js`: `/api/chat` retrieval when a recognized compound is in research-intent/final-intake context, retrieved source context supplied to the model, PMID URL validation, source-owned bibliography, separate static FDA/WADA context.
- Current `pubmed.js` did not originally detect KPV or GHK-Cu, and did not support new unknown explicitly named peptides.
- The *Airo native public /chat* uses its own `src/lib/chatbot/chat-config.ts` prompt and handler; it is NOT automatically powered by Render staging research retrieval. Airo app updates require private-editor installation and separate verification.

## WP08-D3-D2A — Immediate prompt changes (Airo staging only)

- A copy-ready instruction is available in the conversation artifact `AIRO_WP08D2A_STAGING_INSTRUCTION.md`.
- Requires all research reports to separate animal, cell, human observational and human trials; forbid unverified study-specific experiments and blanket statements of no human trials; disclose lack of live literature verification; avoid implausible safety, clinical or regulatory certainty.
- Prompt-based mitigations are best-effort only; cannot certify claim support. Do not claim accepted until Airo edits and actual chat/PDF tests pass.

## WP09 Phase 1 — Code added to existing Render staging branch
- `pubmed.js`: adds KPV and GHK-Cu synonyms; bounded explicit intake target discovery for previously unknown compounds.
- `wp09-intake-targets.js`: extracts explicitly named targets from intake conversation rather than inferring compounds from conditions or goals.
- `wp09-source-ledger.js`: source-owned record summary that distinguishes indexed publication type and target mentions from outcome verification.
- `server.js`: feeds explicit intake targets into existing PubMed search and supplies opt-in staging-only provenance diagnostics under `WP09_LEDGER_AUDIT=true`.
- Automated test suites for provenance, intake target extraction, and mocked unknown peptide ESearch/EFetch.
- No new database, service, paid subscription or API key.
- Existing staging service does **not** auto-deploy: code in GitHub branch is NOT live until an approved staging deployment.
- **Known limitations**: An inline PMID can exist and name the peptide but still support the wrong dose, outcome, disease, intervention, experimental model or direction. `auditResearchReport` reports `claimSupportStatus: not_automatically_verified`. Do not label this 'citation verified' or enable a fail-closed publication gate based solely on heuristics.
- Current FDA/WADA references are static, NOT live regulatory verification.
- Generic all-peptide coverage is not proven: new unknown names require explicitly entered, bounded search targets. Ambiguous names, synonyms, brand names and fragment variants require review.
- The Airo chat and Render backend are separate until a stage-only routing/integration decision.

## WP09 Phase 2 — Claim-level grounding design (not implemented)
- Build evidence records with source metadata plus reviewed population, intervention/fragment identity, experimental model, comparator, endpoints, direction and confidence. Unavailable fields remain explicitly UNKNOWN.
- Only assert quantitative or intervention-specific outcomes when an independent verifier matches a supplied study to exact claims; else remove or downgrade the claim with explicit uncertainty.
- Require inline claim-to-source attribution, while preserving source-owned bibliography.
- Evaluate missing or low-confidence sources without inventing trial counts, study details or unsupported human benefits.
- Verify official regulatory status independently via current FDA/WADA primary sources, record dates, and distinguish review/committee actions from final approvals.
- Add evaluation corpora for KPV, BPC-157, TB-500/full-length thymosin beta-4, MK-677, GHK-Cu and unrecognized peptides; include adverse false attribution tests.
- Do NOT promise that RAG eliminates hallucination. Human review remains part of medical scientific QA.

## Acceptance gates

| Gate | Required evidence | Current status |
| --- | --- | --- |
| D2A prompt | Airo preview prompt diff + TypeScript + three actual endpoint reports + accurate source caveats | Pending Airo editor |
| WP09 code CI | Branch unit tests including mocked NCBI retrieval and existing membership/safety suites | Run GitHub Actions |
| WP09 stage deploy | Explicit staging release, source-audit flag, health/auth regression and KPV/BPC live citation retrieval | Not deployed |
| Claim verification | Claim-to-source match test across intervention/population/model/endpoint/direction, independent review | Not implemented |
| Airo integration | Correctly route existing Airo /chat to verified Render staging RAG or implement matching retrieval with no production effects | Not started |
| Full browser acceptance | Six-question intake, source citations, technical depth, PDF first section and appendix, Safari saved reports | Not started |
| Production | Privacy, security, costs, data retention, owner isolation, regulatory QA and explicit user release approval | Not authorized |

## CI interpretation
Older `wp04_g4_live_acceptance.mjs` expects a small set of specific BPC-157 and MK-677 citations in a *live deployed* Render report. It can fail for real retrieval relevance or live model variability; do not weaken that test merely to mask evidence gaps. Inspect it separately from branch offline test results and only close after live staging verification.

## Operational safeguards
- No logging of conversation/report content or API keys in new diagnostic code.
- Treat titles/abstracts as untrusted data, never instructions.
- Preserve existing output safety, authenticated member reports and production separation.
- Do not deploy to production, migrate data, or alter Airo DB.
