
'use strict';

const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';

const PEPTIDES = [
  {
    name: 'BPC-157',
    pattern: /\bBPC[\s-]?157\b/i,
    terms: ['BPC-157', 'BPC 157']
  },
  {
    name: 'TB-500',
    pattern: /\bTB[\s-]?500\b/i,
    terms: ['TB-500', 'TB 500']
  },
  {
    name: 'sermorelin',
    pattern: /\bsermorelin\b/i,
    terms: ['sermorelin']
  },
  {
    name: 'ipamorelin',
    pattern: /\bipamorelin\b/i,
    terms: ['ipamorelin']
  },
  {
    name: 'MK-677',
    pattern: /\b(?:MK[\s-]?677|ibutamoren)\b/i,
    terms: ['MK-677', 'ibutamoren']
  },
  {
    name: 'thymosin beta-4',
    pattern: /\bthymosin[\s-]?(?:beta[\s-]?4|β4)\b/i,
    terms: ['thymosin beta-4', 'thymosin beta 4']
  }
];

const CACHE_TTL = 15 * 60 * 1000;
const CACHE_LIMIT = 100;
const cache = new Map();

function detectCompounds(text) {
  return PEPTIDES
    .filter(item => item.pattern.test(text))
    .map(item => item.name);
}

function parseMedline(text) {
  const records = [];
  let record = {};
  let lastField = null;

  function finish() {
    if (record.PMID && record.TI) {
      const pmid = record.PMID.trim();

      records.push({
        pmid,
        title: record.TI.trim(),
        date: (record.DP || '').trim(),
        abstract: (record.AB || '').trim().slice(0, 3500),
        publicationTypes: record.PT || [],
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
      });
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

      if (field === 'PT') {
        if (!record.PT) record.PT = [];
        record.PT.push(value.trim());
      } else if (['PMID', 'TI', 'DP', 'AB'].includes(field)) {
        record[field] = (record[field] || '') + value;
      }
    } else if (/^\s{6}/.test(line) && lastField) {
      if (lastField === 'PT' && record.PT?.length) {
        record.PT[record.PT.length - 1] += ' ' + line.trim();
      } else if (typeof record[lastField] === 'string') {
        record[lastField] += ' ' + line.trim();
      }
    }
  }

  finish();
  return records;
}

async function fetchNCBI(endpoint, params) {
  const url = new URL(endpoint, BASE);

  url.search = new URLSearchParams({
    ...params,
    tool: 'VanguardBioPeptideAdvisor',
    ...(process.env.NCBI_EMAIL
      ? { email: process.env.NCBI_EMAIL }
      : {})
  }).toString();

  const response = await fetch(url, {
    signal: AbortSignal.timeout(7000)
  });

  if (!response.ok) {
    throw new Error(`NCBI request failed: ${response.status}`);
  }

  return response;
}

async function searchIds(term, retmax = 15) {
  const response = await fetchNCBI('esearch.fcgi', {
    db: 'pubmed',
    term,
    retmode: 'json',
    retmax: String(retmax),
    sort: 'relevance'
  });

  const data = await response.json();
  return data?.esearchresult?.idlist || [];
}

function scoreStudy(study, question, compounds) {
  const title = study.title.toLowerCase();
  const abstract = study.abstract.toLowerCase();
  const types = study.publicationTypes
    .join(' ')
    .toLowerCase();

  const combined = `${title} ${abstract}`;
  const q = question.toLowerCase();

  let score = 0;

  if (types.includes('randomized controlled trial')) score += 12;
  else if (types.includes('clinical trial')) score += 9;

  if (types.includes('meta-analysis')) score += 3;
  if (types.includes('systematic review')) score += 2;
  if (types.includes('review')) score -= 3;
  if (types.includes('case reports')) score -= 8;

  if (/\b(human|humans|patients|subjects|volunteers)\b/i.test(combined)) {
    score += 3;
  }

  if (/\b(mice|mouse|rats|rodents|in vitro)\b/i.test(title)) {
    score -= 8;
  }

  if (/\b(strength|muscle|physical function|functional|recovery)\b/i.test(q)) {
    if (/\b(strength|physical function|functional performance|exercise capacity)\b/i.test(combined)) {
      score += 6;
    }
  }

  if (/\b(safety|risk|adverse|heart failure)\b/i.test(q)) {
    if (/\b(safety|adverse events|heart failure|glucose|insulin)\b/i.test(combined)) {
      score += 5;
    }
  }

  for (const compound of compounds) {
    const entry = PEPTIDES.find(item => item.name === compound);

    if (entry && entry.terms.some(term => title.includes(term.toLowerCase()))) {
      score += 6;
    }
  }

  return score;
}

async function searchPubMed(question, maxResults = 5) {
  const compounds = detectCompounds(question);
  if (!compounds.length) return [];

  const count = Math.max(1, Math.min(Number(maxResults) || 5, 10));
  const key = `${question.toLowerCase().trim()}|${count}`;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.results;
  }

  const terms = compounds.flatMap(name => {
    const entry = PEPTIDES.find(item => item.name === name);
    return entry ? entry.terms : [name];
  });

  const compoundQuery = terms
    .map(term => `"${term}"[All Fields]`)
    .join(' OR ');

  const baseQuery = `(${compoundQuery})`;

  const wantsHumanEvidence =
    /\b(human|humans|clinical|trial|trials|strength|function|efficacy|effectiveness|patients)\b/i
      .test(question);

  const candidateIds = [];

  if (wantsHumanEvidence) {
    const clinicalQuery =
      `${baseQuery} AND (randomized controlled trial[pt] OR clinical trial[pt])`;

    const clinicalIds = await searchIds(clinicalQuery, 12);
    candidateIds.push(...clinicalIds);
  }

  const generalIds = await searchIds(baseQuery, 20);
  candidateIds.push(...generalIds);

  const uniqueIds = [...new Set(candidateIds)].slice(0, 25);
  if (!uniqueIds.length) return [];

  const response = await fetchNCBI('efetch.fcgi', {
    db: 'pubmed',
    id: uniqueIds.join(','),
    rettype: 'medline',
    retmode: 'text'
  });

  const studies = parseMedline(await response.text());

  const ranked = studies
    .map(study => ({
      ...study,
      score: scoreStudy(study, question, compounds)
    }))
    .sort((a, b) => b.score - a.score);

  const results = ranked.slice(0, count).map(({ score, ...study }) => study);

  if (cache.size >= CACHE_LIMIT) {
    cache.delete(cache.keys().next().value);
  }

  cache.set(key, {
    time: Date.now(),
    results
  });

  return results;
}

export { searchPubMed, detectCompounds };
