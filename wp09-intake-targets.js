// WP09 staging: extract only explicitly named research targets from a previous
// "which peptides?" intake question. Never infer a compound from symptoms/goals.
const QUESTION=/\b(?:specific|particular|which|what|any)\b.{0,110}\bpeptides?\b|\bpeptides?\b.{0,70}\b(?:in mind|interested|name|investigate)\b/i;
const REJECT=/\b(?:none|no preference|not sure|identify|recommend|you choose|any peptide|no specific|all peptides|surprise me|general|don't know|not applicable)\b/i;
const NAME=/^[a-z][a-z0-9]*(?:[- ][a-z0-9]+){0,2}$/i;
const KNOWN=[{regex:/\bKPV\b/i,name:'KPV'},{regex:/\bBPC[\s-]?157\b/i,name:'BPC-157'},
 {regex:/\bTB[\s-]?500\b/i,name:'TB-500'},{regex:/\b(?:MK[\s-]?677|ibutamoren)\b/i,name:'MK-677'},
 {regex:/\bGHK[\s-]?Cu\b/i,name:'GHK-Cu'}];
const BAD=new Set(['broad','plain','technical','human','clinical','recovery','healing','oncology','maybe',
 'unsure','study','studies','safety','evidence','literature','research','full','depth','none','general']);
function normalized(s){return String(s||'').trim().replace(/\s+/g,' ');}
function fromAnswer(answer){
 const text=normalized(answer);if(!text||text.length>140||REJECT.test(text))return [];
 const result=KNOWN.filter(x=>x.regex.test(text)).map(x=>x.name);
 // Only accept previously unrecognized short *standalone* tokens as targets,
 // rather than guessing peptides from free-form health/intake narratives.
 for(const chunk of text.split(/[,;/]+/)){
   const x=normalized(chunk).replace(/^(?:the peptide|peptide|specifically|also|and)\s+/i,'');
   if(!NAME.test(x)||x.length>34||BAD.has(x.toLowerCase())||!/[a-z]/i.test(x))continue;
   if(KNOWN.some(k=>k.regex.test(x)))continue;
   if(x.split(' ').length>1&&!/-|\d/.test(x))continue;
   result.push(x);
 }
 return [...new Set(result)].slice(0,4);
}
export function extractIntakePeptideTargets(messages) {
 if(!Array.isArray(messages))return [];
 const entries=messages.filter(x=>x&&['user','assistant'].includes(x.role)&&typeof x.content==='string');
 for(let i=entries.length-2;i>=0;i--){
   if(entries[i].role==='assistant'&&QUESTION.test(entries[i].content)&&entries[i+1]?.role==='user'){
     return fromAnswer(entries[i+1].content);
   }
 }
 return [];
}
