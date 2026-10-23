#!/usr/bin/env node
'use strict';

// Lists model- and host-specific sections whose "_Verified YYYY-MM-DD against:"
// stamp is older than the re-verification window. It warns; it never fails a
// build — stale notes are a prompt to re-run the evaluation, not a defect.
//
//   node scripts/check-verified.js            human-readable report
//   node scripts/check-verified.js --json     machine-readable (CI)
//   node scripts/check-verified.js --today 2027-01-31
//
// Inside GitHub Actions each stale section is also emitted as a ::warning::
// annotation on its line.

const fs = require('node:fs');
const path = require('node:path');

const MAX_AGE_DAYS = 90;
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const FILES = ['SKILL.md', ...fs.readdirSync(path.join(PACKAGE_ROOT, 'references')).map((f) => `references/${f}`)];
const STAMP_RE = /_Verified (\d{4}-\d{2}-\d{2}) against:/;

function parseArgs(argv) {
  const flags = { json: false, today: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--json') flags.json = true;
    else if (argv[i] === '--today' && argv[i + 1]) flags.today = argv[(i += 1)];
    else {
      process.stderr.write(`unknown argument: ${argv[i]}\n`);
      process.exit(2);
    }
  }
  return flags;
}

function collectStamps() {
  const stamps = [];
  for (const rel of FILES) {
    const lines = fs.readFileSync(path.join(PACKAGE_ROOT, rel), 'utf8').split('\n');
    let heading = '(top of file)';
    lines.forEach((line, i) => {
      const h = line.match(/^#{1,4}\s+(.*)$/);
      if (h) heading = h[1];
      const m = line.match(STAMP_RE);
      if (m) stamps.push({ file: rel, line: i + 1, section: heading, verified: m[1] });
    });
  }
  return stamps;
}

function ageInDays(from, to) {
  return Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

function main(argv) {
  const flags = parseArgs(argv);
  const today = flags.today || new Date().toISOString().slice(0, 10);
  const stamps = collectStamps().map((s) => ({ ...s, ageDays: ageInDays(s.verified, today) }));
  const stale = stamps.filter((s) => s.ageDays > MAX_AGE_DAYS);

  if (flags.json) {
    process.stdout.write(`${JSON.stringify({ today, maxAgeDays: MAX_AGE_DAYS, stamps: stamps.length, stale }, null, 2)}\n`);
    return 0;
  }
  if (!stale.length) {
    process.stdout.write(`✓ ${stamps.length} verified sections, none older than ${MAX_AGE_DAYS} days (today ${today}).\n`);
    return 0;
  }
  process.stdout.write(`! ${stale.length} of ${stamps.length} verified sections are older than ${MAX_AGE_DAYS} days (today ${today}):\n`);
  for (const s of stale) {
    process.stdout.write(`  ${s.file}:${s.line}  ${s.section} — verified ${s.verified} (${s.ageDays} days)\n`);
    if (process.env.GITHUB_ACTIONS) {
      process.stdout.write(
        `::warning file=${s.file},line=${s.line}::"${s.section}" was verified ${s.ageDays} days ago; re-verify the model notes.\n`,
      );
    }
  }
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { collectStamps, ageInDays, MAX_AGE_DAYS };
