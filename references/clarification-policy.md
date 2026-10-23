# Clarification policy

The default is **proceed with explicit assumptions**. Asking is the exception, not the rule. Each question costs the user time and tokens; ask only when the answer materially changes the rewrite.

## When to ask

Ask when **at least one** of these is true:

1. **Outcome is unrecoverable from context.** The desired output cannot be inferred even charitably (e.g. prompt is "make it better" with no referent).
2. **A required dependency is missing.** Source files, audience, target tool/platform, data schema, jurisdiction — items that change the structure of the answer, not its surface.
3. **High-risk domain.** Legal, medical, financial advice, security/safety-critical code, production deployment, business-critical decisions, regulated content.
4. **Contradictory instructions.** The prompt says both "always X" and "never X", or "use markdown" and "no markdown", etc.
5. **Underspecified style/format the user explicitly cares about.** They asked for "in our brand voice" without providing the voice.

## When NOT to ask

Do not ask when:
- The answer is inferable from context with a reasonable assumption.
- The question would be answered by reading a file the user has already mentioned.
- The risk of getting it wrong is low (the user can iterate).
- You would be asking just to be safe; default to acting and surfacing assumptions.

## How to ask

- **Maximum 3 questions** in one turn.
- Prefer **multiple-choice** or **short-answer** to reduce friction.
- Group related questions; never ask the same thing twice.
- Briefly explain *why* a question matters only if non-obvious.
- Do **not** echo the user's prompt back at them; show you've read it.

## Policy overrides

The `clarify` option (`--clarify`) overrides the judgement above:

| Value | Behavior |
|---|---|
| `auto` *(default)* | Apply the rules on this page. |
| `always` | Ask even when the prompt is clear. Still capped at 3 questions, still prefer structured choices. |
| `never` | Never ask. Proceed with explicit `[ASSUMPTION: …]` markers. In a **high-risk domain** do not stay silent — prepend one warning line (`⚠ Dominio ad alto rischio: assunzioni non verificate.` / `⚠ High-risk domain: assumptions unverified.`) and continue. |

`never` suppresses the question, not the risk. The warning line is what keeps the user able to
catch a wrong assumption in a domain where being wrong is expensive.

## Rendering

Markdown MCQ is the universal fallback. **When the host provides a
structured-question primitive — one that renders as clickable options and
constrains the reply to the offered values — prefer it.** Detection rule
for the agent: if a tool whose purpose is "ask the user a question with
choices" is available, call it; otherwise emit the markdown block below.

_Verified 2026-10-23 against: code.claude.com/docs/en/skills, learn.chatgpt.com/docs/developer-commands, geminicli.com/docs, docs.mistral.ai/vibe/code/cli/skills, docs.x.ai/build/features/skills-plugins-marketplaces._

| Host | Primitive | Notes |
|---|---|---|
| Claude Code | `AskUserQuestion` tool | Renders as inline chips; reply is structured; up to 4 questions per call. |
| Cursor | inline choice widget | Similar UX; structured reply. |
| OpenAI Codex CLI / IDE | none documented | A multiple-choice tool exists in Plan mode per an open GitHub issue, not in the docs — fall back to markdown. |
| Gemini CLI | none documented | Falls back to the markdown format. |
| Mistral Vibe · Grok Build · Qwen Code | none documented | Falls back to the markdown format. |
| Plain chat / agnostic | none | Markdown only. |

Why prefer it: lower friction for the user (one click vs typing "1B"),
structured replies (no parsing free-text answers), and unambiguous
coverage (every option visible at the same time). The same preference
applies to the [refinement loop](#refinement-loop) (Choice 2 in step 9
of `SKILL.md`): batch the per-cycle assumptions into one structured
question call.

### Format (markdown fallback)

```
## Domande di chiarimento
- {question 1} (option A / option B / option C)
- {question 2}
- {question 3}
```

Or in English:

```
## Clarifying questions
- {question 1} (option A / option B / option C)
- ...
```

## When to proceed despite uncertainty

When the policy says "do not ask" but you still have unknowns:
- Pick the most charitable interpretation.
- Add an explicit `[ASSUMPTION: ...]` line in the improved prompt.
- List assumptions in the `## Assunzioni` / `## Assumptions` section of the response.
- The user can correct in the next turn at low cost.

## Examples

**Ask:**
- "Generate API docs" → for which language? for which framework? Is there an existing OpenAPI spec?
- "Write the contract" → which jurisdiction? this is high-risk legal.
- "Do X but never X" → contradiction; ask which one wins.

**Do not ask:**
- "Write a sales email for our SaaS product" → assume B2B mid-market unless contradicted; surface as assumption.
- "Translate this to Italian" → just translate; ask only if a tone/register is requested without spec.
- "Improve my prompt" with a long, well-structured prompt attached → infer task type, proceed, surface light assumptions.

## Anti-pattern: clarification creep

If the user has given you any executable starting point, **act first**, ask second. A flawed first pass that surfaces assumptions is faster to correct than a question loop. Only loop on questions when the cost of wrong is high (see "high-risk domain" above).

## Refinement loop

Triggered when the user picks Choice 2 ("Modifica" / "Refine") in step 9 of the Skill — the post-improvement execution offer. The loop converts the assumptions surfaced in the previous pass into targeted questions, folds the answers back into `<context>`, and re-runs the rewrite.

1. **Identify candidates.** From the current improved prompt, list every `[ASSUMPTION: ...]` in `<context>` and every implicit assumption baked into `<role>` / `<objective>` / `<constraints>`. Rank by load-bearing weight: which one would change the rewrite most if flipped?
2. **Pick top 1-3.** Never more than 3 questions per cycle.
3. **Format as multiple-choice.** Reuse the standard clarification block format. Ask one at a time only when later questions depend on earlier answers; otherwise batch.
4. **Fold answers in.** Replace the corresponding `[ASSUMPTION: ...]` markers with the user's confirmed values. If the user volunteered extra detail, weave it into `<context>`.
5. **Re-run steps 6-9.** Strip padding (typically a no-op on a second pass), rewrite, re-score, present, append the choice block again.
6. **Default cap at 3 cycles, escape via `unlock`.** Track cycle count. After cycle 3, present the choice block with a one-line note: `Hai raggiunto il cap di 3 cicli di rifinitura. Scrivi unlock per continuare, oppure scegli Esegui.` (English: `You've reached the 3-cycle refinement cap. Type unlock to keep refining, or pick Run.`). On `unlock`, reset the cycle counter and continue the loop normally; do not raise the cap again until the next `unlock`.

The cap exists to avoid the "infinite refinement" anti-pattern. After three rounds of MCQ, the prompt is usually underspecified at the spec level — better to Run, see the actual output, and iterate from concrete results than to keep nibbling at the spec. The `unlock` escape is for the rare expert user who knows they want to keep iterating: it's a single keyword to opt out of the safety net, not a setting to disable it permanently.
