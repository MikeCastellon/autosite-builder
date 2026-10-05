---
name: skills-release
description: Release or update a Claude API Agent Skill kept in skills/api/ (such as launch-brand-system) safely. Covers the dry run, the owner-run upload, pinning the version in Netlify env, the paid smoke test and rollback. Use when editing anything under skills/api/, when asked to release, publish, upload or update a skill, or when CUSTOM_SITE_*_SKILL_ID / _VERSION come up.
---

# Releasing an API skill

`skills/api/<name>/` holds skills that run in Anthropic's code-execution container through the Messages API.
Read `skills/README.md` first: it covers the container's limits, the folder rules, the env vars and data retention.

## Who does what

| Step | Who | Command (in the mirror copy) |
|---|---|---|
| Edit the skill, keep the contract | Claude | edit in the repo, then rsync to the mirror |
| Validate + list files | Claude may run it (no network, no key) | `npm run skills:release -- <name> --dry-run` |
| Upload a new version | **Owner only**, with their own key | `npm run skills:release -- <name> [--skill-id skill_...]` |
| Smoke-test that version | **Owner only**: it is a paid run | `npm run skills:smoke -- --yes-spend` (+ the id/version env) |
| Pin it on Netlify + redeploy | **Owner**, or Claude with explicit approval for that exact change | set `<PREFIX>_ID` / `<PREFIX>_VERSION` |

Never run `skills:release` without `--dry-run` and never run `skills:smoke --yes-spend` yourself, even when a key is
in the environment. Never ask for, print, store or paste an API key. Hand the owner the exact commands instead.

## Procedure

1. **Keep the contract.** For `launch-brand-system`, `brand.json` and `brand_board.png` are defined by
   `src/lib/brandSpec.js`: `BRAND_SCHEMA`, `sanitizeBrand`, `brandContrast` and `buildBrandPrompt`, which tells the
   skill what to write. The smoke test runs that same code, plus a strict field check in `brandCheck`
   (`scripts/skills-smoke.mjs`). A shape change goes in the skill, `brandSpec.js` and `brandCheck` together.
   Palettes must hold 4.5:1 for text/bg, muted/bg, button text/accent and text/secondary after `deriveTheme`'s
   repair (`src/components/preview/templates/kit/theme.js`). Fonts come only from `FONT_CATALOG`.
2. **Container facts.** Python 3.11 with Pillow, numpy, scikit-learn, matplotlib, reportlab and pypdf. No internet
   and no installs, so ship fonts and data in the folder. Only files at the top level of `$OUTPUT_DIR` come back.
   The SSD working copy stores text with CRLF line endings (see CLAUDE.md), and the upload sends files byte for
   byte. So `SKILL.md` must call scripts as `python3 scripts/x.py` and never rely on a shebang: Linux looks for
   `python3\r` and finds nothing. The dry run warns about such files.
3. **Never rename** the frontmatter `name`: it is the skill's permanent slug and must equal the folder name. Keep the
   `description` under 1024 characters and saying when to use the skill. No secrets and no customer data in the
   folder: every version is kept, and every key in the workspace can read it.
4. **Dry run** in the mirror and fix every problem it lists. Warnings are judgment calls; problems block.
   ```sh
   rsync -a --exclude .git --exclude "._*" --exclude node_modules --exclude .netlify "<repo>/" "<mirror>/"
   cd <mirror> && npm run skills:release -- launch-brand-system --dry-run
   ```
   Run the repo's tests too (`npx vitest run`), since the runner and `brandSpec.js` have their own.
5. **Owner uploads.** Give them the command with `--skill-id` when the skill already exists (it is
   `CUSTOM_SITE_BRAND_SKILL_ID` on Netlify). The key must belong to the same workspace as the production key.
   The script prints the new `skver_...` id and the env lines.
6. **Owner smoke-tests the new version** before production uses it:
   `CUSTOM_SITE_BRAND_SKILL_ID=skill_... CUSTOM_SITE_BRAND_SKILL_VERSION=skver_... npm run skills:smoke -- --yes-spend`.
   Exit 0 means the outputs are valid. On exit 1, read the printed problems and
   `/tmp/skills-smoke-*/transcript.json` (code runs, stderr), fix, and go back to step 4. A failed version just
   stays unpinned.
7. **Pin the exact version** on Netlify (`CUSTOM_SITE_BRAND_SKILL_VERSION=skver_...`, never `latest`) and redeploy.
   Pinning means a new upload can't change live behavior by accident.
8. **Rollback** means setting `_VERSION` back to the previous id and redeploying. Don't delete skills or versions:
   deletion is permanent, and a pinned version may still be in use. Leave cleanup to the owner.

## Adding a new API skill

- Create `skills/api/<new-name>/SKILL.md` and add `'<new-name>': '<ENV_PREFIX>'` to `SKILL_ENV` in
  `scripts/skills-release.mjs`, so the release prints the right env lines.
- The runtime reads `<ENV_PREFIX>_ID` / `_VERSION`, and when they are missing it reports "not set up" instead of
  failing.
- Add a row to the Skills table in `skills/README.md`. A request can load at most 20 skills.
