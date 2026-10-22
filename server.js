import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const ALLOWED_ORIGIN = 'https://you.vanguardbio.ai';
const DEV_ORIGIN = process.env.DEV_ORIGIN || '';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const MAX_BODY = 24000;
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;
const hits = new Map();

const POLICY = `You are Vanguard Bio AI Peptide Advisor, an educational research-literacy assistant.
You explain peptide biology, clinical evidence, research methods, safety concerns, and regulatory uncertainty in plain English.
Differentiate human randomized trials, observational evidence, animal experiments, and cell studies. Do not claim a peptide is approved, safe, or effective without reliable evidence. Do not invent citations, clinical studies, numerical findings, or regulatory approvals. You have no live literature-search tool: disclose that your knowledge may be incomplete or outdated, and recommend checking PubMed, ClinicalTrials.gov, FDA and other authoritative regulators for current facts.
Do not diagnose, prescribe, suggest personalized treatment, dose, schedules, stacks, cycles, titration, routes of administration, injection or reconstitution steps, or vendors/sourcing for restricted, unapproved, or research-use-only peptides. For requests of this kind, briefly explain the limitation and provide safe general educational context or questions to ask a licensed clinician.
Never characterize research-use-only peptides as safe for human use. Do not give a personalized risk assessment based on symptoms, medications, or health history. Encourage consultation with a licensed clinician or pharmacist when discussing health decisions. For severe symptoms or possible emergencies, tell the user to contact local emergency services immediately. For suspected poisoning or product exposure, suggest local poison control.
Do not request personally identifying information or detailed medical histories. Do not imply you are a doctor. Be helpful, concise, factual, and transparent about uncertainty.`;

function send(res, status, data, extra = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(body);
}
function originAllowed(origin) { return origin === ALLOWED_ORIGIN || (!!DEV_ORIGIN && origin === DEV_ORIGIN); }
function corsHeaders(origin) {
  return originAllowed(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } : {};
}
function rateLimited(req) {
  // For real-world proxy deployment, rely on a trusted edge rate limiter too.
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  if (hits.size > 5000) for (const [key, value] of hits) if (now - value.start > WINDOW_MS) hits.delete(key);
  const state = hits.get(ip);
  if (!state || now - state.start > WINDOW_MS) { hits.set(ip, { start: now, count: 1 }); return false; }
  state.count += 1;
  return state.count > MAX_REQUESTS;
}
async function readJson(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk.toString('utf8');
    if (Buffer.byteLength(text) > MAX_BODY) throw new Error('too_large');
  }
  try { return JSON.parse(text); } catch { throw new Error('invalid_json'); }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const origin = req.headers.origin || '';
  if (url.pathname === '/health' && req.method === 'GET') return send(res, 200, { status: 'ok' });
  if (url.pathname === '/chat' && req.method === 'GET') {
    try {
      const html = await readFile(path.join(ROOT, 'public', 'chat.html'));
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors https://you.vanguardbio.ai; base-uri 'none'; form-action 'none'",
        'Referrer-Policy': 'no-referrer'
      });
      return res.end(html);
    } catch { return send(res, 500, { error: 'Chat UI unavailable' }); }
  }
  if (url.pathname === '/chat.js' && req.method === 'GET') {
    try { const js = await readFile(path.join(ROOT, 'public', 'chat.js')); res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }); return res.end(js); }
    catch { return send(res, 404, { error: 'Not found' }); }
  }
  if (url.pathname === '/chat.css' && req.method === 'GET') {
    try { const css = await readFile(path.join(ROOT, 'public', 'chat.css')); res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }); return res.end(css); }
    catch { return send(res, 404, { error: 'Not found' }); }
  }
  if (url.pathname !== '/api/chat') return send(res, 404, { error: 'Not found' });
  if (req.method === 'OPTIONS') {
    if (!originAllowed(origin)) return send(res, 403, { error: 'Origin not allowed' });
    res.writeHead(204, corsHeaders(origin)); return res.end();
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  // The widget is served from this API host (same-origin). Also allow exact GoDaddy origin.
  const sameOrigin = !origin || origin === `https://${req.headers.host}` || (DEV_ORIGIN && origin === DEV_ORIGIN);
  if (!sameOrigin && !originAllowed(origin)) return send(res, 403, { error: 'Origin not allowed' });
  const headers = corsHeaders(origin);
  if (rateLimited(req)) return send(res, 429, { error: 'Too many requests. Please try again shortly.' }, headers);
  if (!process.env.OPENAI_API_KEY) return send(res, 503, { error: 'AI service is not configured.' }, headers);
  let body;
  try { body = await readJson(req); }
  catch (e) { return send(res, e.message === 'too_large' ? 413 : 400, { error: 'Invalid request body.' }, headers); }
  if (!Array.isArray(body?.messages) || body.messages.length < 1 || body.messages.length > 12) return send(res, 400, { error: 'Provide 1–12 messages.' }, headers);
  const messages = [];
  for (const m of body.messages) {
    if (!m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 2500)
      return send(res, 400, { error: 'Invalid message.' }, headers);
    messages.push({ role: m.role, content: m.content.trim() });
  }
  if (messages.at(-1).role !== 'user') return send(res, 400, { error: 'Last message must be from the user.' }, headers);
  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: POLICY }, ...messages], temperature: 0.2, max_tokens: 850 }),
      signal: AbortSignal.timeout(30000)
    });
    if (!upstream.ok) { console.error('OpenAI upstream status:', upstream.status); return send(res, 502, { error: 'AI service temporarily unavailable.' }, headers); }
    const result = await upstream.json();
    const reply = result.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) return send(res, 502, { error: 'AI returned an empty response.' }, headers);
    return send(res, 200, { reply: reply.trim() }, headers);
  } catch (e) { console.error('AI request failed:', e.name); return send(res, 502, { error: 'Unable to answer right now. Please retry.' }, headers); }
});
server.listen(PORT, '0.0.0.0', () => console.log(`Vanguard Bio API listening on port ${PORT}`));
