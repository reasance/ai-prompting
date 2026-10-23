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
- [Install as a Skill](#install-as-a-skill)
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

1. **Detects** language (it/en) and task type (research, coding, writing, correspondence, analysis, data-extraction, agentic-workflow, creative, business, education, general).
2. **Strips** padding that hurts modern reasoning models — `"you are a world-class…"`, `"take a deep breath"`, `"think step by step"`, `"I will tip you…"` plus Italian variants (`"sei un esperto di livello mondiale"`, `"fai un respiro profondo"`, `"pensaci passo passo"`).
3. **Decides whether to ask** for clarification (only when info is critical, contradictions exist, or the domain is high-risk: legal, medical, financial, security, production code).
4. **Rewrites** with a canonical XML scaffold (`<role>`, `<objective>`, `<context>`, `<task>`, `<constraints>`, `<output_format>`, `<quality_bar>`), adding a section only when it has something true to say. A prompt that is already well specified — 25+ words that state their output format or at least two explicit constraints — keeps its own structure and only loses padding (`--scaffold always` forces the scaffold).
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
| `--task <type>` | research / writing / correspondence / coding / analysis / data-extraction / agentic-workflow / creative / business / education / general | inferred | overrides the keyword classifier |
| `--token-budget <level>` | `minimal` / `balanced` / `generous` | `balanced` | `minimal` drops `<quality_bar>`, plus `<context>` when it is not load-bearing; `generous` expands the quality bar |
| `--clarify <policy>` | `auto` / `always` / `never` | `auto` | `never` suppresses the questions but still emits a high-risk warning |
| `--scaffold <policy>` | `auto` / `always` | `auto` | `auto` returns a well-specified prompt with only its padding removed |
| `--language <code>` | `it` / `en` | auto-detect | overrides the it-vs-en evidence scorer |
| `--audience <text>` | free text | — | injected into `<context>`; suppresses the audience question; makes `<context>` load-bearing under `minimal` |
| `--constraints <list>` | pipe-separated | — | e.g. `--constraints "max 200 words|no markdown"` |
| `--no-score` | flag | off | suppresses score block |
| `--no-rationale` | flag | off | suppresses per-category rationale (diagnostic) |
| `--version` | flag | — | prints package version |
| `--help` | flag | — | prints CLI help |

Unknown flags, missing values, invalid enum values, and passing more than one input source are
errors, not warnings — the CLI is meant to be safe in a CI gate.

## Install as a Skill

The Skill is one directory — `SKILL.md`, `references/`, `agents/` — following the Agent Skills
standard ([agentskills.io](https://agentskills.io)). Copy it to where your hosts look for skills:

```bash
npm run install-skill            # every detected host
npm run install-skill -- --list  # targets and which hosts each one serves
npm run install-skill -- --host claude --force
```

| `--host` | Installs to | Serves |
|---|---|---|
| `claude` | `~/.claude/skills/ai-prompting/` | Claude Code |
| `agents` | `~/.agents/skills/ai-prompting/` | Codex CLI / IDE, Gemini CLI, Grok Build |
| `vibe` | `~/.vibe/skills/ai-prompting/` | Mistral Vibe |
| `qwen` | `~/.qwen/skills/ai-prompting/` | Qwen Code |
| `cursor` | `~/.cursor/commands/ai-prompting.md` | Cursor — a short command that points at the shared `SKILL.md` |

Once installed, the host picks the Skill up from its description, or you invoke it directly — in
Claude Code:

```
/ai-prompting <prompt> [--mode …] [--target …] [--task …] [--language …] [--audience "…"] [--token-budget …] [--clarify auto|always|never]
```

In Codex, `$ai-prompting`. Natural-language fallbacks work too: *"in italiano"*, *"non chiedere"*,
*"solo prompt"*, *"compatto"*, *"in dettaglio"*. Flags always win over fallbacks.

**Upgrading from 0.3.x:** the separate `/ai-prompting:improve` command is gone — it was a second
entry for the same Skill. `install-skill` removes `~/.claude/commands/ai-prompting:improve.md` when it
installs the Claude Code skill. (The `install-command` alias was removed in 0.5.0.)

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

**Hosts.** Any host on the Agent Skills standard reads `SKILL.md` from its skills directory — see
[Install as a Skill](#install-as-a-skill) for the verified locations. ChatGPT gets skills through
plugins; `agents/openai.yaml` is only UI metadata for Codex / ChatGPT. Gemini CLI has served only paid
Gemini API and Enterprise keys since 2026-06-18. Hosts without skill support can call
`improvePrompt()` as a tool.

**Target models.** When you name a target (`--target opus-5.5`, `gpt-6`, `gemini-4`, `qwen3.8-27b`,
…), the Skill adapts the rewrite by *behavior* rather than by brand: how the model's reasoning depth
is controlled, whether sampling parameters still apply, what structured output it guarantees,
whether it accepts a prefilled answer, how it handles tools. The
[capability matrix](references/agent-compatibility.md#capability-matrix) covers Anthropic, OpenAI,
Google, xAI, Meta, Mistral, DeepSeek, Qwen, Kimi, GLM and MiniMax; every vendor note is dated, and
`npm run check-verified` lists notes older than 90 days.

## Examples (input → output)

### A vague prompt with English padding

**Input:**
```
You are a world-class expert. Take a deep breath. Help me write something good.
```

**Output (`standard` mode, English):**
```
## Improved prompt
<role>Senior editor focused on clarity, rhythm, and audience fit.</role>
<task>Help me write something good.</task>
<constraints>
- Unknown specifics (names, dates, figures) go in [brackets]; never invent them.
</constraints>
<output_format>Flowing prose; 60-90 word paragraphs; no bullets unless a real list; title + subtitle when appropriate.</output_format>

Structural coverage — Original: 34/100  →  Improved: 58/100  (Δ +24)
```

### An Italian prompt with persona padding

**Input:**
```
Sei un esperto di livello mondiale. Aiutami a scrivere una mail per chiedere un aumento.
```

**Output (`standard` mode, Italian — note the auto-detect):**
- Stripped Italian padding (`Sei un esperto di livello mondiale`)
- One sentence left, so it becomes the `<task>` as written — no `<objective>` repeating it
- Task type → `correspondence`, role → `Redattore di corrispondenza professionale.`, format → subject, greeting, short paragraphs, one concrete next step, sign-off
- Structural coverage 36 → 52 (Δ +16)

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
✓ package.json valid + bin entry (version 0.5.0)
✓ SKILL.md frontmatter (name, description) (name ✓, description ✓)
✓ references/ files (5/5)
✓ bin/ai-prompting executable
✓ compiled CLI artifact (dist)
✓ smoke test (improvePrompt) (improved length=721, delta=44)
Status: OK
Node: 20.10.0 | Package: 0.5.0
```

If a check fails, the doctor prints a `fix:` line for it.

## FAQ

**Why ship both a Skill and a CLI?** They serve different consumers. The Skill is consumed by an agent that has its own LLM — that agent gets semantic rewriting. The CLI runs locally, deterministic, no API key — useful in CI, batch jobs, smoke tests, and as a fallback when no agent is available.

**Does the CLI call an LLM?** No. Never. The CLI is rule-based: keyword detection, regex padding strippers, XML scaffolding, heuristic scoring. Zero API calls.

**Will the score improve my real prompt performance?** Unknown — the score does not measure that. It measures *structural coverage*: whether the prompt declares a role, an objective, constraints, an output format, and success criteria, and whether it avoids padding. A prompt can score 90 and still ask for the wrong thing. There is no eval set behind it, so no correlation with output quality is claimed.

**Why not use a hosted prompt-improvement service?** Privacy, cost, reproducibility, and offline use. The deterministic CLI is the same on every machine. The Skill, when run by a host agent, never leaves the user's existing tool.

**The CLI rewrites my Italian prompt with English structure tags.** The XML tags (`<role>`, `<task>`, etc.) are the protocol for the model — they are intentionally English because that's the convention every modern LLM is trained on. The *content* of the prompt is in your language. If you want fully Italian tags, fork and translate; the rest of the logic doesn't depend on the tag names.

**Can I add a new task type / target agent?** Yes — see [CONTRIBUTING.md](CONTRIBUTING.md). It's two file edits and a regression test.

**What happens to "think step by step"?** The CLI always strips it. The criterion is whether the target model has a reasoning control — an effort / thinking parameter or a thinking mode — and as of late 2026 that covers every current hosted model and the open-weight models people run locally (Qwen3.8, gpt-oss, Gemma 4, Muse Glimmer, Mistral Small 4). For those, an explicit CoT line is redundant, and asking a model to write its reasoning out can even be refused (Claude Fable/Opus/Sonnet 5.x). It still helps a non-reasoning instruct checkpoint (Llama 3.x / 4, Mistral Small 3.x and older). The CLI cannot tell which model you target, so if you use one of those, keep the CoT line yourself — or apply the Skill through an agent, which does adapt. Details: [cost-control](references/cost-control.md#when-to-skip-think-step-by-step).

**Why is there no `--target` on the CLI?** Because it changed nothing. `--target local` and `--target claude` produced byte-identical output. `targetAgent` remains a Skill and library option, where an agent can genuinely adapt the rewrite; the deterministic CLI will get the flag back when it has real adapter branches and tests that prove they fire.

**Where do I report issues?** [GitHub Issues](https://github.com/reasance/ai-prompting/issues). Security: see [SECURITY.md](SECURITY.md).

## Limitations

- **CLI = deterministic baseline.** It guarantees structural scaffolding and padding removal; it does not perform semantic rewriting. The scaffold adds defaults only where the prompt is silent, and never overrides a length, count or format the prompt states. A frontier model usually gains little from the CLI beyond padding removal — the semantic rewrite happens when an agent host applies the Skill.
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
