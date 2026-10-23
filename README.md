# VanguardBio-You: coordinated Render + Airo replacement files

## Contents

- `render/server.js` — hardened Node HTTP backend; keeps `POST /api/chat` returning `{ "reply": "..." }`.
- `render/package.json` — existing Node 20+ package manifest, unchanged.
- `airo/src/pages/ChatPage.tsx` — original Airo React page, modified to call Render and parse JSON, validate length, bound history, and enable PDF export after a completed answer.
- `airo/src/content/pages/chat.json` — updated educational copy; seven original quick goals retained.
- `airo/src/lib/chatbot/pdf-report.ts` — branded jsPDF export with per-line page breaks.
- `airo/src/styles/globals.css` — intentionally NOT replaced. Keep the original file exactly as-is.

## Deploy in two stages

1. **Back up both projects.** Commit your current GitHub branch or create a tagged release.
2. **Render:** Copy `render/server.js` and `render/package.json` to the repository root, retaining any existing `public/` directory. Do not delete `public/` if you use the older standalone `/chat` widget. Commit and deploy. Ensure Render has `OPENAI_API_KEY` (secret), optional `OPENAI_MODEL`, and its normal `PORT`. Do not commit `.env`.
3. Test `GET https://vanguardbio-peptide-advisor.onrender.com/health` (expect `{"status":"ok"}`). Test POST and preflight with the commands below. A live OpenAI reply requires a configured key and sufficient API quota.
4. **Airo:** Ask Airo to replace the three corresponding source files under `src/` with those in `airo/`, keeping `src/styles/globals.css`, global navigation, shared components, and all other files unchanged. **These are React/TypeScript source files, NOT code to paste into an HTML-only embed.** If Airo cannot edit source, this package cannot be deployed there directly.
5. Publish Airo; test goal chips, send, New Session, errors, PDF, mobile layout, and long reports.
6. If a step fails, revert that project's commit. Do not publish a replacement embed unless source editing is unavailable and a separate embed is intentionally chosen.

## Smoke tests

```bash
curl -i https://vanguardbio-peptide-advisor.onrender.com/health
curl -i -X OPTIONS https://vanguardbio-peptide-advisor.onrender.com/api/chat \
  -H 'Origin: https://you.vanguardbio.ai' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
curl -i -X POST https://vanguardbio-peptide-advisor.onrender.com/api/chat \
  -H 'Origin: https://you.vanguardbio.ai' \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Explain how clinical trial evidence is ranked for peptides."}]}'
```

## Security and scope notes

- CORS does **not** prevent non-browser calls or control cost. Before a public launch, add managed rate limiting / bot controls at a trusted edge, and configure OpenAI project usage alerts and spending limits. The built-in limiter is a bounded, per-instance fallback and may not identify individual users behind Render's reverse proxy.
- The backend does not store conversation data. It sends the supplied conversation to OpenAI. Publish accurate privacy disclosures, avoid collecting personal health identifiers, and decide on retention/consent with counsel before public use.
- No live RAG, PubMed verification, user accounts, billing, or citation verification is implemented by this package. Do not advertise those as operational.
- The current response is **JSON**, not streamed tokens. Airo's typing dots remain while waiting for a full response.
- The old `/chat` iframe route is supported only if the repository retains its existing `public/chat.html`, `public/chat.js`, and `public/chat.css` files. This package does not recreate those assets.
- If you need to support browsers from an alternate development site, set `DEV_ORIGIN` to that exact origin temporarily and remove it for production.
