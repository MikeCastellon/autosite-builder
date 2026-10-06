// scripts/skills-smoke.mjs
//
// One real run of a released skill through the production code.
//
// The brand skill (default, or --skill brand): buildBrand
// (netlify/functions/custom-site-brand-background.js) → runSkillRequest (same
// model, effort, tool, container, refusal fallback, pause_turn resumes, turn
// cap and 11-minute budget) → sanitizeBrand (src/lib/brandSpec.js). The
// project is a sample: one logo, drawn here at runtime (no binary in the
// repo), served by a stand-in for the storage bucket, plus a few intake
// answers. It downloads brand.json and brand_board.png to
// /tmp/skills-smoke-<time>/ (--out to change), checks the raw brand.json
// against the shared contract (strictly: a palette the server had to repair
// counts as a failure of the skill).
//
// A Launch Kit skill (--skill photos|mobile|words|claims|print|social|
// handover, src/lib/launchKit.js): the sample project comes from that
// skill's own spec (netlify/functions/_lib/kit/<key>.js smokeSample()), and
// the run goes through production's prepareKitRun / buildKitRun
// (custom-site-kit-background.js): the spec's inputs and prompt plus the kit
// rules, runSkillRequest, only the expected output files (types, sizes,
// caps), the spec's sanitizer. It writes every output, the raw JSON
// (<name>.raw.json) and the transcript to /tmp/skills-smoke-<key>-<time>/,
// and fails on a missing or wrong file, a near-miss file name, or the spec's
// own smokeCheck. Without --yes-spend it still prepares the sample (no
// network, no key): `--skill all` does that for every kit skill, so a spec
// that can't build its request is caught before anyone pays.
//
// Every run prints the usage and an estimated cost at Claude Opus 5.5 prices
// and exits non-zero when anything is off. Run it after each release, before
// pinning the version on Netlify.
//
// COSTS MONEY (one skill run of up to its turn cap; the output ceiling is
// printed first), so it sends nothing without --yes-spend:
//
//   npm run skills:smoke                                    # brand: prints the plan, sends nothing
//   npm run skills:smoke -- --yes-spend                     # brand: the version pinned in the env
//   npm run skills:smoke -- --yes-spend --version skver_... # brand: another version
//   npm run skills:smoke -- --skill all                     # every kit skill: dry run, sends nothing
//   npm run skills:smoke -- --skill words                   # one kit skill: dry run + plan
//   npm run skills:smoke -- --skill words --yes-spend       # one kit skill: the paid run
//
// Reads ANTHROPIC_API_KEY and the skill's id/version pair from the
// environment only (CUSTOM_SITE_BRAND_SKILL_ID/_VERSION, or
// CUSTOM_SITE_KIT_<KEY>_SKILL_ID/_VERSION; flags override the pair); the key
// is never printed. Needs the functions' dependencies
// (netlify/functions/node_modules), so run it in a mirror copy, never
// `npm install` in the repo. The run deletes its Files API uploads and
// outputs, as production does (--keep-files keeps the outputs). Nothing
// touches the database or the bucket.
// Exit code: 0 the run finished and its files are valid (--skill all: every
// built kit skill prepares its sample); 1 they are not, the run failed, or it
// could not start (no ANTHROPIC_API_KEY, no SDK, a spec that can't prepare
// its sample); 2 nothing was sent on purpose (no --yes-spend, skill not set
// up or not built, bad arguments).

import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { hexToRgb } from '../src/components/preview/templates/kit/theme.js';
import { FONT_CATALOG } from '../src/lib/fontCatalog.js';
import {
  BRAND_BOARD_SIZE, BRAND_EFFORT, BRAND_FILES, BRAND_MODEL, BRAND_NOTES_MAX, BRAND_RUN_BUDGET_MS, BRAND_VERSION,
  brandContrast, sanitizeBrand,
} from '../src/lib/brandSpec.js';
import { KIT_BUDGET_MS, KIT_KEYS, KIT_SKILLS, isKitKey, kitEnvNames, kitSkill } from '../src/lib/launchKit.js';

const SDK_URL = new URL('../netlify/functions/node_modules/@anthropic-ai/sdk/index.mjs', import.meta.url);
const BRAND_FN_URL = new URL('../netlify/functions/custom-site-brand-background.js', import.meta.url);
const SKILLS_LIB_URL = new URL('../netlify/functions/_lib/custom-site-skills.js', import.meta.url);
const KIT_FN_URL = new URL('../netlify/functions/custom-site-kit-background.js', import.meta.url);
const KIT_INDEX_URL = new URL('../netlify/functions/_lib/kit/index.js', import.meta.url);

export const SKILL_NAME = 'launch-brand-system';
export const ENV_PREFIX = 'CUSTOM_SITE_BRAND_SKILL';

// USD per million tokens, Claude Opus 5.5 (BRAND_MODEL; first-party API).
// Cache writes cost 1.25x input. Code-execution container time is billed on
// its own and isn't in the estimate.
export const PRICED_MODEL = 'claude-opus-5-5';
export const PRICES = Object.freeze({ input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 });

const FLAGS = new Set(['--yes-spend', '--keep-files']);
const VALUE_FLAGS = new Set(['--skill', '--skill-id', '--version', '--out']);
const USAGE = 'Usage: node scripts/skills-smoke.mjs [--skill brand|<kit key>|all] [--yes-spend] [--skill-id skill_...] [--version skver_...|latest] [--out DIR] [--keep-files]';

