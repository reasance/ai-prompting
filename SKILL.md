---
name: ai-prompting
description: improve, rewrite, debug, evaluate, or compress prompts for llm agents and skill-based workflows. use when the user asks to make a prompt better, perfect, more reliable, cheaper, clearer, structured, model-specific, agent-ready, or suitable for tools, research, coding, writing, extraction, or multi-step workflows.
---

# ai-prompting

A prompt-improvement Skill. Take any user-supplied prompt and return a clearer, cheaper, more reliable version — calibrated to the target agent, task type, and output needs.

The user's instructions take precedence over this Skill.

## When to use

Use this Skill when the user asks any of the following (in any language):
- "improve / fix / rewrite / clean up / make better / perfect / restructure my prompt"
- "ottimizza / migliora / sistema il prompt / rendi più efficace / più chiaro"
- "make this prompt cheaper / shorter / more reliable / agent-ready / model-specific"
- "evaluate this prompt / score it / what's wrong with it / why does it fail"
- "build me a prompt for {research, coding, writing, extraction, agentic workflow}"

Do **not** invoke this Skill when the user simply wants you to *answer* a question — only when they want you to *engineer the prompt itself*.

## Decision flow

1. **Read** the user's original prompt verbatim.
2. **Classify** the task type (research / writing / correspondence / coding / analysis / data-extraction / agentic-workflow / creative / business / education / general).
3. **Detect** the target if mentioned: a model or vendor (Claude, GPT, Gemini, Grok, Muse, Mistral, DeepSeek, Qwen, Kimi, GLM, MiniMax, a local model) or an agent role (coding / research / tool agent). Resolve it as described in [agent-compatibility](references/agent-compatibility.md#resolving-a-target).
4. **Identify missing information** that would *materially* change the result.
5. **Decide on clarification.** Default: produce the rewrite with `[ASSUMPTION: ...]` markers; ask only when the policy below says the result would otherwise be wrong.
   - Critical missing info → ask up to 3 focused questions (see [clarification-policy](references/clarification-policy.md)). When the host has a structured-choice primitive (e.g. `AskUserQuestion` in Claude Code), prefer it over markdown MCQ — see [rendering rules](references/clarification-policy.md#rendering).
   - Otherwise → proceed and surface explicit `[ASSUMPTION: ...]` markers.
6. **Rewrite** using the smallest effective structure (see [prompt-patterns](references/prompt-patterns.md)). A prompt that already states its deliverable, its limits and its output format is returned with its padding removed and its own structure kept — re-sectioning it only reshuffles it — unless `scaffold: always`. Never add a section with nothing true to say: no placeholder context, no restated output format, no quality line that points at something the prompt lacks.
7. **Score structural coverage** of original vs improved against the rubric (see [prompt-quality-rubric](references/prompt-quality-rubric.md)). It measures whether the prompt *declares* role/objective/constraints/format/criteria — not whether it asks for the right thing. Never present it as a quality or performance claim, and never report a confidence level.
8. **Return** the result in the requested output mode.
9. **Offer execution.** After the output block, append a 2-choice prompt asking what to do next. Show it in `compact` / `standard` / `diagnostic`. Skip it when the request implies output only — `final_only`, "just the prompt", piped or CI use, a single-shot host with no follow-up turn — and when invoked from the deterministic CLI (no agent to interpret the reply).

   **Italian template:**

   ```
   ---
   ## Cosa fai adesso?
   1. **Esegui** — applica subito il prompt migliorato (solo il blocco "## Prompt migliorato", non il resto).
   2. **Modifica** — voglio raffinare prima; fammi domande mirate.

   _Non rispondere o scrivi qualcos'altro per chiudere il giro._
   ```

   **English template:**

   ```
   ---
   ## What next?
   1. **Run** — apply the improved prompt now (only the "## Improved prompt" block, not the rest).
   2. **Refine** — ask me targeted questions before running.

   _Reply with anything else (or nothing) to close out._
   ```

   **Behavior.** Choice 1 → treat the body of the `## Improved prompt` / `## Prompt migliorato` code block as the user's next turn; the meta sections (Cosa è migliorato / Copertura strutturale / Assunzioni / Rubric) are not part of that instruction. Choice 2 → enter the [refinement loop](references/clarification-policy.md#refinement-loop) (default cap 3 cycles; the user can type `unlock` to keep refining). Anything else, or no reply → close gracefully without further prompting; do not loop asking the user to disambiguate. The MCQ is a hint, not a gate.

## Options

Every surface — slash command, CLI, library — maps onto this one set. This table is the canonical
definition: adapters translate their own syntax into it and do not redefine semantics.

| Option | Flag | Values | Default | Effect |
|---|---|---|---|---|
| `mode` | `--mode` | `final_only` · `compact` · `standard` · `diagnostic` | `standard` | How much of the report to return — see below. |
| `language` | `--language` | `it` · `en` | auto-detect | Output language; overrides the it-vs-en evidence scorer. |
| `taskType` | `--task` | research · writing · correspondence · coding · analysis · data-extraction · agentic-workflow · creative · business · education · general | inferred | Overrides the keyword classifier. |
| `targetAgent` | `--target` | a model or vendor name (`claude`, `opus-5.5`, `gpt-6`, `gemini-4`, `grok`, `qwen3.8-27b`, `local`, …) · `coding-agent` · `research-agent` · `tool-agent` | none | Resolves to a row of the capability matrix — see [agent-compatibility](references/agent-compatibility.md#resolving-a-target). |
| `audience` | `--audience` | free text | none | Injected into `<context>` as `Audience: …`; suppresses the audience question. |
| `tokenBudget` | `--token-budget` | `minimal` · `balanced` · `generous` | `balanced` | Size of the *generated* prompt — see [cost-control](references/cost-control.md). |
| `clarify` | `--clarify` | `auto` · `always` · `never` | `auto` | Question policy — see [clarification-policy](references/clarification-policy.md#policy-overrides). |
| `scaffold` | `--scaffold` | `auto` · `always` | `auto` | `auto` keeps a well-specified prompt's own structure and only strips padding; `always` scaffolds every prompt — see [prompt-patterns](references/prompt-patterns.md#defaults-the-cli-fills-in). |

`targetAgent` is honored by the **Skill layer only** — an agent can genuinely adapt its rewrite.
The deterministic CLI has no adapter branches, so it exposes no `--target` flag rather than
pretending; see [agent-compatibility](references/agent-compatibility.md).

**What each mode returns**

- `final_only` — only the improved prompt block. Lowest token cost.
- `compact` — improved prompt + 1-line "what changed" + score totals.
- `standard` — improved prompt + change list + score + assumptions.
- `diagnostic` — standard + per-category rubric breakdown with the reason for each score.

**Invoked with arguments** (a slash command such as `/ai-prompting --mode compact <prompt>`): flags
may appear anywhere; strip them and map each to the row above. Everything else is the prompt to
improve. If only flags were given, ask for the prompt.

**Reading options out of prose.** Users state these in natural language more often than as flags.
An explicit flag always wins; otherwise infer: "solo prompt" / "just the prompt" / "no explanation"
→ `mode: final_only`; "why" / "diagnose" / "in dettaglio" → `mode: diagnostic`; "veloce" /
"compatto" / "brief" → `mode: compact`; "in italiano" / "in english" → `language`; "non chiedere" /
"don't ask" → `clarify: never`; "minimale" / "cheap" / "il più corto possibile" →
`tokenBudget: minimal`.

## Default output template (Italian)

````
## Prompt migliorato
```text
<the improved prompt>
```

## Cosa è migliorato
- Chiarezza: ...
- Struttura: ...
- Vincoli: ...
- Output: ...

## Copertura strutturale
Originale: X/100
Migliorato: Y/100
Delta: +Z
Nota: misura la struttura dello scaffold, non la qualità della risposta.

## Assunzioni
- ...
````

For English use the same structure with headers `## Improved prompt / ## What improved / ## Structural coverage / ## Assumptions`.
For `compact` mode drop "Cosa è migliorato" and "Assunzioni"; keep one-line score.
For `final_only` drop everything except `## Prompt migliorato` + the code block.

## Clarification policy (summary)

Ask only when **one or more** of these is true:
- The desired output is impossible to infer.
- A required source/file/audience/tool/jurisdiction/data-schema/platform is missing.
- The task is high-risk (legal, medical, financial, security, safety, production code, business-critical).
- Instructions contradict each other.
- The user explicitly asks for an underspecified style or format.

Otherwise: proceed with explicit assumptions. Max 3 questions, prefer multiple-choice. Full policy: [clarification-policy](references/clarification-policy.md).

## Cost-control rules (summary)

- Do not load the references files unless the user is in `diagnostic` mode or asks for a deeper rewrite.
- Avoid restating the user's full prompt unless the rewrite changes substantively.
- Strip detected padding ("you are a world-class…", "take a deep breath", "I will tip you…") before scaffolding.
- Strip "think step by step" when the target has a reasoning / effort control — every current hosted model and most open-weight ones. Never add a section asking for the reasoning itself (`<thinking>`, `<analysis>`, a trace): some models refuse it. Keep a CoT line only for non-reasoning instruct checkpoints. Criterion: [cost-control](references/cost-control.md#when-to-skip-think-step-by-step).
- Honor `tokenBudget` (`minimal` / `balanced` / `generous`): drop `<context>` and `<quality_bar>` first under `minimal`. Full guidance: [cost-control](references/cost-control.md).

## Generated prompt structure

For complex/multi-source/agentic prompts use this XML scaffold:

```
<role>...</role>
<objective>...</objective>
<context>...</context>
<task>...</task>
<constraints>...</constraints>
<output_format>...</output_format>
<quality_bar>...</quality_bar>
```

For simple tasks use a 2-3 line plain prompt — do not force XML when it adds noise. Pattern catalogue: [prompt-patterns](references/prompt-patterns.md).

## Agent-specific adapters

Adapters are keyed on behavior, not vendor names. When a target is named, look up its row in the
[capability matrix](references/agent-compatibility.md#capability-matrix) and apply the criteria:

- **Reasoning control** → no CoT text, no reasoning sections; point the user at the effort / thinking parameter.
- **Sampling policy** → no temperature advice unless the vendor asks for specific values.
- **Structured output** → schema mode where strict; "json" + an example object where `json_object` only.
- **Prefill** → never suggest it where rejected; use structured output or a plain instruction.
- **Tools** → only the tools needed; parallel only where supported; replay reasoning where required.
- **Defaults to counter** → state length and format when the model runs long, terse, or over-formatted.

Vendor specifics (Claude's refusal on reasoning requests, GPT-6 Astra's sensitivity to skill text,
Gemini's preference for direct prompts, …) and the coding / research / tool-agent role adapters are
in [agent-compatibility](references/agent-compatibility.md). For a model not in the matrix, apply the
criteria from its model card.

## Local CLI utility (optional companion)

This Skill ships with a Node.js CLI for deterministic baseline scaffolding without an LLM call:

```
npx ai-prompting doctor
npx ai-prompting improve --prompt "Write me a better sales email"
npx ai-prompting improve --file prompt.txt --mode diagnostic
```

The CLI is useful for: smoke-testing the package, batch-processing prompts in CI, getting a deterministic baseline you can then refine semantically. The richer rewrite happens *inside the host agent* using the instructions on this page.

When the user explicitly asks for "deterministic" / "rule-based" / "no creativity" output, run the CLI and return its result as-is instead of rewriting semantically.

## References (load only when needed)

- [prompt-quality-rubric.md](references/prompt-quality-rubric.md) — 9-category, 100-point scoring rubric.
- [prompt-patterns.md](references/prompt-patterns.md) — task-specific scaffolds (research / coding / agentic / extraction / writing / correspondence / analysis) and the defaults the CLI fills in per task type.
- [clarification-policy.md](references/clarification-policy.md) — when to ask, how to ask.
- [cost-control.md](references/cost-control.md) — token-budget rules per mode.
- [agent-compatibility.md](references/agent-compatibility.md) — adapter notes per target agent.
