#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { improvePrompt } from './prompt-improver';
import { formatReport, runDoctor } from './doctor';
import {
  ClarificationPolicy,
  ScaffoldPolicy,
  ImprovementResult,
  OutputMode,
  PromptImproverOptions,
  TaskType,
  TokenBudget,
} from './types';

interface ParsedArgs {
  command: string;
  flags: Record<string, string | boolean>;
  positional: string[];
}

const VALID_MODES: OutputMode[] = ['final_only', 'compact', 'standard', 'diagnostic'];
const VALID_BUDGETS: TokenBudget[] = ['minimal', 'balanced', 'generous'];
const VALID_CLARIFY: ClarificationPolicy[] = ['auto', 'always', 'never'];
const VALID_SCAFFOLD: ScaffoldPolicy[] = ['auto', 'always'];
const VALID_TASKS: TaskType[] = [
  'research',
  'writing',
  'correspondence',
  'coding',
  'analysis',
  'data-extraction',
  'agentic-workflow',
  'creative',
  'business',
  'education',
  'general',
];

/**
 * Exit codes. Stable, because this CLI is meant to be usable as a CI gate.
 *   0 — success
 *   1 — usage error (unknown flag, missing value, invalid enum, no prompt)
 *   2 — input error (unreadable file, over the size cap, invalid UTF-8)
 */
export const EXIT_OK = 0;
export const EXIT_USAGE = 1;
export const EXIT_INPUT = 2;

export class CliError extends Error {
  constructor(message: string, readonly code: number) {
    super(message);
    this.name = 'CliError';
  }
}

const BOOLEAN_FLAGS = new Set(['no-score', 'no-rationale', 'help', 'version']);
const VALUE_FLAGS = new Set([
  'prompt', 'file', 'mode', 'task', 'token-budget', 'clarify', 'scaffold',
  'language', 'audience', 'constraints', 'max-bytes',
]);

/** 1 MiB. A prompt improver has no business ingesting more than this by default. */
export const DEFAULT_MAX_BYTES = 1024 * 1024;

function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  let command = '';
  let i = 0;
  if (argv.length > 0 && !argv[0].startsWith('-')) {
    command = argv[0];
    i = 1;
  }
  while (i < argv.length) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      positional.push(a);
      i += 1;
      continue;
    }
    const key = a.slice(2);
    // A silently-ignored typo is the worst outcome for a CI gate: the job goes
    // green having run with defaults nobody chose.
    if (!BOOLEAN_FLAGS.has(key) && !VALUE_FLAGS.has(key)) {
      throw new CliError(`unknown flag "--${key}". Run --help for the list.`, EXIT_USAGE);
    }
    if (BOOLEAN_FLAGS.has(key)) {
      flags[key] = true;
      i += 1;
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      throw new CliError(`flag "--${key}" needs a value.`, EXIT_USAGE);
    }
    flags[key] = next;
    i += 2;
  }
  return { command, flags, positional };
}

function printUsage(): void {
  const usage = `ai-prompting — improve any prompt into a clearer, cheaper, more reliable version.

USAGE
  ai-prompting doctor
  ai-prompting improve --prompt "<text>" [options]
  ai-prompting improve --file <path>     [options]
  cat prompt.txt | ai-prompting improve   [options]

OPTIONS
  --prompt <text>           Inline prompt to improve.
  --file <path>             Read prompt from file.
  --mode <name>             final_only | compact | standard (default) | diagnostic
  --task <type>             ${VALID_TASKS.join(' | ')}
  --token-budget <level>    minimal | balanced (default) | generous
                            minimal drops <quality_bar>.
  --clarify <policy>        auto (default) | always | never
  --scaffold <policy>       auto (default): a well-specified prompt keeps its own structure and
                            only loses padding | always: scaffold every prompt
  --language <code>         it | en  (auto-detected if omitted)
  --audience <text>         Free-text audience description.
  --constraints <list>      Pipe-separated, e.g. "max 200 words|no markdown".
  --max-bytes <n>           Input size cap for --file/stdin (default ${DEFAULT_MAX_BYTES}).
  --no-score                Suppress score block.
  --no-rationale            Suppress per-category rationale (diagnostic mode only).
  --version                 Print package version.
  --help                    Show this help.

EXIT CODES
  0  success
  1  usage error (unknown flag, missing value, invalid enum, no prompt)
  2  input error (unreadable file, over the size cap, invalid UTF-8)

Unknown flags and invalid values are errors, not warnings: a typo must not
silently run with defaults.
`;
  process.stdout.write(usage);
}

function readPackageVersion(): string {
  try {
    const pj = path.resolve(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pj, 'utf8')) as { version?: string };
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Decode strictly: malformed UTF-8 must fail loudly, not become U+FFFD soup. */
function decodeStrict(buf: Buffer, source: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    throw new CliError(`${source} is not valid UTF-8.`, EXIT_INPUT);
  }
}

function enforceCap(byteLength: number, maxBytes: number, source: string): void {
  if (byteLength > maxBytes) {
    throw new CliError(
      `${source} is ${byteLength} bytes, over the ${maxBytes}-byte cap. Raise it with --max-bytes.`,
      EXIT_INPUT,
    );
  }
}

