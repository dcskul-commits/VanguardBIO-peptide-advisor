// Defense-in-depth for experimental peptide preparation guidance.
// Heuristic filter; live model behavior requires additional acceptance testing.
const compound = /\b(?:BPC[\s-]?157|TB[\s-]?500|MK[\s-]?677|ibutamoren|ipamorelin|research[- ]use peptide|experimental peptide)\b/i;
const preparation = /\b(?:reconstitut\w*|bacteriostatic|syringe|needle|inject\w*|mixing|dilut\w*|vial|powder)\b/i;
const steps = /(?:^|\n)\s*(?:\d+[.)]|[-*])\s*(?:using|inject\w*|add|draw|mix|swirl|dissolv\w*|fill|choose|select|use|place|rotate|transfer|combine|pour)\b/im;
const actions = /\b(?:inject\w*|add\w*|draw\w*|mix\w*|swirl\w*|dissolv\w*|dilut\w*|place|rotate|transfer|combine|pour)\b.{0,100}\b(?:water|vial|powder|peptide|syringe|solution|liquid|container)\b/i;
const equipment = /\b(?:insulin syringe|needle (?:size|gauge)|syringe (?:size|gauge)|\d+(?:\.\d+)?\s*mL|\d{2}\s*[-–]\s*\d{2}\s*gauge)\b/i;
const directions = /\b(?:use a|commonly used|should use|choose|select|process involves|step.by.step|slowly|gently|down the side)\b/i;
// Whole-procedure prose that does not use numbered steps or the original direction phrases.
const physicalAction = /\b(?:dissolv\w*|swirl\w*|rotat\w*|plac\w*|add\w*|pour\w*|transferr?\w*|combin\w*|fill\w*|draw\w*|mix\w*)\b/i;
const material = /\b(?:liquid|water|solution|powder|vial|container|bacteriostatic|syringe)\b/i;
const processSignal = /\b(?:then|until|afterwards?|before|first|next|to prepare|to reconstitute|against the inside|inside wall|into the|with bacteriostatic|with water|gently|slowly)\b/i;
const refusalOrNegation = /\b(?:do not|don't|never|avoid|cannot|can't|should not|not recommended|not validated|no established)\b/i;

export const SAFE_REPLY = 'I can explain published evidence and safety uncertainties about experimental peptides, but cannot provide reconstitution steps, injection preparation, syringe or needle specifications, mixing volumes, or individualized administration guidance. Consult a licensed healthcare professional or pharmacist for medical decisions.';

function containsProceduralProse(s) {
  // Inspect sentences individually; a disclaimer in one sentence must not
  // exempt procedural directions in a subsequent sentence.
  const units = s.split(/(?<=[.!?])\s+|\n+/).map(x => x.trim()).filter(Boolean);
  return units.some(unit => {
    if (!physicalAction.test(unit) || !material.test(unit)) return false;
    // Pure negative prohibitions are educational; instructions with a
    // preparation sequence remain blocked, even following a refusal.
    if (refusalOrNegation.test(unit) && !processSignal.test(unit)) return false;
    return processSignal.test(unit) || /\b(?:dissolv\w*|swirl\w*|rotat\w*)\b.{0,75}\b(?:powder|liquid|water|vial|container)\b/i.test(unit);
  });
}

export function assessOutputSafety(reply, context = '') {
  const s = String(reply ?? '');
  if (!compound.test(s + ' ' + context) || !preparation.test(s + ' ' + context)) return {safe:true,reason:'no_procedure'};
  const procedural = steps.test(s) || (actions.test(s) && directions.test(s)) || containsProceduralProse(s);
  const specification = equipment.test(s) && directions.test(s);
  return procedural || specification ? {safe:false,reason:procedural?'procedure':'equipment'} : {safe:true,reason:'educational'};
}
export function guardOutputSafety(reply, context = '') {
  const result = assessOutputSafety(reply, context);
  return {...result, replaced:!result.safe, reply:result.safe ? reply : SAFE_REPLY};
}
