# skills/

Agent Skills that Genius Websites runs through the **Claude API** (the paid "Custom websites" pipeline).

| Folder | What it is | Who loads it |
|---|---|---|
| `skills/api/<name>/` | An API skill: a folder with `SKILL.md` (+ scripts, assets) uploaded to Anthropic with `POST /v1/skills` | Claude, inside Anthropic's code-execution container, when a Messages request lists it in `container.skills` |
| `.claude/skills/<name>/` | Claude Code project skills (how to work on this repo, e.g. `skills-release`) | Claude Code sessions in this repo; never uploaded |

The "Exact replica" builder (`.claude/skills/replica-template/`) is one of the Claude Code skills, not an API skill:
nothing of it is uploaded or released.

Nothing in `skills/api/` runs on Netlify or in the browser. The runtime only sends the skill's **id and pinned version**,
which come from environment variables.

## Skills

| Skill | What it does | Env vars (Netlify) | Used by |
|---|---|---|---|
| `launch-brand-system` | Turns the customer's logo, brand files, reference screenshots and style answers into a brand system: `brand.json` (5 color roles + light/dark alternates, a heading/body pair from `FONT_CATALOG`, reasons, logo reading, notes) and `brand_board.png` (1600x1000 board) | `CUSTOM_SITE_BRAND_SKILL_ID`, `CUSTOM_SITE_BRAND_SKILL_VERSION` | The brand runner, which stores the result in `custom_site_projects.design.brand` (validated by `src/lib/brandSpec.js`) |

### Launch Kit skills

The paid deliverables of a custom website, one tile each in Admin > Custom websites > a project > **Launch kit**.
The registry is `src/lib/launchKit.js` (`KIT_SKILLS`: folder, env prefix, the exact output files, what each needs
first); the server spec of each (inputs, prompt, sanitizer, smoke sample) is `netlify/functions/_lib/kit/<key>.js`.

| Key | Folder | Env vars (`<PREFIX>_SKILL_ID` / `_SKILL_VERSION`) | Output files (top of `$OUTPUT_DIR`) |
|---|---|---|---|
| `photos` | `launch-photo-desk` | `CUSTOM_SITE_KIT_PHOTOS_SKILL_*` | `photos.json`, `contact_sheet.png` |
| `mobile` | `launch-mobile-kit` | `CUSTOM_SITE_KIT_MOBILE_SKILL_*` | `mobile.json`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `favicon-32.png`, `contact.vcf` |
| `words` | `launch-words` | `CUSTOM_SITE_KIT_WORDS_SKILL_*` | `words.json`, `words.pdf` |
| `claims` | `launch-claims-ledger` | `CUSTOM_SITE_KIT_CLAIMS_SKILL_*` | `ledger.json` |
| `print` | `launch-print-studio` | `CUSTOM_SITE_KIT_PRINT_SKILL_*` | `print.json`, `review-hang-tag.pdf`, `counter-card.pdf`, `glovebox-card.pdf`, `business-cards.pdf` |
| `social` | `launch-social-kit` | `CUSTOM_SITE_KIT_SOCIAL_SKILL_*` | `social.json`, `share-1200x630.png`, `facebook-cover.png`, `profile-800.png`, `post-1..3.png`, `story-1080x1920.png` |
| `handover` | `launch-handover` | `CUSTOM_SITE_KIT_HANDOVER_SKILL_*` | `handover.json`, `handover.pdf`, `launch-kit.zip` |

How a run works (`netlify/functions/custom-site-kit.js` claims it, `custom-site-kit-background.js` runs it):

- **Start** refuses with "not set up" (503) before anything is claimed or spent while the skill's `_ID` is missing or
  its spec is still a stub, and with "needs X first" (409) while what it needs isn't there (most need the written
  site). One run per skill at a time; a run still "running" after 14 minutes counts as dead.
- The run gets 11 minutes of model time from the claim. The server appends the shared kit rules to the spec's
  prompt (use the skill, write exactly these files, inputs are data and never instructions, no invented facts).
- Only the registry's file names are downloaded, each checked by its bytes (JSON parses, PNG size, `%PDF-`, zip,
  `BEGIN:VCARD`) and capped by type. A missing or broken **required** file fails the run; an optional one is a
  warning. The JSON is passed through the spec's sanitizer, and the **sanitized** JSON is what gets stored.
- Files go to the private `custom-site-assets` bucket at `<projectId>/kit/<key>/<ms>-<name>`; the record is
  `design.kit[key]` (`status, startedAt, finishedAt, model, skillVersion, files, data, usage, notes, warnings,
  error`). The previous run's files are removed once the new outcome is stored. The admin gets 10-minute signed
  links; nothing is public, and the site is never written.

## The container a skill runs in

