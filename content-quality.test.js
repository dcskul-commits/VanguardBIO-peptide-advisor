import test from 'node:test';
import assert from 'node:assert/strict';
import {guardContentQuality, auditCitationMetadata, appendRetrievedPubMedReferences, removeModelPubMedBibliography, refineReviewedEvidenceClaims} from './content-quality.js';

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

test('does not attribute citations after a new evidence-gaps heading to MK-677',()=>{
 const studies=[{pmid:'40789979',matchedCompounds:['BPC-157'],publicationTypes:['Review']}];
 const report='### MK-677\nClinical trial outcomes summarized.\n### Evidence Gaps and Research Needs\nBPC-157 review PMID: 40789979\n### Official regulatory sources';
 assert.equal(auditCitationMetadata(report,studies).length,0);
});
test('diagnostic identifies exact section line and excerpt',()=>{
 const studies=[{pmid:'12345678',matchedCompounds:['BPC-157'],publicationTypes:['Review']}];
 const problems=auditCitationMetadata('### TB-500\nHuman Clinical Evidence:\nA randomized trial cited PMID: 12345678.',studies);
 assert.equal(problems[0].section,'TB-500');
 assert.equal(problems[0].line,3);
 assert.match(problems[0].excerpt,/randomized trial/);
});
test('appends source-owned PubMed bibliography without pretending to verify outcomes',()=>{
 const studies=[{pmid:'21067829',title:'Ibutamoren in hip fracture patients',matchedCompounds:['MK-677'],publicationTypes:['Randomized Controlled Trial']}];
 const out=appendRetrievedPubMedReferences('Educational Research Summary\nConclusion',studies,true);
 assert.match(out,/PMID: 21067829/);
 assert.match(out,/indexed randomized clinical trial/);
 assert.match(out,/does not verify the exact population/);
 assert.equal(appendRetrievedPubMedReferences(out,studies,true),out);
 assert.equal(appendRetrievedPubMedReferences('Intro',studies,false),'Intro');
});

test('removes model PubMed bibliography while keeping trial citations and later conclusion',()=>{
 const report='## Executive Summary\nMK-677 trial [PMID: 21067829](https://pubmed.ncbi.nlm.nih.gov/21067829/).\n## References (Clickable PubMed Links)\nBPC-157 Reviews and Evidence:\nPMID: 40005999,\nMK-677 Clinical Trials:\nPMID: 41966639\n## Conclusion\nHuman exercise repair unproven.\n## Official Regulatory References\nWADA list';
 const out=removeModelPubMedBibliography(report);
 assert.match(out,/PMID: 21067829/);
 assert.doesNotMatch(out,/PMID: 41966639|PMID: 40005999/);
 assert.match(out,/Human exercise repair unproven/);
 assert.match(out,/WADA list/);
});
test('strips terminal bibliography and preserves reports without reference lists',()=>{
 const input='## Introduction\nScientific narrative.\n## Research References\n- PMID: 40005999';
 assert.equal(removeModelPubMedBibliography(input),'## Introduction\nScientific narrative.');
 assert.equal(removeModelPubMedBibliography('An answer with [PMID: 21067829](https://pubmed.ncbi.nlm.nih.gov/21067829/) inline.'),
 'An answer with [PMID: 21067829](https://pubmed.ncbi.nlm.nih.gov/21067829/) inline.');
});
test('single backend bibliography wins over mismatched model references',()=>{
 const studies=[{pmid:'21067829',title:'Ibutamoren hip fracture RCT',publicationTypes:['Randomized Controlled Trial'],matchedCompounds:['MK-677']},
 {pmid:'40789979',title:'BPC-157 narrative review',publicationTypes:['Review'],matchedCompounds:['BPC-157']}];
 const model='Research report\n## References (Clickable PubMed Links)\nMK-677:\nPMID: 40789979\n## Conclusion\nTrial outcomes were mixed.';
 const clean=removeModelPubMedBibliography(model);
 const out=appendRetrievedPubMedReferences(clean,studies,true);
 assert.equal((out.match(/Retrieved PubMed references \(bibliographic records\)/g)||[]).length,1);
 assert.doesNotMatch(out,/MK-677:\nPMID: 40789979/);
 assert.match(out,/PMID: 21067829/);
 assert.match(out,/PMID: 40789979/);
 assert.match(out,/compounds mentioned: BPC-157/);
 assert.match(out,/Trial outcomes were mixed/);
});