function readStdinSync(maxBytes: number): string {
  if (process.stdin.isTTY) return '';
  let buf: Buffer;
  try {
    buf = fs.readFileSync(0);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    // EAGAIN on an empty non-blocking pipe means "nothing piped", not a failure.
    if (err.code === 'EAGAIN' || err.code === 'EOF') return '';
    throw new CliError(`could not read stdin: ${err.message}`, EXIT_INPUT);
  }
  enforceCap(buf.byteLength, maxBytes, 'stdin');
  return decodeStrict(buf, 'stdin');
}

function pickPrompt(flags: Record<string, string | boolean>, maxBytes: number): string {
  const sources = ['prompt', 'file'].filter((k) => typeof flags[k] === 'string');
  if (sources.length > 1) {
    throw new CliError('--prompt and --file are mutually exclusive; pass one.', EXIT_USAGE);
  }
  if (typeof flags.prompt === 'string') {
    enforceCap(Buffer.byteLength(flags.prompt, 'utf8'), maxBytes, '--prompt');
    return flags.prompt;
  }
  if (typeof flags.file === 'string') {
    const p = path.resolve(process.cwd(), flags.file);
    let buf: Buffer;
    try {
      buf = fs.readFileSync(p);
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      const why = err.code === 'ENOENT' ? 'no such file'
        : err.code === 'EISDIR' ? 'is a directory'
        : err.code === 'EACCES' ? 'permission denied'
        : err.message;
      throw new CliError(`cannot read --file ${p}: ${why}`, EXIT_INPUT);
    }
    enforceCap(buf.byteLength, maxBytes, `--file ${p}`);
    return decodeStrict(buf, `--file ${p}`);
  }
  return readStdinSync(maxBytes);
}

function pickMaxBytes(flags: Record<string, string | boolean>): number {
  const raw = flags['max-bytes'];
  if (typeof raw !== 'string') return DEFAULT_MAX_BYTES;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new CliError(`--max-bytes must be a positive integer, got "${raw}".`, EXIT_USAGE);
  }
  return n;
}

/** Reject rather than fall back: a bad enum used to silently select the default. */
function pickFromUnion<T extends string>(
  v: unknown,
  allowed: readonly T[],
  flag: string,
): T | undefined {
  if (v === undefined) return undefined;
  if (typeof v === 'string' && (allowed as readonly string[]).includes(v)) return v as T;
  throw new CliError(`--${flag} must be one of: ${allowed.join(' | ')}. Got "${String(v)}".`, EXIT_USAGE);
}

function buildOptions(flags: Record<string, string | boolean>, original: string): PromptImproverOptions {
  const opts: PromptImproverOptions = { originalPrompt: original };
  const mode = pickFromUnion(flags.mode, VALID_MODES, 'mode');
  if (mode) opts.outputMode = mode;
  const task = pickFromUnion(flags.task, VALID_TASKS, 'task');
  if (task) opts.taskType = task;
  const budget = pickFromUnion(flags['token-budget'], VALID_BUDGETS, 'token-budget');
  if (budget) opts.tokenBudget = budget;
  const clarify = pickFromUnion(flags.clarify, VALID_CLARIFY, 'clarify');
  if (clarify) opts.askClarifyingQuestions = clarify;
  const scaffold = pickFromUnion(flags.scaffold, VALID_SCAFFOLD, 'scaffold');
  if (scaffold) opts.scaffold = scaffold;
  const language = pickFromUnion(flags.language, ['it', 'en'] as const, 'language');
  if (language) opts.language = language;
  if (typeof flags.audience === 'string') opts.audience = flags.audience;
  if (typeof flags.constraints === 'string') {
    opts.constraints = flags.constraints.split('|').map((s) => s.trim()).filter(Boolean);
  }
  return opts;
}

interface RenderStrings {
  clarifying: string;
  improvedPrompt: string;
  whatImproved: string;
  noChanges: string;
  structuralCoverage: string;
  original: string;
  improved: string;
  estimatedDelta: string;
  heuristicNote: string;
  rubric: string;
  assumptions: string;
}

const STRINGS: Record<'it' | 'en', RenderStrings> = {
  it: {
    clarifying: '## Domande di chiarimento',
    improvedPrompt: '## Prompt migliorato',
    whatImproved: '## Cosa è migliorato',
    noChanges: '- Nessuna modifica strutturale necessaria.',
    structuralCoverage: '## Copertura strutturale',
    original: 'Originale',
    improved: 'Migliorato',
    estimatedDelta: 'Delta',
    heuristicNote: 'Misura la struttura dello scaffold (sezioni, vincoli, formato dichiarato),\nnon la qualità della risposta che il prompt produrrà. Non è una previsione di performance.',
    rubric: '## Rubric (diagnostico)',
    assumptions: '## Assunzioni',
  },
  en: {
    clarifying: '## Clarifying questions',
    improvedPrompt: '## Improved prompt',
    whatImproved: '## What improved',
    noChanges: '- No structural changes needed.',
    structuralCoverage: '## Structural coverage',
    original: 'Original',
    improved: 'Improved',
    estimatedDelta: 'Delta',
    heuristicNote: 'Measures scaffold structure (sections, constraints, declared format), not the\nquality of the answer the prompt will produce. It is not a performance prediction.',
    rubric: '## Rubric (diagnostic)',
    assumptions: '## Assumptions',
  },
};