// ─── Sample logo (PNG drawn in memory) ───────────────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** An 8-bit RGBA PNG from `rgba` (width * height * 4 bytes). */
export function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); // filter 0 per row
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([PNG_SIGNATURE, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

/** { width, height } from a PNG's header, or null when it isn't a PNG. */
export function pngSize(buf) {
  if (!buf || buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// 5x7 capitals for the sample wordmark.
const GLYPHS = {
  A: [' ### ', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  E: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#####'],
  H: ['#   #', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  I: ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '#####'],
  N: ['#   #', '##  #', '# # #', '#  ##', '#   #', '#   #', '#   #'],
  O: [' ### ', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  P: ['#### ', '#   #', '#   #', '#### ', '#    ', '#    ', '#    '],
  S: [' ### ', '#   #', '#    ', ' ### ', '    #', '#   #', ' ### '],
  T: ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '  #  '],
  U: ['#   #', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  ' ': ['     ', '     ', '     ', '     ', '     ', '     ', '     '],
};

// What the sample logo is made of, so the run's logo reading can be
// compared with the truth: a navy badge with an orange swoosh and a navy +
// orange wordmark on a transparent background.
export const SAMPLE = Object.freeze({
  business: 'Shine Auto Spa',
  assetPath: 'skills-smoke/logo/shine-logo.png',
  navy: '#16325c',
  orange: '#f2711c',
  background: 'transparent',
  hasText: true,
});

/** The sample logo: { png, width, height }. */
export function sampleLogo() {
  const width = 640;
  const height = 320;
  const px = Buffer.alloc(width * height * 4); // all transparent
  const rgb = (hex) => { const c = hexToRgb(hex); return [c.r, c.g, c.b]; };
  const navy = rgb(SAMPLE.navy);
  const orange = rgb(SAMPLE.orange);
  const white = [255, 255, 255];
  const set = (x, y, [r, g, b]) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
  };

  // Badge: navy disc, white ring, orange diagonal swoosh inside the ring.
  const cx = 160; const cy = 160;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < 320; x += 1) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > 120) continue;
      if (d >= 96 && d <= 104) set(x, y, white);
      else if (d < 96 && Math.abs((y - cy) + (x - cx) * 0.35) < 20) set(x, y, orange);
      else set(x, y, navy);
    }
  }

  const text = (word, x0, y0, scale, color) => {
    [...word].forEach((ch, k) => {
      const rows = GLYPHS[ch] || GLYPHS[' '];
      rows.forEach((row, r) => [...row].forEach((cell, c) => {
        if (cell !== '#') return;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) set(x0 + k * 6 * scale + c * scale + dx, y0 + r * scale + dy, color);
        }
      }));
    });
  };
  text('SHINE', 300, 88, 11, navy);
  text('AUTO SPA', 302, 190, 5, orange);

  return { png: encodePng(width, height, px), width, height };
}

// ─── Sample project (what buildBrand reads) ──────────────────────────

/**
 * A custom_site_projects row with what the brand run reads: intake answers
 * (form) and one logo upload (assets). Small, but with what the skill has
 * to handle: a logo with real colors and text, "match my logo", styles and
 * something to avoid.
 */
export function sampleProject(logoBytes) {
  return {
    id: 'skills-smoke',
    business_name: SAMPLE.business,
    form: {
      businessName: SAMPLE.business,
      businessType: 'mobile_detailing',
      colorMode: 'logo',
      styles: ['Clean & minimal', 'Classic & trusted'],
      brandNotes: 'People know us by the navy van with the orange stripe.',
      dislikes: 'Neon colors.',
    },
    assets: [{ path: SAMPLE.assetPath, kind: 'logo', name: 'shine-logo.png', size: logoBytes }],
  };
}

/**
 * The part of the service-role Supabase client buildBrand uses (storage
 * download + the board upload), serving the sample logo from memory and
 * keeping the board in `saved` instead of the bucket.
 */
export function sampleStorage(logoPng, saved = {}) {
  return {
    storage: {
      from: () => ({
        download: async (path) => (path === SAMPLE.assetPath
          ? { data: new Blob([logoPng]), error: null }
          : { data: null, error: { message: `no such object ${path}` } }),
        upload: async (path, body) => {
          saved.board = { path, body: Buffer.from(body) };
          return { data: { path }, error: null };
        },
      }),
    },
  };
}

/**
 * Wraps an Anthropic client for the run: every response (turns), the
 * request bodies, the output files' names and downloaded bytes are kept in
 * `rec`, so the raw brand.json and the transcript survive the production
 * code's own cleanup. With keepOutputs, files the run didn't upload are
 * not deleted.
 */
export function recordingClient(client, rec, { keepOutputs = false, onTurn = () => {} } = {}) {
  Object.assign(rec, { turns: [], requests: [], uploads: new Set(), names: new Map(), downloads: new Map(), kept: [] });
  return {
    files: {
      upload: async (...args) => {
        const meta = await client.files.upload(...args);
        if (meta?.id) rec.uploads.add(meta.id);
        return meta;
      },
      retrieveMetadata: async (id, ...rest) => {
        const meta = await client.files.retrieveMetadata(id, ...rest);
        rec.names.set(id, meta?.filename || '');
        return meta;
      },
      download: async (id, ...rest) => {
        const res = await client.files.download(id, ...rest);
        const buf = Buffer.from(await res.arrayBuffer());
        rec.downloads.set(id, buf);
        return new Response(buf);
      },
      delete: async (id, ...rest) => {
        if (keepOutputs && !rec.uploads.has(id)) {
          rec.kept.push(id);
          return { id, type: 'file_deleted' };
        }
        return client.files.delete(id, ...rest);
      },
    },
    messages: {
      stream: (params, options) => {
        rec.requests.push(params);
        const stream = client.messages.stream(params, options);
        return {
          finalMessage: async () => {
            const message = await stream.finalMessage();
            rec.turns.push(message);
            onTurn(rec);
            return message;
          },
        };
      },
    },
  };
}

// ─── Reading the run ─────────────────────────────────────────────────

const count = (value) => (Number.isFinite(value) ? value : 0);
const USAGE_KEYS = ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'];

/**
 * Token totals over every response. After a refusal fallback a response's
 * top-level usage covers only the attempt that served it; usage.iterations
 * has every attempt, so those are summed when present.
 */
export function sumUsage(turns) {
  const total = Object.fromEntries(USAGE_KEYS.map((k) => [k, 0]));
  const models = new Set();
  for (const turn of turns) {
    const u = turn?.usage;
    const entries = Array.isArray(u?.iterations) && u.iterations.length ? u.iterations : [u];
    for (const entry of entries) {
      for (const key of USAGE_KEYS) total[key] += count(entry?.[key]);
      const model = entry?.model || turn?.model;
      if (model) models.add(model);
    }
  }
  return { ...total, models: [...models] };
}

