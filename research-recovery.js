// Deterministic, fail-closed acceptance gate for a second-pass literature answer.
// The actual output guard and PubMed validator run before this gate.
export function evaluateResearchRecovery({
  candidate, finishReason, citationValid, requestedPmids, safetyResult
}) {
  const answer=typeof candidate==='string'?candidate.trim():'';
  if(!answer || answer.length<=100 || finishReason==='length')
    return {accepted:false,reason:'incomplete'};
  if(!citationValid || !Array.isArray(requestedPmids) || !requestedPmids.length)
    return {accepted:false,reason:'citation'};
  if(!requestedPmids.some(id => /^\d{6,9}$/.test(String(id)) &&
      new RegExp('\\b'+String(id)+'\\b').test(answer)))
    return {accepted:false,reason:'requested_pmid_missing'};
  if(!safetyResult || safetyResult.replaced || safetyResult.safe!==true)
    return {accepted:false,reason:'output_guard'};
  return {accepted:true,reason:'verified'};
}
