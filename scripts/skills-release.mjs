// scripts/skills-release.mjs
//
// Releases one Claude API Agent Skill from skills/api/<name>/: checks the
// folder the way the API will (SKILL.md frontmatter, total size) plus what
// must never leave this machine (hidden and AppleDouble files, secrets), then
// uploads it as a new skill or as a new version of an existing one and prints
// the skill id + version to pin on Netlify.
//
//   npm run skills:release -- launch-brand-system --dry-run
//       checks + file list only: no network, no key, no SDK needed
//   npm run skills:release -- launch-brand-system
//       first release: creates the skill (refuses when one with that name
//       already exists in the key's workspace; pass --skill-id or --new)
//   npm run skills:release -- launch-brand-system --skill-id skill_...
//       a new version of that skill (also taken from CUSTOM_SITE_BRAND_SKILL_ID
//       when that is set in the shell)
//
// The OWNER runs the upload with their own key: ANTHROPIC_API_KEY from the
// environment only (never read from a file, never printed). Use a key from
// the same workspace as the production key on Netlify: a custom skill belongs
// to one workspace, and requests from another workspace can't load it.
// Uploading needs the functions' dependencies (netlify/functions/node_modules),
// so run it in a mirror copy, never `npm install` in the repo.
// Uploads are not retried: a retried create can leave two skills or versions.
// Exit code: 0 checks passed (and uploaded, unless --dry-run), 1 checks or the
// upload failed, 2 bad arguments (nothing checked or sent).

import { lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILLS_ROOT = fileURLToPath(new URL('../skills/api/', import.meta.url));
const SDK_URL = new URL('../netlify/functions/node_modules/@anthropic-ai/sdk/index.mjs', import.meta.url);

// Limits from the Agent Skills docs (agent-skills/overview, skills-guide).
export const MAX_NAME = 64;
export const MAX_DESCRIPTION = 1024;
// "Under 30 MB" uncompressed. Counted in decimal megabytes, the smaller
// reading, so a folder that passes here passes whichever MB the API means.
export const MAX_TOTAL_BYTES = 30 * 1000 * 1000;
const RESERVED_WORDS = ['anthropic', 'claude'];
// Anthropic's authoring advice: keep the SKILL.md body under 500 lines and
// move detail into files it links to (loaded only when needed).
const BODY_LINES_HINT = 500;

// The env var pair the runtime reads for each released skill
// (<PREFIX>_ID, <PREFIX>_VERSION, set on Netlify). Missing env = the feature
// reports "not set up", so a new skill needs its entry here and in the runner.
export const SKILL_ENV = Object.freeze({
  'launch-brand-system': 'CUSTOM_SITE_BRAND_SKILL',
});

const FLAGS = new Set(['--dry-run', '--new']);
const VALUE_FLAGS = new Set(['--skill-id']);
const USAGE = 'Usage: node scripts/skills-release.mjs <skill-name> [--dry-run] [--skill-id skill_...] [--new]';

// ─── SKILL.md frontmatter ────────────────────────────────────────────

// The YAML the frontmatter uses in practice: `key: value` at the top level,
// quoted strings, block scalars (| and >) and multi-line plain scalars.
// Nested maps and lists (metadata:, allowed-tools:) come back as
// { nested: true }; the release only reads name and description.
function scalar(first, more) {
  const value = first.trim();
  const lines = more.slice();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  const body = lines.map((l) => l.slice(cut));

  if (/^[|>][+-]?\d*$/.test(value)) {
    if (value[0] === '|') return body.join('\n').trimEnd();
    // Folded: lines join with spaces, a blank line is a newline.
    return body.reduce((acc, l) => {
      if (!l.trim()) return `${acc}\n`;
      return acc && !acc.endsWith('\n') ? `${acc} ${l.trim()}` : `${acc}${l.trim()}`;
    }, '').trimEnd();
  }
  if (!value && body.length && /^(?:[A-Za-z0-9_-]+:(?:\s|$)|-\s|-$)/.test(body[0])) return { nested: true };

  const joined = [value, ...body.map((l) => l.trim())].filter(Boolean).join(' ');
  if (joined.startsWith('"')) {
    const close = joined.lastIndexOf('"');
    const inner = close > 0 ? joined.slice(0, close + 1) : `${joined}"`;
    try {
      return JSON.parse(inner);
    } catch {
      return inner.slice(1, -1);
    }
  }
  if (joined.startsWith("'")) {
    const close = joined.lastIndexOf("'");
    return (close > 0 ? joined.slice(1, close) : joined.slice(1)).replace(/''/g, "'");
  }
  // A plain scalar ends at a " #" comment.
  return joined.replace(/\s+#.*$/, '');
}

/**
 * { fields, body, error } for a SKILL.md text. `error` is set when there is
 * no frontmatter block at all.
 */
export function parseFrontmatter(text) {
  const src = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = src.split('\n');
  if (lines[0].trim() !== '---') {
    return { fields: {}, body: src, error: 'SKILL.md must start with a "---" line opening the YAML frontmatter' };
  }
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end < 0) return { fields: {}, body: src, error: 'SKILL.md frontmatter has no closing "---" line' };

  const fields = {};
  let i = 1;
  while (i < end) {
    const line = lines[i];
    const match = line.match(/^([A-Za-z0-9_-]+):(?:\s+(.*))?$/);
    i += 1;
    if (!match) continue; // blank, comment, or stray indented text
    const more = [];
    while (i < end && (!lines[i].trim() || /^\s/.test(lines[i]))) {
      more.push(lines[i]);
      i += 1;
    }
    fields[match[1]] = scalar(match[2] ?? '', more);
  }
  return { fields, body: lines.slice(end + 1).join('\n'), error: null };
}

/** Problems with the frontmatter `name` and `description` (the API's rules). */
export function frontmatterProblems(fields, folderName) {
  const problems = [];
  const { name, description } = fields || {};

  if (typeof name !== 'string' || !name.trim()) {
    problems.push('frontmatter "name" is missing');
  } else {
    if (name.length > MAX_NAME) problems.push(`frontmatter "name" is ${name.length} characters (at most ${MAX_NAME})`);
    if (!/^[a-z0-9-]+$/.test(name)) problems.push(`frontmatter "name" "${name}" may only use lowercase letters, digits and hyphens`);
    for (const word of RESERVED_WORDS) {
      if (name.toLowerCase().includes(word)) problems.push(`frontmatter "name" may not contain the reserved word "${word}"`);
    }
    // The name becomes the skill's immutable slug and the top-level folder
    // of the upload, so the folder and the name must agree.
    if (folderName && name !== folderName) problems.push(`frontmatter "name" "${name}" does not match the folder name "${folderName}"`);
  }

  if (typeof description !== 'string' || !description.trim()) {
    problems.push('frontmatter "description" is missing or empty');
  } else {
    if (description.length > MAX_DESCRIPTION) {
      problems.push(`frontmatter "description" is ${description.length} characters (at most ${MAX_DESCRIPTION})`);
    }
    if (/<\/?[A-Za-z][^>]*>/.test(description)) problems.push('frontmatter "description" may not contain XML tags');
  }
  return problems;
}

// ─── Files ───────────────────────────────────────────────────────────

const JUNK_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini', '__pycache__', 'node_modules']);
const KEY_FILE_RE = /(?:\.pem|\.key|\.p12|\.pfx|\.jks|\.keystore)$|^id_(?:rsa|dsa|ecdsa|ed25519)\b/i;

// Why a path segment must not be uploaded, or null. AppleDouble (._*) files
// appear next to every file written on the external SSD; the mirror rsync
// drops them, so they only show up when this runs on the SSD copy.
function junkReason(segment) {
  if (segment.startsWith('._')) return 'macOS AppleDouble file (run from the mirror, or delete ._* files)';
  if (JUNK_NAMES.has(segment)) return 'OS or build junk';
  if (/\.py[co]$/.test(segment)) return 'compiled Python file';
  if (segment.startsWith('.')) return 'hidden file or folder (often .env or .git)';
  if (KEY_FILE_RE.test(segment)) return 'looks like a key or certificate file';
  return null;
}

/**
 * Every file under `dir`: [{ rel, abs, size }] with forward-slash `rel`
 * paths, plus problems for junk, hidden files and links (never followed:
 * a link could pull in files from outside the folder).
 */
export function listSkillFiles(dir) {
  const files = [];
  const problems = [];
  const walk = (abs, rel) => {
    for (const entry of readdirSync(abs).sort()) {
      const childAbs = join(abs, entry);
      const childRel = rel ? `${rel}/${entry}` : entry;
      const reason = junkReason(entry);
      if (reason) {
        problems.push(`${childRel}: ${reason}`);
        continue;
      }
      const stat = lstatSync(childAbs);
      if (stat.isSymbolicLink()) problems.push(`${childRel}: symbolic link (copy the file in instead)`);
      else if (stat.isDirectory()) walk(childAbs, childRel);
      else if (stat.isFile()) files.push({ rel: childRel, abs: childAbs, size: stat.size });
      else problems.push(`${childRel}: not a regular file`);
    }
  };
  walk(dir, '');
  return { files, problems };
}

// Token shapes that are secrets wherever they appear. Matches are reported
// by file and line only; the value is never printed.
const SECRET_PATTERNS = [
  ['an Anthropic API key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['a Stripe secret key', /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/],
  ['a Stripe webhook secret', /\bwhsec_[A-Za-z0-9+/=]{16,}/],
  ['an AWS access key id', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['a private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['a GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/],
  ['a Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['a Slack token', /\bxox[abposr]-[A-Za-z0-9-]{10,}/],
  ['a Netlify token', /\bnfp_[A-Za-z0-9]{30,}/],
  ['a JSON Web Token (a Supabase service-role key looks like this)', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
];
// Shell variables whose values are secrets: any of these values found in a
// file is a leak, whatever its shape.
const SECRET_ENV_RE = /KEY|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL/i;
const MIN_SECRET_ENV_LENGTH = 16;

const isBinary = (buf) => buf.subarray(0, 8000).includes(0);
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** Problems for secrets found in text files (binary files are skipped). */
export function secretProblems(files, env = {}) {
  const envSecrets = Object.entries(env || {})
    .filter(([key, value]) => SECRET_ENV_RE.test(key) && typeof value === 'string' && value.trim().length >= MIN_SECRET_ENV_LENGTH)
    .map(([key, value]) => [key, value.trim()]);
  const problems = [];
  for (const file of files) {
    const buf = file.buffer ?? readFileSync(file.abs);
    if (isBinary(buf)) continue;
    const text = buf.toString('utf8');
    for (const [label, re] of SECRET_PATTERNS) {
      const match = re.exec(text);
      if (match) problems.push(`${file.rel}:${lineOf(text, match.index)}: looks like ${label}`);
    }
    for (const [key, value] of envSecrets) {
      const index = text.indexOf(value);
      if (index >= 0) problems.push(`${file.rel}:${lineOf(text, index)}: contains the value of $${key}`);
    }
  }
  return problems;
}

/**
 * Checks one skill folder. Returns { name, description, files, totalBytes,
 * problems, warnings, notes }; `problems` empty = ready to upload.
 */
export function checkSkill(dir, { folderName, env = {} } = {}) {
  const { files, problems } = listSkillFiles(dir);
  const warnings = [];
  const notes = [];
  let fields = {};

  const skillMd = files.find((f) => f.rel === 'SKILL.md');
  if (!skillMd) {
    const misplaced = files.find((f) => f.rel.toLowerCase() === 'skill.md' || f.rel.endsWith('/SKILL.md'));
    problems.push(misplaced
      ? `SKILL.md must sit at the top of the folder, named exactly SKILL.md (found ${misplaced.rel})`
      : 'no SKILL.md at the top of the folder');
  } else {
    const parsed = parseFrontmatter(readFileSync(skillMd.abs, 'utf8'));
    if (parsed.error) problems.push(parsed.error);
    fields = parsed.fields;
    problems.push(...frontmatterProblems(fields, folderName));
    const bodyLines = parsed.body.split('\n').length;
    if (bodyLines > BODY_LINES_HINT) {
      warnings.push(`SKILL.md body is ${bodyLines} lines; Anthropic suggests under ${BODY_LINES_HINT} (move detail into linked files)`);
    }
    const other = Object.keys(fields).filter((k) => k !== 'name' && k !== 'description');
    if (other.length) notes.push(`other frontmatter keys (not checked here): ${other.join(', ')}`);
  }

  // The SSD copy stores text with CRLF, and the upload is byte for byte: a
  // "#!/usr/bin/env python3\r" line can't run in the Linux container, so
  // SKILL.md has to call such scripts as `python3 path`.
  for (const file of files) {
    if (file.size > 1000 * 1000) continue;
    const head = readFileSync(file.abs).subarray(0, 512).toString('latin1');
    if (head.startsWith('#!') && /^[^\n]*\r\n/.test(head)) {
      warnings.push(`${file.rel}: shebang line ends in CRLF; call it as \`python3 ${file.rel}\` (or bash), not ./${file.rel}`);
    }
  }

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes >= MAX_TOTAL_BYTES) {
    problems.push(`the folder is ${formatBytes(totalBytes)}; uploads must be under ${formatBytes(MAX_TOTAL_BYTES)}`);
  }
  problems.push(...secretProblems(files, env));

  return {
    name: typeof fields.name === 'string' ? fields.name : null,
    description: typeof fields.description === 'string' ? fields.description : null,
    files,
    totalBytes,
    problems,
    warnings,
    notes,
  };
}

// ─── Output helpers ──────────────────────────────────────────────────

export function formatBytes(n) {
  if (n >= 1000 * 1000) return `${(n / (1000 * 1000)).toFixed(1)} MB`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)} KB`;
  return `${n} B`;
}

const MIME = {
  md: 'text/markdown',
  txt: 'text/plain',
  py: 'text/x-python',
  json: 'application/json',
  csv: 'text/csv',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  html: 'text/html',
  js: 'text/javascript',
  sh: 'text/x-shellscript',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  pdf: 'application/pdf',
};

export function mimeFor(rel) {
  const ext = rel.includes('.') ? rel.split('.').pop().toLowerCase() : '';
  return MIME[ext] || 'application/octet-stream';
}

/** The lines to paste into Netlify's environment variables. */
export function envLines(prefix, skillId, versionId) {
  return [`${prefix}_ID=${skillId}`, `${prefix}_VERSION=${versionId}`];
}

function report(log, name, dir, result) {
  log(`Skill ${name} (${dir})`);
  log(`  name:         ${result.name ?? 'missing'}`);
  log(`  description:  ${result.description != null ? `${result.description.length} of ${MAX_DESCRIPTION} characters` : 'missing'}`);
  log(`  files:        ${result.files.length}, ${formatBytes(result.totalBytes)} of ${formatBytes(MAX_TOTAL_BYTES)}`);
  const width = Math.max(0, ...result.files.map((f) => f.rel.length));
  for (const file of result.files) {
    log(`    ${file.rel.padEnd(width)}  ${formatBytes(file.size).padStart(9)}  ${mimeFor(file.rel)}`);
  }
  for (const note of result.notes) log(`  note:         ${note}`);
  for (const warning of result.warnings) log(`  warning:      ${warning}`);
  if (result.problems.length) {
    log(`Problems (${result.problems.length}):`);
    for (const problem of result.problems) log(`  - ${problem}`);
  } else {
    log('Checks:       frontmatter, size, no hidden or junk files, no links, no secrets: OK');
  }
}

// ─── Upload ──────────────────────────────────────────────────────────

async function loadSdk({ apiKey }) {
  let mod;
  try {
    mod = await import(SDK_URL.href);
  } catch (err) {
    throw new Error(`Could not load the Anthropic SDK from netlify/functions/node_modules (${err.message}). Run this in a mirror copy with the functions' dependencies installed.`);
  }
  const Anthropic = mod.default;
  return { client: new Anthropic({ apiKey, maxRetries: 0 }), toFile: mod.toFile };
}

// What an API failure most likely means here, by HTTP status (no message
// matching: the SDK's typed errors all carry `status`).
const STATUS_HINTS = {
  400: 'the API rejected the upload: read the message (frontmatter, a name that differs from the first upload, size)',
  401: 'the key was rejected: check ANTHROPIC_API_KEY',
  403: 'this key may not manage skills in its workspace',
  404: "no such skill in this key's workspace: check --skill-id, and that the key belongs to the production workspace",
  413: 'the upload is too large',
  429: 'rate limited: wait a minute and run it again',
};

function logApiError(log, err) {
  log(`FAILED: ${err?.status ?? 'no status'} ${err?.message || err}`.trimEnd());
  if (STATUS_HINTS[err?.status]) log(`  likely cause:  ${STATUS_HINTS[err.status]}`);
  if (err?.requestID) log(`  request id:    ${err.requestID}`);
}

function parseArgs(argv) {
  const out = { positional: [], flags: new Set(), values: {}, errors: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const [key, inline] = arg.startsWith('--') && arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, null];
    if (FLAGS.has(key) && inline == null) out.flags.add(key);
    else if (VALUE_FLAGS.has(key)) {
      const value = inline ?? argv[i + 1];
      if (inline == null) i += 1;
      if (!value || value.startsWith('--')) out.errors.push(`${key} needs a value`);
      else out.values[key] = value;
    } else if (arg.startsWith('-')) out.errors.push(`unknown option ${arg}`);
    else out.positional.push(arg);
  }
  return out;
}

