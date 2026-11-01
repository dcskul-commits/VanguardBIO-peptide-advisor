import test from 'node:test';
import assert from 'node:assert/strict';
import {extractIntakePeptideTargets} from './wp09-intake-targets.js';
import {detectCompounds} from './pubmed.js';
const conversation=(name)=>[
 {role:'assistant',content:'Question 5: Are there specific peptides you already have in mind, or would you like me to identify candidates?'},
 {role:'user',content:name},
 {role:'assistant',content:'Question 6: What level of technical depth would you prefer?'},
 {role:'user',content:'full depth'}
];
test('KPV is detected by existing PubMed registry',()=>{
 assert.ok(detectCompounds('Please review KPV in mouse studies').includes('KPV'));
});
test('GHK-Cu alias is registered',()=>{
 assert.ok(detectCompounds('GHK-Cu').includes('GHK-Cu'));
});
test('standalone intake names become query targets',()=>{
 assert.deepEqual(extractIntakePeptideTargets(conversation('KPV')),['KPV']);
 assert.deepEqual(extractIntakePeptideTargets(conversation('selank')),['selank']);
 assert.deepEqual(extractIntakePeptideTargets(conversation('KPV, selank')),['KPV','selank']);
});
test('the assistant must not infer a molecule from symptoms or depth',()=>{
 assert.deepEqual(extractIntakePeptideTargets([{role:'user',content:'I want recovery and healing'}]),[]);
 assert.deepEqual(extractIntakePeptideTargets(conversation('broad overview')),[]);
 assert.deepEqual(extractIntakePeptideTargets(conversation('no specific peptide')),[]);
 assert.deepEqual(extractIntakePeptideTargets(conversation('none')),[]);
});
test('rejects obvious search-injection payload and oversized answers',()=>{
 assert.deepEqual(extractIntakePeptideTargets(conversation('KPV") OR cancer[All Fields]')),[]);
 assert.deepEqual(extractIntakePeptideTargets(conversation('a'.repeat(141))),[]);
});
