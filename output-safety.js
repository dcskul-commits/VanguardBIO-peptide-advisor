// Defense-in-depth for experimental peptide preparation guidance; not a complete classifier.
const compound = /\b(?:BPC[\s-]?157|TB[\s-]?500|MK[\s-]?677|ibutamoren|ipamorelin|research[- ]use peptide|experimental peptide)\b/i;
const preparation = /\b(?:reconstitut\w*|bacteriostatic|syringe|needle|inject\w*|mixing|dilut\w*)\b/i;
const steps = /(?:^|\n)\s*(?:\d+[.)]|[-*])\s*(?:using|inject\w*|add|draw|mix|swirl|dissolv\w*|fill|choose|select|use)\b/im;
const actions = /\b(?:inject\w*|add\w*|draw\w*|mix\w*|swirl\w*|dissolv\w*|dilut\w*)\b.{0,100}\b(?:water|vial|powder|peptide|syringe|solution)\b/i;
const equipment = /\b(?:insulin syringe|needle (?:size|gauge)|syringe (?:size|gauge)|\d+(?:\.\d+)?\s*mL|\d{2}\s*[-–]\s*\d{2}\s*gauge)\b/i;
const directions = /\b(?:use a|commonly used|should use|choose|select|process involves|step.by.step|slowly|gently|down the side)\b/i;
export const SAFE_REPLY = 'I can explain published evidence and safety uncertainties about experimental peptides, but cannot provide reconstitution steps, injection preparation, syringe or needle specifications, mixing volumes, or individualized administration guidance. Consult a licensed healthcare professional or pharmacist for medical decisions.';
export function assessOutputSafety(reply, context = '') {
  const s = String(reply ?? '');
  if (!compound.test(s + ' ' + context) || !preparation.test(s)) return {safe:true,reason:'no_procedure'};
  const procedural = steps.test(s) || (actions.test(s) && directions.test(s));
  const specification = equipment.test(s) && directions.test(s);
  return procedural || specification ? {safe:false,reason:procedural?'procedure':'equipment'} : {safe:true,reason:'educational'};
}
export function guardOutputSafety(reply, context = '') {
  const result = assessOutputSafety(reply, context);
  return {...result, replaced:!result.safe, reply:result.safe ? reply : SAFE_REPLY};
}