export function estimateCost(usage) {
  return (count(usage.input_tokens) * PRICES.input
    + count(usage.output_tokens) * PRICES.output
    + count(usage.cache_read_input_tokens) * PRICES.cacheRead
    + count(usage.cache_creation_input_tokens) * PRICES.cacheWrite) / 1e6;
}

const isCodeResult = (block) => typeof block?.type === 'string' && block.type.endsWith('code_execution_tool_result');

/** { runs, failed: [{ code, stderr }] } for the code the run executed. */
export function codeRuns(turns) {
  const failed = [];
  let runs = 0;
  for (const turn of turns) {
    for (const block of turn?.content || []) {
      if (!isCodeResult(block)) continue;
      runs += 1;
      const c = block.content || {};
      if (c.error_code) failed.push({ code: c.error_code, stderr: '' });
      else if (Number.isFinite(c.return_code) && c.return_code !== 0) failed.push({ code: `exit ${c.return_code}`, stderr: String(c.stderr || '') });
    }
  }
  return { runs, failed };
}

/**
 * The downloaded output production took for `filename`: { buf, name } with
 * the name the Files API reported, or null. `pick` is production's
 * pickOutput (last path segment, case and -/_ ignored), so the smoke reads
 * the file production read instead of calling it missing over a name.
 */
export function downloaded(rec, filename, pick) {
  const outputs = [...rec.downloads.keys()].map((id) => ({ file_id: id, filename: rec.names.get(id) || '' }));
  const out = pick(outputs, filename);
  return out ? { buf: rec.downloads.get(out.file_id), name: out.filename } : null;
}

// ─── brand.json contract ─────────────────────────────────────────────

export const ROLES = Object.freeze(['bg', 'secondary', 'text', 'muted', 'accent']);
const HEX6 = /^#[0-9a-fA-F]{6}$/;
const LOGO_BACKGROUNDS = ['light', 'dark', 'transparent'];
const isObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const PALETTES = [['palette', (b) => b.palette], ['alternates.light', (b) => b.alternates?.light], ['alternates.dark', (b) => b.alternates?.dark]];

function paletteShape(p, path) {
  if (!isObject(p)) return [`${path}: expected an object with ${ROLES.join(', ')}`];
  return ROLES.filter((role) => typeof p[role] !== 'string' || !HEX6.test(p[role]))
    .map((role) => `${path}.${role}: expected "#rrggbb", got ${JSON.stringify(p[role])}`);
}

/**
 * Problems with a raw brand.json against the shared contract, strictly:
 * everything sanitizeBrand would repair, drop or blank is a problem here,
 * because the skill is meant to deliver it right (the server's repair is
 * the safety net, not the plan). Contrast is measured as production does
 * (brandContrast: after deriveTheme's repair). Returns { problems, clean }
 * with clean = sanitizeBrand's output.
 */
export function brandCheck(raw) {
  if (!isObject(raw)) return { problems: ['brand.json: expected a JSON object'], clean: null };
  const problems = [];
  if (raw.version !== BRAND_VERSION) problems.push(`version: expected ${BRAND_VERSION}, got ${JSON.stringify(raw.version)}`);
  for (const [path, get] of PALETTES) {
    const p = get(raw);
    const shape = paletteShape(p, path);
    problems.push(...shape);
    if (shape.length) continue;
    for (const check of brandContrast(p)) {
      if (!check.pass) problems.push(`${path}: ${check.label} is ${Number(check.ratio).toFixed(2)}:1, under 4.5:1`);
    }
  }
  // Exact catalog family names; which families may be the body font
  // (sans or serif) is sanitizeBrand's rule, reported with its adjustments.
  for (const slot of ['heading', 'body']) {
    const family = raw.fonts?.[slot];
    if (!nonEmpty(family)) problems.push(`fonts.${slot}: missing`);
    else if (!Object.hasOwn(FONT_CATALOG, family)) problems.push(`fonts.${slot}: "${family}" is not a FONT_CATALOG family`);
  }
  for (const key of ['palette', 'accent', 'fonts']) {
    if (!nonEmpty(raw.reasons?.[key])) problems.push(`reasons.${key}: missing or empty`);
  }
  const logo = raw.logo;
  if (!isObject(logo)) problems.push('logo: expected { dominant, background, hasText } (the sample has a logo)');
  else {
    if (!Array.isArray(logo.dominant) || !logo.dominant.length || logo.dominant.some((c) => typeof c !== 'string' || !HEX6.test(c))) {
      problems.push(`logo.dominant: expected a list of "#rrggbb", got ${JSON.stringify(logo.dominant)}`);
    }
    if (!LOGO_BACKGROUNDS.includes(logo.background)) problems.push(`logo.background: expected ${LOGO_BACKGROUNDS.join(' | ')}, got ${JSON.stringify(logo.background)}`);
    if (typeof logo.hasText !== 'boolean') problems.push(`logo.hasText: expected true or false, got ${JSON.stringify(logo.hasText)}`);
  }
  if (!Array.isArray(raw.notes) || raw.notes.some((n) => typeof n !== 'string')) problems.push('notes: expected a list of strings');
  else if (raw.notes.length > BRAND_NOTES_MAX) problems.push(`notes: ${raw.notes.length}, at most ${BRAND_NOTES_MAX}`);

  // What the server changed, unless a problem above already names it.
  const clean = sanitizeBrand(raw);
  if (!clean) problems.push('sanitizeBrand rejected it: no usable main palette (the Studio would show a failed run)');
  const paths = problems.map((p) => p.slice(0, p.indexOf(':')));
  for (const a of clean?.adjustments || []) {
    if (paths.some((p) => p.startsWith(a.target) || a.target.startsWith(p))) continue;
    const change = a.from || a.to ? ` (${a.from || '?'} -> ${a.to || 'left out'})` : '';
    problems.push(`${a.target}: the server would change it: ${a.reason}${change}`);
  }
  return { problems, clean };
}

