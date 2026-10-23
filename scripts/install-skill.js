#!/usr/bin/env node
'use strict';

// Installs the Skill as a directory (SKILL.md + references/ + agents/) where
// agent hosts look for Agent Skills. One copy in ~/.agents/skills serves every
// host that reads the shared location; Claude Code reads its own directory.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const SKILL_NAME = 'ai-prompting';
const SKILL_FILES = ['SKILL.md', 'references', 'agents'];

const HOSTS = [
  {
    id: 'claude',
    label: 'Claude Code',
    kind: 'skill',
    root: path.join(os.homedir(), '.claude'),
    dir: path.join(os.homedir(), '.claude', 'skills', SKILL_NAME),
    serves: 'Claude Code',
    // Before 0.4.0 Claude Code got a separate command, which showed up next to
    // the skill as a second entry (/ai-prompting:improve). The skill replaces it.
    legacy: path.join(os.homedir(), '.claude', 'commands', 'ai-prompting:improve.md'),
  },
  {
    id: 'agents',
    label: 'Shared .agents',
    kind: 'skill',
    root: os.homedir(),
    dir: path.join(os.homedir(), '.agents', 'skills', SKILL_NAME),
    serves: 'Codex CLI/IDE, Gemini CLI, Grok Build',
  },
  {
    id: 'vibe',
    label: 'Mistral Vibe',
    kind: 'skill',
    root: path.join(os.homedir(), '.vibe'),
    dir: path.join(os.homedir(), '.vibe', 'skills', SKILL_NAME),
    serves: 'Mistral Vibe',
  },
  {
    id: 'qwen',
    label: 'Qwen Code',
    kind: 'skill',
    root: path.join(os.homedir(), '.qwen'),
    dir: path.join(os.homedir(), '.qwen', 'skills', SKILL_NAME),
    serves: 'Qwen Code',
  },
  {
    id: 'cursor',
    label: 'Cursor',
    kind: 'shim',
    root: path.join(os.homedir(), '.cursor'),
    dir: path.join(os.homedir(), '.cursor', 'commands'),
    file: 'ai-prompting.md',
    serves: 'Cursor (command shim → shared SKILL.md)',
  },
];

function cursorShim() {
  const skill = path.join(os.homedir(), '.agents', 'skills', SKILL_NAME, 'SKILL.md');
  return [
    '---',
    'description: Improve, rewrite, debug, or compress a prompt for any LLM agent (ai-prompting Skill).',
    '---',
    '',
    `Read \`${skill}\` and follow it. It defines the procedure, the options, and how to read flags`,
    'out of the arguments below. Load files from its `references/` directory only when it says to.',
    '',
    '**User input:** $ARGUMENTS',
    '',
  ].join('\n');
}

function parseArgs(argv) {
  const flags = { force: false, hosts: null, dryRun: false, list: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--force' || a === '-f') flags.force = true;
    else if (a === '--dry-run' || a === '-n') flags.dryRun = true;
    else if (a === '--list') flags.list = true;
    else if (a === '--host' && argv[i + 1]) {
      flags.hosts = (flags.hosts || []).concat(argv[i + 1].toLowerCase());
      i += 1;
    } else if (a === '--help' || a === '-h') {
      printUsage();
      process.exit(0);
    } else {
      process.stderr.write(`unknown argument: ${a}\n`);
      printUsage();
      process.exit(2);
    }
  }
  return flags;
}

function printUsage() {
  process.stdout.write(
    'ai-prompting install-skill\n\n' +
    'USAGE\n' +
    '  node scripts/install-skill.js [options]\n\n' +
    'OPTIONS\n' +
    `  --host <id>      Install only for the named host (${HOSTS.map((h) => h.id).join(' / ')}).\n` +
    '                   May be repeated. Default: every host whose home directory exists.\n' +
    '  --force, -f      Overwrite an existing installation.\n' +
    '  --dry-run, -n    Print what would be done without writing.\n' +
    '  --list           List supported hosts and target paths, then exit.\n' +
    '  --help, -h       Show this help.\n'
  );
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) copyRecursive(path.join(src, entry), path.join(dest, entry));
  } else {
    fs.copyFileSync(src, dest);
  }
}

function targetOf(host) {
  return host.kind === 'shim' ? path.join(host.dir, host.file) : host.dir;
}

function install(host, flags) {
  const label = host.label.padEnd(16);
  const target = targetOf(host);
  if (!fs.existsSync(host.root)) {
    process.stdout.write(`- ${label} skip (not detected: ${host.root})\n`);
    return 'skipped';
  }
  if (fs.existsSync(target) && !flags.force) {
    process.stdout.write(`- ${label} skip (already installed at ${target}; use --force to overwrite)\n`);
    return 'skipped';
  }
  const legacy = host.legacy && fs.existsSync(host.legacy) ? host.legacy : null;
  if (flags.dryRun) {
    process.stdout.write(`- ${label} dry-run → would write ${target}\n`);
    if (legacy) process.stdout.write(`  ${' '.repeat(16)} would remove the legacy command ${legacy}\n`);
    return 'dry-run';
  }
  if (host.kind === 'shim') {
    fs.mkdirSync(host.dir, { recursive: true });
    fs.writeFileSync(target, cursorShim(), 'utf8');
  } else {
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(target, { recursive: true });
    for (const f of SKILL_FILES) copyRecursive(path.join(PACKAGE_ROOT, f), path.join(target, f));
  }
  process.stdout.write(`✓ ${label} installed → ${target}  (${host.serves})\n`);
  if (legacy) {
    fs.rmSync(legacy);
    process.stdout.write(`  ${' '.repeat(16)} removed the legacy command ${legacy}\n`);
  }
  return 'installed';
}

function main(argv) {
  const flags = parseArgs(argv);
  if (flags.list) {
    process.stdout.write('Supported hosts:\n');
    for (const h of HOSTS) {
      process.stdout.write(`  ${h.id.padEnd(8)} ${h.label.padEnd(16)} → ${targetOf(h)}\n`);
      process.stdout.write(`  ${' '.repeat(8)} ${' '.repeat(16)}   serves: ${h.serves}\n`);
    }
    return 0;
  }
  for (const f of SKILL_FILES) {
    if (!fs.existsSync(path.join(PACKAGE_ROOT, f))) {
      process.stderr.write(`package file not found: ${path.join(PACKAGE_ROOT, f)}\n`);
      return 2;
    }
  }
  if (flags.hosts) {
    const unknown = flags.hosts.filter((id) => !HOSTS.some((h) => h.id === id));
    if (unknown.length) {
      process.stderr.write(`unknown host: ${unknown.join(', ')}\n`);
      return 2;
    }
  }

  const counts = { installed: 0, skipped: 0, 'dry-run': 0 };
  for (const host of HOSTS) {
    if (flags.hosts && !flags.hosts.includes(host.id)) continue;
    counts[install(host, flags)] += 1;
  }
  const shared = HOSTS.find((h) => h.id === 'agents');
  const cursorSelected = !flags.hosts || flags.hosts.includes('cursor');
  if (!flags.dryRun && cursorSelected && fs.existsSync(path.join(os.homedir(), '.cursor')) && !fs.existsSync(shared.dir)) {
    process.stdout.write(`! The Cursor shim reads ${shared.dir}/SKILL.md — install it too: --host agents\n`);
  }
  if (!flags.dryRun) {
    process.stdout.write(`\nDone. installed=${counts.installed} skipped=${counts.skipped}\n`);
  }
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { HOSTS, main };
