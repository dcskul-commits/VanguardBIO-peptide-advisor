import test from 'node:test';
import assert from 'node:assert/strict';
import { retrieveResearchSources, searchClinicalTrials, searchEuropePMC } from './research-sources.js';
const mockFetch = async url => {
  if (url.includes('clinicaltrials.gov')) return { ok: true, json: async () => ({ studies: [
    { protocolSection: { identificationModule: { nctId: 'NCT12345678', briefTitle: 'Test trial' }, statusModule: { overallStatus: 'COMPLETED' }, designModule: { studyType: 'INTERVENTIONAL' } } }
  ] }) };
  return { ok: true, json: async () => ({ resultList: { result: [{ pmid: '21067829', title: 'Test publication', pubYear: '2010' }] } }) };
};
test('registry entries do not claim efficacy without results', async () => {
  const [trial] = await searchClinicalTrials('ibutamoren', { fetchImpl: mockFetch });
  assert.equal(trial.resultsPosted, false);
  assert.match(trial.evidenceNote, /does not demonstrate efficacy/);
});
test('Europe PMC produces stable citation URL', async () => {
  const [article] = await searchEuropePMC('ibutamoren', { fetchImpl: mockFetch });
  assert.equal(article.pmid, '21067829');
  assert.equal(article.url, 'https://europepmc.org/article/MED/21067829');
});
test('combined retrieval returns both sources', async () => {
  const data = await retrieveResearchSources('ibutamoren', { fetchImpl: mockFetch });
  assert.equal(data.trials.length, 1);
  assert.equal(data.literature.length, 1);
});
test('source outage does not discard other source', async () => {
  const data = await retrieveResearchSources('ibutamoren', { fetchImpl: async url => {
    if (url.includes('clinicaltrials.gov')) throw Error('offline');
    return mockFetch(url);
  } });
  assert.equal(data.status.clinicalTrials, 'unavailable');
  assert.equal(data.literature.length, 1);
});
test('rejects empty queries', async () => {
  await assert.rejects(searchClinicalTrials(' '), TypeError);
});
