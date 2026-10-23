# Contributing to ai-prompting

Thanks for considering a contribution. This project is small, opinionated, and easy to extend. The two principles to keep in mind:

1. **The CLI must remain deterministic.** No runtime dependencies, no LLM calls, no network access. Heuristics only.
2. **Model-specific advice belongs in `references/`, not in core code.** The TypeScript core stays vendor-neutral.

## Dev setup

```bash
git clone https://github.com/reasance/ai-prompting.git
cd ai-prompting
npm install
npm run build
npm test
npm run doctor
```

Requires Node.js ≥ 18. The only devDeps are `typescript` and `@types/node`.

## Project layout

```
ai-prompting/
├── SKILL.md                       # Skill entrypoint (Agent Skills standard); also reads its own flags
├── src/
│   ├── types.ts                   # Public type surface
│   ├── evaluator.ts               # 9-category, 100-point heuristic rubric
│   ├── prompt-improver.ts         # Rule-based scaffolding + padding strip
│   ├── doctor.ts                  # Health checks
│   ├── cli.ts                     # Argv parser + render
│   └── index.ts                   # Public library API (barrel)
├── references/                    # Deep docs loaded by host agents on-demand
│   ├── prompt-quality-rubric.md
│   ├── prompt-patterns.md
│   ├── clarification-policy.md
│   ├── cost-control.md
│   └── agent-compatibility.md
├── tests/                         # node:test
├── scripts/install-skill.js       # Installs the Skill directory per host
├── scripts/check-verified.js      # Warns on model notes verified > 90 days ago
├── agents/openai.yaml             # Codex / ChatGPT skill UI metadata
└── examples/                      # Reference inputs
```

## Common contributions

### Adding a new option

`SKILL.md` § **Options** is the canonical definition of every option — its flag, values, default,
and effect. Hosts invoke the Skill directly and it maps flags onto that table itself; the CLI is
the only adapter.

1. Add the row to the Options table in `SKILL.md`.
2. If the CLI implements it too, add it to the `VALID_*` unions and `buildOptions()` in
   `src/cli.ts`, and to `PromptImproverOptions` in `src/types.ts`.
3. Put the deep semantics in the relevant `references/*.md` file and link to the anchor from the
   Options table. `tests/skill-md.test.ts` fails on a link to an anchor that does not exist.

### Adding a new task type

1. Add a regex pattern set to `TASK_TYPE_HINTS` in `src/prompt-improver.ts`.
2. Add `it` and `en` strings to `ROLE_BY_TASK` and `OUTPUT_FORMAT_BY_TASK`, and map the type to a
   default group in `CONSTRAINT_GROUP` (that picks its default constraints and quality bar).
3. Document the scaffold in `references/prompt-patterns.md`, and the type in the `taskType` row of
   SKILL.md's Options table, `VALID_TASKS` in `src/cli.ts`, and README's flag table.
4. Add a regression test in `tests/prompt-improver.test.ts`:
   ```ts
   test('inferTaskType: <new keywords> route to <new-type>', () => {
     assert.equal(inferTaskType('your sample prompt'), 'new-type');
   });
   ```

### Adding or updating a target model

Adapters are keyed on behavior, not vendor. A new model usually needs no new prose:

1. Add or update its vendor's row in the **Capability matrix** of `references/agent-compatibility.md`
   — reasoning control and default, sampling policy, structured output, prefill, tools, reasoning
   replay. Write "—" where the vendor's docs say nothing; never fill a cell from memory.
2. Put only what the matrix cannot hold in that vendor's note under **Vendor notes**.
3. Every vendor note and host section starts with `_Verified YYYY-MM-DD against: <official sources>_`.
   Bump the date whenever you re-check a section. The test suite fails on a vendor note without a
   stamp; `npm run check-verified` warns on stamps older than 90 days, CI prints the warning, and a
   monthly workflow opens a reminder issue.

