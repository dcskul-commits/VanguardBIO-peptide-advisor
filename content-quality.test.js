import test from 'node:test';
import assert from 'node:assert/strict';
import {guardContentQuality, auditCitationMetadata} from './content-quality.js';

test('research-only is not FDA approval', () => {
 const {reply}=guardContentQuality('MK-677 | approved for research only | S2.2.4\nNot FDA-approved for muscle repair or any indication outside research.');
 assert.doesNotMatch(reply,/approved for research only|outside research/i);
 assert.match(reply,/not FDA-approved for human therapeutic use/i);
 assert.match(reply,/not FDA-approved for any therapeutic indication/i);
});
test('BPC animal PK is not human PK, unrelated context is preserved',()=>{
 const {reply}=guardContentQuality('BPC-157\nDosing and Quality:\nNo standardized dosing protocols; half-life under 30 minutes; metabolism primarily hepatic.\nSafety is uncertain.');
 assert.match(reply,/No standardized dosing protocols/);
 assert.doesNotMatch(reply,/half-life under 30 minutes|metabolism primarily hepatic/);
 assert.match(reply,/Human pharmacokinetics and metabolism remain insufficiently characterized/);
 assert.match(reply,/Safety is uncertain/);
});
test('leaves unrelated and already accurate statements alone',()=>{
 const input='TB-500\nStudy in rodents reported half-life under 30 minutes.\nMK-677 is investigational and not FDA-approved for therapeutic use.\nWADA S2.2.4.';
 assert.equal(guardContentQuality(input).reply,input);
});
test('citation metadata mismatches are diagnostics and do not delete claims',()=>{
 const studies=[{pmid:'12345678',matchedCompounds:['BPC-157'],publicationTypes:['Review']}];
 const input='TB-500\nHuman Clinical Evidence:\nA randomized trial supported repair [PMID: 12345678](https://pubmed.ncbi.nlm.nih.gov/12345678/).';
 const problems=auditCitationMetadata(input,studies);
 assert.ok(problems.some(p=>p.type==='possible_compound_mismatch'));
 assert.ok(problems.some(p=>p.type==='review_near_trial_claim'));
 assert.equal(guardContentQuality(input).reply,input);
});
