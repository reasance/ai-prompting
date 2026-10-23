# Security Policy

## Supported versions

The `ai-prompting` package is in active development. Security fixes are applied to the latest minor release line.

| Version | Supported |
|---|---|
| 0.1.x | ✓ |
| < 0.1 | ✗ |

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

If you discover a security issue, please report it privately:

- **Email:** matteo.scurati@gmail.com
- **GitHub Security Advisories:** [github.com/reasance/ai-prompting/security/advisories/new](https://github.com/reasance/ai-prompting/security/advisories/new)

Include in your report:

- A description of the vulnerability and its potential impact.
- Steps to reproduce or a proof-of-concept.
- The affected version(s) of the package.
- Any known mitigations or workarounds.

You can expect:

- An acknowledgement within **72 hours**.
- An initial assessment within **7 days**.
- A fix or mitigation plan within **30 days** for critical/high severity issues.

After a fix is published, you will be credited in the [CHANGELOG](CHANGELOG.md) and (with permission) in the GitHub Security Advisory, unless you prefer to remain anonymous.

## Scope

This package's threat model is narrow because it has **no runtime dependencies**, **no network calls**, and **no API keys**. Realistic attack surfaces:

| Surface | Risk |
|---|---|
| Prompt content passed to `improvePrompt()` | Untrusted prompts cannot execute code; treated as opaque text |
| `--file <path>` flag | Reads from filesystem with user-level permissions; ensure paths are not user-controlled in privileged contexts |
| Slash command body | Loaded by the host agent; respects the host's tool-allowlist (`allowed-tools: Read Bash`) |
| Dependency tree | TypeScript + @types/node (devDeps only); audited via `npm audit` in CI |
| `scripts/install-command.js` | Writes to user-level command directories; never elevates privileges |

## Out of scope

- **Misuse of the rewritten prompt by a downstream LLM.** This package improves prompt structure; it does not validate the *intent* of the prompt or constrain the *behavior* of the model that consumes the result.
- **Accuracy of the heuristic score.** Scores are estimates; a high score does not guarantee a safe or correct LLM response.
- **The host agent's own security posture.** This package ships instructions; the host agent decides whether to act on them.

If you are unsure whether something is in scope, report it anyway — we'll triage it.
