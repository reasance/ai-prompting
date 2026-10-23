# Cost control

Two budgets to manage:
1. **Skill execution cost** — tokens spent reasoning about and rewriting the prompt.
2. **Generated prompt cost** — tokens spent every time the rewritten prompt is run.

Optimize both. The second matters more if the prompt will be reused.

## Per-mode budget

| Mode | Skill output target | What to include | What to drop |
|---|---|---|---|
| `final_only` | smallest | Only the improved prompt block | Everything else |
| `compact` | small | Improved prompt + 1-line score | Change list, rationale, assumptions |
| `standard` | medium | Improved prompt + change list + score + assumptions | Per-category rationale |
| `diagnostic` | largest | Standard + per-category rationale | (nothing — this is the exhaustive mode) |

Default to `standard` unless the user signals otherwise.

## Per-`tokenBudget` rules for the *generated* prompt

| Budget | Rule | Deterministic CLI |
|---|---|---|
| `minimal` | Drop `<quality_bar>`. Drop `<context>` when it is not load-bearing — a bare `[ASSUMPTION: …]` placeholder is not; a real audience or user-supplied context is. Drop `<role>` if the task type is implicit. Inline constraints into `<task>`. | drops `<quality_bar>` (it never emits a placeholder `<context>` at any budget); keeps `<role>` and the constraints block |
| `balanced` *(default)* | Full canonical scaffold. | same |
| `generous` | Add few-shot examples (3–5), expanded `<quality_bar>`, fallback strategies. | expands `<quality_bar>`; does **not** invent examples |

The third column exists because these two layers genuinely differ. The rules are written for an
agent applying the Skill, which can judge "load-bearing" and write examples worth the tokens. The
CLI does the subset that is decidable without a model. Read a row as a CLI spec and you will
document behavior that does not exist — that mistake shipped once already.

## Padding to strip from any prompt

Detect and remove:
- "You are a world-class / expert / brilliant / amazing AI…"
- "Take a deep breath" / "Let's think step by step"
- "I will tip you $X" / "My career depends on this"
- Repeated trigrams (3+ word phrases that recur ≥3 times)
- Polite filler ("if you don't mind", "could you please", "thank you in advance")

Modern reasoning models treat persona padding as noise. Do not add it during scaffolding.

## When to skip "think step by step"

_Verified 2026-10-23 against: the vendor sources in [agent-compatibility](agent-compatibility.md#vendor-notes)._

The criterion is the target's **reasoning control**, not its size or where it runs. If the model
exposes an effort / thinking parameter or a thinking mode, an explicit "think step by step" is:
- Redundant: the model already reasons internally, and the parameter sets the depth more reliably
  than prose does.
- Sometimes counterproductive: it invites a verbal trace that pollutes the output — and on some
  models (Claude Fable/Opus/Sonnet 5.x) a request to write the reasoning out is refused.

As of the verification date that covers every current hosted model and the open-weight models
people run locally (Qwen3.8, gpt-oss, Gemma 4, Muse Glimmer, Mistral Small 4). Remove the
instruction and point the user at the parameter instead (Claude `effort`, OpenAI
`reasoning.effort`, Gemini `thinking_level`, `reasoning_effort` elsewhere — see the
[capability matrix](agent-compatibility.md#capability-matrix)).

Keep a CoT line only for a non-reasoning instruct checkpoint (Llama 3.x / 4, Mistral Small 3.x and
older) or when the user has turned thinking off. Gemini tolerates a short "Think very hard before
answering" on hard tasks; that is a nudge, not a requested trace.

## Reuse vs one-shot

If the user signals "I'll reuse this prompt" or "this is for a template / API call":
- Optimize aggressively for the *generated* prompt cost.
- Use template variables (`{{var}}`).
- Move long fixed context above the template — it amortizes across calls and benefits from caching where supported.

If the user signals "one-shot" / "just for now":
- Don't over-engineer. A 3-line plain prompt may beat a 30-line scaffold.

## Token-efficiency self-check

Before returning, ask:
- Could any sentence be cut without changing the model's behavior? Cut it.
- Did I echo the user's full prompt back? Don't.
- Did I add a constraint that's already implicit? Drop it.
- Did I ladder verbose enumerations when a short list would suffice? Compress.

## When verbosity is justified

Keep length when:
- Multiple documents are quoted (long-context tasks).
- Few-shot examples are needed for format/tone control.
- The output schema requires a worked example.

Length is not virtue. Length is a cost paid every call.
