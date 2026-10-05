# skills/

Agent Skills that Genius Websites runs through the **Claude API** (the paid "Custom websites" pipeline).

| Folder | What it is | Who loads it |
|---|---|---|
| `skills/api/<name>/` | An API skill: a folder with `SKILL.md` (+ scripts, assets) uploaded to Anthropic with `POST /v1/skills` | Claude, inside Anthropic's code-execution container, when a Messages request lists it in `container.skills` |
| `.claude/skills/<name>/` | Claude Code project skills (how to work on this repo, e.g. `skills-release`) | Claude Code sessions in this repo; never uploaded |

Nothing in `skills/api/` runs on Netlify or in the browser. The runtime only sends the skill's **id and pinned version**,
which come from environment variables.

## Skills

| Skill | What it does | Env vars (Netlify) | Used by |
|---|---|---|---|
| `launch-brand-system` | Turns the customer's logo, brand files, reference screenshots and style answers into a brand system: `brand.json` (5 color roles + light/dark alternates, a heading/body pair from `FONT_CATALOG`, reasons, logo reading, notes) and `brand_board.png` (1600x1000 board) | `CUSTOM_SITE_BRAND_SKILL_ID`, `CUSTOM_SITE_BRAND_SKILL_VERSION` | The brand runner, which stores the result in `custom_site_projects.design.brand` (validated by `src/lib/brandSpec.js`) |

Without the `_ID` variable the feature reports "not set up"; it does not fail.

## The container a skill runs in

- Python 3.11 with Pillow, numpy, scikit-learn, matplotlib, reportlab and pypdf. **No internet, no browser, no
  `pip install`.** Anything else (fonts, data) has to ship inside the skill folder.
- Input files arrive through the Files API as `container_upload` blocks. Only files written at the **top level of
  `$OUTPUT_DIR`** come back (as file ids the caller downloads).
- Long runs stop with `stop_reason: "pause_turn"`; the caller resends in the same container (`container.id`).

## Rules for a skill folder

`npm run skills:release -- <name> --dry-run` checks all of these:

- `SKILL.md` at the top of the folder, starting with YAML frontmatter:
  - `name`: at most 64 characters, lowercase letters, digits and hyphens, without the words "claude" or
    "anthropic", and equal to the folder name. It becomes the skill's permanent slug: never rename it.
  - `description`: 1 to 1024 characters, no XML tags. Say what the skill does and when to use it.
- Under 30 MB in total (uncompressed).
- No hidden files (`.env`, `.git`), no macOS `._*` / `.DS_Store` files, no `__pycache__` / `.pyc`, no symbolic
  links, no key or certificate files.
- No secrets: known token shapes (Anthropic, Stripe, AWS, GitHub, Google, Slack, Netlify, JWTs such as a Supabase
  service-role key, private keys) and the value of any `*KEY*`, `*SECRET*`, `*TOKEN*` or `*PASSWORD*` variable in
  your shell.
- Keep the `SKILL.md` body under about 500 lines; put detail in files it links to.
- Call scripts as `python3 scripts/x.py`. Files from the SSD copy have CRLF line endings, so a shebang line breaks
  in the container (the dry run warns).
- **No customer data.** A skill is visible to everyone with an API key for the workspace, and every version is kept.

## Releasing (the owner runs the upload)

Run in the mirror copy (the upload needs `netlify/functions/node_modules`; never `npm install` in the repo):

```sh
rsync -a --exclude .git --exclude "._*" --exclude node_modules --exclude .netlify "<repo>/" "<mirror>/"
cd <mirror>

# 1. Check and list the files. No network, no key.
npm run skills:release -- launch-brand-system --dry-run

# 2. Upload. Use a key from the SAME workspace as the production key on Netlify:
#    custom skills belong to one workspace, and other workspaces can't load them.
export ANTHROPIC_API_KEY=...            # your key; it is never printed or read from a file
npm run skills:release -- launch-brand-system                          # first release: creates the skill
npm run skills:release -- launch-brand-system --skill-id skill_...     # later releases: a new version
```

