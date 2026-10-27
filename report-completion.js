// Q6 final-report completeness guard. No report text is logged.
const REPORT_SECTION = /(?:^|\n)\s*(?:#{1,4}\s*)?(?:Educational Research Summary|Executive Summary|Evidence Comparison|Human Clinical Evidence|Safety Considerations|Regulatory (?:Status|Limitations)|Conclusion)\b/im;
const TRANSITION_OPENING = /^(?:(?:thank you|thanks|got it|understood)[.!,:]?\s*)?(?:(?:I will|I'll|let me|I'm going to|I am going to)\s+(?:now\s+)?(?:prepare|generate|compile|create|put together)\b|(?:I have all (?:the )?information|(?:the )?report (?:will be|is being) prepared|please hold on|hold on for the (?:full )?report)\b)/i;
const INTAKE_QUESTION = /^\s*(?:#{1,3}\s*)?(?:Question\s*[1-6]\s*[:.])/i;

export function assessIntakeReport(reply) {
  const text = typeof reply === 'string' ? reply.trim() : '';
  const length = text.length;
  if (length < 650) return { complete: false, reason: 'too_short', length };
  const firstParagraph = text.split(/\n\s*\n/, 1)[0].slice(0, 350).trim();
  if (INTAKE_QUESTION.test(firstParagraph) && !REPORT_SECTION.test(text)) {
    return { complete: false, reason: 'intake_question', length };
  }
  // A complete report may QUOTE transition language anywhere in its body.
  // Only reject a transition-style opening when no substantive report section exists.
  if (TRANSITION_OPENING.test(firstParagraph) && !REPORT_SECTION.test(text)) {
    return { complete: false, reason: 'transition_only', length };
  }
  return { complete: true, reason: 'complete', length };
}
