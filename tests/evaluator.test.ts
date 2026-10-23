import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { scorePrompt, categoryById, detectPaddingPhrases } from '../src/evaluator';

test('scorePrompt: empty input gives a low total', () => {
  const r = scorePrompt('');
  assert.equal(r.max, 100);
  assert.ok(r.total <= 30, `expected low score for empty input, got ${r.total}`);
});

test('scorePrompt: vague opener penalizes intent_clarity', () => {
  const r = scorePrompt('help me write something');
  const cat = categoryById(r, 'intent_clarity');
  assert.ok(cat, 'intent_clarity category present');
  assert.ok(cat!.score < cat!.max, `expected score < max, got ${cat!.score}/${cat!.max}`);
});

test('scorePrompt: structured XML prompt scores higher than vague prompt', () => {
  const vague = scorePrompt('help me with this');
  const structured = scorePrompt(`
<role>Senior engineer</role>
<objective>Refactor parser to a state machine.</objective>
<context>TypeScript 5.4, Node 20, no new deps.</context>
<task>
1. Replace nested if-else with explicit states.
2. Add tests for empty, malformed, unicode, long inputs.
</task>
<constraints>
- Preserve public signature.
- No new dependencies.
- Max 300 lines added.
</constraints>
<output_format>
Code in fenced block; precede with 2-4 lines explaining choices; tests follow.
</output_format>
<quality_bar>
- Compiles without warnings.
- All existing tests pass.
- Cite the file:line of any non-trivial change.
</quality_bar>
  `.trim());
  assert.ok(structured.total > vague.total + 20,
    `structured (${structured.total}) should beat vague (${vague.total}) by >20`);
});

test('scorePrompt: padding detection', () => {
  const text = 'You are a world-class expert. Take a deep breath and think step by step. Solve x.';
  const padding = detectPaddingPhrases(text);
  assert.ok(padding.length >= 2, `expected ≥2 padding phrases, got ${padding.length}`);
});

test('scorePrompt: hallucination guards boost robustness', () => {
  const noGuard = scorePrompt('Write a summary of the topic.');
  const guarded = scorePrompt(
    'Write a summary of the topic. Do not invent facts. If unknown, say so. Cite every source.',
  );
  const before = categoryById(noGuard, 'robustness_hallucination')!.score;
  const after = categoryById(guarded, 'robustness_hallucination')!.score;
  assert.ok(after > before, `guarded (${after}) should beat unguarded (${before})`);
});

test('scorePrompt: success criteria detection', () => {
  const without = scorePrompt('Do the thing.');
  const withCrit = scorePrompt('Do the thing. <success_criteria>output is JSON-parseable</success_criteria>');
  const a = categoryById(without, 'evaluation_criteria')!.score;
  const b = categoryById(withCrit, 'evaluation_criteria')!.score;
  assert.ok(b > a, `with criteria (${b}) should beat without (${a})`);
});

test('scorePrompt: total never exceeds 100, never negative', () => {
  for (const sample of [
    '',
    'x',
    'help me',
    'write something good for me, please, be amazing',
    '<role>r</role><task>t</task><output_format>json</output_format>',
  ]) {
    const r = scorePrompt(sample);
    assert.ok(r.total >= 0 && r.total <= 100, `total out of range: ${r.total} for "${sample}"`);
  }
});

// The intent checks read the request, not the markup: a scaffold starts with
// <role>, so they used to see neither the imperative nor the vagueness inside it.
test('scorePrompt: wrapping a request in tags neither earns nor hides intent', () => {
  const intent = (t: string) => categoryById(scorePrompt(t), 'intent_clarity')!.score;
  const clear = 'Summarize the incident report for the on-call engineer.';
  assert.equal(intent(`<role>\nOn-call lead.\n</role>\n\n<task>\n${clear}\n</task>`), intent(clear));
  assert.ok(intent('<role>\nEditor.\n</role>\n\n<task>\nhelp me write something\n</task>') < intent(clear),
    'a vague request must stay penalized inside a scaffold');
});
