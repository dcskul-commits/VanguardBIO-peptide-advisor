'use strict';

const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
const PEPTIDES = [
  { name: 'BPC-157', pattern: /\bBPC[\s-]?157\b/i, terms: ['BPC-157', 'BPC 157'] },
  { name: 'TB-500', pattern: /\bTB[\s-]?500\b/i, terms: ['TB-500', 'TB 500'] },
  { name: 'sermorelin', pattern: /\bsermorelin\b/i, terms: ['sermorelin'] },
  { name: 'ipamorelin', pattern: /\bipamorelin\b/i, terms: ['ipamorelin'] },
  { name: 'MK-677', pattern: /\b(?:MK[\s-]?677|ibutamoren)\b/i, terms: ['MK-677', 'ibutamoren'] },
  { name: 'thymosin beta-4', pattern: /\bthymosin[\s-]?(?:beta[\s-]?4|β4)\b/i, terms: ['thymosin beta-4', 'thymosin beta 4'] }
];
const CACHE_TTL = 15 * 60_000;
const CACHE_LIMIT = 100;
const cache = new Map();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let nextNcbiRequest = 0;
let ncbiQueue = Promise.resolve();

export function detectCompounds(text) {
  return PEPTIDES.filter(item => item.pattern.test(String(text || ''))).map(item => item.name);
}

function parseMedline(text) {
  const records = [];
  let record = {};
  let lastField = null;
  function finish() {
    if (record.PMID && record.TI) {
      const pmid = record.PMID.trim();
      if (/^\d{6,9}$/.test(pmid)) {
        records.push({
          pmid, title: record.TI.trim(),
          date: (record.DP || '').trim(),
          abstract: (record.AB || '').trim().slice(0, 3500),
          publicationTypes: record.PT || [],
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
        });
      }
    }
    record = {};
    lastField = null;
  }
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9]{2,4})\s*-\s(.*)$/);
    if (match) {
      const [, field, value] = match;
      if (field === 'PMID' && record.PMID) finish();
      lastField = field;
      if (field === 'PT') (record.PT ||= []).push(value.trim());
      else if (['PMID', 'TI', 'DP', 'AB'].includes(field))
        record[field] = (record[field] || '') + value;
    } else if (/^\s{6}/.test(line) && lastField) {
      if (lastField === 'PT' && record.PT?.length)
        record.PT[record.PT.length - 1] += ' ' + line.trim();
      else if (typeof record[lastField] === 'string')
        record[lastField] += ' ' + line.trim();
    }
  }
  finish();
  return records;
}

// NCBI recommends no more than three requests per second without an API key.
// Serialize requests in this process; a shared deployment-wide limiter is still
// required if multiple application instances call NCBI concurrently.
async function paceNCBI() {
  const previous = ncbiQueue;
  let release;
  ncbiQueue = new Promise(resolve => { release = resolve; });
  await previous;
  try {
    const wait = Math.max(0, nextNcbiRequest - Date.now());
    if (wait) await sleep(wait);
    nextNcbiRequest = Date.now() + (process.env.NCBI_API_KEY ? 110 : 370);
  } finally { release(); }
}

async function fetchNCBI(endpoint, params) {
  const url = new URL(endpoint, BASE);
  url.search = new URLSearchParams({
    ...params, tool: 'VanguardBioPeptideAdvisor',
    ...(process.env.NCBI_EMAIL ? { email: process.env.NCBI_EMAIL } : {}),
    ...(process.env.NCBI_API_KEY ? { api_key: process.env.NCBI_API_KEY } : {})
  }).toString();

  for (let attempt = 0; attempt < 3; attempt++) {
    await paceNCBI();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(6500) });
      if (response.ok) return response;
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2)
        throw new Error(`NCBI HTTP ${response.status}`);
      const retryAfter = Number(response.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 3000) : 400 * (attempt + 1));
    } catch (error) {
      if (attempt === 2 || /^NCBI HTTP /.test(error.message)) throw error;
      await sleep(400 * (attempt + 1));
    }
  }
}

async function searchIds(term, retmax = 12) {
  const response = await fetchNCBI('esearch.fcgi', {
    db: 'pubmed', term, retmode: 'json', retmax: String(retmax), sort: 'relevance'
  });
  const data = await response.json();
  return (data?.esearchresult?.idlist || []).filter(id => /^\d{6,9}$/.test(id));
}

function matchCompound(study, compound) {
  const text = `${study.title} ${study.abstract}`;
  const item = PEPTIDES.find(p => p.name === compound);
  return !!item && item.pattern.test(text);
}

