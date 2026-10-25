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
        /(?:half[- ]life\s+(?:is\s+)?(?:under|less than|<)\s*\d+|(?:metabolism\s+primarily\s+(?:hepatic|in\s+(?:the\s+)?liver)|metaboli[sz](?:ed|ation)?\s+primarily\s+(?:in\s+)?(?:the\s+)?liver)|(?:primarily|mainly)\s+(?:hepatic|liver)\s+metaboli[sz])/i.test(next)) {
      const bad = /(?:half[- ]life\s+(?:is\s+)?(?:under|less than|<)\s*\d+|(?:metabolism\s+primarily\s+(?:hepatic|in\s+(?:the\s+)?liver)|metaboli[sz](?:ed|ation)?\s+primarily\s+(?:in\s+)?(?:the\s+)?liver)|(?:primarily|mainly)\s+(?:hepatic|liver)\s+metaboli[sz])/i;
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

// Diagnostic only. Inspect final report text and only sections with a single
// named compound heading; cross-compound tables/references are not attributed
// to the most recently mentioned compound.
export function auditCitationMetadata(reply, studies) {
  if (typeof reply !== 'string' || !Array.isArray(studies)) return [];
  const byPmid = new Map(studies.map(s => [String(s.pmid), s]));
  const findings = [];
  let section = '';
  const heading = line => line.trim().replace(/^#{1,6}\s*/, '')
    .replace(/^\d+(?:\.\d+)*[.)]?\s+/, '').replace(/\*/g, '').trim();
  const compoundHeading = /^(?:BPC[\s-]?157|TB[\s-]?500|MK[\s-]?677|ibutamoren)(?:\s*\([^)]*\))?\s*:?\s*$/i;
  const stopHeading = /^(?:comparison|comparative|evidence gaps|safety and regulatory|safety considerations|dosing|questions|conclusion|references|pubmed|official regulatory|retrieved evidence|clinicaltrials|europe pmc|educational research|executive summary)\b/i;
  const knownSubheading = /^(?:human clinical evidence|preclinical evidence|human evidence|safety|regulatory|research gaps|evidence quality|clinical outcomes|dosing and quality)\s*:?\s*$/i;
  for (const [i, line] of reply.split('\n').entries()) {
    const h = heading(line);
    if (compoundHeading.test(h)) section = /BPC/i.test(h) ? 'BPC-157' : /TB/i.test(h) ? 'TB-500' : 'MK-677';
    else if (stopHeading.test(h)) section = '';
    else if (section && (/^#{1,4}\s/.test(line) || /^\d+[.)]\s+\p{L}/u.test(line)) && !knownSubheading.test(h)) section = '';
    if (!section || !/\bPMID\b|pubmed\.ncbi\.nlm\.nih\.gov/i.test(line)) continue;
    const pmids = [...new Set([...line.matchAll(/(?:PMID\s*:?\s*\[?|pubmed\.ncbi\.nlm\.nih\.gov\/)(\d{6,9})/gi)].map(m=>m[1]))];
    for (const pmid of pmids) {
      const study = byPmid.get(pmid);
      if (!study) continue;
      const base = { pmid, section, line: i + 1, excerpt: line.trim().slice(0, 150) };
      if (study.matchedCompounds?.length && !study.matchedCompounds.includes(section))
        findings.push({type:'possible_compound_mismatch', ...base});
      const types = (study.publicationTypes || []).join(' ').toLowerCase();
      if (/\b(?:review|meta-analysis)\b/.test(types) &&
          /\b(?:RCT|randomized|controlled trial)\b/i.test(line) &&
          !/\b(?:review|synthesi[sz])\b/i.test(line))
        findings.push({type:'review_near_trial_claim', ...base});
    }
  }
  return findings.slice(0, 12);
}

// Preserve traceable, source-owned citations when a long report otherwise
// omits them. This is a BIBLIOGRAPHIC index, not a claim-level validation.
// Cite only retrieved PubMed sources that name a compound in title/abstract.
export function appendRetrievedPubMedReferences(reply, studies, completedReport) {
  if (!completedReport || typeof reply !== 'string' || !Array.isArray(studies) || !studies.length)
    return reply;
  if (/^#{0,4}\s*(?:retrieved|verified|compound[- ]attributed)?\s*pubmed\s+(?:study\s+)?references\b/im.test(reply))
    return reply; // Existing bibliography already present.
  const candidates = studies.filter(s => /^\d{6,9}$/.test(String(s.pmid)) &&
    Array.isArray(s.matchedCompounds) && s.matchedCompounds.length &&
    typeof s.title === 'string' && s.title.trim());
  if (!candidates.length) return reply;
  const unique = new Map(candidates.map(s => [String(s.pmid),s]));
  const entries = [...unique.values()].slice(0, 8).map(s => {
    const types = (s.publicationTypes||[]).join(' ').toLowerCase();
    const classification = /randomized controlled trial/.test(types) ? 'indexed randomized clinical trial'
      : /\bclinical trial\b/.test(types) ? 'indexed clinical trial'
      : /\b(systematic review|meta-analysis|review)\b/.test(types) ? 'review/synthesis, not a primary trial'
      : 'study design not established from metadata';
    const title = s.title.replace(/[\n\r|]/g,' ').slice(0,180);
    const names = s.matchedCompounds.join(', ');
    return '- [PMID: '+s.pmid+'](https://pubmed.ncbi.nlm.nih.gov/'+s.pmid+
      '/) — '+title+'; indexed as: '+classification+'; compounds mentioned: '+names+'.';
  });
  return reply + '\n\n### Retrieved PubMed references (bibliographic records)\n\n' +
    'These links are PubMed records retrieved for this request. Inclusion does not verify the exact population, intervention, endpoint or claim in this report; verify each abstract and study before citing an outcome.\n\n' +
    entries.join('\n');
}
