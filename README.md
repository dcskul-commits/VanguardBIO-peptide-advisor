# Vanguard Bio AI Peptide Advisor — GoDaddy Airo Edition

**Target website:** https://you.vanguardbio.ai  
**Style:** navy / white  
**Placement:** embedded full-page iframe  
**AI:** OpenAI API (server-side only)

## Architecture

GoDaddy Airo HTML Embed -> HTTPS iframe (`https://YOUR-API-HOST/chat`) -> Node.js API (`/api/chat`) -> OpenAI API.

The iframe serves the UI from the backend's origin, so the browser's chat requests are same-origin. The API also returns `Access-Control-Allow-Origin: https://you.vanguardbio.ai` for direct requests from the exact website origin. The API key never appears in browser HTML/JS.

## Deploy to Render (example)

1. Create a **private GitHub repository** and upload the files in this folder (keep `.env` / `.env.local` out of git). Do not upload an actual API key.
2. In Render, select **New > Web Service**, connect your repository, and set **Runtime: Node**.
3. Set **Build Command:** `npm install` and **Start Command:** `npm start`.
4. Add environment variables:
   - `OPENAI_API_KEY` = your secret OpenAI API key
   - `OPENAI_MODEL` = `gpt-4.1-mini` (or another model available to your account)
5. Deploy. Render supplies `PORT` automatically. Your service will have an HTTPS address such as `https://your-service.onrender.com`.
6. Test `https://your-service.onrender.com/health` and `https://your-service.onrender.com/chat`.
7. Open `godaddy/embed.html`. Replace `https://YOUR-API-HOST.example.com/chat` with your actual deployed HTTPS `/chat` URL.
8. In GoDaddy Airo, edit the intended page, add **HTML / Custom Code / Embed**, paste the full snippet, adjust the section height to at least 850 px, save and publish.
9. Visit https://you.vanguardbio.ai and test the chat. If the iframe is blocked, confirm the published site's exact origin and that the hosting service preserves the supplied `Content-Security-Policy` header.

GoDaddy's editor features and embed script restrictions may vary by plan. The iframe avoids requiring external scripts inside the Airo editor. Do not put the OpenAI API key into GoDaddy custom HTML.

## Local testing

Install Node.js 20+ and run:

```bash
export OPENAI_API_KEY='your-secret-key'
export DEV_ORIGIN='http://localhost:3000'
npm start
```

Open http://localhost:3000/chat. On Windows PowerShell use `$env:OPENAI_API_KEY='...'` instead of `export`.

## API reference

`POST /api/chat` with `Content-Type: application/json`:

```json
{"messages":[{"role":"user","content":"What does current evidence say about BPC-157?"}]}
```

Successful response:

```json
{"reply":"..."}
```

The API accepts 1–12 messages, each with role `user` or `assistant`, up to 2500 characters each. Requests are rate limited in memory to 12 per minute per IP (best-effort). Invalid requests, unavailable upstream API, and missing configuration return JSON errors.

## Security and launch checklist

- **Keep your OpenAI key server-side** as a host environment variable; never commit it or expose it in an embed.
- CORS is limited to `https://you.vanguardbio.ai` for direct cross-origin requests. **CORS is not authentication** and does not prevent server-to-server calls or abuse. This public API needs stronger protection before a large launch.
- The embedded page is restricted with `frame-ancestors https://you.vanguardbio.ai`. For local embedding, this policy must be adjusted intentionally.
- The chat does not intentionally persist conversation history on the server or in browser storage. However, user messages are transmitted to your server and OpenAI; review their data processing terms and your hosting provider's logs.
- The included memory-only rate limiter is **not sufficient for multi-instance production**. Add a trusted edge WAF/rate limiter, usage quotas, bot mitigation, monitoring, and spend caps. Use authentication if private access is needed.
- Add an accurate privacy policy, AI disclosure, accessibility testing, content review, and professional/legal review before public deployment.
- The assistant has **no live literature retrieval**, so it should not be represented as a current clinical evidence database. Consider adding a vetted citation/RAG layer for source-backed answers.
- The assistant is educational, not a clinician. It is not designed for diagnosis, prescribing, personalized dosing, injections, reconstitution, or sourcing unapproved peptides.
- Set billing limits/alerts on your OpenAI account; API usage incurs costs.

## Files

- `server.js` — Node.js 20+ HTTP server, CORS, validation, rate limiting, OpenAI proxy, system safety prompt
- `public/chat.html` — branded embedded chat UI
- `public/chat.css` — navy visual design and responsive layout
- `public/chat.js` — client-side conversation handling
- `godaddy/embed.html` — copy/paste iframe embed
- `.env.example` — example server configuration

## Troubleshooting

- **Blank iframe:** Check deployed `/chat` URL, hosting status, GoDaddy embed permissions, and `frame-ancestors` policy.
- **Service not configured:** Set `OPENAI_API_KEY` in your backend host, not in GoDaddy.
- **502 AI service temporarily unavailable:** Check your OpenAI API key, available model, billing, and provider status.
- **CORS 403:** The request origin must be exactly `https://you.vanguardbio.ai` or same-origin with the backend. The `www` variant and alternate subdomains are intentionally not allowed.
- **Widget too short:** Increase the GoDaddy HTML section height to 850 px or more.