/** Problems with brand_board.png (BRAND_BOARD_SIZE, PNG). */
export function boardProblems(buf) {
  if (!buf) return [`${BRAND_FILES.board}: not among the output files`];
  const size = pngSize(buf);
  if (!size) return [`${BRAND_FILES.board}: not a PNG`];
  if (size.width !== BRAND_BOARD_SIZE.width || size.height !== BRAND_BOARD_SIZE.height) {
    return [`${BRAND_FILES.board}: ${size.width}x${size.height}, expected ${BRAND_BOARD_SIZE.width}x${BRAND_BOARD_SIZE.height}`];
  }
  return [];
}

const distance = (a, b) => {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return x && y ? Math.hypot(x.r - y.r, x.g - y.g, x.b - y.b) : Infinity;
};

/** How the run read the sample logo, next to what was drawn (informational). */
export function sampleReading(logo) {
  if (!isObject(logo)) return ['no logo reading'];
  const dominant = Array.isArray(logo.dominant) ? logo.dominant : [];
  const found = (hex) => dominant.some((c) => distance(c, hex) < 60);
  return [
    `background ${logo.background} (drawn: ${SAMPLE.background})`,
    `hasText ${logo.hasText} (drawn: ${SAMPLE.hasText})`,
    `navy ${SAMPLE.navy} ${found(SAMPLE.navy) ? 'found' : 'NOT found'} in logo.dominant`,
    `orange ${SAMPLE.orange} ${found(SAMPLE.orange) ? 'found' : 'NOT found'} in logo.dominant`,
  ];
}

// ─── CLI ─────────────────────────────────────────────────────────────

const mirrorHint = (what, err) => new Error(`Could not load ${what} (${err.message}). Run this in a mirror copy with the functions' dependencies installed (netlify/functions/node_modules).`);

async function loadSdk({ apiKey }) {
  let mod;
  try {
    mod = await import(SDK_URL.href);
  } catch (err) {
    throw mirrorHint('the Anthropic SDK', err);
  }
  // The production code sets its own retries per request; the client
  // default (2) is what the functions' client has too.
  return { client: new mod.default({ apiKey }) };
}

// The production run and its limits. Loaded on demand: both import the SDK.
async function loadRunner() {
  try {
    const [brandFn, skillsLib] = await Promise.all([import(BRAND_FN_URL.href), import(SKILLS_LIB_URL.href)]);
    return {
      buildBrand: brandFn.buildBrand,
      skillFromEnv: skillsLib.skillFromEnv,
      pickOutput: skillsLib.pickOutput,
      maxTurns: skillsLib.MAX_SKILL_TURNS,
      maxTokens: skillsLib.SKILL_MAX_TOKENS,
      tool: skillsLib.CODE_EXECUTION_TOOL?.type,
    };
  } catch (err) {
    throw mirrorHint('the brand run (netlify/functions/custom-site-brand-background.js)', err);
  }
}

const STATUS_HINTS = {
  400: 'the API rejected the request: read the message (skill id/version, container, file)',
  401: 'the key was rejected: check ANTHROPIC_API_KEY',
  403: 'this key may not use the skill or the Files API',
  404: "the skill or version isn't in this key's workspace: check the id/version and that the key is the production workspace's",
  429: 'rate limited: wait a minute and run it again',
  529: 'the API is overloaded: try again later',
};

function parseArgs(argv) {
  const out = { flags: new Set(), values: {}, errors: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const key = eq > 0 ? arg.slice(0, eq) : arg;
    if (FLAGS.has(key) && eq < 0) out.flags.add(key);
    else if (VALUE_FLAGS.has(key)) {
      const value = eq > 0 ? arg.slice(eq + 1) : argv[i + 1];
      if (eq < 0) i += 1;
      if (!value || value.startsWith('--')) out.errors.push(`${key} needs a value`);
      else out.values[key] = value;
    } else out.errors.push(`unknown argument ${arg}`);
  }
  return out;
}

// What the run prints includes model output (brand.json strings, Claude's
// text, stderr of the code it ran): control characters are dropped (tabs
// and newlines stay) so none of it can move the cursor or rewrite earlier
// lines of the owner's terminal.
export const printable = (line) => String(line ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '');

const usd = (value) => `$${value.toFixed(4)}`;
const thousands = (n) => n.toLocaleString('en-US');

function paletteLines(label, p) {
  const pad = `${label}:`.padEnd(18);
  if (!isObject(p) || ROLES.some((r) => typeof p[r] !== 'string' || !HEX6.test(p[r]))) return [`${pad}(not five #rrggbb colors)`];
  return [
    `${pad}${ROLES.map((r) => `${r} ${p[r]}`).join('  ')}`,
    `${''.padEnd(18)}${brandContrast(p).map((c) => `${c.label.toLowerCase()} ${Number(c.ratio).toFixed(2)}`).join(', ')}`,
  ];
}

function usageLines(turns, model = BRAND_MODEL) {
  const usage = sumUsage(turns);
  const others = usage.models.filter((m) => m !== model);
  return [
    `  usage:          input ${thousands(usage.input_tokens)}, output ${thousands(usage.output_tokens)}, cache read ${thousands(usage.cache_read_input_tokens)}, cache write ${thousands(usage.cache_creation_input_tokens)} (${turns.length} request(s))`,
    `  estimated cost: ${usd(estimateCost(usage))} at Opus 5.5 prices ($${PRICES.input}/M input, $${PRICES.output}/M output, $${PRICES.cacheRead}/M cache read); code-execution container time is billed separately`,
    ...(others.length ? [`  note:           the refusal fallback served part of the run on ${others.join(', ')}; the estimate still uses Opus 5.5 prices`] : []),
  ];
}

