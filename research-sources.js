/**
 * VanguardBio Stage 1 — optional research source retrieval (ESM, Node 18+).
 * Not connected to the production chat path. No external dependencies.
 * Sources: ClinicalTrials.gov API v2, Europe PMC REST API, NCBI PMC OA metadata.
 * Research metadata is untrusted input, never executable instructions.
 */
const MAX_QUERY = 180;
const MAX_RECORDS = 5;
const TIMEOUT_MS = 7000;

function cleanText(value, limit = 900) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}
function safeQuery(query) {
  const q = cleanText(query, MAX_QUERY);
  if (!q || q.length < 2) throw new TypeError('A research query of at least 2 characters is required');
  return q;
}
async function getJson(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Research source HTTP ${response.status}`);
  return response.json();
}
function nctRecord(study) {
  const p = study?.protocolSection ?? {};
  const id = cleanText(p.identificationModule?.nctId, 24);
  if (!/^NCT\d{8}$/.test(id)) return null;
  const d = p.designModule ?? {};
  const status = p.statusModule ?? {};
  const outcomes = p.outcomesModule ?? {};
  const resultsPosted = Boolean(study?.resultsSection);
  return {
    source: 'ClinicalTrials.gov', id, url: `https://clinicaltrials.gov/study/${id}`,
    title: cleanText(p.identificationModule?.briefTitle, 240),
    studyType: cleanText(d.studyType, 70), allocation: cleanText(d.designInfo?.allocation, 70),
    enrollment: d.enrollmentInfo?.count ?? null,
    status: cleanText(status.overallStatus, 60),
    primaryOutcomes: (outcomes.primaryOutcomes ?? []).slice(0, 3).map(x => cleanText(x.measure, 160)),
    resultsPosted, lastUpdated: cleanText(status.studyFirstPostDateStruct?.date, 20),
    evidenceNote: resultsPosted ? 'Registry results are posted; assess actual outcome data before drawing conclusions.' : 'Registry record only; registration does not demonstrate efficacy or safety.'
  };
}
export async function searchClinicalTrials(query, { limit = 4, fetchImpl = fetch } = {}) {
  const q = safeQuery(query);
  const n = Math.max(1, Math.min(MAX_RECORDS, Number(limit) || 4));
  const url = `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(q)}&pageSize=${n}&format=json`;
  const data = await getJson(url, fetchImpl);
  return (data.studies ?? []).map(nctRecord).filter(Boolean).slice(0, n);
}
function epmcRecord(article) {
  const pmid = cleanText(article?.pmid, 20);
  const pmcid = cleanText(article?.pmcid, 20);
  const doi = cleanText(article?.doi, 180);
  if (!/^\d{5,9}$/.test(pmid) && !/^PMC\d+$/.test(pmcid)) return null;
  const url = /^PMC\d+$/.test(pmcid)
    ? `https://europepmc.org/articles/${pmcid}`
    : `https://europepmc.org/article/MED/${pmid}`;
  return {
    source: 'Europe PMC', id: pmcid || pmid, pmid: /^\d{5,9}$/.test(pmid) ? pmid : null,
    pmcid: /^PMC\d+$/.test(pmcid) ? pmcid : null, doi: doi || null, url,
    title: cleanText(article?.title, 260), journal: cleanText(article?.journalTitle, 140),
    publicationYear: cleanText(article?.pubYear, 8),
    publicationTypes: (article?.pubTypeList?.pubType ?? []).slice(0, 5).map(x => cleanText(x, 90)),
    openAccess: article?.isOpenAccess === 'Y',
    evidenceNote: 'Publication metadata only. Verify methods, population, outcomes, and full text before supporting a claim.'
  };
}
export async function searchEuropePMC(query, { limit = 4, fetchImpl = fetch } = {}) {
  const q = safeQuery(query);
  const n = Math.max(1, Math.min(MAX_RECORDS, Number(limit) || 4));
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(q)}&format=json&pageSize=${n}&resultType=core`;
  const data = await getJson(url, fetchImpl);
  return (data.resultList?.result ?? []).map(epmcRecord).filter(Boolean).slice(0, n);
}
/** Searches independently; one unavailable source does not hide results from the other. */
export async function retrieveResearchSources(query, options = {}) {
  const q = safeQuery(query);
  const [trials, literature] = await Promise.allSettled([
    searchClinicalTrials(q, options), searchEuropePMC(q, options)
  ]);
  return {
    query: q,
    trials: trials.status === 'fulfilled' ? trials.value : [],
    literature: literature.status === 'fulfilled' ? literature.value : [],
    status: {
      clinicalTrials: trials.status === 'fulfilled' ? 'ok' : 'unavailable',
      europePMC: literature.status === 'fulfilled' ? 'ok' : 'unavailable'
    },
    disclaimer: 'Retrieved metadata is not proof of clinical benefit. Do not treat registry enrollment, abstracts, or publication types as independently verified outcomes.'
  };
}
