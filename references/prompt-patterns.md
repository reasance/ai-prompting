# Prompt patterns

Use the smallest structure that solves the problem. Force XML only when the prompt mixes instructions, examples, multiple documents, or tool definitions.

> **Never ask the model to write out its reasoning.** No `<thinking>`, `<analysis>` or
> `<reasoning>` section, no "step trace", no `reasoning` field in a JSON schema. Current reasoning
> models think internally, and some refuse a request to expose it (Claude Fable/Opus/Sonnet 5.x
> return a billed `reasoning_extraction` refusal). Ask for what you actually need instead:
> evidence, quotes, a one-to-two sentence justification, or a summary of actions taken. Control
> depth with the API's effort/thinking parameter, not with prose.

## 1. Canonical XML scaffold (default for complex prompts)

```
<role>
{functional role: domain + seniority + relevant lens}
</role>

<objective>
{one-sentence outcome with action verb and observable result}
</objective>

<context>
{only the facts that change the output: stakeholders, constraints, prior work}
</context>

<task>
{numbered or bulleted steps when order matters}
</task>

<constraints>
- {verifiable constraint}
- {explicit exclusion}
- {numeric thresholds}
</constraints>

<output_format>
{schema, example, or precise structural description}
</output_format>

<quality_bar>
- {observable success criterion}
- {what must be true before responding}
</quality_bar>
```

## 2. Ultra-compact (for simple, single-shot tasks)

```
{Imperative verb} {object} {format hint}.
{One-line constraint if any}.
```

Example: `Riassumi questo testo in 3 bullet, max 30 parole totali.`

## 3. Research

```
<role>Senior research analyst.</role>
<objective>Risposta verificabile a: {question}.</objective>
<process>
1. Identifica 5–7 fonti autorevoli.
2. Per ogni fonte: claim, evidenza, anno, confidenza.
3. Triangola: consenso vs controversia vs gap.
4. Sintetizza con citazioni inline [n].
</process>
<constraints>
- Cita la fonte di ogni claim numerico.
- Distingui fatti / inferenze / ipotesi.
- Non inventare URL o autori.
</constraints>
<output_format>
<summary>3-5 frasi</summary>
<findings>...</findings>
<open_questions>...</open_questions>
<sources>[n] Autore, Titolo, Anno, URL</sources>
</output_format>
```

## 4. Coding

```
<role>Senior {language} engineer.</role>
<context>{framework, runtime, codebase conventions, dependency constraints}</context>
<task>{file boundary + change}: {what to implement / fix}.</task>
<constraints>
- Non modificare file fuori dal boundary dichiarato.
- Niente nuove dipendenze senza permesso.
- Stile coerente con il codice esistente.
- Test devono restare verdi.
</constraints>
<output_format>
Codice in code block con linguaggio. Prima del codice 2-4 righe di spiegazione delle scelte. Dopo: test e/o note di follow-up.
</output_format>
<quality_bar>
- Compila senza warning.
- Edge case: {empty, null, max, concurrent}.
- Nessuna regressione su test esistenti.
</quality_bar>
```

## 5. Agentic workflow / tool use

```
<role>Tool-using agent for {domain}.</role>
<objective>{task that requires multiple tool calls}</objective>
<tools>
- {tool_a}: {when to use, when NOT to use}
- {tool_b}: {parallelism rules, error recovery}
</tools>
<process>
1. Plan: enumera gli step.
2. Per ogni step: input, tool, output atteso, criterio di stop.
3. Se un tool fallisce: retry una volta, poi degrada o segnala.
4. Sintetizza il risultato finale.
</process>
<constraints>
- Mai chiamare tool con parametri inventati.
- Tool calls indipendenti in parallelo, se il modello target lo supporta.
- Dichiara solo i tool che servono al task.
- Stop quando l'output soddisfa <quality_bar>.
</constraints>
<output_format>
Risultato finale, poi un registro breve delle azioni (tool → esito, una riga ciascuna) e i punti irrisolti.
</output_format>
```

## 6. Data extraction

```
<task>Estrai entità conformi allo schema dal testo.</task>
<schema>
{ "items": [{ "field_a": "string", "field_b": "ISO-8601 | null", "evidence_quote": "string" }] }
</schema>
<rules>
- Campo non presente nel testo = null. Mai inventare.
- evidence_quote testuale, non parafrasi.
- Output: solo JSON valido, niente prosa.
</rules>
<input>{{TEXT}}</input>
```

## 7. Writing

```
<role>Senior editor per {audience}.</role>
<objective>{tipo documento} che porti {azione del lettore}.</objective>
<context>
- Tono di voce: {esempi o link}
- Vincoli editoriali: {brand, legal}
- Lunghezza target: {N parole}
</context>
<process>
1. Proponi 3 angoli con tesi in una frase.
2. Aspetta scelta.
3. Outline.
4. Aspetta conferma.
5. Draft.
</process>
<output_format>Prosa fluida, paragrafi 60-90 parole; usa elenchi solo per item realmente discreti.</output_format>
```