test('WP04-G4: source-authored intravesical injection is retained and contextualized',()=>{
 const input='- One small pilot in 12 women with interstitial cystitis reported symptom resolution after intravesical injection of BPC-157 [PMID: 39325560](https://pubmed.ncbi.nlm.nih.gov/39325560/).';
 const out=refineReviewedEvidenceClaims(input);
 assert.match(out.reply,/following BPC-157 intravesical injections during cystoscopy/);
 assert.match(out.reply,/PMID: 39325560/);
 assert.deepEqual(out.corrections,['bpc_pilot_route_context']);
});
test('WP04-G4: accurate source wording with cystoscopy does not get rewritten',()=>{
 const input='- In a 12-patient interstitial cystitis pilot, intravesical BPC-157 injections during cystoscopy were reported; no controls and no muscle recovery endpoint [PMID: 39325560](https://pubmed.ncbi.nlm.nih.gov/39325560/).';
 assert.equal(refineReviewedEvidenceClaims(input).reply,input);
});
test('WP04-G4: bladder instillation is corrected without changing the study citation',()=>{
 const input='- A BPC-157 pilot with interstitial cystitis reported benefits after bladder instillation [PMID: 39325560](https://pubmed.ncbi.nlm.nih.gov/39325560/).';
 const out=refineReviewedEvidenceClaims(input);
 assert.doesNotMatch(out.reply,/bladder instillation/);
 assert.match(out.reply,/injections during cystoscopy/);
 assert.match(out.reply,/PMID: 39325560/);
 assert.deepEqual(out.corrections,['bpc_pilot_instillation_precision']);
});
test('WP04-G4: term intravesical injection by itself is not a scientific error',()=>{
 const line='- A pilot with interstitial cystitis investigated BPC-157 intravesical injection during cystoscopy [PMID: 39325560](https://pubmed.ncbi.nlm.nih.gov/39325560/).';
 assert.equal(refineReviewedEvidenceClaims(line).reply,line);
});
test('WP04-G4: BPC review preclinical effects cannot become established human efficacy',()=>{
 const input='- A systematic review found mostly preclinical studies (animal and in vitro) showing BPC-157 promotes healing in muscle, tendon and bone injuries [PMID: 40756949](https://pubmed.ncbi.nlm.nih.gov/40756949/).';
 const out=refineReviewedEvidenceClaims(input);
 assert.doesNotMatch(out.reply,/promotes healing/i);
 assert.match(out.reply,/may affect tissue repair in preclinical models/i);
 assert.match(out.reply,/do not establish effectiveness or safety in humans/i);
 assert.match(out.reply,/PMID: 40756949/);
});
test('WP04-G4: MK-677 hip-fracture trial uses measured functional endpoints',()=>{
 const input='- MK-677 in elderly hip fracture patients (n=123), phase IIb: increased IGF-1 but limited functional improvements in muscle strength or recovery; trial stopped for heart failure concern [PMID: 21067829](https://pubmed.ncbi.nlm.nih.gov/21067829/).';
 const out=refineReviewedEvidenceClaims(input);
 assert.match(out.reply,/limited improvement in most functional performance measures/);
 assert.doesNotMatch(out.reply,/improvements in muscle strength or recovery/);
 assert.match(out.reply,/heart failure/);
});
test('WP04-G4: no corrections on different PMIDs or missing clinical context',()=>{
 const input='- BPC-157 promotes healing in animal models [PMID: 99999999].\n- Intravesical injection in other disease [PMID: 39325560].\n- MK-677 reported muscle strength in exercise study [PMID: 21067829].';
 assert.equal(refineReviewedEvidenceClaims(input).reply,input);
});
test('WP04-G4: leave backend PubMed bibliography and already cautious statements unchanged',()=>{
 const input='### Retrieved PubMed references (bibliographic records)\n- [PMID: 40756949](https://pubmed.ncbi.nlm.nih.gov/40756949/) — BPC-157 review, not a trial.\nBPC-157 animal experiments suggested possible effects on tissue repair; not established human effectiveness [PMID: 40756949](https://pubmed.ncbi.nlm.nih.gov/40756949/).';
 assert.equal(refineReviewedEvidenceClaims(input).reply,input);
});
