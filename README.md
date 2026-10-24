# VanguardBio-You backend update

Replace **both** root-level backend files in your GitHub repository:
- `server.js`
- `pubmed.js`

Do not change the Airo frontend or the version 7 PDF generator. Keep `package.json` unchanged if it already uses `"type": "module"` and starts `node server.js`.

## Improvements
- Separate PubMed searches for each detected compound; balanced study selection up to 8 records.
- Explicit publication-type and compound metadata; TB-500 evidence must not be equated with full-length thymosin beta-4.
- NCBI request pacing and bounded transient retries.
- PubMed records are supplied as lower-priority, untrusted context.
- A research answer may correctly say retrieved evidence is insufficient without being rejected for lacking a citation. Invented/unretrieved PMID references still fail validation.
- Existing `/api/chat` response shape, six-question intake, OpenAI safety policy, and PDF integration remain unchanged.

## Verification before publishing
1. Commit both files together, deploy to a staging Render service if available.
2. Run `node --check server.js` and `node --check pubmed.js`.
3. Confirm `GET /health` returns `{"status":"ok"}`.
4. Test general chat, a complete six-question intake, a three-compound report, an explicit PMID question, and a no-relevant-evidence question.
5. Confirm citations are accurate against the actual studies, not merely clickable. Do not consider the PDF export a scientific verification step.
6. Test upstream failures, PubMed outages, 429s, and large messages.

## Outstanding production risks
- The existing in-memory, `remoteAddress`-based rate limiter is **not** a trusted per-user limiter behind Render. Add edge-level rate limiting and abuse controls before broad public launch.
- CORS does not authenticate callers. A public API can be used by scripts without an Origin header. Plan appropriate abuse prevention and usage caps.
- Citation checking still verifies PMID membership, not scientific claim-to-source support. Human review and stronger claim validation are needed for health-related content.
- Long reports may exceed the model output limit and return a controlled error; test full reports.
- NCBI pacing here is per Node process; multi-instance deployments need coordinated controls.
