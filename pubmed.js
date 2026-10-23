
'use strict';

const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';

const PEPTIDES = [
  ['BPC-157', /\bBPC[\s-]?157\b/i],
  ['TB-500', /\bTB[\s-]?500\b/i],
  ['sermorelin', /\bsermorelin\b/i],
  ['ipamorelin', /\bipamorelin\b/i],
  ['MK-677', /\b(?:MK[\s-]?677|ibutamoren)\b/i],
  ['thymosin beta-4', /\bthymosin[\s-]?(?:beta[\s-]?4|β4)\b/i]
];

function detectCompounds(text) {
  return PEPTIDES
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
}

function parseMedline(text) {
  const records = [];
  let record = {};
  let lastField = null;

  function finish() {
    if (record.PMID && record.TI) {
      records.push({
        pmid: record.PMID.trim(),
        title: record.TI.trim(),
        date: (record.DP || '').trim(),
        abstract: (record.AB || '').trim().slice(0, 3500),
        url: `https://pubmed.ncbi.nlm.nih.gov/${record.PMID.trim()}/`
      });
    }
    record = {};
    lastField = null;
  }

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9]{2,4})\s*-\s(.*)$/);

    if (match) {
      const [, field, value] = match;
      lastField = field;

      if (field === 'PMID' && record.PMID) finish();

      if (['PMID', 'TI', 'DP', 'AB'].includes(field)) {
        record[field] = (record[field] || '') + value;
      }
    } else if (/^\s{6}/.test(line) && lastField && record[lastField]) {
      record[lastField] += ' ' + line.trim();
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

async function searchPubMed(question, maxResults = 5) {
  const compounds = detectCompounds(question);

  if (!compounds.length) return [];

  const term = compounds
    .map(name => `"${name}"[All Fields]`)
    .join(' OR ');

  const searchResponse = await fetchNCBI('esearch.fcgi', {
    db: 'pubmed',
    term: `(${term})`,
    retmode: 'json',
    retmax: String(Math.min(maxResults, 10)),
    sort: 'relevance'
  });

  const searchData = await searchResponse.json();
  const ids = searchData?.esearchresult?.idlist || [];

  if (!ids.length) return [];

  const fetchResponse = await fetchNCBI('efetch.fcgi', {
    db: 'pubmed',
    id: ids.join(','),
    rettype: 'medline',
    retmode: 'text'
  });

  return parseMedline(await fetchResponse.text());
}

export { searchPubMed, detectCompounds };