## 8. Analysis / review

```
<role>Senior analyst orientato a evidenze.</role>
<task>
1. Riformula il problema in una frase.
2. Mappa stakeholder e vincoli.
3. Genera tesi alternative con trade-off.
4. Raccomanda con confidenza esplicita.
</task>
<constraints>
- Distingui assunzioni da fatti.
- Indica quali assunzioni vanno validate.
</constraints>
<output_format>Tesi → evidenze → controfattuali → raccomandazione + confidenza.</output_format>
```

## 9. Long-context / multi-document

Place documents *first*, instructions *last* — Anthropic recommends queries at the end can improve quality up to ~30% on multi-document tasks.

```
<documents>
  <document index="1"><source>...</source><document_content>{{DOC1}}</document_content></document>
  <document index="2"><source>...</source><document_content>{{DOC2}}</document_content></document>
</documents>

<task>
1. Estrai in <quotes> i passaggi rilevanti per {{question}} con riferimento a document index.
2. In <answer>, rispondi in massimo {{N}} parole basandoti solo sulle quotes, citando il document index; se serve, 1-2 frasi di giustificazione.
Se le quotes sono insufficienti, dichiaralo invece di estrapolare.
</task>
```

## 10. Correspondence (email, letter, reply)

```
<role>Redattore di corrispondenza professionale.</role>
<context>
- Destinatario e relazione: {cliente, collega, fornitore}
- Fatti: {cosa è successo, cosa si può offrire}
</context>
<task>Scrivi {tipo di messaggio} a {destinatario} su {tema}.</task>
<constraints>
- Dettagli specifici sconosciuti tra [parentesi quadre], mai inventati.
</constraints>
<output_format>Oggetto; saluto; 2-4 paragrafi brevi; prossimo passo o rimedio concreto; chiusura.</output_format>
```

## Defaults the CLI fills in

**Well-specified prompts are left alone.** A free-text prompt of 25+ words that states its output
(a length, count or format, or an `Output:` line) or at least two explicit constraints is returned
with its padding removed and nothing else (`--scaffold always` overrides). Re-sectioning such a
prompt only reshuffled it.

Otherwise the deterministic CLI scaffolds, with defaults keyed on the task type — never on a model —
and adds a section only when it has something true and checkable to put in it:

- **Role.** A "You are …" opening sentence that is a role becomes `<role>`; one that lists tools or
  access ("You are an agent with web_search…") goes to `<context>`. Otherwise the task type's role,
  with the detected language for coding ("Senior TypeScript engineer.").
- **Objective.** Only the user's own `<objective>`. The CLI does not carve one out of the body.
- **Context.** Only real context: a user-written `<context>`, a capability sentence, or
  `--audience`. No placeholder — assumptions are reported next to the prompt, not inside it.
- **Constraints.** Sentences that prohibit or require ("Do not …", "Preserve …", "Never …", "Only …")
  move from the task to `<constraints>` verbatim; the task-type defaults below are added when they
  apply and the prompt does not already say them.
- **Output format.** When the prompt states one, no `<output_format>` is added — its own wording is
  the contract. Otherwise the task type's format; a coding prompt that names repository files or asks
  for tests gets "edit the files in place; if you can run commands, run the build and the affected
  tests; summarize" instead of a chat-style code block.
- **Quality bar.** Only the lines below. A type with nothing checkable to add gets no section.

| Task type | Default `<constraints>` | Default `<quality_bar>` |
|---|---|---|
| research · analysis · business · education | distinguish facts / inferences / assumptions; declare missing info | every non-trivial claim has evidence or a source |
| coding | preserve existing behavior and existing tests (refactors only); preserve public interfaces; no new dependencies | builds cleanly, affected tests pass |
| correspondence | unknown specifics in `[brackets]`; no refunds, discounts or remedies the request does not mention; acknowledge and apologise before explaining (complaints only) | — |
| writing · creative | unknown specifics in `[brackets]`, never invented | — |
| data-extraction | missing fields are `null`, never inferred | valid JSON, values traceable to the source |
| agentic-workflow | on tool error retry once, then fall back or report | ends with the deliverable or a report of what was tried and why it stopped |
| general | declare missing info | — |

## When to choose which

| Situation | Pattern |
|---|---|
| Single-shot trivial task | Ultra-compact (#2) |
| Mixed instructions + data + examples | Canonical XML (#1) |
| Multiple source documents | Long-context (#9) |
| Tool-heavy multi-step | Agentic (#5) |
| Strict structured output | Data extraction (#6) |
| Email, letter, reply | Correspondence (#10) |

When in doubt: start compact, add structure only on observed failure.
