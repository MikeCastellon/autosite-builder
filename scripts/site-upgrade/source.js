// Which code this checkout is: publish only runs from a mirror of one
// commit (made by mirror.sh: `git archive <commit>` plus SOURCE_COMMIT and
// SOURCE_TREE, the commit's `git ls-tree -r` listing), checked file by file
// here. A copy of the shared working tree carries other sessions'
// uncommitted template edits, and would publish a design the production
// editor does not have.
//   - every file SOURCE_TREE lists under the checked paths is here, with
//     the same git blob hash (byte for byte: line endings count, as the
//     deployed build uses the committed bytes)
//   - no other file is under those folders (node_modules, macOS ._* and
//     .DS_Store files aside)
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs';
import path from 'node:path';

// What the pages are built from (src, public), the tool and the shared
// function code it runs (scripts, netlify), and the build setup the
// production guard repeats.
export const CHECKED_DIRS = ['src', 'public', 'scripts', 'netlify'];
export const CHECKED_FILES = ['package.json', 'package-lock.json', 'vite.config.js', 'index.html'];

const IGNORED = (name) => name === 'node_modules' || name === '.DS_Store' || name.startsWith('._');

// git's object id of a file's bytes.
export function gitBlobHash(buf) {
  return createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

function parseTree(text) {
  const out = new Map();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const m = /^(\d{6}) (\w+) ([0-9a-f]{40})\t(.+)$/.exec(line);
    if (!m) throw new Error(`SOURCE_TREE has a line that is not git ls-tree output: ${line.slice(0, 80)}`);
    if (m[2] === 'blob') out.set(m[4], { mode: m[1], hash: m[3] });
  }
  return out;
}

function walk(root, rel, out) {
  const dir = path.join(root, rel);
  for (const name of readdirSync(dir)) {
    if (IGNORED(name)) continue;
    const r = rel ? `${rel}/${name}` : name;
    const st = lstatSync(path.join(root, r));
    if (st.isDirectory()) walk(root, r, out);
    else out.push(r);
  }
  return out;
}

const checked = (p) => CHECKED_FILES.includes(p) || CHECKED_DIRS.some((d) => p.startsWith(`${d}/`));

// { pinned, commit, files, problems: [..] }. `pinned` is true only for an
// exact copy of SOURCE_COMMIT under the checked paths.
export function sourceState(root) {
  const commitFile = path.join(root, 'SOURCE_COMMIT');
  const treeFile = path.join(root, 'SOURCE_TREE');
  if (!existsSync(commitFile) || !existsSync(treeFile)) {
    return { pinned: false, commit: null, files: 0, problems: ['not a mirror of one commit (no SOURCE_COMMIT / SOURCE_TREE): make one with scripts/site-upgrade/mirror.sh'] };
  }
  const commit = readFileSync(commitFile, 'utf8').trim();
  if (!/^[0-9a-f]{40}$/.test(commit)) return { pinned: false, commit: null, files: 0, problems: ['SOURCE_COMMIT does not hold a full commit id'] };
  let tree;
  try {
    tree = parseTree(readFileSync(treeFile, 'utf8'));
  } catch (e) {
    return { pinned: false, commit, files: 0, problems: [e.message] };
  }
  const problems = [];
  let files = 0;
  for (const [p, { mode, hash }] of tree) {
    if (!checked(p) || p.split('/').some(IGNORED)) continue;
    files += 1;
    const abs = path.join(root, p);
    let buf;
    try {
      const st = lstatSync(abs);
      // git stores a symlink as its target's text.
      buf = mode === '120000' && st.isSymbolicLink() ? Buffer.from(readlinkSync(abs)) : readFileSync(abs);
    } catch {
      problems.push(`missing ${p}`);
      continue;
    }
    if (gitBlobHash(buf) !== hash) problems.push(`changed ${p}`);
  }
  for (const d of CHECKED_DIRS) {
    if (!existsSync(path.join(root, d))) continue;
    for (const p of walk(root, d, [])) {
      if (!tree.has(p)) problems.push(`not in the commit ${p}`);
    }
  }
  return { pinned: problems.length === 0, commit, files, problems };
}

// A short line for the logs.
export function sourceLine(s) {
  if (s.pinned) return `Source: commit ${s.commit} (mirror checked: ${s.files} files match it)`;
  const more = s.problems.length > 3 ? ` (+${s.problems.length - 3} more)` : '';
  return `Source: NOT a mirror of one commit${s.commit ? ` (SOURCE_COMMIT ${s.commit})` : ''}: ${s.problems.slice(0, 3).join('; ')}${more}`;
}