**The CLI has no `--target` flag on purpose.** It used to, and it did nothing —
`--target local` and `--target claude` produced byte-identical output while the
docs claimed the local adapter preserved "think step by step". Re-expose the flag
only together with a branch that actually fires and a test that proves it, of the
form "output for target A differs from target B in this specific way". A test
asserting the flag reaches the options object is not that test — that is exactly
the coverage `--target` and `--clarify` both had while being broken.

### Adding a new skill host

1. Add a row to the **Skill-based hosts** table in `references/agent-compatibility.md`, with the
   documented skills directory and a source in the section's Verified line.
2. If the host does not read `~/.agents/skills/`, add an entry to `HOSTS` in
   `scripts/install-skill.js` (`id`, `label`, `kind: 'skill'`, `root`, `dir`, `serves`).
3. Verify with `npm run install-skill -- --list` and, against a throwaway home,
   `HOME=$(mktemp -d) npm run install-skill -- --dry-run --host <id>`.

### Adding a new padding pattern

1. Append a `{ re, label }` entry to `PADDING_PATTERNS` in `src/evaluator.ts`. Patterns must be **specific** (no false positives on legitimate text).
2. Add a regression test that asserts both: (a) the padding is removed from `improved`, (b) a `removed_padding` change is registered.
3. If the new pattern is language-specific, document it in `references/cost-control.md` under "Padding to strip".

### Adjusting the scoring rubric

The rubric is **the API contract** of the package. Changes affect every score people have published. Treat it as a breaking change unless you only add new categories.

1. Update `src/evaluator.ts` — adjust weights or add scoring functions in the `Features`-driven pattern (one pure function per category).
2. Update `references/prompt-quality-rubric.md` to match.
3. Update tests in `tests/evaluator.test.ts`.
4. Bump **minor** version (or major if total ≠ 100).
5. Document the rationale in `CHANGELOG.md`.

## Style

- TypeScript strict mode. No `any` casts that aren't justified by an in-line comment.
- Pure functions where possible. The three core entrypoints (`scorePrompt`, `improvePrompt`, `runDoctor`) must remain pure (deterministic, no side effects beyond reading the filesystem in `runDoctor`).
- No comments narrating what the code does. Keep comments to non-obvious **why** only — hidden constraints, subtle invariants, workarounds.
- No new runtime dependencies. Devdeps require justification in the PR.

## Testing

```bash
npm test                                   # builds + runs node:test on dist/tests/*.test.js
node --test dist/tests/evaluator.test.js   # run a single test file after npm run build
```

A regression test is required for every behavior fix. Aim for one assertion per meaningful invariant — not one mega-test per function.

## Commit messages

Conventional, short subject + body explaining the **why**. Co-author lines welcome (humans and agents).

```
v0.1.x: <subject in imperative>

<body — what changed and why>

<co-author lines>
```

## Release flow

Maintainers only. The CLI's `prepublishOnly` hook runs `build + test` automatically.

```bash
# 1. Update CHANGELOG.md with the new version's section
$EDITOR CHANGELOG.md

# 2. Bump version (semver):
#    - patch: bug fix, no API change
#    - minor: new feature, no breaking change
#    - major: breaking change to API or rubric
npm version patch                       # or minor / major

# 3. Publish (prepublishOnly will gate on test+build):
npm publish

# 4. Push the tag:
git push --follow-tags
```

If `release.yml` is configured with `NPM_TOKEN`, pushing the tag also publishes via GitHub Actions — but a maintainer can still publish manually.

## Reporting bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). Include:

- the **input prompt** that triggered the bug,
- the **command line** or library call you used,
- the **observed output** vs the **expected output**,
- the package version (`ai-prompting --version`) and Node version (`node --version`).

For security issues, see [SECURITY.md](SECURITY.md). Do not open a public issue.

## Code of Conduct

Participation in this project requires adherence to the [Code of Conduct](CODE_OF_CONDUCT.md).
