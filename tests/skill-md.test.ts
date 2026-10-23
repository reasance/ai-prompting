import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Tests run from dist/tests/, so the package root is two levels up.
const packageRoot = join(__dirname, '..', '..');
const skillContent = readFileSync(join(packageRoot, 'SKILL.md'), 'utf8');
const referenceFiles = readdirSync(join(packageRoot, 'references')).filter((f) => f.endsWith('.md'));
const readRef = (f: string): string => readFileSync(join(packageRoot, 'references', f), 'utf8');

/** Slice a markdown file down to a single `## heading` section. */
function section(md: string, heading: string): string {
  const start = md.indexOf(`\n## ${heading}`);
  assert.notEqual(start, -1, `heading "## ${heading}" not found`);
  const rest = md.slice(start + 1);
  const next = rest.indexOf('\n## ');
  return next === -1 ? rest : rest.slice(0, next);
}

test('SKILL.md: Italian follow-up choice markers present (2-choice)', () => {
  assert.match(skillContent, /\*\*Esegui\*\*[^—]*—\s*applica subito/);
  assert.match(skillContent, /\*\*Modifica\*\*[^—]*—\s*voglio raffinare/);
  // Esci was removed in favor of "no reply = exit"; assert it's gone.
  assert.doesNotMatch(skillContent, /\*\*Esci\*\*/);
});

test('SKILL.md: English follow-up choice markers present (2-choice)', () => {
  assert.match(skillContent, /\*\*Run\*\*[^—]*—\s*apply the improved prompt/);
  assert.match(skillContent, /\*\*Refine\*\*[^—]*—\s*ask me targeted questions/);
  // Exit was removed in favor of "no reply = exit"; assert it's gone.
  assert.doesNotMatch(skillContent, /\*\*Exit\*\*/);
});

test('SKILL.md: reference cross-links resolve to real anchors', () => {
  assert.match(skillContent, /references\/clarification-policy\.md#refinement-loop/);
  assert.match(skillContent, /references\/clarification-policy\.md#policy-overrides/);
});

/** GitHub's heading slug: lowercase, punctuation dropped, spaces to hyphens. */
function slug(heading: string): string {
  return heading.trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').replace(/ /g, '-');
}

test('markdown links: every #anchor into a reference file exists', () => {
  const sources: Array<[string, string]> = [
    ['SKILL.md', skillContent],
    ...referenceFiles.map((f) => [`references/${f}`, readRef(f)] as [string, string]),
  ];
  for (const [from, text] of sources) {
    for (const m of text.matchAll(/\]\(((?:references\/)?[\w-]+\.md)?#([\w-]+)\)/g)) {
      const target = m[1] ? m[1].replace(/^references\//, '') : from.replace(/^references\//, '');
      const body = target === 'SKILL.md' ? skillContent : readRef(target);
      const anchors = [...body.matchAll(/^#{1,6}\s+(.+)$/gm)].map((h) => slug(h[1]));
      assert.ok(anchors.includes(m[2]), `${from} links to ${target}#${m[2]}, which does not exist`);
    }
  }
});

// Commands and skills are one surface now: hosts invoke the Skill directly and
// it reads its own flags. A second adapter file is how the two drifted before.
test('SKILL.md: the Skill reads its own flags; no separate command adapter ships', () => {
  assert.match(skillContent, /\*\*Invoked with arguments\*\*/);
  assert.ok(!existsSync(join(packageRoot, '.claude', 'commands', 'improve.md')),
    'the command adapter was merged into SKILL.md and must not come back');
  const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
  assert.ok(!pkg.files.includes('.claude/'), 'package.json still ships the removed .claude/ directory');
});

test('SKILL.md: user instructions take precedence over the Skill', () => {
  assert.match(skillContent, /The user's instructions take precedence over this Skill\./);
});

test('SKILL.md: frontmatter stays at name + description', () => {
  // Outside Claude Code, unknown frontmatter fields are a hard error.
  const fm = skillContent.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fm, 'frontmatter present');
  const keys = [...fm![1].matchAll(/^([a-z_-]+):/gm)].map((m) => m[1]);
  assert.deepEqual(keys, ['name', 'description']);
});

// Every claim about a specific model or host is dated, so staleness is visible.
// scripts/check-verified.js warns on stamps older than 90 days.
test('agent-compatibility.md: every vendor and host section carries a Verified stamp', () => {
  const doc = readRef('agent-compatibility.md');
  const vendorNotes = section(doc, 'Vendor notes');
  const notes = vendorNotes.split(/\n(?=### )/).slice(1);
  assert.ok(notes.length >= 7, `expected >= 7 vendor notes, got ${notes.length}`);
  for (const note of notes) {
    assert.match(note, /_Verified \d{4}-\d{2}-\d{2} against: \S/, `missing stamp in "${note.split('\n')[0]}"`);
  }
  for (const heading of ['Capability matrix', 'Skill-based hosts']) {
    assert.match(section(doc, heading), /_Verified \d{4}-\d{2}-\d{2} against: \S/, `missing stamp in "${heading}"`);
  }
});

// Some current models refuse a request to write their reasoning out, and it is
// billed. No template we ship may ask for one.
test('references: no shipped template asks for the model\'s reasoning', () => {
  for (const f of referenceFiles) {
    const blocks = [...readRef(f).matchAll(/```[\s\S]*?```/g)].map((m) => m[0]);
    for (const block of blocks) {
      assert.doesNotMatch(block, /<(thinking|analysis|reasoning|scratchpad)>/i, `${f}: template asks for a reasoning section`);
      assert.doesNotMatch(block, /step trace/i, `${f}: template asks for a step trace`);
    }
  }
});

test('agents/openai.yaml: documented Codex schema, no version to drift', () => {
  const yaml = readFileSync(join(packageRoot, 'agents', 'openai.yaml'), 'utf8');
  assert.match(yaml, /^interface:\n\s+display_name: ai-prompting$/m);
  assert.doesNotMatch(yaml, /^version:/m, 'a version field drifted from package.json once already');
  assert.doesNotMatch(yaml, /^(entrypoint|capabilities|triggers|modes):/m, 'undocumented keys');
});

test('clarification-policy.md: linked sections are anchored', () => {
  const policyPath = join(packageRoot, 'references', 'clarification-policy.md');
  const policy = readFileSync(policyPath, 'utf8');
  // SKILL.md links to these anchors; ensure they exist.
  assert.match(policy, /^## Refinement loop$/m);
  assert.match(policy, /^## Rendering$/m);
  assert.match(policy, /^## Policy overrides$/m);
});