The first release refuses if the workspace already has a custom skill with that name (pass `--skill-id` for a new
version, or `--new` for a second, separate skill). When `CUSTOM_SITE_BRAND_SKILL_ID` is set in your shell, it is
used as `--skill-id`. Uploads are not retried, because a retried create can leave a duplicate.

The script prints the `skill_id`, the new version id (`skver_...`) and the exact lines to set:

```
CUSTOM_SITE_BRAND_SKILL_ID=skill_...
CUSTOM_SITE_BRAND_SKILL_VERSION=skver_...
```

Every upload is a full snapshot: files you leave out are not carried over from the previous version.

## Smoke test (one paid run)

Before pointing production at a new version, run it once on a sample logo (drawn by the script, so no binary sits
in the repo):

```sh
npm run skills:smoke                     # prints the plan and the cost ceiling, sends nothing
CUSTOM_SITE_BRAND_SKILL_ID=skill_... CUSTOM_SITE_BRAND_SKILL_VERSION=skver_... \
  npm run skills:smoke -- --yes-spend    # the real run
```

It runs the **production code**, the Studio's "Build brand system" path: `buildBrand`
(`netlify/functions/custom-site-brand-background.js`) calls `runSkillRequest`, then `sanitizeBrand`. The request
therefore matches production: same model and effort, refusal fallback, `pause_turn` resumes in the same
container, turn cap, and the 11-minute budget. Only the project is a stand-in: one sample logo plus a few intake
answers, served from memory. Nothing touches the database or the bucket.

The run writes `brand.json`, `brand_board.png`, the sample logo and `transcript.json` to
`/tmp/skills-smoke-<time>/`. It then checks the raw `brand.json` strictly. Every contract field must be present,
the four 4.5:1 pairs must pass as `brandContrast` measures them, the fonts must be catalog families, and the board
must be 1600x1000. Anything `sanitizeBrand` would have to repair or drop also counts as a failure, because the
server's repair is a safety net, not the plan. Finally it prints the token usage and the estimated cost at Opus 5.5
prices ($4/M input, $20/M output; container time is billed separately).

Exit code 0 means valid; 1 invalid, failed, or unable to start (no key, no SDK); 2 nothing sent on purpose (no
`--yes-spend`, skill not set up, bad arguments). Like production, the run deletes its Files API
uploads and outputs (`--keep-files` keeps the outputs). Other options: `--version latest`, `--skill-id`,
`--out DIR`.

## Pinning, env vars and rollback

| Variable | Value | Where |
|---|---|---|
| `CUSTOM_SITE_BRAND_SKILL_ID` | `skill_...` from the first release | Netlify > Site configuration > Environment variables |
| `CUSTOM_SITE_BRAND_SKILL_VERSION` | the exact `skver_...` that passed the smoke test, **never `latest`** | same |
| `ANTHROPIC_API_KEY` | already set for the other AI features; must be the workspace the skill was uploaded to | same |

- Without `_ID` the feature reports "not set up". Without a valid `_VERSION`, the functions run the newest
  version, so every upload would go live untested: always set it.
- Redeploy after changing them, so the functions read the new values (`netlify env:set NAME value` works too).
- To roll back, set `CUSTOM_SITE_BRAND_SKILL_VERSION` back to the previous version id and redeploy. Keep old
  versions until the new one has run in production.

## Data retention

A skill runs through code execution, which is **not covered by zero data retention (ZDR)**: Anthropic keeps that
request data for **up to 30 days**, including the customer uploads the brand runner puts in the container. Uploaded
skills and Files API files are stored until someone deletes them, so anything that uploads should delete its files
after use (`runSkillRequest` / `buildBrand` and the smoke test do). Custom skills can be read by every API key in
the workspace.
