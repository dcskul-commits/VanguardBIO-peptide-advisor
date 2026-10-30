// WP04-G4: private citation-to-claim review. Run in Codespaces with:
// node wp04_g4_citation_review.mjs
// Saves results ONLY under ~/.wp04-g4-private; does not print report text.
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';

const endpoint = process.env.STAGING_URL || 'https://vanguardbio-peptide-advisor-staging.onrender.com/api/chat';
const prompts = [
  'Start the six-question educational research intake.',
  'I want to understand muscle recovery evidence.',
  'Compare human clinical evidence and safety.',
  'Compare BPC-157, TB-500, and MK-677.',
  'Focus on risks, drug interaction uncertainty, and FDA status.',
  'Prioritize human trials and distinguish animal findings.',
  'Explain evidence gaps, sourcing safety concerns, and questions for my clinician.'
];
const messages = [], stages = [];
for (let step = 0; step < prompts.length; step++) {
  messages.push({role:'user', content:prompts[step]});
  const resp = await fetch(endpoint, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({messages:messages.slice(-12).map(m=>({role:m.role,content:m.content.slice(0,2500)}))}),
    signal:AbortSignal.timeout(90000)
  });
  const payload = await resp.json().catch(()=>({}));
  if (!resp.ok || typeof payload.reply !== 'string' || !payload.reply.trim())
    throw new Error('Staging intake step '+step+' failed, HTTP '+resp.status);
  stages.push({step, status:resp.status, characters:payload.reply.length, finalReportHeading:/educational research summary/i.test(payload.reply)});
  messages.push({role:'assistant',content:payload.reply});
}
const report = messages.at(-1).content;
const fallbackDetected = /^I can explain published evidence and safety uncertainties about experimental peptides, but cannot provide reconstitution steps/i.test(report.trim());
const hasReportHeading = /educational research summary/i.test(report);
if (fallbackDetected || !hasReportHeading) {
  const privateDir = path.join(os.homedir(), '.wp04-g4-private');
  await mkdir(privateDir, {recursive:true, mode:0o700});
  const file = path.join(privateDir, 'citation-blocked-'+randomUUID()+'.json');
  await writeFile(file, JSON.stringify({
    note:'Private staging report diagnostic, do not commit.',
    reason:fallbackDetected ? 'OUTPUT_SAFETY_FALLBACK' : 'MISSING_REPORT_HEADING',
    stages,
    reportCharacters:report.length,
    report
  }, null, 2), {mode:0o600,flag:'wx'});
  console.log(JSON.stringify({
    status:'CITATION_REVIEW_BLOCKED',
    reason:fallbackDetected?'OUTPUT_SAFETY_FALLBACK':'MISSING_REPORT_HEADING',
    stagingStages:stages.length,
    finalCharacters:report.length,
    localPrivateFile:file,
    note:'Do not score a replaced or missing report as zero citations. Requires output safety guard review.'
  },null,2));
  process.exit(2);
}
const extractIds = text => [...new Set([...text.matchAll(/\bPMID\s*:?\s*\[?(\d{5,9})\]?|pubmed\.ncbi\.nlm\.nih\.gov\/(\d{5,9})/gi)].map(m=>m[1]||m[2]))];
const ids = extractIds(report);
const decode = text => String(text ?? '').replace(/&#x([0-9a-f]+);/gi, (_,num)=>String.fromCodePoint(parseInt(num,16)))
  .replace(/&#(\d+);/g,(_,num)=>String.fromCodePoint(Number(num)))
  .replace(/&(?:amp|lt|gt|quot|apos);/g, token=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'" }[token]));
const clean = text => decode(String(text??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
const blocks = (text,tag) => [...String(text).matchAll(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','gi'))].map(m=>m[1]);
const pubmed = [];
for(let start=0;start<ids.length;start+=10){
  const group=ids.slice(start,start+10);
  const url='https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id='+group.join(',')+'&retmode=xml';
  const resp=await fetch(url,{signal:AbortSignal.timeout(25000)});
  if(!resp.ok) throw Error('PubMed fetch failed: HTTP '+resp.status);
  const xml=await resp.text();
  for(const entry of blocks(xml,'PubmedArticle')){
    const citation=blocks(entry,'MedlineCitation')[0]??entry;
    const pmid=clean(blocks(citation,'PMID')[0]??'');
    if(!pmid)continue;
    const title=clean(blocks(citation,'ArticleTitle')[0]??'');
    const abstract=blocks(citation,'AbstractText').map(clean).join(' ');
    pubmed.push({
      pmid,title,abstract,publicationTypes:blocks(citation,'PublicationType').map(clean),
      meshTerms:blocks(citation,'DescriptorName').map(clean).slice(0,25),
      publicationYear:clean(blocks(citation,'Year')[0]??''),
      hasAbstract:Boolean(abstract)
    });
  }
}
const publications=new Map(pubmed.map(item=>[item.pmid,item]));
const claims=[];let section='';
const lines=report.split('\n');
for(let index=0;index<lines.length;index++){
  const line=lines[index].trim();
  if(/^#{1,6}\s/.test(line))section=line.replace(/^#+\s*/,'').slice(0,160);
  for(const pmid of extractIds(line)){
    const article=publications.get(pmid);
    const words=String(line).match(/\b(?:BPC[\s-]?157|TB[\s-]?500|MK[\s-]?677|ibutamoren)\b/gi)||[];
    const statedCompounds=[...new Set(words.map(w=>w.toLowerCase()))];
    const canonical = text=>String(text).toLowerCase().replace(/[\s-]/g,'');
    const sourceText=canonical((article?.title||'')+' '+(article?.abstract||''));
    const possibleMismatch=statedCompounds.length>0&&!statedCompounds.some(name=>sourceText.includes(canonical(name)));
    claims.push({
      reportLine:index+1, section, pmid, claimLine:line,
      publicationFound:Boolean(article), sourceTitle:article?.title||null,
      possibleCompoundMismatch:possibleMismatch,
      review: {
        compoundActuallyStudied:'UNREVIEWED',
        populationAndSpecies:'UNREVIEWED',
        interventionAndDoseContext:'UNREVIEWED',
        outcomesSupported:'UNREVIEWED',
        strengthOfEvidence:'UNREVIEWED',
        overallVerdict:'UNREVIEWED',
        reviewerNotes:''
      }
    });
  }
}
const directory=path.join(os.homedir(),'.wp04-g4-private');
await mkdir(directory,{recursive:true,mode:0o700});
const token=randomUUID();
const reportFile=path.join(directory,'citation-report-'+token+'.md');
const reviewFile=path.join(directory,'citation-worksheet-'+token+'.json');
await writeFile(reportFile,report,{mode:0o600,flag:'wx'});
await writeFile(reviewFile,JSON.stringify({
  warning:'PRIVATE LOCAL REVIEW ONLY. Do not commit or paste report/worksheet.',
  source:'Synthetic seven-turn staging intake; this may differ from an earlier report.',
  stagedResponses:stages, citations:ids,
  citationOccurrences:claims,
  sourceRecords:pubmed,
  assessmentInstructions:[
    'Read the full claim and actual study abstract or full text; do not rely only on title or match flags.',
    'Confirm compound identity, species/population, study design, intervention, endpoint and conclusion.',
    'Distinguish human randomized trials from animal/cell/review evidence.',
    'Mark each citation occurrence SUPPORTED, OVERSTATED, MISATTRIBUTED or UNCERTAIN.',
    'Research source metadata cannot alone prove a clinical claim; obtain full text when needed.'
  ]
},null,2),{mode:0o600,flag:'wx'});
console.log(JSON.stringify({
  status:'PRIVATE_CITATION_REVIEW_CREATED',
  stagingStages:stages.length,
  reportCharacters:report.length,
  uniquePubmedIds:ids.length,
  pubmedRecordsRetrieved:pubmed.length,
  missingPubmedIds:ids.filter(id=>!publications.has(id)),
  citedLineOccurrences:claims.length,
  possibleCompoundMismatchCount:claims.filter(c=>c.possibleCompoundMismatch).length,
  reportFile, reviewFile,
  note:'Inspect locally only; citation-to-claim accuracy requires independent review.'
},null,2));
