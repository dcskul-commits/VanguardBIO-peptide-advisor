// Report-only content-quality safeguards. These are not a substitute for full-text study review.
export function guardContentQuality(reply) {
  if (typeof reply !== 'string') return {reply, corrections: []};
  const corrections = [];
  let inBpc = false;
  const lines = reply.split('\n').map(line => {
    const heading = line.trim().replace(/^#{1,6}\s*/, '').replace(/^\d+(?:\.\d+)*[.)]?\s+/, '').replace(/\*/g,'');
    if (/^BPC[\s-]?157(?:\s*[:(]|$)/i.test(heading)) inBpc = true;
    else if (/^(?:TB[\s-]?500|MK[\s-]?677|ibutamoren|conclusion|regulatory and anti-doping)(?:\s*[:(]|$)/i.test(heading)) inBpc = false;
    let next = line;
    const approval = /\b(?:FDA[- ]approved for research|approved for research (?:only|use|purposes only))\b/gi;
    if (approval.test(next)) {
      next = next.replace(approval, 'investigational; not FDA-approved for human therapeutic use');
      corrections.push('research_approval_language');
    }
    if (/\bnot FDA[- ]approved for [^.;\n]*?\bor any indication outside research\b/i.test(next)) {
      next = next.replace(/\bnot FDA[- ]approved for [^.;\n]*?\bor any indication outside research\b/gi,
        'not FDA-approved for any therapeutic indication');
      corrections.push('research_approval_language');
    }
    if ((inBpc || /\bBPC[\s-]?157\b/i.test(next)) &&
        /(?:half[- ]life\s+(?:is\s+)?(?:under|less than|<)\s*\d+|metaboli[sz](?:ed|ation)?\s+primarily\s+(?:in\s+)?(?:the\s+)?liver|(?:primarily|mainly)\s+(?:hepatic|liver)\s+metaboli[sz])/i.test(next)) {
      const bad = /(?:half[- ]life\s+(?:is\s+)?(?:under|less than|<)\s*\d+|metaboli[sz](?:ed|ation)?\s+primarily\s+(?:in\s+)?(?:the\s+)?liver|(?:primarily|mainly)\s+(?:hepatic|liver)\s+metaboli[sz])/i;
      let changed = false;
      const remaining = next.split(/;\s*/).filter(clause => {
        if (!bad.test(clause)) return true;
        changed = true; return false;
      });
      if (changed) {
        remaining.push('Human pharmacokinetics and metabolism remain insufficiently characterized; animal half-life results are not established human values');
        next = remaining.join('; ');
        corrections.push('animal_pk_extrapolation');
      }
    }
    return next;
  });
  return {reply: lines.join('\n'), corrections: [...new Set(corrections)]};
}

// Diagnostic only: PMID retrieval and metadata do not establish exact endpoint support.
export function auditCitationMetadata(reply, studies) {
  if (typeof reply !== 'string' || !Array.isArray(studies)) return [];
  const byPmid = new Map(studies.map(s => [String(s.pmid), s]));
  let section = '';
  const findings = [];
  for (const line of reply.split('\n')) {
    const heading = line.trim().replace(/^#{1,6}\s*/, '').replace(/^\d+(?:\.\d+)*[.)]?\s+/, '');
    if (/^(?:BPC[\s-]?157|TB[\s-]?500|MK[\s-]?677|ibutamoren)\b/i.test(heading))
      section = /^BPC/i.test(heading) ? 'BPC-157' : /^TB/i.test(heading) ? 'TB-500' : 'MK-677';
    if (/^(?:conclusion|references|official regulatory|retrieved evidence index)\b/i.test(heading)) section = '';
    if (!section || !/\bPMID\b|pubmed\.ncbi\.nlm\.nih\.gov/i.test(line)) continue;
    for (const pmid of new Set([...line.matchAll(/(?:PMID\s*:?\s*\[?|pubmed\.ncbi\.nlm\.nih\.gov\/)(\d{6,9})/gi)].map(m => m[1]))) {
      const study = byPmid.get(pmid);
      if (!study) continue; // Existing validator rejects unrecognized PMIDs.
      if (study.matchedCompounds?.length && !study.matchedCompounds.includes(section))
        findings.push({type: 'possible_compound_mismatch',pmid,section});
      if (/\b(?:review|meta-analysis)\b/i.test((study.publicationTypes||[]).join(' ')) &&
          /\b(?:RCT|randomized|controlled trial)\b/i.test(line) && !/\b(?:review|synthesi[sz])\b/i.test(line))
        findings.push({type:'review_near_trial_claim',pmid,section});
    }
  }
  return findings.slice(0,12);
}
