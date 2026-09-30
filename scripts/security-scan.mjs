// Scans the project for the "fake font" malware that infected this repo in
// Sept 2026 (commits f6ec584 on main, 9627df6 on Dev were force-pushed with it).
// It hid an obfuscated JS payload in a .woff2 file, ran it from a hidden
// .vscode task on folderOpen, and appended it to tailwind.config.js behind a
// long run of spaces so it also ran on every `npm run dev` / `build`.
//
// Runs automatically before `dev`, `dev:next` and `build` (npm pre-scripts),
// from the git hooks in .githooks/, and in CI (.github/workflows).
//
// Plain Node with no dependencies and no git/`file` binaries, because Vercel
// and Railway builds have neither a .git folder nor a guaranteed `file`.
// It only READS files and never imports anything from the project, so it is
// safe to run on a checkout you do not trust yet.
//
// Usage: node scripts/security-scan.mjs   (exit code 1 = something found)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const IN_CI = process.env.GITHUB_ACTIONS === 'true';

// Generated or third-party output. Everything else is scanned, including
// public/ (where a disguised font would live) and this script itself.
// Any `.next*` folder is build output too (.next-dev, .next-build, ...).
const SKIP_DIR_PREFIX = '.next';
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.vercel',
  'out',
  'build',
  'dist',
  'coverage',
]);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Campaign tag the payload sets first thing: a global named "!" (Houseiana,
// Sept 2026) or "i" (Nawy, Apr 2026) assigned a version like 9-8619,
// A9-8618 or 9-8618-<suffix>. The version changes between waves, so match
// the shape, not the value. \x21 is "!", so this file does not match itself.
const MARKER = /global\s*(\[\s*['"]\x21['"]\s*\]|\.i)\s*=\s*['"][A-Z]?\d+-\d+/;

const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);
const BINARY_ASSET_EXT = new Set([
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
]);
const CONFIG_FILE =
  /(\.config\.[cm]?[jt]s|^server\.js|^\.eslintrc.*|^package\.json)$/;

let failed = false;

function report(file, message) {
  failed = true;
  if (IN_CI) {
    console.log(`::error file=${file}::${message}`);
  } else {
    console.error(`  ✖ ${file}\n      ${message}`);
  }
}

function warn(file, message) {
  if (IN_CI) {
    console.log(`::warning file=${file}::${message}`);
  } else {
    console.warn(`  ⚠ ${file}\n      ${message}`);
  }
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const skip =
        SKIP_DIRS.has(entry.name) || entry.name.startsWith(SKIP_DIR_PREFIX);
      if (!skip) yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

// Real fonts and images are full of control bytes. The payload was plain JS
// saved as fa-solid-900.woff2, so a "binary" asset that reads as printable
// text is a disguised script.
function looksLikeText(buf) {
  const sample = buf.subarray(0, 8192);
  if (sample.length === 0) return false;
  let printable = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (
      byte === 9 ||
      byte === 10 ||
      byte === 13 ||
      (byte >= 32 && byte < 127)
    ) {
      printable++;
    }
  }
  return printable / sample.length > 0.95;
}

for (const full of walk(ROOT)) {
  const file = relative(ROOT, full).split(sep).join('/');
  const name = basename(file);
  const ext = extname(file).toLowerCase();

  if (statSync(full).size > MAX_FILE_BYTES) continue;
  const buf = readFileSync(full);

  // 1. Known marker of this malware family, in any file type.
  const tag = buf.toString('latin1').match(MARKER);
  if (tag) {
    report(file, `Known malware marker found: ${tag[0]}`);
  }

  // 2. Binary assets that are really text.
  if (BINARY_ASSET_EXT.has(ext)) {
    if (looksLikeText(buf)) {
      report(
        file,
        'Font/image file is actually text - possible disguised script'
      );
    }
    continue;
  }

  // 3. Editor tasks that run by themselves when the folder is opened.
  const isEditorConfig =
    file.startsWith('.vscode/') || ext === '.code-workspace';
  if (isEditorConfig) {
    const text = buf.toString('utf8');
    if (/"runOn"\s*:\s*"folderOpen"/.test(text)) {
      report(file, 'Auto-run editor task (runOn: folderOpen)');
    }
    if (text.includes('task.allowAutomaticTasks')) {
      report(
        file,
        'Workspace enables automatic tasks (task.allowAutomaticTasks)'
      );
    }
  }

  const isConfig = CONFIG_FILE.test(name);
  if (!CODE_EXT.has(ext) && !isConfig) continue;
  const lines = buf.toString('utf8').split(/\r?\n/);

  if (CODE_EXT.has(ext)) {
    // 4. Code hidden after a long run of spaces, so it sits off-screen.
    // Needs code BEFORE the spaces too (`};<spaces>payload`), otherwise
    // deeply indented JSX would match.
    if (lines.some((line) => /\S {80,}\S/.test(line))) {
      report(file, 'Code hidden after a long run of spaces');
    }
    // 5. Obfuscator output: identifiers like _0x followed by hex digits.
    if (lines.some((line) => /_0x[0-9a-f]{4,}/.test(line))) {
      report(file, 'Obfuscated identifiers (_0x...) found');
    }
  }

  // 6. Config files are short and hand-written; one very long line there
  // means something was injected. (App code has legit long lines, so only
  // configs get this check.)
  if (isConfig && lines.some((line) => line.length > 500)) {
    report(file, 'Config file has a line longer than 500 characters');
  }
}

// 7. npm lifecycle hooks run on `npm install`. None exist today, so a new one
// should be looked at by a human. Warning only, since some are legit.
try {
  const { scripts = {} } = JSON.parse(readFileSync('package.json', 'utf8'));
  for (const hook of ['preinstall', 'install', 'postinstall', 'prepare']) {
    if (scripts[hook]) {
      warn(
        'package.json',
        `npm "${hook}" hook present, review it: ${scripts[hook]}`
      );
    }
  }
} catch {
  // No package.json or invalid JSON: nothing to check here.
}

if (failed) {
  console.error(
    '\nSecurity scan FAILED. Do not run or build this project until the files ' +
      'above are removed.\nSee scripts/security-scan.mjs for what each check means.'
  );
  process.exit(1);
}
console.log('Security scan passed.');
