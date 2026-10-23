import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { main, parseArgs, buildOptions, CliError, EXIT_OK, EXIT_USAGE, EXIT_INPUT } from '../src/cli';

function runCli(argv: string[]): { out: string; err: string; code: number } {
  const outW = process.stdout.write.bind(process.stdout);
  const errW = process.stderr.write.bind(process.stderr);
  let out = '';
  let err = '';
  (process.stdout as unknown as { write: (c: unknown) => boolean }).write = (c: unknown) => {
    out += String(c);
    return true;
  };
  (process.stderr as unknown as { write: (c: unknown) => boolean }).write = (c: unknown) => {
    err += String(c);
    return true;
  };
  let code: number;
  try {
    code = main(argv);
  } finally {
    (process.stdout as unknown as { write: typeof outW }).write = outW;
    (process.stderr as unknown as { write: typeof errW }).write = errW;
  }
  return { out, err, code };
}

function tmpFile(name: string, contents: Buffer | string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-'));
  const p = path.join(dir, name);
  fs.writeFileSync(p, contents);
  return p;
}

function options(argv: string[]) {
  return buildOptions(parseArgs(argv).flags, 'sample prompt body');
}

// Regression guard for a whole class of bug: a flag the argv parser accepts but
// buildOptions never reads, so it is silently ignored at runtime. `--clarify` shipped that way.
test('buildOptions: every documented flag reaches PromptImproverOptions', () => {
  const opts = options([
    'improve',
    '--mode', 'diagnostic',
    '--task', 'research',
    '--language', 'it',
    '--audience', 'CTOs',
    '--token-budget', 'minimal',
    '--clarify', 'never',
    '--scaffold', 'always',
    '--constraints', 'max 200 words|no markdown',
  ]);

  assert.equal(opts.outputMode, 'diagnostic');
  assert.equal(opts.taskType, 'research');
  assert.equal(opts.language, 'it');
  assert.equal(opts.audience, 'CTOs');
  assert.equal(opts.tokenBudget, 'minimal');
  assert.equal(opts.askClarifyingQuestions, 'never');
  assert.equal(opts.scaffold, 'always');
  assert.deepEqual(opts.constraints, ['max 200 words', 'no markdown']);
});

// --- boundary: a typo must never run with defaults -------------------------
// This inverts the previous test, which asserted that invalid enum values fell
// back to the default. In a CI gate that is the worst outcome: the job goes
// green having run a configuration nobody chose.

test('parseArgs: unknown flags and missing values are usage errors', () => {
  assert.throws(() => parseArgs(['improve', '--mdoe', 'standard']), (e: unknown) => {
    assert.ok(e instanceof CliError);
    assert.equal((e as CliError).code, EXIT_USAGE);
    assert.match((e as CliError).message, /unknown flag "--mdoe"/);
    return true;
  });
  assert.throws(() => parseArgs(['improve', '--prompt']), /needs a value/);
});

test('buildOptions: invalid enum values are rejected, not silently defaulted', () => {
  for (const [flag, bad] of [['mode', 'diagnstic'], ['clarify', 'maybe'], ['scaffold', 'never'], ['token-budget', 'huge'], ['task', 'poetry']]) {
    assert.throws(
      () => options(['improve', `--${flag}`, bad]),
      (e: unknown) => {
        assert.ok(e instanceof CliError, `--${flag} should raise CliError`);
        assert.equal((e as CliError).code, EXIT_USAGE);
        return true;
      },
      `--${flag} ${bad} must be rejected`
    );
  }
});