// The brand skill's smoke test (no --skill, or --skill brand): unchanged
// since the brand skill shipped.
async function brandMain(args, { env, createClient, runner, log, now }) {
  const apiKey = typeof env?.ANTHROPIC_API_KEY === 'string' ? env.ANTHROPIC_API_KEY.trim() : '';
  if (!apiKey) {
    log('ANTHROPIC_API_KEY is not set in the environment. Nothing sent.');
    return 1;
  }

  const fromEnv = (suffix) => (typeof env?.[`${ENV_PREFIX}_${suffix}`] === 'string' ? env[`${ENV_PREFIX}_${suffix}`].trim() : '');
  const skillId = args.values['--skill-id'] || fromEnv('ID');
  const version = args.values['--version'] || fromEnv('VERSION');
  if (!skillId) {
    log(`The brand skill is not set up: ${ENV_PREFIX}_ID is not set. Release it first (npm run skills:release -- ${SKILL_NAME}), or pass --skill-id. Nothing sent.`);
    return 2;
  }
  if (!version) {
    log(`${ENV_PREFIX}_VERSION is not set. Pin the version to test (--version skver_..., or --version latest for the newest). Nothing sent.`);
    return 2;
  }

  let run;
  try {
    run = await runner();
  } catch (err) {
    log(err?.message || String(err));
    return 1;
  }
  // The production reading of the pair: a malformed id is "not set up", a
  // malformed version runs latest.
  const skill = run.skillFromEnv(skillId, version);
  if (!skill) {
    log(`"${skillId}" is not a skill id the functions accept, so production would report "not set up". Nothing sent.`);
    return 2;
  }
  if (skill.version !== version) log(`warning: production would run version ${skill.version}, not "${version}" (not a valid version id)`);

  const stamp = new Date(now()).toISOString().replace(/[:.]/g, '-');
  const outDir = resolve(args.values['--out'] || join(process.platform === 'win32' ? tmpdir() : '/tmp', `skills-smoke-${stamp}`));
  const logo = sampleLogo();
  const ceiling = (run.maxTurns * run.maxTokens * PRICES.output) / 1e6;
  log(`Brand skill smoke test (${SKILL_NAME}), through production's buildBrand`);
  log(`  skill:          ${skill.skill_id}, version ${skill.version}${skill.version === 'latest' ? ' (production pins a version id; latest is for trying the newest)' : ''}`);
  log(`  model:          ${BRAND_MODEL}, effort ${BRAND_EFFORT}, refusal fallback and prompt caching as in production`);
  if (BRAND_MODEL !== PRICED_MODEL) log(`  warning:        the cost estimate uses ${PRICED_MODEL} prices; update PRICES in this script for ${BRAND_MODEL}`);
  log(`  tool:           ${run.tool}; up to ${run.maxTurns} requests (pause_turn resumes), max_tokens ${run.maxTokens}, ${Math.round(BRAND_RUN_BUDGET_MS / 60000)} min budget`);
  log(`  input:          a sample logo (${logo.width}x${logo.height}, ${logo.png.length} bytes, drawn now) and intake answers for "${SAMPLE.business}"`);
  log(`  output to:      ${outDir}`);

  if (!args.flags.has('--yes-spend')) {
    log('');
    log(`Not sent. A run is paid: ${BRAND_MODEL} at $${PRICES.input}/M input and $${PRICES.output}/M output tokens.`);
    log(`Output alone is at most ${usd(ceiling)} (every request using all of max_tokens); input grows with each resume and code result. The real total is printed after the run.`);
    log('Run again with --yes-spend to send it.');
    return 2;
  }

  let client;
  try {
    ({ client } = await createClient({ apiKey }));
  } catch (err) {
    log(err?.message || String(err));
    return 1;
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'sample-logo.png'), logo.png);
  const transcript = join(outDir, 'transcript.json');
  const rec = {};
  const saveTranscript = () => writeFileSync(transcript, `${JSON.stringify({ requests: rec.requests, responses: rec.turns }, null, 2)}\n`);
  const recording = recordingClient(client, rec, { keepOutputs: args.flags.has('--keep-files'), onTurn: saveTranscript });
  const saved = {};
  const t0 = now();

  log('');
  log('Running the skill through buildBrand (this can take several minutes)...');
  let result = null;
  let failure = null;
  try {
    result = await run.buildBrand({
      db: sampleStorage(logo.png, saved),
      client: recording,
      project: sampleProject(logo.png.length),
      skill,
      deadline: now() + BRAND_RUN_BUDGET_MS,
    });
  } catch (err) {
    failure = err;
  }
  const seconds = Math.round((now() - t0) / 1000);
  if (rec.turns.length) saveTranscript();

  const last = rec.turns.at(-1);
  const runs = codeRuns(rec.turns);
  log(`${failure ? 'FAILED' : 'Finished'} after ${seconds} s (budget ${Math.round(BRAND_RUN_BUDGET_MS / 1000)} s).`);
  if (failure) {
    log(`  error:          ${failure?.status ? `${failure.status} ` : ''}${failure?.message || failure}`);
    if (STATUS_HINTS[failure?.status]) log(`  likely cause:   ${STATUS_HINTS[failure.status]}`);
  }
  log(`  model:          ${last?.model || failure?.model || 'unknown'}`);
  log(`  stop_reason:    ${last?.stop_reason ?? 'none'}`);
  log(`  container:      ${last?.container?.id || 'none'}`);
  log(`  code runs:      ${runs.runs}${runs.failed.length ? `, ${runs.failed.length} failed` : ''}`);
  for (const f of runs.failed.slice(-3)) log(`    ${f.code}${f.stderr ? `: ${f.stderr.trim().split('\n').slice(-3).join(' | ').slice(0, 300)}` : ''}`);
  for (const line of usageLines(rec.turns)) log(line);
  if (result?.usage) log(`  stored usage:   input ${thousands(result.usage.input_tokens)}, output ${thousands(result.usage.output_tokens)} (what design.brand.usage would hold)`);
  log(`  output files:   ${[...new Set(rec.names.values())].filter(Boolean).join(', ') || 'none'}`);
  if (rec.turns.length) log(`  transcript:     ${transcript}`);
  if (rec.kept.length) log(`  kept in the Files API (--keep-files): ${rec.kept.join(', ')}`);

  // brand.json as the skill wrote it, and the board (what buildBrand stored,
  // or the download when it stopped before storing it).
  const problems = [];
  if (failure) problems.push(`the run failed: ${failure?.message || failure}`);
  if (last?.stop_reason === 'pause_turn') problems.push(`the run stopped while paused (turn cap ${run.maxTurns} or the ${Math.round(BRAND_RUN_BUDGET_MS / 60000)} min budget)`);
  const spec = downloaded(rec, BRAND_FILES.spec, run.pickOutput);
  const board = downloaded(rec, BRAND_FILES.board, run.pickOutput);
  const specBuf = spec?.buf || null;
  const boardBuf = saved.board?.body || board?.buf || null;
  // Production accepts a near name (Brand.json, brand-board.png); the
  // contract names the files exactly, so the skill should too.
  for (const [out, want] of [[spec, BRAND_FILES.spec], [board, BRAND_FILES.board]]) {
    if (out && out.name !== want) problems.push(`${want}: written as ${JSON.stringify(out.name)} (production still takes it; the contract name is ${want})`);
  }
  if (specBuf) writeFileSync(join(outDir, BRAND_FILES.spec), specBuf);
  if (boardBuf) writeFileSync(join(outDir, BRAND_FILES.board), boardBuf);

  let raw = null;
  if (!specBuf) problems.push(`${BRAND_FILES.spec}: not among the output files`);
  else {
    try {
      raw = JSON.parse(specBuf.toString('utf8').replace(/^\uFEFF/, ''));
    } catch (err) {
      problems.push(`${BRAND_FILES.spec}: not valid JSON (${err.message})`);
    }
  }
  if (raw) problems.push(...brandCheck(raw).problems);
  if (!failure || boardBuf) problems.push(...boardProblems(boardBuf));
  for (const warning of result?.warnings || []) log(`warning: ${warning}`);

  if (raw) {
    log('');
    for (const line of paletteLines('Palette', raw.palette)) log(line);
    for (const line of paletteLines('Light', raw.alternates?.light)) log(line);
    for (const line of paletteLines('Dark', raw.alternates?.dark)) log(line);
    log(`Fonts:            heading ${raw.fonts?.heading}, body ${raw.fonts?.body}`);
    log(`Sample logo read: ${sampleReading(raw.logo).join('; ')}`);
    if (Array.isArray(raw.notes) && raw.notes.length) log(`Notes:            ${raw.notes.join(' | ').slice(0, 400)}`);
  }
  const summary = (last?.content || []).filter((b) => b?.type === 'text').map((b) => b.text).join('\n').trim();
  if (summary) {
    log('');
    log('Claude said:');
    log(summary.length > 1200 ? `${summary.slice(0, 1200)}...` : summary);
  }

  log('');
  if (problems.length) {
    log(`Result: ${problems.length} problem(s)`);
    for (const problem of problems) log(`  - ${problem}`);
  } else {
    log(`Result: OK (contract, 4.5:1 pairs, catalog fonts, ${BRAND_BOARD_SIZE.width}x${BRAND_BOARD_SIZE.height} board, nothing for the server to repair)`);
  }
  log(`Files saved in ${outDir}`);
  return problems.length ? 1 : 0;
}

