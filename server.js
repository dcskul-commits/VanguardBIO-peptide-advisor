import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const SITE_ORIGIN = 'https://you.vanguardbio.ai';
const DEV_ORIGIN = process.env.DEV_ORIGIN || '';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const MAX_BODY = 24_000;
const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 2500;
const MAX_REQUESTS = 12;
const WINDOW_MS = 60_000;
const MAX_TRACKED_KEYS = 5000;
const MAX_CONCURRENT = 8;
const hits = new Map();
let active = 0;

const POLICY = `You are VanguardBio-You AI Peptide Advisor, an educational research-literacy assistant.
Explain peptide biology, study quality, human evidence, uncertainty, potential risks and regulatory limitations.
Differentiate randomized human trials, observational studies, animal research and cell studies. Never fabricate citations, approvals, studies or data. You do not have live literature retrieval; clearly disclose when up-to-date verification is needed and direct users to PubMed, ClinicalTrials.gov and relevant regulators.
Do not diagnose, prescribe, or give individualized treatment plans, doses, schedules, cycles, stacks, injection/reconstitution instructions or sourcing for restricted, unapproved or research-use-only peptides. Instead offer general evidence and safety context and questions for a licensed clinician.
Do not treat research-use-only products as safe for human use. Do not request identifying details or medical histories. For emergencies advise local emergency services. For possible poisoning advise local poison control. Keep answers clear, appropriately cautious and useful.`;

function headers(extra = {}) {
  return { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", ...extra };
}
function send(res, status, data, extra = {}) {
  res.writeHead(status, { ...headers(extra), 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}
function allowedOrigin(origin) { return origin === SITE_ORIGIN || (!!DEV_ORIGIN && origin === DEV_ORIGIN); }
function cors(origin) { return allowedOrigin(origin) ? {
  'Access-Control-Allow-Origin': origin, 'Vary': 'Origin',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '600'
} : {}; }
function limit(key) {
  const now = Date.now();
  for (const [k, v] of hits) if (now - v.start >= WINDOW_MS) hits.delete(k);
  if (!hits.has(key) && hits.size >= MAX_TRACKED_KEYS) return true;
  const entry = hits.get(key);
  if (!entry) { hits.set(key, { start: now, count: 1 }); return false; }
  entry.count++;
  return entry.count > MAX_REQUESTS;
}
async function readJSON(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) { const err = new Error('too_large'); err.status = 413; throw err; }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { const err = new Error('invalid_json'); err.status = 400; throw err; }
}
function validate(body) {
  if (!body || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > MAX_MESSAGES) return null;
  const messages = [];
  for (const m of body.messages) {
    if (!m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' ||
        !m.content.trim() || m.content.length > MAX_MESSAGE_CHARS) return null;
    messages.push({ role: m.role, content: m.content.trim() });
  }
  return messages.at(-1).role === 'user' ? messages : null;
}

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  const origin = req.headers.origin || '';
  if (pathname === '/health' && req.method === 'GET') return send(res, 200, { status: 'ok' });
  // Legacy standalone widget routes retained for existing integrations.
  const assets = { '/chat': ['chat.html', 'text/html'], '/chat.js': ['chat.js', 'text/javascript'], '/chat.css': ['chat.css', 'text/css'] };
  if (req.method === 'GET' && assets[pathname]) {
    const [file, type] = assets[pathname];
    try {
      const data = await readFile(path.join(ROOT, 'public', file));
      const csp = pathname === '/chat'
        ? "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors https://you.vanguardbio.ai; base-uri 'none'; form-action 'none'"
        : "default-src 'none'";
      const h = headers({ 'Content-Type': `${type}; charset=utf-8`, 'Content-Security-Policy': csp });
      if (pathname === '/chat') delete h['X-Frame-Options'];
      res.writeHead(200, h); return res.end(data);
    } catch { return send(res, 404, { error: 'Not found.' }); }
  }
  if (pathname !== '/api/chat') return send(res, 404, { error: 'Not found.' });
  if (req.method === 'OPTIONS') {
    if (!allowedOrigin(origin)) return send(res, 403, { error: 'Origin not allowed.' });
    res.writeHead(204, headers(cors(origin))); return res.end();
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' }, { Allow: 'POST, OPTIONS' });
  // Browser requests must come from the published Airo origin or an explicitly configured development origin.
  // Non-browser requests without Origin are possible; CORS is not an authentication mechanism.
  if (origin && !allowedOrigin(origin) && origin !== `https://${req.headers.host}`)
    return send(res, 403, { error: 'Origin not allowed.' });
  const extra = cors(origin);
  // remoteAddress is intentionally not treated as a verified end-user IP behind Render's proxy.
  // This is a coarse fallback; production needs a trusted edge limiter.
  if (limit(req.socket.remoteAddress || 'unknown'))
    return send(res, 429, { error: 'Too many requests. Please retry shortly.' }, { ...extra, 'Retry-After': '60' });
  if (!process.env.OPENAI_API_KEY) return send(res, 503, { error: 'AI service is not configured.' }, extra);
  let body;
  try { body = await readJSON(req); }
  catch (err) { return send(res, err.status || 400, { error: err.status === 413 ? 'Request is too large.' : 'Invalid JSON request.' }, extra); }
  const messages = validate(body);
  if (!messages) return send(res, 400, { error: 'Provide 1–12 valid messages (up to 2,500 characters each), ending with a user message.' }, extra);
  if (active >= MAX_CONCURRENT) return send(res, 503, { error: 'Service is busy. Please retry shortly.' }, { ...extra, 'Retry-After': '5' });
  active++;
  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: POLICY }, ...messages], temperature: 0.2, max_tokens: 850 }),
      signal: AbortSignal.timeout(30_000)
    });
    if (!upstream.ok) {
      console.error('OpenAI upstream HTTP status:', upstream.status);
      const status = upstream.status === 429 ? 503 : 502;
      return send(res, status, { error: 'AI service temporarily unavailable. Please retry.' }, extra);
    }
    const result = await upstream.json();
    const reply = result?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) return send(res, 502, { error: 'AI returned an empty response.' }, extra);
    return send(res, 200, { reply: reply.trim() }, extra);
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    console.error('AI request failed:', timedOut ? 'timeout' : 'network_or_parse_error');
    return send(res, timedOut ? 504 : 502, { error: timedOut ? 'The AI response timed out. Please retry.' : 'Unable to answer right now. Please retry.' }, extra);
  } finally { active--; }
});
server.requestTimeout = 40_000;
server.headersTimeout = 15_000;
server.listen(PORT, '0.0.0.0', () => console.log(`VanguardBio-You API listening on ${PORT}`));