test('CLI: exit codes are stable and distinguish usage from input errors', () => {
  const cases: Array<[string[], number, RegExp]> = [
    [['improve', '--prompt', 'x', '--nope', 'y'], EXIT_USAGE, /unknown flag/],
    [['improve', '--prompt', 'x', '--file', '/etc/hosts'], EXIT_USAGE, /mutually exclusive/],
    [['improve', 'stray-positional'], EXIT_USAGE, /unexpected argument/],
    [['frobnicate'], EXIT_USAGE, /unknown command/],
    [['improve', '--file', '/definitely/not/here.txt'], EXIT_INPUT, /no such file/],
  ];
  for (const [argv, expected, pattern] of cases) {
    const r = runCli(argv);
    assert.equal(r.code, expected, `${argv.join(' ')} → expected exit ${expected}, got ${r.code}`);
    assert.match(r.err, pattern);
    assert.ok(!/at \w+ \(/.test(r.err), 'must not leak a stack trace');
  }
});

test('CLI: input over the byte cap is refused', () => {
  const big = tmpFile('big.txt', 'x'.repeat(5000));
  const r = runCli(['improve', '--file', big, '--max-bytes', '1000']);
  assert.equal(r.code, EXIT_INPUT);
  assert.match(r.err, /over the 1000-byte cap/);
});

test('CLI: invalid UTF-8 is refused rather than turned into replacement chars', () => {
  const bad = tmpFile('bad.bin', Buffer.from([0x48, 0x69, 0xff, 0xfe, 0x00, 0x80]));
  const r = runCli(['improve', '--file', bad]);
  assert.equal(r.code, EXIT_INPUT);
  assert.match(r.err, /not valid UTF-8/);
});

test('CLI: a valid file run succeeds', () => {
  const good = tmpFile('good.txt', 'Write a launch email for the new pricing page.');
  const r = runCli(['improve', '--file', good, '--mode', 'final_only']);
  assert.equal(r.code, EXIT_OK);
  assert.match(r.out, /<role>/);
});

test('--help documents every flag buildOptions actually reads', () => {
  const { out, code } = runCli(['--help']);
  assert.equal(code, EXIT_OK);
  for (const flag of [
    '--prompt', '--file', '--mode', '--task', '--language', '--audience',
    '--token-budget', '--clarify', '--scaffold', '--constraints', '--max-bytes',
    '--no-score', '--no-rationale',
  ]) {
    assert.ok(out.includes(flag), `--help does not document ${flag}`);
  }
  // Removed because it did nothing: --target local and --target claude were
  // byte-identical. It must not reappear without real adapter branches.
  assert.ok(!out.includes('--target'), '--target must not be advertised while it is a no-op');
  assert.match(out, /EXIT CODES/, 'exit codes must be documented');
});

test('CLI: --target is rejected rather than silently accepted', () => {
  const r = runCli(['improve', '--prompt', 'hello there', '--target', 'local']);
  assert.equal(r.code, EXIT_USAGE);
  assert.match(r.err, /unknown flag "--target"/);
});

// --- mode contracts --------------------------------------------------------

test('CLI: compact is a one-line change summary plus a one-line score', () => {
  const r = runCli(['improve', '--prompt', 'Write a launch email.', '--mode', 'compact']);
  assert.equal(r.code, EXIT_OK);
  const after = r.out.split('```')[2] || '';
  const lines = after.split('\n').filter((l) => l.trim());
  assert.equal(lines.length, 2, `compact should emit 2 lines after the prompt block, got: ${JSON.stringify(lines)}`);
  assert.match(lines[1], /Structural coverage: \d+ → \d+\/\d+ \([+-]\d+\)/);
});

test('CLI: --clarify never suppresses the clarifying-questions block', () => {
  const risky = 'Write a contract for legal compliance with GDPR for patient data.';

  const withDefault = runCli(['improve', '--prompt', risky, '--mode', 'standard']);
  assert.match(withDefault.out, /Clarifying questions|Domande di chiarimento/);

  const suppressed = runCli(['improve', '--prompt', risky, '--mode', 'standard', '--clarify', 'never']);
  assert.doesNotMatch(suppressed.out, /Clarifying questions|Domande di chiarimento/);
  assert.match(suppressed.out, /high-risk|alto rischio/i);
});

test('CLI: --token-budget minimal produces a shorter prompt than balanced', () => {
  // A research prompt: its type carries a default quality bar for minimal to drop.
  const prompt = 'Research the adoption of passkeys in European banking apps.';
  const minimal = runCli(['improve', '--prompt', prompt, '--token-budget', 'minimal', '--mode', 'final_only']);
  const balanced = runCli(['improve', '--prompt', prompt, '--token-budget', 'balanced', '--mode', 'final_only']);
  assert.ok(!minimal.out.includes('<quality_bar>'));
  assert.ok(balanced.out.includes('<quality_bar>'));
  assert.ok(minimal.out.length < balanced.out.length);
});

test('CLI: the score block never claims performance', () => {
  const r = runCli(['improve', '--prompt', 'Write a launch email.', '--mode', 'standard']);
  assert.match(r.out, /Structural coverage/);
  assert.doesNotMatch(r.out, /Confidence|Confidenza/);
  assert.match(r.out, /not a performance prediction|non è una previsione/i);
});
