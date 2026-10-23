# Structural coverage rubric (100 points)

Score both the *original* and the *improved* prompt across 9 categories. Total = 100.

**What this measures:** whether a prompt *declares* the things that make prompts
legible — role, objective, context, steps, constraints, output format, success
criteria — and whether it avoids padding. **What it does not measure:** whether
the prompt asks for the right thing, or how good the resulting answer will be. A
prompt can score 90 and be pointed at entirely the wrong problem.

Two consequences worth stating plainly:

- **A high baseline is built in.** Every category has a non-zero floor, so even
  an empty prompt lands near 40/100. Treat the number as a relative before/after
  signal, never as an absolute grade.
- **Sections earn credit only when they carry content.** A `<context>` holding
  nothing but `[ASSUMPTION: ...]` scores as absent, because it is.

| Category | Weight |
|---|---|
| Intent clarity | 15 |
| Context sufficiency | 15 |
| Task decomposition | 10 |
| Constraint specificity | 10 |
| Output format clarity | 15 |
| Tool / source instructions | 10 |
| Robustness vs hallucination | 10 |
| Token efficiency | 10 |
| Evaluation criteria | 5 |

## 1. Intent clarity (15)

What the user wants must be unambiguous.

| Score | Signal |
|---|---|
| 0–4 | Vague opener ("help me", "do something"), no concrete verb, no noun-target. |
| 5–9 | Topic identifiable but goal underspecified. |
| 10–13 | Clear imperative + concrete object; minor ambiguity. |
| 14–15 | Explicit `<objective>` or one-sentence outcome statement; no rephrasing needed. |

The opener signals (vague opener, concrete imperative) are read from the request itself — the
`<objective>` if present, else the `<task>`, else the raw text — never from the markup around it.
Wrapping a request in tags therefore neither earns the imperative credit nor hides a vague opener.
A one-sentence prompt is scaffolded as `<task>` alone: an `<objective>` repeating the same sentence
adds tokens, not intent.

## 2. Context sufficiency (15)

The prompt should carry the context that materially changes the output — and not more.

| Score | Signal |
|---|---|
| 0–4 | Prompt < 20 words, no audience, no domain, no constraints. |
| 5–9 | Some context but key elements (audience, domain, prior work) missing. |
| 10–13 | Context present and relevant; mild over- or under-supply. |
| 14–15 | Context selectively included; load-bearing facts present, irrelevant ones excluded; lengths in the productive band (≈50–800 words for typical tasks). |

Penalize >1500 words unless the task genuinely demands long context (RAG, multi-document analysis).

## 3. Task decomposition (10)

For non-trivial tasks, list the steps.

| Score | Signal |
|---|---|
| 0–3 | Single blob, no structure, no steps. |
| 4–6 | Some structure but key steps implicit. |
| 7–10 | `<task>` block with 3+ explicit numbered/bulleted items in execution order. |

Trivial single-step tasks should not be penalized for lacking decomposition.

## 4. Constraint specificity (10)

Constraints must be verifiable post-hoc.

| Score | Signal |
|---|---|
| 0–3 | No constraints, or vague ("be good"). |
| 4–6 | Some constraints present, partly verifiable. |
| 7–10 | `<constraints>` block with quantifiers (max words, allowed formats, exclusions, must/never). |

## 5. Output format clarity (15)

| Score | Signal |
|---|---|
| 0–4 | No format mentioned. |
| 5–9 | Format named but not specified (e.g. "JSON" without schema). |
| 10–13 | Format + structure described. |
| 14–15 | `<output_format>` block with schema or worked example; explicit handling of empty/missing fields. |

## 6. Tool / source instructions (10)

Only relevant when tools or sources are in scope.

| Score | Signal |
|---|---|
| 0–3 | Tools available but not addressed. |
| 4–6 | Tools mentioned but no usage rules. |
| 7–10 | When/when-not to use, error handling, parallelism rules, source-citation requirements. |

For prompts that do not involve tools/sources, score around 5 (neutral).

## 7. Robustness vs hallucination (10)

| Score | Signal |
|---|---|
| 0–3 | No guards. |
| 4–6 | One guard ("cite sources" OR "if unknown, say so"). |
| 7–10 | Multiple guards: do-not-invent, declare-uncertainty, distinguish facts/inferences, verify cross-source. |

## 8. Token efficiency (10)

| Score | Signal |
|---|---|
| 0–3 | Padding ("you are a world-class…", "take a deep breath"), repetition, redundant CoT requests. |
| 4–6 | Moderate verbosity. |
| 7–10 | Compact; every line earns its place; no padding; no repeated trigrams. |

## 9. Evaluation criteria (5)

| Score | Signal |
|---|---|
| 0–1 | No success criteria. |
| 2–3 | Implicit criteria. |
| 4–5 | Explicit `<success_criteria>` or `<quality_bar>` block; the model can self-check before answering. |

## Reporting the delta

```
Structural coverage
Original: X/100
Improved: Y/100
Delta: +Z
```

Do **not** report a confidence level. It used to be emitted, but it was only the
absolute delta relabelled — it carried no independent evidence, and because it
used `|delta|` it announced "high confidence" on a *regression*.

Never claim measurable business impact, and never claim the score correlates
with output quality, unless there is an eval set to point at. There is not.
