// Defense-in-depth for research-use peptide preparation; not a complete classifier.
// Evaluate one sentence or list item at a time to avoid joining unrelated words
// across a long educational report. Report headings do not exempt unsafe instructions.
const compound = /\b(?:BPC[\s-]?157|TB[\s-]?500|MK[\s-]?677|ibutamoren|ipamorelin|research[- ]use peptide|experimental peptide)\b/i;
const material = /\b(?:water|liquid|powder|solution|vial|needle|syringe|container|bacteriostatic)\b/i;
const physicalAction = /\b(?:reconstitut\w*|inject\w*|dissolv\w*|swirl\w*|rotat\w*|plac\w*|add\w*|pour\w*|transferr?\w*|combin\w*|fill\w*|draw\w*|mix\w*|dilut\w*|prepar\w*)\b/i;
const equipment = /\b(?:insulin syringe|needle (?:size|gauge)|syringe (?:size|gauge)|\d+(?:\.\d+)?\s*mL|\d{2}\s*[-–]\s*\d{2}\s*gauge)\b/i;
const processCue = /\b(?:then|until|afterwards?|first|next|to prepare|to reconstitute|against the inside|inside wall|into the|with bacteriostatic|with water|gently|slowly|down the side)\b/i;
const imperative = /^(?:(?:first|next|then)\s*,?\s*)?(?:using|use|inject\w*|add|draw|mix|swirl|dissolv\w*|fill|choose|select|place|rotate|transfer|combine|pour|reconstitute|prepare)\b/i;
const direction = /\b(?:use a|should use|commonly used|choose|select|process involves|step.by.step|the steps are|follow these steps|can use)\b/i;
const evidence = /\b(?:study|studies|pilot|paper|trial|trials|publication|pubmed|PMID|clinical|animals?|rodents?|research|evidence|methods?|protocols?|literature|historical|investigational|regulatory|safety|risk|contamination|sterility|uncertain|unknown|not established|insufficient|lack of|unapproved)\b/i;
const negation = /\b(?:do not|don't|never|avoid|cannot|can't|should not|not recommended|not validated|no established|not provide|does not recommend|shouldn't|must not)\b/i;
const studyMethod = /\b(?:administered|was given|were given|used in (?:a |the )?(?:study|trial|animal)|reported|investigated|evaluated|assessed|described|injected|injection(?:s)? (?:were|was)|performed|conducted)\b/i;
// "Into the bladder wall" is anatomical, not a preparation sequence.
// Actual handling sequences cannot acquire an exception from study citations.
const operationalSequence = /\b(?:then|until|afterwards?|first|next|to prepare|to reconstitute|against the inside|inside wall|with bacteriostatic|with water|gently|slowly|down the side)\b/i;
const studyAttribution = /\b(?:study|studies|trial|trials|pilot|publication|paper|article|authors?|methods?|patients?|participants?|subjects?|during cystoscopy|intravesical|clinical|animal|research|PMID)\b/i;

export const SAFE_REPLY = 'I can explain published evidence and safety uncertainties about experimental peptides, but cannot provide reconstitution steps, injection preparation, syringe or needle specifications, mixing volumes, or individualized administration guidance. Consult a licensed healthcare professional or pharmacist for medical decisions.';

function unitsOf(reply) {
  // Keep each bullet/numbered item and sentence distinct. Refusals in one
  // sentence do not exempt directions in later sentences.
  return reply.split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9\-*])/).map(x=>x.trim()).filter(Boolean);
}
function assessUnit(raw) {
  const s=raw.replace(/^\s*(?:[-*]\s+|\d+[.)]\s+)/,'').trim();
  if(!s || !material.test(s)) return null;
  const hasAction=physicalAction.test(s);
  const hasEquipment=equipment.test(s);
  const directs=imperative.test(s)||direction.test(s);
  const hasSequence=processCue.test(s);
  const negative=negation.test(s);
  const academic=evidence.test(s);
  // Avoid suppressing an explicit later instruction because an earlier
  // negative warning happens elsewhere in the report.
  if(negative && !hasSequence) return null;
  // Source-attributed, past-tense methods descriptions are educational.
  // The exception is clause-local and never covers directives, equipment
  // recommendations, or operational handling sequences.
  if(academic && studyAttribution.test(s) && studyMethod.test(s) &&
      !directs && !operationalSequence.test(s)) return null;
  if(hasEquipment && (directs || (hasSequence && hasAction))) return 'equipment';
  if(hasAction && ((directs && !negative) || (hasSequence && (!academic || directs)))) return 'procedure';
  return null;
}
export function assessOutputSafety(reply, context='') {
  const s=String(reply??'');
  if(!compound.test(s+' '+context)) return {safe:true,reason:'no_compound'};
  for(const unit of unitsOf(s)){
    const reason=assessUnit(unit);
    if(reason) return {safe:false,reason};
  }
  return {safe:true,reason:'educational'};
}
export function guardOutputSafety(reply,context='') {
  const result=assessOutputSafety(reply,context);
  return {...result,replaced:!result.safe,reply:result.safe?reply:SAFE_REPLY};
}
