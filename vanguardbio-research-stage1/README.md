# VanguardBio-You: Stage 1 Research Retrieval (Not Deployed)

This is an additive, opt-in Node.js ESM module. It does **not** change your production `server.js`, `pubmed.js`, intake, OpenAI request, or PDF generation.

## Included
- `research-sources.js`: ClinicalTrials.gov API v2 and Europe PMC REST retrieval.
- `research-sources.test.js`: offline mocked tests.
- `package.json`: test command.

## Test locally
```sh
cd vanguardbio-research-stage1
npm test
```

## Example (local only)
```js
import { retrieveResearchSources } from './research-sources.js';
const result = await retrieveResearchSources('ibutamoren', { limit: 4 });
console.log(JSON.stringify(result, null, 2));
```

## Safe rollout
1. Keep the existing deployed `server.js` and `pubmed.js` untouched.
2. Test this module in isolation, including with actual network access in a staging environment.
3. Review trial matching, false positives, study design labels, source uptime, and rate limits.
4. In a **separate reviewed patch**, optionally call `retrieveResearchSources` only during research/report requests, and add its bounded metadata to the existing untrusted research-context section. Do not replace PubMed retrieval or alter the six-question state machine.
5. Validate the six-question intake, full report, tables, PDF button, and PDF export in staging before production enablement.

## Important limits
- The current implementation retrieves **registry and publication metadata**, not complete trial results or full-text articles. Europe PMC provides a bridge to PMC records, but **PMC full-text retrieval and license checking are a separate next step**.
- Registry status and posted results do not prove efficacy. Publication metadata does not establish study quality.
- A failed source returns `unavailable`, not a fabricated citation.
- Do not feed returned source content to the model as instructions; it is untrusted evidence data.
- No user data, medical history, or conversations should be included in research queries. Query compound names or general research topics only.
