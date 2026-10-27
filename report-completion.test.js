import test from 'node:test';
import assert from 'node:assert/strict';
import { assessIntakeReport } from './report-completion.js';

const report = '## Educational Research Summary\n\n' +
  'Human clinical evidence for these experimental compounds remains limited. '.repeat(16) +
  '\n\n## Evidence Comparison\n\nNo outcome should be inferred from animal experiments alone.';

test('accepts substantive final report', () => assert.equal(assessIntakeReport(report).complete, true));
test('accepts report containing incidental transition phrase', () => {
  const input = report + '\n\nA common marketing claim is "I will prepare the report now."';
  assert.deepEqual(assessIntakeReport(input), {complete:true,reason:'complete',length:input.length});
});
test('accepts report whose opening quotes a transition but has actual report sections', () => {
  const input = 'I will prepare your report is an example of wording to avoid.\n\n' + report;
  assert.equal(assessIntakeReport(input).complete, true);
});
test('rejects short placeholder', () => {
  assert.equal(assessIntakeReport('I will prepare the report now.').reason, 'too_short');
});
test('rejects long transition-only message', () => {
  const input = 'I will prepare the report now. ' + 'Please return for the full findings later. '.repeat(24);
  assert.equal(assessIntakeReport(input).reason, 'transition_only');
});
test('rejects lengthy additional intake question', () => {
  const input = 'Question 6: Any more preferences?\n\n' + 'Tell me more about your goals. '.repeat(30);
  assert.equal(assessIntakeReport(input).reason, 'intake_question');
});
test('does not expose report content in diagnostics', () => {
  const decision = assessIntakeReport(report + ' PRIVATE_EXAMPLE_STRING');
  assert.equal(JSON.stringify(decision).includes('PRIVATE_EXAMPLE_STRING'), false);
});
test('missing response fails closed', () => assert.equal(assessIntakeReport(undefined).reason, 'too_short'));
