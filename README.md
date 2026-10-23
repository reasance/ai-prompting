# ai-prompting

> Improve, rewrite, debug, evaluate, and compress prompts for any LLM agent.

[![npm version](https://img.shields.io/npm/v/ai-prompting.svg)](https://www.npmjs.com/package/ai-prompting)
[![license](https://img.shields.io/npm/l/ai-prompting.svg)](LICENSE)
[![node](https://img.shields.io/node/v/ai-prompting.svg)](https://nodejs.org)
[![types](https://img.shields.io/npm/types/ai-prompting.svg)](https://www.npmjs.com/package/ai-prompting)
[![CI](https://github.com/reasance/ai-prompting/actions/workflows/ci.yml/badge.svg)](https://github.com/reasance/ai-prompting/actions/workflows/ci.yml)

`ai-prompting` ships in two layers — an Anthropic-style **Skill** that any compatible agent can apply semantically, and a **deterministic Node.js CLI** that runs without API keys, without LLM calls, and without runtime dependencies. The CLI is the verifiable baseline. The Skill is where the real semantic gains happen.

## 30-second quickstart

```bash
# Improve any prompt from your shell:
npx ai-prompting improve --prompt "Help me write a sales email"

# Or pipe one in:
echo "scrivi una mail di vendita" | npx ai-prompting improve --mode final_only

# Verify install health:
npx ai-prompting doctor
```

In a Claude Code session (or any host that supports Skills) the same logic is invokable as a slash command:

```
/ai-prompting:improve scrivi una mail al manager per chiedere un aumento --mode diagnostic
```

## Table of contents

- [What it does](#what-it-does)
- [How it works](#how-it-works)
- [Install](#install)
- [CLI](#cli)
- [Slash command](#slash-command)
- [Library API](#library-api)
- [Output modes](#output-modes)
- [The 100-point rubric](#the-100-point-rubric)
- [Agent compatibility](#agent-compatibility)
- [Examples (input → output)](#examples-input--output)
- [Doctor](#doctor)
- [FAQ](#faq)
- [Limitations](#limitations)
- [Contributing](#contributing)
- [Changelog](#changelog)
- [License](#license)

## What it does

You give it a vague, padded, or unstructured prompt. It returns a clearer, cheaper, more reliable version — calibrated to the target agent, task type, and output you need.

Concretely, on every prompt it:

1. **Detects** language (it/en) and task type (research, coding, writing, analysis, data-extraction, agentic-workflow, creative, business, education, general).
2. **Strips** padding that hurts modern reasoning models — `"you are a world-class…"`, `"take a deep breath"`, `"think step by step"`, `"I will tip you…"` plus Italian variants (`"sei un esperto di livello mondiale"`, `"fai un respiro profondo"`, `"pensaci passo passo"`).
3. **Decides whether to ask** for clarification (only when info is critical, contradictions exist, or the domain is high-risk: legal, medical, financial, security, production code).
4. **Rewrites** with a canonical XML scaffold (`<role>`, `<objective>`, `<context>`, `<task>`, `<constraints>`, `<output_format>`, `<quality_bar>`).
5. **Scores** structural coverage on a 100-point heuristic rubric (9 categories), before/after.
6. **Surfaces** every assumption it made as `[ASSUMPTION: …]` — so you can correct without rerunning.

## How it works

```
       ┌─────────────────────────────┐
       │  USER: "improve my prompt"  │
       └──────────────┬──────────────┘
                      ▼
       ┌─────────────────────────────┐
       │  classify: lang, task type, │
       │  target agent (if declared) │
       └──────────────┬──────────────┘
                      ▼
                ╱╲ critical info ╱╲
               ╱   missing?       ╲
                ╲ yes ◄──► no    ╱
                 ▼              ▼
       ┌──────────────┐  ┌──────────────┐
       │ ask ≤ 3 Qs   │  │ proceed with │
       │ (multi-      │  │ [ASSUMPTION] │
       │  choice)     │  │  markers     │
       └──────┬───────┘  └──────┬───────┘
              └─────────┬───────┘
                        ▼
       ┌─────────────────────────────┐
       │  strip padding              │
       │  scaffold XML               │
       │  score 0-100                │
       └──────────────┬──────────────┘
                      ▼
       ┌─────────────────────────────┐
       │  return in chosen mode:     │
       │  final_only / compact /     │
       │  standard / diagnostic      │
       └─────────────────────────────┘
```

**Two layers.** The Skill (`SKILL.md` + `references/`) is read by a host agent (Claude Code, Codex CLI, Cursor, Gemini CLI, etc.); the agent applies the procedure with its own model. The CLI runs the *same* decisions deterministically, locally, with no LLM call — useful for batch jobs, CI gates, smoke tests, and as a verifiable baseline.

## Install

Requires **Node.js ≥ 18**. No runtime dependencies.

```bash
# One-off use:
npx ai-prompting <command>

# Project install:
npm install --save-dev ai-prompting

# Global install:
npm install -g ai-prompting
```

From source:

```bash
git clone https://github.com/reasance/ai-prompting.git
cd ai-prompting
npm install
npm run build
node dist/src/cli.js doctor
```

## CLI

```bash
ai-prompting improve --prompt "Help me write something good"
ai-prompting improve --file ./prompt.txt --mode diagnostic
ai-prompting improve --prompt "..." --task research --token-budget minimal
cat prompt.txt | ai-prompting improve --mode final_only
ai-prompting doctor
ai-prompting --help
```

### Flags

| Flag | Values | Default | Notes |
|---|---|---|---|
| `--prompt <text>` | inline string | — | exclusive with `--file`/stdin |
| `--file <path>` | filesystem path | — | UTF-8 |
| `--mode <name>` | `final_only` / `compact` / `standard` / `diagnostic` | `standard` | see [Output modes](#output-modes) |
| `--task <type>` | research / writing / coding / analysis / data-extraction / agentic-workflow / creative / business / education / general | inferred | overrides the keyword classifier |
| `--token-budget <level>` | `minimal` / `balanced` / `generous` | `balanced` | `minimal` drops `<quality_bar>`, plus `<context>` when it is not load-bearing; `generous` expands the quality bar |
| `--clarify <policy>` | `auto` / `always` / `never` | `auto` | `never` suppresses the questions but still emits a high-risk warning |
| `--language <code>` | `it` / `en` | auto-detect | overrides the it-vs-en evidence scorer |
| `--audience <text>` | free text | — | injected into `<context>`; suppresses the audience question; makes `<context>` load-bearing under `minimal` |
| `--constraints <list>` | pipe-separated | — | e.g. `--constraints "max 200 words|no markdown"` |
| `--no-score` | flag | off | suppresses score block |
| `--no-rationale` | flag | off | suppresses per-category rationale (diagnostic) |
| `--version` | flag | — | prints package version |
| `--help` | flag | — | prints CLI help |

Unknown flags, missing values, invalid enum values, and passing more than one input source are
errors, not warnings — the CLI is meant to be safe in a CI gate.

## Slash command

A slash command ships at `.claude/commands/improve.md` for hosts that support the Agent Skills Open Standard. Install it system-wide:

```bash
npm run install-command            # detects supported hosts and copies the file
npm run install-command -- --list  # show targets
npm run install-command -- --host claude --force
```

Auto-detected: **Claude Code** (`~/.claude/commands/`), **OpenAI Codex CLI** (`~/.codex/commands/`), **Cursor** (`~/.cursor/commands/`). Add more in `scripts/install-command.js` (5 lines per host).

Once installed, in a Claude Code session:

```
/ai-prompting:improve <prompt> [--mode …] [--target …] [--task …] [--language …] [--audience "…"] [--token-budget …] [--clarify auto|always|never]
```

Natural-language fallbacks work too: *"in italiano"*, *"non chiedere"*, *"solo prompt"*, *"compatto"*, *"in dettaglio"*. Flags always win over fallbacks.

## Library API

The package exposes a small, fully-typed library. No runtime deps.

```ts
import {
  improvePrompt,
  scorePrompt,
  runDoctor,
  type PromptImproverOptions,
  type ImprovementResult,
} from 'ai-prompting';

const result: ImprovementResult = improvePrompt({
  originalPrompt: 'Help me write a better sales email',
  taskType: 'writing',
  outputMode: 'standard',
  language: 'it',
  audience: 'CTOs di scale-up B2B',
  tokenBudget: 'minimal',
  askClarifyingQuestions: 'never',
});

console.log(result.improved);          // string: the rewritten prompt
console.log(result.scores);            // { before, after, delta }
console.log(result.assumptions);       // string[]: explicit assumptions
console.log(result.clarifications);    // ClarificationQuestion[]
console.log(result.changes);           // ImprovementChange[]: what was modified
```

Full options surface: `PromptImproverOptions` in `dist/src/types.d.ts`.

## Output modes

| Mode | What you get | Use when |
|---|---|---|
| `final_only` | Improved prompt block only | You'll paste it elsewhere; lowest token cost |
| `compact` | Improved prompt + 1-line score | You want quick before/after delta |
| `standard` *(default)* | Improved prompt + change list + score + assumptions | Day-to-day work |
| `diagnostic` | Standard + per-category rubric breakdown | Debugging why a prompt scored low |

## The 100-point rubric

| Category | Weight | What it measures |
|---|---|---|
| Intent clarity | 15 | Vague openers penalized; explicit objective rewarded |
| Context sufficiency | 15 | Load-bearing facts present; productive length band |
| Task decomposition | 10 | Numbered/bulleted steps when order matters |
| Constraint specificity | 10 | Verifiable rules: lengths, formats, exclusions |
| Output format clarity | 15 | Schema declared; example present; structured tags |
| Tool / source instructions | 10 | When to use, when not to, error handling, citations |
| Robustness vs hallucination | 10 | "Do not invent", "if unknown say so", uncertainty |
| Token efficiency | 10 | No padding; no repeated trigrams |
| Evaluation criteria | 5 | `<success_criteria>` or equivalent |

Total = **100**. Scores are heuristic estimates, not guaranteed performance gains. Full breakdown in [`references/prompt-quality-rubric.md`](references/prompt-quality-rubric.md).

## Agent compatibility

The package follows the **Agent Skills Open Standard** (Anthropic, December 2025). As of 2026, ~32 host tools read `SKILL.md` from the conventional directory.

| Host | Reads `SKILL.md` natively | Slash command directory |
|---|---|---|
| Claude Code | ✓ | `~/.claude/commands/` |
| OpenAI Codex CLI | ✓ | `~/.codex/commands/` |
| ChatGPT (Apps SDK) | ✓ via Apps SDK | uses `agents/openai.yaml` |
| Cursor | ✓ | `~/.cursor/commands/` |
| Gemini CLI | ✓ | `~/.gemini/commands/` (add to installer) |
| JetBrains Junie | ✓ | proprietary mechanism |
| Block Goose | ✓ | `.goose/commands/` |
| AWS Kiro | ✓ | proprietary manifest |
| Older custom integrations | adapter required | call `improvePrompt()` as a tool |

Adapter notes per target are in [`references/agent-compatibility.md`](references/agent-compatibility.md).

## Examples (input → output)

### A vague prompt with English padding

**Input:**
```
You are a world-class expert. Take a deep breath. Help me write something good.
```

**Output (`standard` mode, English):**
```
## Improved prompt
<role>Expert generalist assistant — precise and direct.</role>
<objective>Write something good.</objective>
<context>[ASSUMPTION: no additional context provided; the model should flag any load-bearing assumptions]</context>
<task>Help me write something good.</task>
<constraints>
- Explicitly distinguish facts, inferences, and assumptions.
- If critical information is missing, declare it rather than inventing.
</constraints>
<output_format>Structured, direct answer; length calibrated to task complexity.</output_format>
<quality_bar>...</quality_bar>

Structural coverage — Original: 30/100  →  Improved: 79/100  (Δ +49)
```

### An Italian prompt with persona padding

**Input:**
```
Sei un esperto di livello mondiale. Aiutami a scrivere una mail per chiedere un aumento.
```

**Output (`standard` mode, Italian — note the auto-detect):**
- Stripped Italian padding (`Sei un esperto di livello mondiale`)
- Nominalized opener (`Aiutami a scrivere…` → objective: `Scrivere una mail…`)
- Task type → `writing`, role → `Senior editor con focus su chiarezza, ritmo e adeguatezza al pubblico.`
- Structural coverage 32 → 84 (Δ +52)

### A high-risk prompt — triggers clarification

**Input:**
```
Estrai i dati dei pazienti da questo CSV e crea un report di compliance GDPR.
```

The CLI detects `paziente` + `gdpr` + `compliance` (high-risk keyword set), surfaces:
```
## Domande di chiarimento
- Per quale audience? (es. tecnici, clienti finali)
- Formato di output preferito? (markdown / json / plain text / table / xml)
```
…and proceeds with `[CLARIFY] High-risk domain detected — confirmation needed.` in the assumptions.

More examples in [`examples/`](examples/).

## Doctor

```
$ npx ai-prompting doctor
AIPrompting Doctor
✓ Node.js >= 18 (node v20.10.0)
✓ package.json valid + bin entry (version 0.3.1)
✓ SKILL.md frontmatter (name, description) (name ✓, description ✓)
✓ references/ files (5/5)
✓ bin/ai-prompting executable
✓ compiled CLI artifact (dist)
✓ smoke test (improvePrompt) (improved length=721, delta=44)
Status: OK
Node: 20.10.0 | Package: 0.3.1
```

If a check fails, the doctor prints a `fix:` line for it.

## FAQ

**Why ship both a Skill and a CLI?** They serve different consumers. The Skill is consumed by an agent that has its own LLM — that agent gets semantic rewriting. The CLI runs locally, deterministic, no API key — useful in CI, batch jobs, smoke tests, and as a fallback when no agent is available.

**Does the CLI call an LLM?** No. Never. The CLI is rule-based: keyword detection, regex padding strippers, XML scaffolding, heuristic scoring. Zero API calls.

**Will the score improve my real prompt performance?** Unknown — the score does not measure that. It measures *structural coverage*: whether the prompt declares a role, an objective, constraints, an output format, and success criteria, and whether it avoids padding. A prompt can score 90 and still ask for the wrong thing. There is no eval set behind it, so no correlation with output quality is claimed.

**Why not use a hosted prompt-improvement service?** Privacy, cost, reproducibility, and offline use. The deterministic CLI is the same on every machine. The Skill, when run by a host agent, never leaves the user's existing tool.

**The CLI rewrites my Italian prompt with English structure tags.** The XML tags (`<role>`, `<task>`, etc.) are the protocol for the model — they are intentionally English because that's the convention every modern LLM is trained on. The *content* of the prompt is in your language. If you want fully Italian tags, fork and translate; the rest of the logic doesn't depend on the tag names.

**Can I add a new task type / target agent?** Yes — see [CONTRIBUTING.md](CONTRIBUTING.md). It's two file edits and a regression test.

**What happens to "think step by step"?** The CLI always strips it. Modern reasoning models (Claude 4.x, GPT-5.x, Gemini 2.5+) reason adaptively, so explicit CoT instructions are redundant or counterproductive there — but that is not true of small local models, and the CLI has no adapter that knows the difference. Earlier versions of this FAQ claimed `--target local` preserved it; that was never implemented, and the flag has been removed from the CLI rather than left as a decorative no-op. If you are targeting a local model, keep the CoT line yourself, or apply the Skill through an agent, which does adapt.

**Why is there no `--target` on the CLI?** Because it changed nothing. `--target local` and `--target claude` produced byte-identical output. `targetAgent` remains a Skill and library option, where an agent can genuinely adapt the rewrite; the deterministic CLI will get the flag back when it has real adapter branches and tests that prove they fire.

**Where do I report issues?** [GitHub Issues](https://github.com/reasance/ai-prompting/issues). Security: see [SECURITY.md](SECURITY.md).

## Limitations

- **CLI = deterministic baseline.** It guarantees structural scaffolding and padding removal; it does not perform semantic rewriting. The richer rewrite happens when an agent host applies the Skill.
- **Scores are heuristic.** Useful for relative comparison (before vs after, variant A vs B); not a direct performance metric.
- **Language detection** weighs Italian evidence against English evidence (function words, action verbs, accents, elisions, Italian-only morphology) and picks the larger pile; English wins ties. Tokens shared by both languages are excluded so they cannot tip it. It is still a heuristic: a one-or-two-word prompt carries no evidence and falls back to English, and a third language is classified as English. Pass `--language en|it` for certainty.
- **Padding patterns** are explicit regexes; novel padding phrases may slip through. Open an issue with the example.
- **The Skill description** is dense to maximize triggering precision; tune for your host if needed.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, how to add task types / agent targets / scoring categories, and the release flow.

By participating, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Changelog

See [CHANGELOG.md](CHANGELOG.md). The project follows [Semantic Versioning](https://semver.org) and [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## License

MIT — see [LICENSE](LICENSE). © 2026 Matteo Scurati.