/**
 * Runs the release. Returns the exit code. Everything it touches is
 * injectable, so the tests run it with a fake client and a temp folder.
 */
export async function main(argv = process.argv.slice(2), {
  env = process.env,
  skillsRoot = SKILLS_ROOT,
  createClient = loadSdk,
  log = console.log,
} = {}) {
  const args = parseArgs(argv);
  if (args.errors.length || args.positional.length !== 1) {
    for (const error of args.errors) log(error);
    if (args.positional.length !== 1) log('Name exactly one skill folder under skills/api/.');
    log(USAGE);
    return 2;
  }
  const name = args.positional[0];
  // A plain slug only: the name picks a folder, so no paths or dots.
  if (!/^[a-z0-9-]+$/.test(name)) {
    log(`"${name}" is not a skill name (lowercase letters, digits and hyphens: the folder name under skills/api/).`);
    return 2;
  }
  const dir = join(skillsRoot, name);
  let isDir = false;
  try {
    isDir = lstatSync(dir).isDirectory();
  } catch {
    isDir = false;
  }
  if (!isDir) {
    log(`No skill folder at ${dir}.`);
    return 2;
  }

  const dryRun = args.flags.has('--dry-run');
  const forceNew = args.flags.has('--new');
  const prefix = SKILL_ENV[name] || null;
  const envSkillId = prefix && typeof env?.[`${prefix}_ID`] === 'string' ? env[`${prefix}_ID`].trim() : '';
  if (forceNew && args.values['--skill-id']) {
    log('--new and --skill-id contradict each other: --new creates a separate skill.');
    return 2;
  }
  const skillId = forceNew ? '' : (args.values['--skill-id'] || envSkillId);
  const skillIdSource = args.values['--skill-id'] ? '--skill-id' : (skillId ? `${prefix}_ID` : null);

  const result = checkSkill(dir, { folderName: name, env });
  report(log, name, dir, result);
  if (!prefix) log(`  note:         no env var pair for "${name}" yet: add it to SKILL_ENV in scripts/skills-release.mjs and to the runner`);
  if (result.problems.length) {
    log('');
    log('Fix these first. Nothing uploaded.');
    return 1;
  }

  const plan = skillId
    ? `upload a new version of ${skillId} (from ${skillIdSource})`
    : `create a new skill named ${name}${forceNew ? ' (--new: even if one with that name exists)' : " (first checks that the key's workspace has no custom skill with that name)"}`;
  if (dryRun) {
    log('');
    log(`Dry run: nothing uploaded. Without --dry-run this would ${plan}.`);
    return 0;
  }

  const apiKey = typeof env?.ANTHROPIC_API_KEY === 'string' ? env.ANTHROPIC_API_KEY.trim() : '';
  if (!apiKey) {
    log('');
    log('ANTHROPIC_API_KEY is not set in the environment. Nothing uploaded.');
    return 1;
  }

  let client;
  let toFile;
  try {
    ({ client, toFile } = await createClient({ apiKey }));
  } catch (err) {
    log(err?.message || String(err));
    return 1;
  }

  log('');
  log(`Uploading: ${plan}...`);
  let skill;
  let version;
  try {
    // Path-qualified names: the API wants every file under one top-level
    // folder holding SKILL.md (skills.create keeps the paths in the
    // multipart file names).
    const files = await Promise.all(result.files.map((f) => toFile(readFileSync(f.abs), `${name}/${f.rel}`, { type: mimeFor(f.rel) })));
    if (skillId) {
      // Fail early, with a clear message, on an id from another workspace.
      skill = await client.skills.retrieve(skillId);
      const created = await client.skills.versions.create(skillId, { files });
      version = created.id;
    } else {
      if (!forceNew) {
        // display_name defaults to the frontmatter name, so a skill this
        // script created before shows up under that name.
        for await (const existing of client.skills.list({ source: 'custom' })) {
          if (existing.display_name === name) {
            log(`A custom skill named ${name} already exists in this workspace: ${existing.id} (latest version ${existing.latest_version_id}).`);
            log(`Nothing uploaded. For a new version: --skill-id ${existing.id}. For a second, separate skill: --new.`);
            return 1;
          }
        }
      }
      skill = await client.skills.create({ files });
      version = skill.latest_version_id;
    }
  } catch (err) {
    logApiError(log, err);
    return 1;
  }

  const id = skill?.id || skillId;
  log(`Uploaded ${name}${skillId ? ' as a new version' : ' as a new skill'}.`);
  log(`  skill_id:      ${id}`);
  log(`  version:       ${version}`);
  log('');
  if (prefix) {
    const lines = envLines(prefix, id, version);
    log('1. Smoke-test this exact version (one paid request):');
    log(`   ${lines.join(' ')} npm run skills:smoke -- --yes-spend`);
    log('');
    log('2. Then pin it on Netlify (Site configuration > Environment variables), and redeploy so the functions read it:');
    for (const line of lines) log(`   ${line}`);
    log('   or with the Netlify CLI:');
    for (const line of lines) log(`   netlify env:set ${line.replace('=', ' ')}`);
    log('');
    log(`Rollback = set ${prefix}_VERSION back to the previous version id. Keep old versions until this one has run in production.`);
  } else {
    log(`Pin version ${version} wherever the runtime reads this skill's id and version.`);
  }
  return 0;
}

// Run as a command, not when a test imports it. Real paths on both sides:
// argv[1] is the path as typed, which can go through a symlink (macOS /tmp
// is /private/tmp) while import.meta.url is already resolved, and a
// mismatch would exit 0 having checked nothing.
const isMain = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  main().then((code) => { process.exitCode = code; });
}