function classifyStudy(study) {
  const types = study.publicationTypes.join(' ').toLowerCase();
  if (types.includes('randomized controlled trial')) return 'randomized clinical trial (publication type)';
  if (types.includes('clinical trial')) return 'clinical trial (publication type)';
  if (types.includes('meta-analysis')) return 'meta-analysis (publication type)';
  if (types.includes('systematic review')) return 'systematic review (publication type)';
  if (types.includes('review')) return 'review (publication type)';
  return 'study design not verified from publication type';
}

function scoreStudy(study, question, compound) {
  const title = study.title.toLowerCase();
  const combined = `${title} ${study.abstract.toLowerCase()}`;
  const types = study.publicationTypes.join(' ').toLowerCase();
  let score = 0;
  if (types.includes('randomized controlled trial')) score += 12;
  else if (types.includes('clinical trial')) score += 9;
  if (types.includes('meta-analysis')) score += 3;
  if (types.includes('systematic review')) score += 2;
  if (types.includes('review')) score -= 3;
  if (types.includes('case reports')) score -= 8;
  if (/\b(human|humans|patients|subjects|volunteers)\b/i.test(combined)) score += 3;
  if (/\b(mice|mouse|rats|rodents|in vitro)\b/i.test(title)) score -= 8;
  if (/\b(strength|muscle|physical function|functional|recovery)\b/i.test(question) &&
      /\b(strength|physical function|functional performance|exercise capacity)\b/i.test(combined)) score += 6;
  if (/\b(safety|risk|adverse|heart failure)\b/i.test(question) &&
      /\b(safety|adverse events|heart failure|glucose|insulin)\b/i.test(combined)) score += 5;
  if (matchCompound(study, compound)) score += 8;
  return score;
}

async function fetchStudies(ids) {
  if (!ids.length) return [];
  const response = await fetchNCBI('efetch.fcgi', {
    db: 'pubmed', id: ids.join(','), rettype: 'medline', retmode: 'text'
  });
  return parseMedline(await response.text());
}

function enrich(study) {
  const matchedCompounds = detectCompounds(`${study.title} ${study.abstract}`);
  return {
    ...study,
    matchedCompounds,
    evidenceType: classifyStudy(study),
    // A publication type does not verify a study's endpoints or completed results.
    interpretationWarning: 'Verify intervention identity, population, endpoints and results from the original publication.'
  };
}

export async function searchPubMed(question, maxResults = 5) {
  const compounds = detectCompounds(question);
  if (!compounds.length) return [];
  const count = Math.max(1, Math.min(Number(maxResults) || 5, 10));
  const key = `${question.toLowerCase().trim()}|${count}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.results;

  const wantsHumanEvidence =
    /\b(human|humans|clinical|trial|trials|strength|function|efficacy|effectiveness|patients)\b/i.test(question);
  const perCompound = new Map();
  const allIds = new Set();

  // Search each compound independently, rather than letting one compound
  // consume all candidate slots in a combined OR query.
  for (const compound of compounds) {
    const entry = PEPTIDES.find(item => item.name === compound);
    const base = `(${entry.terms.map(term => `"${term}"[All Fields]`).join(' OR ')})`;
    const ids = [];
    if (wantsHumanEvidence) {
      ids.push(...await searchIds(`${base} AND (randomized controlled trial[pt] OR clinical trial[pt])`, 8));
    }
    ids.push(...await searchIds(base, 12));
    const unique = [...new Set(ids)].slice(0, 14);
    perCompound.set(compound, unique);
    unique.forEach(id => allIds.add(id));
  }

  if (!allIds.size) return [];
  const studies = (await fetchStudies([...allIds].slice(0, 60))).map(enrich);
  const byId = new Map(studies.map(study => [study.pmid, study]));
  const chosen = new Map();

  // Round-robin selection ensures coverage when sufficient relevant records exist.
  const rankedByCompound = new Map(compounds.map(compound => [
    compound,
    (perCompound.get(compound) || [])
      .map(id => byId.get(id)).filter(Boolean)
      .filter(study => matchCompound(study, compound))
      .sort((a, b) => scoreStudy(b, question, compound) - scoreStudy(a, question, compound))
  ]));
  let progress = true;
  while (chosen.size < count && progress) {
    progress = false;
    for (const compound of compounds) {
      if (chosen.size >= count) break;
      const candidate = rankedByCompound.get(compound).find(study => !chosen.has(study.pmid));
      if (candidate) {
        chosen.set(candidate.pmid, candidate);
        progress = true;
      }
    }
  }

  // If strict matching is sparse, do not fill the report with unrelated studies.
  const results = [...chosen.values()];
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, { time: Date.now(), results });
  return results;
}

export async function fetchPubMedByPMID(pmid) {
  const id = String(pmid).trim();
  if (!/^\d{6,9}$/.test(id)) return null;
  const studies = await fetchStudies([id]);
  const study = studies.find(item => item.pmid === id);
  return study ? enrich(study) : null;
}
