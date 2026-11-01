// WP09 phase 1: conservative source provenance and citation audits.
// This module verifies retrieved metadata and flags potential misattribution.
// It does NOT certify that an abstract supports every adjacent claim.
const PMID=/^\d{6,9}$/;
const SAFE_NAMES=/^[A-Za-z][A-Za-z0-9 +()\-]{1,45}$/;
const PMID_LINK=/https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/(\d{6,9})\/?/gi;
const PMID_LABEL=/\bPMID\s*:?\s*\[?(\d{6,9})\]?/gi;
function norm(s){return String(s||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function tokens(s){return norm(s).split(/\s+/).filter(t=>t.length>=3);}
export function normalizeStudyTarget(raw){
 const cleaned=String(raw||'').trim().replace(/\s+/g,' ');
 if(!SAFE_NAMES.test(cleaned))return null;
 return cleaned;
}
const NAMES=Object.freeze({
 'KPV':['KPV','Lys-Pro-Val','lysine proline valine'],
 'BPC-157':['BPC-157','BPC 157'],
 'TB-500':['TB-500','TB 500'],
 'MK-677':['MK-677','MK 677','ibutamoren'],
 'GHK-Cu':['GHK-Cu','copper tripeptide-1']
});
function compoundAliases(target){
 const k=Object.keys(NAMES).find(k=>norm(k)===norm(target));
 return k?NAMES[k]:[target];
}
function containsAlias(text,alias){
 const hay=' '+norm(text)+' ', needle=' '+norm(alias)+' ';
 return needle.length>3&&hay.includes(needle);
}
export function classifyPublication(record){
 const types=(record.publicationTypes||[]).join(' ').toLowerCase();
 if(/randomized controlled trial/.test(types))return 'human_rct_indexed';
 if(/clinical trial/.test(types))return 'clinical_trial_indexed';
 if(/observational study|cohort study|case-control studies/.test(types))return 'human_observational_indexed';
 if(/case reports?/.test(types))return 'case_report_indexed';
 if(/systematic review|meta-analysis|review/.test(types))return 'review_not_primary';
 // Neither animal nor cell work can be certified from PubMed type alone.
 return 'study_design_unverified';
}
export function buildEvidenceLedger(studies,requestedTargets=[]){
 const targets=[...new Set(requestedTargets.map(normalizeStudyTarget).filter(Boolean))].slice(0,5);
 const result=[];
 const seen=new Set();
 for(const study of Array.isArray(studies)?studies:[]){
   const id=String(study?.pmid||'');
   if(!PMID.test(id)||seen.has(id)||typeof study.title!=='string'||!study.title.trim())continue;
   seen.add(id);
   const text=[study.title,study.abstract].filter(Boolean).join(' ');
   const matches=targets.filter(t=>compoundAliases(t).some(alias=>containsAlias(text,alias)));
   result.push(Object.freeze({
     pmid:id,url:'https://pubmed.ncbi.nlm.nih.gov/'+id+'/',
     title:study.title.trim().slice(0,300),
     date:typeof study.date==='string'?study.date.slice(0,80):'',
     publicationType:classifyPublication(study),
     matchedTargets:matches,
     relevance:matches.length?'target_mentioned_in_title_or_abstract':'target_not_verified_in_title_or_abstract',
     sourceScope:'pubmed_metadata_and_abstract_only',
     outcomeVerification:'not_certified',
     abstractAvailable:Boolean(String(study.abstract||'').trim())
   }));
 }
 return result;
}
function citedPmids(text){
 const match=[...String(text||'').matchAll(PMID_LINK),...String(text||'').matchAll(PMID_LABEL)];
 return [...new Set(match.map(m=>m[1]))];
}
export function auditResearchReport(report,ledger,{requireSourceForStudyClaims=true}={}){
 const lines=String(report||'').split(/\r?\n/);
 const byId=new Map((ledger||[]).map(x=>[x.pmid,x]));
 const findings=[];let citeCount=0;
 const studyClaim=/\b(?:a study|in (?:a|the) study|trial|patients|participants|mice|mouse|rats|rodent|human-derived cells|animal model|cell culture|demonstrated|observed|measured|found|reported|statistically significant)\b/i;
 const bibliography=/^\s*(?:#{1,6}\s*)?(?:retrieved pubmed references|references|bibliography|official regulatory sources|clinicaltrials\.gov)/i;
 let inBibliography=false;
 for(const [i,line] of lines.entries()){
   if(bibliography.test(line)){inBibliography=true;continue;}
   if(inBibliography)continue;
   const ids=citedPmids(line);
   if(ids.length)citeCount+=ids.length;
   for(const id of ids){
     const source=byId.get(id);
     if(!source){findings.push({code:'citation_not_retrieved',line:i+1,pmid:id});continue;}
     if(source.relevance!=='target_mentioned_in_title_or_abstract')
       findings.push({code:'citation_target_not_verified',line:i+1,pmid:id});
     // A valid PMID proves record provenance, NOT outcomes or clinical relevance.
   }
   if(requireSourceForStudyClaims&&studyClaim.test(line)&&ids.length===0&&
      !/\b(?:no|not|never|none|absence|lacking|insufficient|unverified|uncertain|no studies|could not verify)\b/i.test(line)){
     findings.push({code:'study_claim_without_inline_source',line:i+1});
   }
 }
 return {
   verifiedSourceCount:(ledger||[]).filter(x=>x.relevance==='target_mentioned_in_title_or_abstract').length,
   citedSourceCount:citeCount,
   findings,
   // No automated abstract-level or full-text entailment verified; human review remains necessary.
   claimSupportStatus:'not_automatically_verified',
   passingProvenance:!findings.some(x=>x.code==='citation_not_retrieved'||x.code==='citation_target_not_verified')
 };
}
