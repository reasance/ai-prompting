# Agent compatibility

Adapter notes for a named target. Apply them only when the user names a model, a vendor, or an
agent role; otherwise use the vendor-neutral scaffold at the end of this file.

**How to read this file.** Adapters are organized by *behavior*, not by vendor. Every current
model is described by the same handful of capabilities — how reasoning depth is controlled, whether
sampling parameters still do anything, what structured output it guarantees, whether it accepts a
prefilled answer, how it handles tools. A vendor is one row of the matrix below. Model names are
examples true at the verification date; when a newer model appears, look up its capabilities on its
model card and apply the same criteria — do not wait for a row.

Every section that makes a claim about a specific model or host carries a
`_Verified YYYY-MM-DD against: <sources>_` line. A stamp older than three months is a signal to
re-verify before relying on the section; `npm run check-verified` lists the stale ones.

## Resolving a target

`targetAgent` accepts a model or vendor name (`claude`, `opus-5.5`, `gpt-6`, `gemini-4`, `grok`,
`qwen3.8-27b`, `local`, …) or an agent role (`coding-agent`, `research-agent`, `tool-agent`).

1. **Model or vendor name** → find its row in the [capability matrix](#capability-matrix) and apply
   the [criteria](#criteria). Add the vendor note's specifics only where the matrix points to them.
2. **Unknown model** → apply the criteria using its model card. If the card does not say whether
   the model reasons internally, treat it as a reasoning model unless it is a plain instruct
   checkpoint, and say so in an `[ASSUMPTION: …]`.
3. **`local`** → it names *where* the model runs, not what it can do. Ask which model or apply the
   criteria with the [open-weight](#open-weight-and-local-models) defaults.
4. **Agent role** → apply the [role adapter](#role-adapters); combine with a model row when both are
   known.

## Criteria

Apply each criterion from the target's matrix row. These are what actually change the rewrite.

- **Reasoning control.** If the target exposes an effort / thinking parameter or a thinking mode —
  every row of the matrix does — strip "think step by step" and similar instructions, and never add
  a section that asks for the reasoning itself (`<thinking>`, `<analysis>`, a step trace, a
  `reasoning` field). Ask for evidence, quotes, or a short justification instead. Tell the user that
  depth is set with the parameter named in the row. Keep an explicit CoT line only for a
  non-reasoning instruct checkpoint, or when the user has disabled thinking.
- **Sampling policy.** Do not add temperature / top_p advice to the prompt or around it unless the
  row says the vendor wants specific values. Several vendors now ignore or reject them.
- **Structured output.** Where the row says *strict schema*, recommend the API's JSON-schema mode
  over describing JSON in prose. Where it says *json_object only*, the prompt must say "json" and
  include an example object.
- **Prefill.** Where prefill is rejected, never suggest starting the assistant turn for the model;
  use structured output or a plain instruction ("Respond with the JSON only, no preamble").
- **Tools.** Declare only the tools the task needs. Ask for parallel calls only where the row allows
  them. Where reasoning must be replayed, tell the integrator to send the whole assistant message
  (reasoning + tool calls) back unchanged.
- **Caching.** Fixed content first, variable content last — true for every vendor below. Keep the
  tool list and effort setting stable across calls where the row says changing them breaks the cache.
- **Defaults to counter.** Some models run long, some terse, some over-format. State the length
  and format explicitly when the row flags a default that conflicts with the request.

## Capability matrix

_Verified 2026-10-23 against: the vendor sources listed in each [vendor note](#vendor-notes)._

| Vendor · current models | Reasoning control (default) | Sampling | Structured output | Prefill | Tools | Reasoning replay in tool loops |
|---|---|---|---|---|---|---|
| **Anthropic** · Fable 5.1, Opus 5.5, Sonnet 5.5, Haiku 5.5 | `effort` low…max (medium on Opus 5.5 / Haiku 5.5, high elsewhere); thinking always on for Fable 5.x / Opus 5.5 | temperature / top_p / top_k removed (400) | strict schema | rejected (400) | forced `tool_choice` rejected on Fable 5.1 / Sonnet 5.5 | history append-only; editing earlier turns invalidates thinking |
| **OpenAI** · GPT-6 Astra, GPT-6 / 6.1 Sol, GPT-6 Luna, GPT-5.6 | `reasoning.effort` (medium); Astra / 6.1 Sol reject `none` | unsupported when effort ≠ none | strict schema; GPT-6 tools need the Responses API | — | parallel (Codex guide) | — |
| **Google** · Gemini 4 Argon, Gemini 3.8 Flash | `thinking_level` low/medium/high (medium) | deprecated: ignored with a warning on 4 / 3.6+; keep 1.0 on earlier 3.x | JSON schema (subset) | rejected on 3.8+ / 4 | — | return thought signatures |
| **xAI** · Grok 4.7, 4.6, 4.5 | `reasoning.effort` low…xhigh (high); cannot be disabled | vendor asks for temperature 0.7, top_p 0.95 | strict schema | — | — | return encrypted reasoning unchanged |
| **Meta** · Muse Wonder, Spark Open, Glimmer 30B | `reasoning_effort` / `reasoning_strength`; always reasons | per model card | always schema-constrained | — | Wonder parallel; Glimmer **one call per turn** | — |
| **Mistral** · Large 4, Medium 3.5, Small 4 | `reasoning_effort` (`high` for agentic/code; `none` omits thinking) | — | — | — | — | replay ThinkChunks |
| **DeepSeek** · V4.1-Flash, V4-Pro | `reasoning_effort` low/high/max (high); thinking on by default | ignored in thinking mode | **json_object only** | — | — | required with tools (400 without) |
| **Qwen** · Qwen3.8-Max, Flash, 27B | `reasoning_effort` low/medium/xhigh (xhigh); `enable_thinking` | per model card | — | — | — | `preserve_thinking` on by default |
| **Moonshot** · Kimi K3, K3.1 Pro | `reasoning_effort` low/high/max (max); always thinks | fixed by platform — omit | strict schema | — | declare only needed tools | required, whole assistant message |
| **Zhipu** · GLM-5.3, 5.3-Flash | `reasoning_effort` low/high/max (max); cannot be disabled | — | — | — | — | kept by default (`clear_thinking=false`) |
| **MiniMax** · M3, M3.1-Flash | `effort` low…max (max); cannot be disabled | temperature 1.0, top_p 0.95 | — | — | — | — |

"—" means the sources checked say nothing either way; do not invent a rule for it.

## Vendor notes

Only what the matrix cannot hold. Each note is self-contained.

### Anthropic (Claude 4.6+ / 5.x)

_Verified 2026-10-23 against: platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices, …/build-with-claude/effort, …/build-with-claude/refusals-and-fallback, per-model guides (prompting-claude-fable-5-1, -opus-5, -opus-5-5, -sonnet-5-5, -haiku-5-5), …/models/opus-5-5/migration-guide._

- **XML scaffold is native.** Consistent tag names; `<documents><document index>` with `<source>` /
  `<document_content>`; examples in `<example>` / `<examples>`, 3–5 of them, diverse.
- **Long context:** documents first, query last — up to ~30% better on multi-document tasks. Ask for
  quotes first, then the answer.
- **Never ask for the reasoning in the output.** On Fable 5.x, Opus 5.x and Sonnet 5.5 a request for
  a thinking / reasoning section, a reasoning field, or the reasoning "in full" can be declined as
  `reasoning_extraction` — billed, and fallback does not retry it. A short justification, the
  evidence, or a summary of actions is fine.
- **Depth is `effort`, not prose.** Lowering effort trims thinking more reliably than instructions.
  Per model: on Opus 5.5, drop "think carefully before answering"; on Sonnet 5.5 JSON tasks, one line
  "Think the problem through before you answer." helps.
- **A one-line functional role still helps.** Give the reason behind an instruction; Claude
  generalizes from it.
- **Literal instruction following.** Fable 5.x is steered by brief instructions; prompts written for
  older models are often too prescriptive and can degrade output. Opus 5 obeys "only report
  high-severity issues" literally — for review harnesses, ask for coverage and filter downstream.
- **Length and format.** Opus 5 runs long and effort does not shorten it: state the length. Fable 5.1
  under-formats, so anti-markdown blocks can strip structure the content needs. Steer format
  positively ("smoothly flowing prose paragraphs", not "no markdown").
- **Self-verification differs.** Opus 5 verifies unprompted — drop "double-check your answer".
  Sonnet 5.5 / Haiku 5.5 at low effort can skip checks — ask for a real test or build run.
- **Delegation differs.** Opus 5 over-delegates ("Do not delegate work you can finish yourself in a
  handful of tool calls"); Fable 5 should be told when to use subagents. Do not apply one rule to both.
- **Tools.** "Use this tool when…" beats "CRITICAL: you MUST use this tool". For Sonnet 5.5 research,
  remove "minimize tool calls" and ask it to search for anything that may have changed. Give Haiku 5.5
  today's date in the system prompt.
- **Untrusted pasted text:** wrap it in `<pasted_content id="…">` with a matching random id and one
  system-prompt line explaining the tags.
- **JSON without structured outputs (Sonnet 5.5):** it often works the problem in text and ends with
  the JSON — parse the last JSON value.

### OpenAI (GPT-5.6 / GPT-6.x)

_Verified 2026-10-23 against: developers.openai.com/api/docs/guides/prompt-engineering, …/guides/prompt-guidance, …/guides/reasoning, …/guides/latest-model, developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra._

- **Message layout:** developer message (or `instructions`) in the order Identity → Instructions →
  Examples → Context, with context near the end. Markdown headings for sections, XML tags to fence
  documents. A short functional identity is recommended; strip only flattery, tipping and guilt.
- **Fix weak results with a clearer goal, constraints and output contract** before raising
  `reasoning.effort`; do not prescribe every intermediate step.
- **Length:** GPT-5.6 is more concise than 5.5 — a blanket "be concise" over-shortens; use
  `text.verbosity` and put task-specific length in the prompt. GPT-6 Astra defaults to detailed,
  heavily formatted answers — specify prose when you want it.
- **Skill and instruction sensitivity (GPT-6 Astra):** it weighs instructions in skills and
  AGENTS.md heavily and asks for clarification more often. Recommended lines: "The user's instructions
  take precedence over guidelines provided in a skill." and "Before asking the user clarifying
  questions, complete the work that is already authorized." Define what done means up front; say when
  to delegate; drop blanket testing reminders — Astra tests on its own.
- **Codex-tuned models:** the advice to avoid upfront plans and preambles applies to models before
  gpt-5.3-codex; later ones accept promptable status updates.
- **Caching:** stable prefix, `prompt_cache_key`, stable effort and tool list; cache writes bill at
  1.25× on GPT-5.6+.

### Google (Gemini 3.x / 4, Gemma 4)

_Verified 2026-10-23 against: ai.google.dev/gemini-api/docs/prompting-strategies, …/docs/gemini-3, …/docs/latest-model, …/docs/structured-output, …/docs/changelog, ai.google.dev/gemma/docs/core/prompt-formatting-gemma4._

- **Direct and concise.** Gemini 3+ "may over-analyze verbose or overly complex prompt engineering
  techniques used for older models". Define ambiguous terms.
- **Pick one delimiter style** — XML tags or Markdown headings — and keep it for the whole prompt.
- **Role, constraints and output format** in the system instruction or at the top; context first,
  question last, bridged with "Based on the information above…".
- **Terse by default:** request detail explicitly when you want it.
- **Few-shot:** Google recommends always including examples — consistent format, varied content.
- **Reasoning:** a short "Think very hard before answering" is tolerated on hard tasks; a visible
  step-by-step trace is not needed.
- **Agents:** include the current date and the knowledge cutoff; for low-risk exploratory calls,
  prefer calling the tool over asking the user.
- **Gemma 4** (open weights): thinking is enabled by `<|think|>` in the system turn; strip previous
  turns' thoughts except between function calls.

### xAI (Grok 4.x)

_Verified 2026-10-23 against: docs.x.ai/docs/guides/reasoning, docs.x.ai/developers/model-capabilities/text/best-practices, …/text/structured-outputs, x.ai/news/grok-4-7._

- State the task, constraints and output format directly; Grok reasons before answering.
- Set `reasoning.effort` explicitly on every request. On Grok 4.5, `xhigh` is silently treated as
  `high`.
- No official guidance on XML vs Markdown or personas — use the neutral scaffold.
- `stop`, `presencePenalty` and `frequencyPenalty` error on reasoning models.

### Meta (Muse)

_Verified 2026-10-23 against: dev.meta.ai/docs/models, dev.meta.ai/docs/muse-glimmer/prompting, dev.meta.ai/docs/muse-spark-open/prompting, …/muse-spark-open/settings, dev.meta.ai/docs/structured-output._

- Muse succeeds Llama. Wonder and Spark are hosted only; Spark Open (816B MoE) and Glimmer (30B) are
  open weights — and both reason natively.
- **Spark Open weighs the start of the system prompt most:** put the rules that must always hold
  first. Suggested order: role, objective, priority rules, scope, decision procedure, tools, output
  format, completion criteria. Tools go in the `tools` parameter, not in prose.
- **Glimmer:** a specific role beats a generic one; state format, length and tone up front; no
  meta-instructions about how the model works internally; one tool call per turn.

### Mistral (2026 line)

_Verified 2026-10-23 against: docs.mistral.ai/capabilities/reasoning, docs.mistral.ai/capabilities/completion/prompting_capabilities, docs.mistral.ai/models/mistral-large-4-0, mistral.ai/news/mistral-small-4._

- "Markdown and/or XML-style tags are ideal" for separating sections.
- Open with role and task ("You are a <role>, your task is to <task>"); add few-shot examples.
- Replace vague quantitative adjectives with objective measures — but do not ask the model to count
  words.
- In long system prompts, resolve conflicting rules with an explicit decision tree.
- Magistral is deprecated: reasoning is a `reasoning_effort` setting on the general models. Large 4
  and Medium 3.5 are frontier-class, not "small local" models.

### Open-weight frontier APIs (DeepSeek, Qwen, Kimi, GLM, MiniMax)

_Verified 2026-10-23 against: api-docs.deepseek.com/guides/thinking_mode, …/guides/json_mode, …/guides/kv_cache, huggingface.co/Qwen/Qwen3.8-27B, platform.kimi.ai/docs/guide/kimi-k3-quickstart, …/kimi-k3-tool-calling-best-practice, docs.z.ai/guides/llm/glm-5.3, platform.minimax.io/docs/guides/text-generation._

- All reason by default; most cannot turn it off. Do not add CoT text; do not tune sampling.
- **DeepSeek JSON:** `json_object` only — the prompt must contain the word "json" and an example of
  the target object. The API may occasionally return empty content.
- **Qwen:** lower effort does not always cut the cost of multi-turn agentic tasks — failed steps and
  retries can add more than the thinking saved.
- **Kimi:** don't declare every tool (extra tools cost context and raise wrong-tool picks); parse only
  `message.content`, never `reasoning_content`.
- **GLM:** official examples use a functional role ("You are a senior full-stack software
  engineer…") and no incentive phrasing.

### Open-weight and local models

_Verified 2026-10-23 against: huggingface.co/Qwen/Qwen3.8-27B, huggingface.co/openai/gpt-oss-120b, ai.google.dev/gemma/docs/core/prompt-formatting-gemma4, dev.meta.ai/docs/muse-glimmer/prompting, mistral.ai/news/mistral-small-4, ollama.com/library/qwen3.8._

"Local" no longer predicts "no internal reasoning". The models people actually run locally —
Qwen3.8-27B, gpt-oss, Gemma 4, Muse Glimmer 30B, Mistral Small 4 — all reason natively; apply the
reasoning-control criterion to them like any hosted model.

- **Keep a CoT line only for non-reasoning instruct checkpoints** (Llama 3.x / 4, Mistral Small 3.x
  and older) or when thinking is disabled.
- **Shorter prompts, explicit constraints, few-shot examples** still help smaller models.
- **Markdown or shallow XML;** avoid deep nesting on <10B or heavily quantized models (heuristic, not
  measured).
- **Use the model card's sampling settings** and chat template.

## Role adapters

Model-agnostic; combine with a matrix row when the model is known.

### Coding agents (Claude Code, Codex, Cursor, Gemini CLI, …)

- **Declare file boundaries:** "Modify only X.ts and Y.ts; do not touch tests/."
- **Define done:** "Builds without warnings; the affected tests pass; no new dependencies."
- **Scope test requirements to the change.** Current agents test on their own; blanket "always add
  tests" reminders cause over-testing.
- **State management:** for long tasks, track progress in a structured file (tests.json, progress.md).

### Research agents

- **Citations required:** every non-trivial claim cites a source; "If you don't have a real URL,
  write `[no URL]`, not a guess."
- **Source diversity** and a **recency floor** for time-sensitive topics.
- **Uncertainty:** separate fact / inference / hypothesis.
- **Date:** state today's date and ask the model to verify anything that may have changed. Avoid both
  "always search" and "minimize tool calls".

### Tool agents

- **When to use / when not:** per-tool conditions; "Don't call tools when the answer is in the
  prompt."
- **Parallel calls** for independent steps — where the target supports them (not Muse Glimmer).
- **Errors:** retry once, then fall back or report.
- **No invented parameters.**
- **Keep reasoning in history:** in tool loops with reasoning models, send back the whole assistant
  message, not just its text.
- **Scope tools:** declare only the tools the task needs.

## Skill-based hosts

_Verified 2026-10-23 against: code.claude.com/docs/en/skills, learn.chatgpt.com/docs/build-skills, learn.chatgpt.com/docs/custom-prompts, learn.chatgpt.com/docs/developer-commands, geminicli.com/docs/cli/custom-commands, developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli, docs.mistral.ai/vibe/code/cli/skills, docs.x.ai/build/features/skills-plugins-marketplaces, qwenlm.github.io/qwen-code-docs._

This Skill is one `SKILL.md` directory following the Agent Skills standard (agentskills.io). Where it
is installed decides whether it triggers at all:

| Host | Skill location | Invocation | Notes |
|---|---|---|---|
| Claude Code | `~/.claude/skills/ai-prompting/` | `/ai-prompting`, or automatic from the description | Commands and skills are merged; `description` + `when_to_use` truncated at 1,536 chars; keep SKILL.md < 500 lines. Outside Claude Code only `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools` are accepted. |
| Codex CLI / IDE | `~/.agents/skills/ai-prompting/` | `$ai-prompting` or `/skills` | Reads `agents/openai.yaml` for UI metadata. `~/.codex/prompts` custom prompts are deprecated. Non-interactive runs use `codex exec`. |
| ChatGPT | via plugins | `@ai-prompting` | `agents/openai.yaml` is UI metadata only. |
| Gemini CLI | `~/.gemini/skills/` or `~/.agents/skills/` | `activate_skill` after a consent prompt | Since 2026-06-18 only for paid Gemini API / Enterprise keys; consumer tiers moved to Antigravity CLI. Custom commands would have to be TOML. |
| Mistral Vibe | `~/.vibe/skills/` or `./.agents/skills/` | slash command when `user-invocable` | |
| Grok Build | `~/.grok/skills/` or `~/.agents/skills/` | | Reads Claude Code skills as-is. |
| Qwen Code | `~/.qwen/skills/` | model-invoked or slash command | |
| Cursor | command shim in `~/.cursor/commands/` | `/ai-prompting` | The shim points at the installed SKILL.md. |

`~/.agents/skills/` is the shared location: one copy serves Codex, Gemini CLI, Grok Build, and
(project-level) Vibe.

**Description is the trigger surface.** Hosts shorten long descriptions as the skill list grows, so
the front of the description carries the concrete user phrases.

**Instruction sensitivity.** Some hosts' models weigh skill text heavily (GPT-6 Astra). The Skill
states that the user's instructions take precedence over it, and asks only when blocked.

**Multi-turn mechanics for step 9 (offer execution).** The choice block needs a follow-up turn: the
host either re-injects the `## Improved prompt` block as the next user turn (Run) or carries state
through the refinement loop (Refine). Interactive sessions in all the hosts above support both.
Single-shot runs (`codex exec`, piped CLI output, embedded widgets) do not — the Skill then omits the
block and emits only the improved prompt and score.

**Interactive question primitives.** Prefer the host's structured-choice tool over markdown MCQ:
Claude Code's `AskUserQuestion` (chips, structured reply, up to 4 questions per call), Cursor's
inline choice widget. No such primitive is documented for Codex, Gemini CLI, Vibe, Grok Build or Qwen
Code — fall back to the markdown clarification block. Full rules:
[rendering](clarification-policy.md#rendering).

## Cross-vendor neutral scaffold (default when no target is named)

```
<role>...</role>
<objective>...</objective>
<context>...</context>
<task>...</task>
<constraints>...</constraints>
<output_format>...</output_format>
<quality_bar>...</quality_bar>
```

Anthropic recommends XML tags; Google and Mistral endorse XML tags or Markdown headings equally;
OpenAI uses Markdown sections with XML for documents; xAI and the Chinese labs publish no guidance
either way. Specialize only when the user names a target.
