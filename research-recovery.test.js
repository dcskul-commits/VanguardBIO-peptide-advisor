import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateResearchRecovery} from './research-recovery.js';
import {guardOutputSafety} from './output-safety.js';
const requestedPmids=['39325560'];
const question='Summarize BPC-157 research, PMID 39325560.';
const base='A 12-participant uncontrolled BPC-157 interstitial cystitis pilot study described injections during cystoscopy. This was not a randomized trial for muscle repair, and its observations do not establish clinical efficacy for muscle recovery. [PMID: 39325560](https://pubmed.ncbi.nlm.nih.gov/39325560/).';
function check(candidate, overrides={}) {
 const safetyResult=guardOutputSafety(candidate,question);
 return evaluateResearchRecovery({candidate,finishReason:'stop',
   citationValid:true,requestedPmids,safetyResult,...overrides});
}
test('safe source-grounded study summary can pass second-pass gate',()=>{
 assert.deepEqual(check(base),{accepted:true,reason:'verified'});
});
test('unsafe preparation steps remain blocked even with a valid study citation',()=>{
 const unsafe=base+'\nUse a syringe to add water to the vial.';
 assert.equal(check(unsafe).reason,'output_guard');
});
test('a cited historical source does not authorize reagent preparation directions',()=>{
 const unsafe=base+'\nThe study described adding water to the vial, then mixing gently.';
 assert.equal(check(unsafe).reason,'output_guard');
});
test('no requested PMID in candidate cannot pass even when another citation validates',()=>{
 const other=base.replaceAll('39325560','40756949');
 assert.equal(check(other).reason,'requested_pmid_missing');
});
test('retrieved evidence without matching verified PMID cannot pass',()=>{
 assert.equal(check(base,{requestedPmids:[]}).reason,'citation');
});
test('invalid or unverified citation cannot pass',()=>{
 assert.equal(check(base,{citationValid:false}).reason,'citation');
});
test('truncated output cannot pass',()=>{
 assert.equal(check(base,{finishReason:'length'}).reason,'incomplete');
});
test('too-short reply cannot pass',()=>{
 assert.equal(check('PMID: 39325560').reason,'incomplete');
});
test('missing guard result cannot pass',()=>{
 assert.equal(check(base,{safetyResult:null}).reason,'output_guard');
});