function render(r: ImprovementResult, includeScore: boolean, includeRationale: boolean): string {
  const s = STRINGS[r.language];
  const mode = r.mode;
  const out: string[] = [];

  if (r.needsClarification && r.clarifications.length > 0 && mode !== 'final_only') {
    out.push(s.clarifying);
    for (const q of r.clarifications) {
      const qOpts = q.options ? ` (${q.options.join(' / ')})` : '';
      out.push(`- ${q.question}${qOpts}`);
    }
    out.push('');
  }

  out.push(s.improvedPrompt);
  out.push('```text');
  out.push(r.improved.trim());
  out.push('```');

  if (mode === 'final_only') return out.join('\n');

  const delta = `${r.scores.delta >= 0 ? '+' : ''}${r.scores.delta}`;

  // `compact` is documented as "improved prompt + 1-line what-changed + score
  // totals". It used to emit no change line at all and a five-line score block.
  if (mode === 'compact') {
    out.push('');
    const kinds = [...new Set(r.changes.map((c) => c.type))];
    out.push(kinds.length === 0 ? s.noChanges : `- ${kinds.join(', ')}`);
    if (includeScore) {
      out.push(
        `${s.structuralCoverage.replace(/^##\s*/, '')}: ` +
          `${r.scores.before.total} → ${r.scores.after.total}/${r.scores.after.max} (${delta})`
      );
    }
    return out.join('\n');
  }

  out.push('');
  out.push(s.whatImproved);
  if (r.changes.length === 0) {
    out.push(s.noChanges);
  } else {
    const seen = new Set<string>();
    for (const c of r.changes) {
      const line = `- ${c.type}: ${c.detail}`;
      if (!seen.has(line)) {
        seen.add(line);
        out.push(line);
      }
    }
  }

  if (includeScore) {
    out.push('');
    out.push(s.structuralCoverage);
    out.push(`${s.original}: ${r.scores.before.total}/${r.scores.before.max}`);
    out.push(`${s.improved}: ${r.scores.after.total}/${r.scores.after.max}`);
    out.push(`${s.estimatedDelta}: ${delta}`);
    out.push(s.heuristicNote);
  }

  if (mode === 'diagnostic' && includeRationale) {
    out.push('');
    out.push(s.rubric);
    for (const c of r.scores.after.categories) {
      out.push(`- ${c.label}: ${c.score}/${c.max} — ${c.rationale}`);
    }
  }

  if (r.assumptions.length > 0) {
    out.push('');
    out.push(s.assumptions);
    for (const a of r.assumptions) out.push(`- ${a}`);
  }

  return out.join('\n');
}

function main(argv: string[]): number {
  try {
    return run(argv);
  } catch (e) {
    if (e instanceof CliError) {
      process.stderr.write(`ai-prompting: ${e.message}\n`);
      return e.code;
    }
    // Never surface a raw stack trace from the boundary.
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`ai-prompting: unexpected failure: ${msg}\n`);
    return EXIT_INPUT;
  }
}

function run(argv: string[]): number {
  const parsed = parseArgs(argv);
  if (parsed.flags.help || parsed.command === 'help') {
    printUsage();
    return EXIT_OK;
  }
  if (parsed.flags.version || parsed.command === 'version') {
    process.stdout.write(`${readPackageVersion()}\n`);
    return EXIT_OK;
  }

  if (parsed.command === 'doctor' || parsed.command === '') {
    if (parsed.command === '') {
      printUsage();
      return EXIT_USAGE;
    }
    const report = runDoctor();
    process.stdout.write(formatReport(report) + '\n');
    return report.ok ? EXIT_OK : EXIT_USAGE;
  }

  if (parsed.command === 'improve') {
    if (parsed.positional.length > 0) {
      throw new CliError(
        `unexpected argument "${parsed.positional[0]}". Pass the prompt with --prompt "…".`,
        EXIT_USAGE,
      );
    }
    const original = pickPrompt(parsed.flags, pickMaxBytes(parsed.flags));
    if (!original.trim()) {
      process.stderr.write('ai-prompting: no prompt provided. Use --prompt, --file, or pipe via stdin.\n\n');
      printUsage();
      return EXIT_USAGE;
    }
    const opts = buildOptions(parsed.flags, original);
    const result = improvePrompt(opts);
    const includeScore = !(parsed.flags['no-score'] === true);
    const includeRationale = !(parsed.flags['no-rationale'] === true);
    process.stdout.write(render(result, includeScore, includeRationale) + '\n');
    return EXIT_OK;
  }

  throw new CliError(`unknown command "${parsed.command}". Expected: improve | doctor.`, EXIT_USAGE);
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

export { main, parseArgs, render, buildOptions };