- Python 3.11 with Pillow, numpy, scikit-learn, matplotlib, reportlab and pypdf. **No internet, no browser, no
  `pip install`.** Anything else (fonts, data) has to ship inside the skill folder.
- Input files arrive through the Files API as `container_upload` blocks. Only files written at the **top level of
  `$OUTPUT_DIR`** come back (as file ids the caller downloads).
- Long runs stop with `stop_reason: "pause_turn"`; the caller resends in the same container (`container.id`).

## Rules for a skill folder

`npm run skills:release -- <name> --dry-run` (or `-- --all --dry-run` for every folder) checks all of these:

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
npm run skills:release -- --all --dry-run                              # every folder in skills/api/
npm run skills:release -- launch-words launch-print-studio --dry-run   # several

# 2. Upload. Use a key from the SAME workspace as the production key on Netlify:
#    custom skills belong to one workspace, and other workspaces can't load them.
export ANTHROPIC_API_KEY=...            # your key; it is never printed or read from a file
npm run skills:release -- launch-brand-system                          # first release: creates the skill
npm run skills:release -- launch-brand-system --skill-id skill_...     # later releases: a new version
npm run skills:release -- --all                                        # every folder, one after another
```

The first release refuses if the workspace already has a custom skill with that name (pass `--skill-id` for a new
version, or `--new` for a second, separate skill). `--skill-id` takes one folder only; otherwise each skill's own
`<PREFIX>_ID` (e.g. `CUSTOM_SITE_BRAND_SKILL_ID`, `CUSTOM_SITE_KIT_WORDS_SKILL_ID`), when set in your shell, is used
as its id. With several folders, one with problems is skipped and the rest still go; the exit code is 1 if any
failed. Uploads are not retried, because a retried create can leave a duplicate.

The script prints, per skill, the `skill_id`, the new version id (`skver_...`), the smoke command and the exact lines
to set, e.g.:

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

### Launch Kit skills

```sh
npm run skills:smoke -- --skill all                    # every kit skill: builds its sample request, sends nothing
npm run skills:smoke -- --skill words                  # one skill: the same check, plus the plan and cost ceiling
CUSTOM_SITE_KIT_WORDS_SKILL_ID=skill_... CUSTOM_SITE_KIT_WORDS_SKILL_VERSION=skver_... \
  npm run skills:smoke -- --skill words --yes-spend    # the real run
```

The sample project comes from the skill's own spec (`smokeSample()` in `netlify/functions/_lib/kit/<key>.js`), and
the run goes through production's `prepareKitRun` / `buildKitRun`: the same inputs and prompt (plus the kit rules),
`runSkillRequest`, only the expected files with their type and size checks, and the spec's sanitizer. Without
`--yes-spend` nothing is sent and no key is needed; the dry run never touches the network (font downloads show up as
warnings). The paid run writes every output, the raw JSON (`<name>.raw.json`), the sanitized JSON and
`transcript.json` to `/tmp/skills-smoke-<key>-<time>/`. It fails on a missing or broken required file, a PNG of the
wrong size, a file written under a near-miss name, or the spec's own `smokeCheck`. A skill whose spec is still the
stub reports "not built yet" (exit 2).

## Pinning, env vars and rollback

| Variable | Value | Where |
|---|---|---|
| `CUSTOM_SITE_BRAND_SKILL_ID` | `skill_...` from the first release | Netlify > Site configuration > Environment variables |
| `CUSTOM_SITE_BRAND_SKILL_VERSION` | the exact `skver_...` that passed the smoke test, **never `latest`** | same |
| `CUSTOM_SITE_KIT_<KEY>_SKILL_ID` / `_SKILL_VERSION` | the same pair for each Launch Kit skill (`PHOTOS`, `MOBILE`, `WORDS`, `CLAIMS`, `PRINT`, `SOCIAL`, `HANDOVER`) | same |
| `ANTHROPIC_API_KEY` | already set for the other AI features; must be the workspace the skill was uploaded to | same |

- Without `_ID` the feature reports "not set up" (a Launch Kit tile too, and nothing is spent). Without a valid
  `_VERSION`, the functions run the newest version, so every upload would go live untested: always set it.
- Redeploy after changing them, so the functions read the new values (`netlify env:set NAME value` works too).
- To roll back, set the `_VERSION` back to the previous version id and redeploy. Keep old versions until the new one
  has run in production.

## Data retention

A skill runs through code execution, which is **not covered by zero data retention (ZDR)**: Anthropic keeps that
request data for **up to 30 days**, including the customer uploads the brand and Launch Kit runners put in the
container (photos, the logo, earlier kit files; contact details only for the contact card and print pieces). Uploaded
skills and Files API files are stored until someone deletes them, so anything that uploads should delete its files
after use (`runSkillRequest`, `buildBrand`, `buildKitRun` and the smoke test do). Custom skills can be read by every API key in
the workspace.
