// The one secret this tool uses: a Cloudflare API token scoped to the R2
// bucket autosite-published, plus the account id, in a file outside the
// repo and outside the shared SSD:
//   ~/.config/acg/site-upgrade.env      (or the path in ACG_UPGRADE_ENV)
//   CLOUDFLARE_ACCOUNT_ID=...
//   CLOUDFLARE_API_TOKEN=...
// The file must be readable by its owner only (chmod 600). The token is
// never printed, logged or written: every line the tool prints or writes
// goes through redact(), and the token only goes to api.cloudflare.com
// (net.js refuses any other host for R2 calls).
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export const DEFAULT_ENV_PATH = path.join(homedir(), '.config', 'acg', 'site-upgrade.env');

const secrets = new Set();

// A problem with the env file: the CLI reports it as a refusal, not a crash.
const configError = (message) => Object.assign(new Error(message), { config: true });

// Removes every loaded secret from a string.
export function redact(text) {
  let s = String(text ?? '');
  for (const v of secrets) if (v) s = s.split(v).join('[redacted]');
  return s;
}

export function envFilePath(env = process.env) {
  return env.ACG_UPGRADE_ENV ? path.resolve(env.ACG_UPGRADE_ENV) : DEFAULT_ENV_PATH;
}

function inside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

// Reads the env file. Returns { found: false, path, why } when there is
// none (plan still runs, without R2), or { found: true, path, accountId,
// token }. Throws when the file is there but unsafe or incomplete.
// `appRoot`: the checkout the tool runs from; the file may not be in it.
export function loadSecrets({ appRoot, env = process.env } = {}) {
  const file = envFilePath(env);
  let st;
  try {
    st = statSync(file);
  } catch {
    return { found: false, path: file, why: 'no env file' };
  }
  const real = realpathSync(file);
  if (appRoot && inside(real, realpathSync(appRoot))) {
    throw configError(`The env file ${file} is inside the app checkout; keep it in ~/.config/acg/ (never in the repo)`);
  }
  if (real.startsWith('/Volumes/')) {
    throw configError(`The env file ${file} is on an external volume; keep it in ~/.config/acg/ on this Mac`);
  }
  if (!st.isFile()) throw configError(`The env file ${file} is not a file`);
  if (st.mode & 0o077) throw configError(`The env file ${file} can be read by other users: run chmod 600 "${file}"`);
  const vars = parseEnv(readFileSync(file, 'utf8'));
  const accountId = vars.CLOUDFLARE_ACCOUNT_ID || '';
  const token = vars.CLOUDFLARE_API_TOKEN || '';
  if (token) secrets.add(token);
  // A template with both values still empty: not set up yet.
  if (!accountId && !token) return { found: false, path: file, why: 'the env file has no token yet' };
  if (!/^[0-9a-f]{32}$/i.test(accountId)) throw configError(`CLOUDFLARE_ACCOUNT_ID in ${file} is missing or not a 32-character account id`);
  if (!token || /\s/.test(token)) throw configError(`CLOUDFLARE_API_TOKEN in ${file} is missing or malformed`);
  return { found: true, path: file, accountId, token };
}

// Hands the token to netlify/functions/_shared/r2.js, which reads it from
// process.env per call. Only after every page is rendered (cli.mjs), so no
// template code ever runs in a process that holds it.
export function activateSecrets(s) {
  if (!s?.found) throw new Error('No R2 credentials loaded');
  secrets.add(s.token);
  process.env.CLOUDFLARE_ACCOUNT_ID = s.accountId;
  process.env.CLOUDFLARE_API_TOKEN = s.token;
}

export function hasR2() {
  return !!process.env.CLOUDFLARE_API_TOKEN && secrets.has(process.env.CLOUDFLARE_API_TOKEN);
}