// ─── Launch Kit skills (--skill <key>) ───────────────────────────────

/**
 * The part of the service-role Supabase client a kit run reads: storage
 * downloads, served from the sample's `files` (customer uploads and earlier
 * kit runs' stored files). It stores nothing and has no database: the run
 * gets the sample's site directly.
 */
export function sampleKitDb(files = {}) {
  return {
    storage: {
      from: () => ({
        download: async (path) => (files[path]
          ? { data: new Blob([files[path]]), error: null }
          : { data: null, error: { message: `no such object ${path}` } }),
        upload: async () => ({ data: null, error: { message: 'the smoke test stores nothing' } }),
      }),
    },
    from: (table) => {
      throw new Error(`the smoke test has no database (the spec asked for ${table}); put what it needs in smokeSample()`);
    },
  };
}

// Dry runs never touch the network: the brand fonts come back as warnings.
const noNetwork = async () => {
  throw new Error('no network in a dry run');
};

// The production kit run and its limits. Loaded on demand: they import the SDK.
async function loadKitRunner() {
  try {
    const [bg, index, skillsLib] = await Promise.all([import(KIT_FN_URL.href), import(KIT_INDEX_URL.href), import(SKILLS_LIB_URL.href)]);
    return {
      prepareKitRun: bg.prepareKitRun,
      buildKitRun: bg.buildKitRun,
      specs: index.KIT_SPECS,
      model: index.KIT_MODEL,
      effort: index.KIT_EFFORT,
      skillFromEnv: skillsLib.skillFromEnv,
      pickOutput: skillsLib.pickOutput,
      maxTurns: skillsLib.MAX_SKILL_TURNS,
      maxTokens: skillsLib.SKILL_MAX_TOKENS,
      tool: skillsLib.CODE_EXECUTION_TOOL?.type,
    };
  } catch (err) {
    throw mirrorHint('the launch kit run (netlify/functions/custom-site-kit-background.js)', err);
  }
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

/**
 * The free half of a kit smoke test: the spec's smokeSample(), its inputs
 * and its prompt, exactly as production prepares them (prepareKitRun), with
 * no request sent. Returns { ok, sample, prepared }.
 */
export async function dryKit(key, run, { log, now = Date.now, fetchImpl } = {}) {
  const spec = run.specs[key];
  let sample;
  try {
    sample = await spec.smokeSample();
    if (!isObject(sample?.project)) throw new Error('it returned no project');
  } catch (err) {
    log(`  sample:         smokeSample() failed: ${err?.message || err}`);
    return { ok: false };
  }
  let prepared;
  try {
    prepared = await run.prepareKitRun({
      db: sampleKitDb(sample.files), project: sample.project, site: sample.site || null, key, spec,
      deadline: now() + KIT_BUDGET_MS, nowMs: now, fetchImpl: fetchImpl || sample.fetchImpl || noNetwork,
    });
  } catch (err) {
    log(`  inputs:         the spec could not prepare the sample: ${err?.message || err}`);
    return { ok: false, sample };
  }
  const { files, system, userText, ctx } = prepared;
  log(`  inputs:         ${files.length} file(s)${files.length ? `: ${files.map((f) => `${f.name} (${f.mediaType}, ${kb(f.data.length)}${f.vision === false ? ', container only' : ''})`).join(', ')}` : ''}`);
  for (const s of (ctx.inputs?.skipped || []).slice(0, 5)) log(`  skipped:        ${s.name || s.path}: ${s.reason}`);
  for (const w of (ctx.inputs?.warnings || []).slice(0, 5)) log(`  input warning:  ${w}`);
  log(`  prompt:         system ${system.length} chars (with the kit rules), request ${userText.length} chars`);
  return { ok: true, sample, prepared };
}

/** `--skill all`: the dry run for every Launch Kit skill. 0 when every built spec prepares its sample. */
async function kitDryAll({ kitRunner, log, now }) {
  let run;
  try {
    run = await kitRunner();
  } catch (err) {
    log(err?.message || String(err));
    return 1;
  }
  const failed = [];
  for (const entry of KIT_SKILLS) {
    log(`${entry.label} (--skill ${entry.key}, ${entry.folder})`);
    const spec = run.specs[entry.key];
    if (!spec || spec.stub) {
      log('  not built yet: its spec is still the stub');
      continue;
    }
    const dry = await dryKit(entry.key, run, { log, now });
    if (!dry.ok) failed.push(entry.key);
  }
  log('');
  log('The brand skill: npm run skills:smoke (prints its plan; needs ANTHROPIC_API_KEY).');
  log(failed.length ? `Result: ${failed.length} skill(s) could not prepare their sample: ${failed.join(', ')}` : 'Result: every built skill prepares its sample. Nothing was sent.');
  return failed.length ? 1 : 0;
}

/** One Launch Kit skill: the dry run, then (with --yes-spend) one paid run through buildKitRun. */
async function kitMain(key, args, { env, createClient, kitRunner, log, now }) {
  const entry = kitSkill(key);
  let run;
  try {
    run = await kitRunner();
  } catch (err) {
    log(err?.message || String(err));
    return 1;
  }
  const spec = run.specs[key];
  log(`Launch kit smoke test: ${entry.label} (${entry.folder}), through production's buildKitRun`);
  if (!spec || spec.stub) {
    log(`  ${entry.label} isn't built yet: netlify/functions/_lib/kit/${key}.js is still the stub. Nothing sent.`);
    return 2;
  }
  const dry = await dryKit(key, run, { log, now });
  if (!dry.ok) {
    log('Fix the spec first. Nothing sent.');
    return 1;
  }

  const names = kitEnvNames(key);
  const fromEnv = (name) => (typeof env?.[name] === 'string' ? env[name].trim() : '');
  const skillId = args.values['--skill-id'] || fromEnv(names.id);
  const version = args.values['--version'] || fromEnv(names.version);
  const stamp = new Date(now()).toISOString().replace(/[:.]/g, '-');
  const outDir = resolve(args.values['--out'] || join(process.platform === 'win32' ? tmpdir() : '/tmp', `skills-smoke-${key}-${stamp}`));
  const ceiling = (spec.maxTurns * run.maxTokens * PRICES.output) / 1e6;
  log(`  skill:          ${skillId ? `${skillId}, version ${version || '(not pinned)'}` : `not set up (${names.id})`}`);
  log(`  model:          ${run.model}, effort ${run.effort}, refusal fallback and prompt caching as in production`);
  if (run.model !== PRICED_MODEL) log(`  warning:        the cost estimate uses ${PRICED_MODEL} prices; update PRICES in this script for ${run.model}`);
  log(`  tool:           ${run.tool}; up to ${spec.maxTurns} requests (pause_turn resumes), max_tokens ${run.maxTokens}, ${Math.round(KIT_BUDGET_MS / 60000)} min budget`);
  log(`  outputs:        ${entry.outputs.map((o) => `${o.name}${o.required ? '' : ' (optional)'}`).join(', ')}`);
  log(`  output to:      ${outDir}`);

  if (!args.flags.has('--yes-spend')) {
    log('');
    log(`Not sent. A run is paid: ${run.model} at $${PRICES.input}/M input and $${PRICES.output}/M output tokens (usually ${entry.estimate}).`);
    log(`Output alone is at most ${usd(ceiling)} (every request using all of max_tokens); input grows with each resume and code result. The real total is printed after the run.`);
    log(`Run again with --yes-spend to send it (${names.id} and ${names.version} set, or --skill-id / --version).`);
    return 2;
  }

  const apiKey = typeof env?.ANTHROPIC_API_KEY === 'string' ? env.ANTHROPIC_API_KEY.trim() : '';
  if (!apiKey) {
    log('ANTHROPIC_API_KEY is not set in the environment. Nothing sent.');
    return 1;
  }
  if (!skillId) {
    log(`${entry.label} is not set up: ${names.id} is not set. Release it first (npm run skills:release -- ${entry.folder}), or pass --skill-id. Nothing sent.`);
    return 2;
  }
  if (!version) {
    log(`${names.version} is not set. Pin the version to test (--version skver_..., or --version latest for the newest). Nothing sent.`);
    return 2;
  }
  // The production reading of the pair: a malformed id is "not set up", a
  // malformed version runs latest.
  const skill = run.skillFromEnv(skillId, version);
  if (!skill) {
    log(`"${skillId}" is not a skill id the functions accept, so production would report "not set up". Nothing sent.`);
    return 2;
  }
  if (skill.version !== version) log(`warning: production would run version ${skill.version}, not "${version}" (not a valid version id)`);

  let client;
  try {
    ({ client } = await createClient({ apiKey }));
  } catch (err) {
    log(err?.message || String(err));
    return 1;
  }

  mkdirSync(outDir, { recursive: true });
  const transcript = join(outDir, 'transcript.json');
  const rec = {};
  const saveTranscript = () => writeFileSync(transcript, `${JSON.stringify({ requests: rec.requests, responses: rec.turns }, null, 2)}\n`);
  const recording = recordingClient(client, rec, { keepOutputs: args.flags.has('--keep-files'), onTurn: saveTranscript });
  const { sample } = dry;
  const t0 = now();

  log('');
  log('Running the skill through buildKitRun (this can take several minutes)...');
  let result = null;
  let failure = null;
  try {
    result = await run.buildKitRun({
      db: sampleKitDb(sample.files), client: recording, project: sample.project, site: sample.site || null, key, spec, skill,
      deadline: now() + KIT_BUDGET_MS, fetchImpl: sample.fetchImpl || globalThis.fetch,
    });
  } catch (err) {
    failure = err;
  }
  const seconds = Math.round((now() - t0) / 1000);
  if (rec.turns.length) saveTranscript();

  const last = rec.turns.at(-1);
  const runs = codeRuns(rec.turns);
  log(`${failure ? 'FAILED' : 'Finished'} after ${seconds} s (budget ${Math.round(KIT_BUDGET_MS / 1000)} s).`);
  if (failure) {
    log(`  error:          ${failure?.status ? `${failure.status} ` : ''}${failure?.message || failure}`);
    if (STATUS_HINTS[failure?.status]) log(`  likely cause:   ${STATUS_HINTS[failure.status]}`);
  }
  log(`  model:          ${last?.model || failure?.model || 'unknown'}`);
  log(`  stop_reason:    ${last?.stop_reason ?? 'none'}`);
  log(`  container:      ${last?.container?.id || 'none'}`);
  log(`  code runs:      ${runs.runs}${runs.failed.length ? `, ${runs.failed.length} failed` : ''}`);
  for (const f of runs.failed.slice(-3)) log(`    ${f.code}${f.stderr ? `: ${f.stderr.trim().split('\n').slice(-3).join(' | ').slice(0, 300)}` : ''}`);
  for (const line of usageLines(rec.turns, run.model)) log(line);
  log(`  output files:   ${[...new Set(rec.names.values())].filter(Boolean).join(', ') || 'none'}`);
  if (rec.turns.length) log(`  transcript:     ${transcript}`);
  if (rec.kept.length) log(`  kept in the Files API (--keep-files): ${rec.kept.join(', ')}`);

  const problems = [];
  if (failure) problems.push(`the run failed: ${failure?.message || failure}`);
  if (last?.stop_reason === 'pause_turn') problems.push(`the run stopped while paused (turn cap ${spec.maxTurns} or the ${Math.round(KIT_BUDGET_MS / 60000)} min budget)`);
  // What the skill wrote, as downloaded (the raw JSON too), and what
  // production would store (the sanitized JSON in its place).
  for (const output of entry.outputs) {
    const got = downloaded(rec, output.name, run.pickOutput);
    if (got?.buf) writeFileSync(join(outDir, output.name === entry.dataFile ? `${output.name}.raw.json` : output.name), got.buf);
    // Production accepts a near name; the contract names the files exactly.
    if (got && got.name !== output.name) problems.push(`${output.name}: written as ${JSON.stringify(got.name)} (production still takes it; the contract name is ${output.name})`);
  }
  if (result) {
    for (const out of result.outputs) writeFileSync(join(outDir, out.name), out.data);
    for (const w of result.warnings) {
      // A file of the wrong size or kind is the skill's mistake; the rest
      // (an input the sample lacks) is information.
      if (/ is \d+x\d+, not \d+x\d+$|isn't (a|valid)|could not be read/.test(w)) problems.push(w);
      else log(`warning: ${w}`);
    }
    if (typeof spec.smokeCheck === 'function') {
      try {
        problems.push(...(spec.smokeCheck(result.raw, result.data, result.outputs) || []).map(String));
      } catch (err) {
        problems.push(`smokeCheck failed: ${err?.message || err}`);
      }
    }
    for (const n of result.notes) log(`note: ${n}`);
  }
  const summary = (last?.content || []).filter((b) => b?.type === 'text').map((b) => b.text).join('\n').trim();
  if (summary) {
    log('');
    log('Claude said:');
    log(summary.length > 1200 ? `${summary.slice(0, 1200)}...` : summary);
  }

  log('');
  if (problems.length) {
    log(`Result: ${problems.length} problem(s)`);
    for (const problem of problems) log(`  - ${problem}`);
  } else {
    log(`Result: OK (every required file, the right types and sizes, ${entry.dataFile} accepted by the sanitizer)`);
  }
  log(`Files saved in ${outDir}`);
  return problems.length ? 1 : 0;
}

// ─── CLI entry ───────────────────────────────────────────────────────

/**
 * Runs the smoke test. Returns the exit code. Everything it touches is
 * injectable, so the tests run it with a fake client and no key.
 *   --skill brand (default)  the brand skill, as before
 *   --skill <kit key>        one Launch Kit skill (src/lib/launchKit.js)
 *   --skill all              the dry run of every Launch Kit skill (never spends)
 */
export async function main(argv = process.argv.slice(2), {
  env = process.env,
  createClient = loadSdk,
  runner = loadRunner,
  kitRunner = loadKitRunner,
  log: rawLog = console.log,
  now = Date.now,
} = {}) {
  const log = (line = '') => rawLog(printable(line));
  const args = parseArgs(argv);
  if (args.errors.length) {
    for (const error of args.errors) log(error);
    log(USAGE);
    return 2;
  }
  const which = args.values['--skill'] || 'brand';
  if (which === 'brand') return brandMain(args, { env, createClient, runner, log, now });
  if (which === 'all') {
    if (args.flags.has('--yes-spend')) {
      log('--skill all only checks (no requests). Spend on one skill at a time: --skill <key> --yes-spend.');
      return 2;
    }
    return kitDryAll({ kitRunner, log, now });
  }
  if (!isKitKey(which)) {
    log(`Unknown skill "${which}". One of: brand, ${KIT_KEYS.join(', ')}, all.`);
    log(USAGE);
    return 2;
  }
  return kitMain(which, args, { env, createClient, kitRunner, log, now });
}

// Run as a command, not when a test imports it. Real paths on both sides:
// argv[1] is the path as typed, which can go through a symlink (macOS /tmp
// is /private/tmp) while import.meta.url is already resolved, and a
// mismatch would exit 0, which reads as "valid", having run nothing.
const isMain = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  main().then((code) => { process.exitCode = code; });
}
