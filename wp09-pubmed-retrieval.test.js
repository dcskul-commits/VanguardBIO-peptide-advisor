import test from 'node:test';
import assert from 'node:assert/strict';
import {searchPubMed} from './pubmed.js';

test('WP09 retrieves PubMed record for an unfamiliar explicitly named peptide',async()=>{
 const previous=globalThis.fetch;
 const queries=[];
 globalThis.fetch=async (u)=>{
   const url=new URL(u);queries.push(url);
   if(url.pathname.endsWith('/esearch.fcgi'))return new Response(JSON.stringify({esearchresult:{idlist:['12345678']}}),{status:200,headers:{'Content-Type':'application/json'}});
   if(url.pathname.endsWith('/efetch.fcgi'))return new Response(
     'PMID- 12345678\nTI  - Selank research in experimental rats\nAB  - Selank was investigated in rodent models.\nDP  - 2021\nPT  - Journal Article\n',
     {status:200,headers:{'Content-Type':'text/plain'}});
   throw Error('unexpected endpoint');
 };
 try{
   const records=await searchPubMed('selank human clinical evidence',3,{explicitTargets:['selank']});
   assert.equal(records.length,1);
   assert.equal(records[0].pmid,'12345678');
   assert.ok(records[0].matchedCompounds.includes('selank'));
   assert.ok(queries.every(x=>x.hostname==='eutils.ncbi.nlm.nih.gov'));
   assert.ok(queries.some(x=>x.pathname.endsWith('/esearch.fcgi')));
   assert.ok(queries.some(x=>x.pathname.endsWith('/efetch.fcgi')));
 }finally{globalThis.fetch=previous;}
});
