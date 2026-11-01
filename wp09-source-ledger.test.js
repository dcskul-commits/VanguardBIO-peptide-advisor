import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStudyTarget,classifyPublication,buildEvidenceLedger,auditResearchReport} from './wp09-source-ledger.js';
const kpv={pmid:'18061177',title:'KPV modulates inflammation in human cell lines and murine colitis',abstract:'Human cell culture and mouse colitis models with KPV.',publicationTypes:['Journal Article'],date:'2008'};
const bpc={pmid:'39325560',title:'BPC-157 interstitial cystitis pilot report',abstract:'Exploratory human pilot BPC-157 in bladder conditions, not muscle outcomes.',publicationTypes:['Case Reports']};
const other={pmid:'21067829',title:'Ibutamoren in older hip fracture patients',abstract:'Trial of ibutamoren in hip fracture patients',publicationTypes:['Randomized Controlled Trial']};
test('identifies KPV evidence from verified PubMed metadata without inventing human trials',()=>{
 const ledger=buildEvidenceLedger([kpv],['KPV']);
 assert.equal(ledger.length,1);
 assert.deepEqual(ledger[0].matchedTargets,['KPV']);
 assert.equal(ledger[0].publicationType,'study_design_unverified');
 assert.equal(ledger[0].outcomeVerification,'not_certified');
});
test('preserves compound distinctions and does not misattribute other peptide',()=>{
 const l=buildEvidenceLedger([other,bpc],['KPV']);
 assert.equal(l.every(x=>x.relevance==='target_not_verified_in_title_or_abstract'),true);
 const audit=auditResearchReport('KPV improved muscle function [PMID: 21067829](https://pubmed.ncbi.nlm.nih.gov/21067829/).',l);
 assert.equal(audit.passingProvenance,false);
 assert.ok(audit.findings.some(x=>x.code==='citation_target_not_verified'));
});
test('unknown target cannot inject raw PubMed query syntax',()=>{
 assert.equal(normalizeStudyTarget('KPV'), 'KPV');
 assert.equal(normalizeStudyTarget('KPV") OR ("cancer'), null);
 assert.equal(normalizeStudyTarget(' '),null);
});
test('blocks cited PMID missing from fetched records',()=>{
 const r=auditResearchReport('Study reported healing [PMID: 99999999](https://pubmed.ncbi.nlm.nih.gov/99999999/).',buildEvidenceLedger([kpv],['KPV']));
 assert.equal(r.passingProvenance,false);
 assert.ok(r.findings.some(x=>x.code==='citation_not_retrieved'));
});
test('verified PMID still does not automatically establish claim-to-outcome entailment',()=>{
 const ledger=buildEvidenceLedger([kpv],['KPV']);
 const r=auditResearchReport('A study claimed KPV repairs muscle in humans [PMID: 18061177](https://pubmed.ncbi.nlm.nih.gov/18061177/).',ledger);
 assert.equal(r.passingProvenance,true);
 assert.equal(r.claimSupportStatus,'not_automatically_verified');
});
test('flags specific unsupported study claims without inline citation',()=>{
 const r=auditResearchReport('Animal model demonstrated enhanced muscle function and regeneration.\n## References\n- PMID: 18061177',buildEvidenceLedger([kpv],['KPV']));
 assert.ok(r.findings.some(x=>x.code==='study_claim_without_inline_source'));
});
test('publication type is treated as metadata not definitive patient evidence',()=>{
 assert.equal(classifyPublication(other),'human_rct_indexed');
 assert.equal(classifyPublication(kpv),'study_design_unverified');
});
test('duplicate PMID deduped, metadata provenance preserved',()=>{
 const l=buildEvidenceLedger([kpv,kpv],['KPV']);assert.equal(l.length,1);
 assert.equal(l[0].sourceScope,'pubmed_metadata_and_abstract_only');
});
