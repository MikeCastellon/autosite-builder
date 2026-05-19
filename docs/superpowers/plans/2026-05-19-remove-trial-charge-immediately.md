# Remove 30-Day Trial — Charge Immediately Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop offering a 30-day free trial on the Pro subscription. New signups are charged $19.99 immediately at Stripe Checkout. Existing trialing subscriptions are honored.

**Architecture:** Single-line backend change to remove `trial_period_days: 30` from the Stripe Checkout session config. Marketing copy updates across three React components to remove trial framing in favor of `Cancel anytime` reassurance. No DB migration, no env vars, no test changes — the `trialing` status code path stays in place to keep legacy trials working.

**Tech Stack:** Netlify Functions (Node.js), Stripe Node SDK, React 19, Vite, Vitest, ESLint, Tailwind CSS.

**Spec:** [docs/superpowers/specs/2026-05-19-remove-trial-charge-immediately-design.md](../specs/2026-05-19-remove-trial-charge-immediately-design.md)

---

## Notes for the Engineer

- This project is on **Windows + PowerShell**. Use PowerShell syntax for any commands you run (`$env:VAR`, no `&&`, etc.). Bash is also available via Git Bash if you prefer.
- **All git commands** stay on the current branch (a worktree branch). At the end we merge to `master` and push directly — no PR (project preference).
- **No new unit tests are needed.** The only behavioral change to logic is removing one field from a Stripe API call. The status-map and event-handler tests (`tests/functions/stripe-status-map.test.js`, `tests/functions/stripe-event-handlers.test.js`) cover the `trialing` path, which we are keeping. They must continue to pass after this change — that is your verification.
- **Manual smoke test in Task 6** is the actual functional verification for the backend change. It uses Stripe test mode.
- **Don't touch:**
  - `netlify/functions/_lib/stripe-status-map.js` — keeps `trialing → active` mapping for legacy trials
  - `netlify/functions/_lib/stripe-event-handlers.js`
  - `db/migrations/20260424_stripe_subscriptions.sql`
  - `src/components/admin/AdminUserDrawer.jsx` — admin trial-end display stays for legacy data
  - Any test file

---

## File Inventory

| File | Action | Responsibility |
|------|--------|----------------|
| `netlify/functions/stripe-checkout-url.js` | Modify | Remove `trial_period_days: 30` |
| `src/components/LandingPage.jsx` | Modify | Update pricing card badge + CTA button copy |
| `src/components/ui/UpgradeProPanel.jsx` | Modify | Update CTA button + subtext copy |
| `src/components/dashboard/UpgradeFunnel.jsx` | Modify | Update 2 CTA buttons + 2 subtext lines + remove 1 reassurance line + spacing tweak |

---

## Task 1: Remove trial_period_days from Stripe Checkout session

**Files:**
- Modify: `netlify/functions/stripe-checkout-url.js:50-53`

- [ ] **Step 1: Make the edit**

Open `netlify/functions/stripe-checkout-url.js` and locate the `subscription_data` object passed to `stripe.checkout.sessions.create(...)`. It currently looks like:

```js
    subscription_data: {
      trial_period_days: 30,
      metadata: { supabase_user_id: user.id },
    },
```

Remove the `trial_period_days: 30,` line so it becomes:

```js
    subscription_data: {
      metadata: { supabase_user_id: user.id },
    },
```

Nothing else in this file should change. Do **not** alter the `customer`, `client_reference_id`, `line_items`, `payment_method_collection`, `allow_promotion_codes`, `success_url`, or `cancel_url` fields.

- [ ] **Step 2: Run the existing function-level tests**

Run from project root:

```powershell
npm test
```

Expected: all tests pass, including everything in `tests/functions/stripe-status-map.test.js` and `tests/functions/stripe-event-handlers.test.js`. If anything fails, stop and investigate — we did not intend to break any test. The `trialing` code path is preserved by design.

- [ ] **Step 3: Run the linter**

```powershell
npm run lint
```

Expected: no new errors. (Pre-existing warnings in unrelated files are fine — only fail if you introduced one.)

- [ ] **Step 4: Commit**

```powershell
git add netlify/functions/stripe-checkout-url.js
git commit -m "feat(billing): remove 30-day trial from new Stripe Checkout sessions

New subscriptions are now charged immediately on Checkout completion.
Existing trialing subscriptions in Stripe are honored — they continue
until their original trial end date.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Update LandingPage copy

**Files:**
- Modify: `src/components/LandingPage.jsx` (around lines 331 and 367)

- [ ] **Step 1: Update the pricing-card badge**

Locate the badge inside the pricing card header. Current code (around line 331):

```jsx
                <div className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 mt-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.5l2.78 6.42 6.97.5-5.27 4.6 1.6 6.81L12 16.5l-6.08 3.33 1.6-6.81L2.25 8.42l6.97-.5L12 1.5z"/></svg>
                  <span className="text-[12px] font-bold">30 days free — no charge today</span>
                </div>
```

Change the inner `<span>` text. New code:

```jsx
                <div className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 mt-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.5l2.78 6.42 6.97.5-5.27 4.6 1.6 6.81L12 16.5l-6.08 3.33 1.6-6.81L2.25 8.42l6.97-.5L12 1.5z"/></svg>
                  <span className="text-[12px] font-bold">Cancel anytime — no contract</span>
                </div>
```

(Only the `<span>` text changes. The wrapping `<div>` classes and the `<svg>` stay identical.)

- [ ] **Step 2: Update the pricing-card CTA button**

Locate the CTA button inside the pricing card. Current code (around line 367):

```jsx
              <button
                type="button"
                onClick={onStart}
                className="block w-full py-4 rounded-xl bg-[#cc0000] hover:bg-[#aa0000] text-white text-center font-bold text-[15px] transition-colors shadow-sm"
              >
                ⭐ Start 30-Day Free Trial
              </button>
```

Change the button text only:

```jsx
              <button
                type="button"
                onClick={onStart}
                className="block w-full py-4 rounded-xl bg-[#cc0000] hover:bg-[#aa0000] text-white text-center font-bold text-[15px] transition-colors shadow-sm"
              >
                ⭐ Upgrade to Pro — $19.99/month
              </button>
```

The subtext immediately below (`Create your free account · then activate Pro inside the dashboard · cancel anytime.`) stays unchanged.

- [ ] **Step 3: Verify no other trial mentions remain in this file**

Run from project root:

```powershell
Select-String -Path "src\components\LandingPage.jsx" -Pattern "trial|30.day|30 day" -CaseSensitive:$false
```

Expected: no output (zero matches). If anything matches, read the context and update it according to the same `Cancel anytime` / `Upgrade to Pro` framing — but check with a human first because the spec only enumerated lines 331 and 367.

- [ ] **Step 4: Run the linter**

```powershell
npm run lint
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```powershell
git add src/components/LandingPage.jsx
git commit -m "feat(landing): replace trial copy with 'Upgrade to Pro' on pricing card

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Update UpgradeProPanel copy

**Files:**
- Modify: `src/components/ui/UpgradeProPanel.jsx` (around lines 103 and 106)

- [ ] **Step 1: Update the CTA button text**

Locate the upgrade button inside `UpgradeProPanel`. Current code (around line 97-108):

```jsx
        <button
          type="button"
          onClick={handleUpgrade}
          disabled={busy}
          className={`block w-full ${isLg ? 'py-3.5 text-[15px]' : 'py-3 text-[14px]'} px-6 rounded-xl bg-[#cc0000] hover:bg-[#aa0000] disabled:opacity-60 disabled:cursor-not-allowed text-white text-center font-semibold transition-colors shadow-sm`}
        >
          {busy ? 'Loading...' : '⭐ Start 30-Day Free Trial'}
        </button>
        <p className="text-[11px] text-[#888] text-center mt-2.5">
          30 days free · then $19.99/month · Cancel anytime.
        </p>
```

Change the busy-state ternary's success-text branch and the subtext `<p>`. New code:

```jsx
        <button
          type="button"
          onClick={handleUpgrade}
          disabled={busy}
          className={`block w-full ${isLg ? 'py-3.5 text-[15px]' : 'py-3 text-[14px]'} px-6 rounded-xl bg-[#cc0000] hover:bg-[#aa0000] disabled:opacity-60 disabled:cursor-not-allowed text-white text-center font-semibold transition-colors shadow-sm`}
        >
          {busy ? 'Loading...' : '⭐ Upgrade to Pro — $19.99/month'}
        </button>
        <p className="text-[11px] text-[#888] text-center mt-2.5">
          $19.99/month · Cancel anytime · No contract.
        </p>
```

Two text changes:
1. Button text: `⭐ Start 30-Day Free Trial` → `⭐ Upgrade to Pro — $19.99/month`
2. Subtext: `30 days free · then $19.99/month · Cancel anytime.` → `$19.99/month · Cancel anytime · No contract.`

The `Loading...` busy text stays — that's only visible mid-API-call and is unrelated to trial messaging.

- [ ] **Step 2: Verify no other trial mentions remain in this file**

```powershell
Select-String -Path "src\components\ui\UpgradeProPanel.jsx" -Pattern "trial|30.day|30 day" -CaseSensitive:$false
```

Expected: no output.

- [ ] **Step 3: Run the linter**

```powershell
npm run lint
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```powershell
git add src/components/ui/UpgradeProPanel.jsx
git commit -m "feat(upgrade-panel): replace trial copy with 'Upgrade to Pro'

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Update UpgradeFunnel copy

**Files:**
- Modify: `src/components/dashboard/UpgradeFunnel.jsx` (around lines 30, 240, 267, 269, 278)

This file has FIVE separate trial-related copy locations. Do them all in this one task because they're all in the same file and serve the same funnel.

- [ ] **Step 1: Update the small inline CTA button (CtaButton component)**

Locate the `CtaButton` component near the top of the file. Current code (around line 20-33):

```jsx
function CtaButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#cc0000] hover:bg-[#aa0000] text-white font-semibold text-[14px] transition-colors shadow-sm"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1.5l2.78 6.42 6.97.5-5.27 4.6 1.6 6.81L12 16.5l-6.08 3.33 1.6-6.81L2.25 8.42l6.97-.5L12 1.5z" />
      </svg>
      Start Free Trial
    </button>
  );
}
```

Change the text after the `</svg>` from `Start Free Trial` to `Upgrade — $19.99/mo`. New code:

```jsx
function CtaButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#cc0000] hover:bg-[#aa0000] text-white font-semibold text-[14px] transition-colors shadow-sm"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1.5l2.78 6.42 6.97.5-5.27 4.6 1.6 6.81L12 16.5l-6.08 3.33 1.6-6.81L2.25 8.42l6.97-.5L12 1.5z" />
      </svg>
      Upgrade — $19.99/mo
    </button>
  );
}
```

- [ ] **Step 2: Update the funnel intro subtext**

Locate the intro paragraph at the top of the funnel. Current code (around line 239-241):

```jsx
        <p className="text-[15px] text-[#666] mt-3 max-w-xl mx-auto">
          Scroll through the toolkit. Start free for 30 days — then $19.99/month. Cancel anytime.
        </p>
```

Change to:

```jsx
        <p className="text-[15px] text-[#666] mt-3 max-w-xl mx-auto">
          Scroll through the toolkit. $19.99/month — cancel anytime.
        </p>
```

- [ ] **Step 3: Update the closing CTA subtext AND remove the reassurance line below it (plus spacing fix)**

Locate the closing CTA block. Current code (around line 266-269):

```jsx
        <p className="text-[16px] opacity-90 mb-2 max-w-md mx-auto">
          Try everything free for 30 days — then $19.99/month. Cancel anytime.
        </p>
        <p className="text-[13px] opacity-70 mb-6">No charge today. No commitment.</p>
```

Replace both `<p>` tags with a single `<p>`. New code:

```jsx
        <p className="text-[16px] opacity-90 mb-6 max-w-md mx-auto">
          $19.99/month — cancel anytime, no contract.
        </p>
```

Three things happen here:
1. The first `<p>` text changes from `Try everything free for 30 days — then $19.99/month. Cancel anytime.` to `$19.99/month — cancel anytime, no contract.`
2. The second `<p>` (`No charge today. No commitment.`) is **deleted entirely**.
3. The remaining `<p>`'s `mb-2` changes to `mb-6` so the spacing before the button below it matches what the deleted line was providing.

- [ ] **Step 4: Update the closing CTA button text**

Locate the closing CTA button immediately below the paragraph you just edited. Current code (around line 270-279):

```jsx
        <button
          type="button"
          onClick={onUpgrade}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-[#cc0000] hover:bg-[#1a1a1a] hover:text-white font-bold text-[15px] transition-colors shadow-lg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1.5l2.78 6.42 6.97.5-5.27 4.6 1.6 6.81L12 16.5l-6.08 3.33 1.6-6.81L2.25 8.42l6.97-.5L12 1.5z" />
          </svg>
          Start Free Trial
        </button>
```

Change the text after the `</svg>` from `Start Free Trial` to `Upgrade to Pro — $19.99/month`. New code:

```jsx
        <button
          type="button"
          onClick={onUpgrade}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-[#cc0000] hover:bg-[#1a1a1a] hover:text-white font-bold text-[15px] transition-colors shadow-lg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1.5l2.78 6.42 6.97.5-5.27 4.6 1.6 6.81L12 16.5l-6.08 3.33 1.6-6.81L2.25 8.42l6.97-.5L12 1.5z" />
          </svg>
          Upgrade to Pro — $19.99/month
        </button>
```

- [ ] **Step 5: Verify no other trial mentions remain in this file**

```powershell
Select-String -Path "src\components\dashboard\UpgradeFunnel.jsx" -Pattern "trial|30.day|30 day|free for|no charge" -CaseSensitive:$false
```

Expected: no output.

- [ ] **Step 6: Run the linter**

```powershell
npm run lint
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```powershell
git add src/components/dashboard/UpgradeFunnel.jsx
git commit -m "feat(upgrade-funnel): replace trial copy with 'Upgrade to Pro' framing

- Inline + closing CTA buttons now show price
- Funnel intro + closing subtext lead with price and 'cancel anytime'
- Remove 'No charge today' reassurance line (no longer accurate);
  bump remaining paragraph's margin from mb-2 to mb-6 to preserve
  vertical rhythm before the closing button

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Project-wide trial-copy sweep

This task catches any trial copy that wasn't enumerated in the spec — e.g. if a teammate added a banner or modal we missed.

**Files:** None to edit unless something is found.

- [ ] **Step 1: Search the whole `src/` tree for any remaining trial copy**

```powershell
Select-String -Path "src\**\*.jsx","src\**\*.js" -Pattern "30.day free|30-day free|free trial|Start Free Trial|no charge today" -CaseSensitive:$false
```

Expected matches (these are FINE to leave as-is):
- `src/components/dashboard/DashboardPage.jsx` lines around 20, 164, 212, 586 — these reference a **30-day cooldown timer for a banner**, NOT the subscription trial. Leave alone.
- `src/components/admin/AdminUserDrawer.jsx` lines around 248-249 — admin field showing `Trial ends` for legacy trial users. Per the spec, leave alone.

Unexpected matches (any other file): read the context. If it's user-facing CTA/marketing copy about the subscription trial, update it following the same `Upgrade to Pro` / `Cancel anytime` framing from earlier tasks. If you're not sure whether something counts, stop and ask.

- [ ] **Step 2: Run the full build to confirm nothing broke**

```powershell
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 3: Run tests one more time**

```powershell
npm test
```

Expected: all tests pass.

- [ ] **Step 4: If you edited anything in Step 1, commit it**

If you found and fixed unexpected matches:

```powershell
git add <whatever you changed>
git commit -m "feat(copy): clean up remaining trial references

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

If nothing else needed editing, skip this step.

---

## Task 6: Manual smoke test (REQUIRED — backend verification)

This is the only real functional verification for the backend change. You must do this before declaring the task complete.

**Pre-requisites:**
- Stripe is in test mode for the environment you're testing against
- You have a test account on the platform OR can create one through the normal signup flow
- Dev server can be started locally

- [ ] **Step 1: Start the dev server**

```powershell
npm run dev
```

Note the URL it prints (typically `http://localhost:5173`).

- [ ] **Step 2: As a non-Pro user, trigger the upgrade flow**

Either:
- Visit the landing page and click `⭐ Upgrade to Pro — $19.99/month`, OR
- Sign in to the dashboard as a non-Pro user, open the upgrade funnel/panel, and click any `Upgrade to Pro` button.

Expected: you're redirected to Stripe Checkout (`checkout.stripe.com/...`).

- [ ] **Step 3: Verify NO trial messaging in Stripe Checkout**

Look at the Stripe Checkout page. There should be:
- **NO** "30 days free" banner
- **NO** "Free trial" line on the order summary
- **NO** "$0.00 due today" — the order summary should show `$19.99` due today

If you see any trial messaging on the Stripe Checkout page, the backend change didn't deploy or didn't apply. Stop and investigate.

- [ ] **Step 4: Complete checkout with a Stripe test card**

Use `4242 4242 4242 4242` with any future expiry and any CVC. Click Pay.

Expected: redirected back to `/dashboard?stripe_success=1`. Card was charged $19.99 immediately.

- [ ] **Step 5: Verify the profile updated correctly**

In Supabase (or via the admin drawer for this user), check the `profiles` row for your test user:

- `subscription_status` = `active`
- `stripe_subscription_id` = a `sub_...` id
- `stripe_price_id` = the Pro monthly price id
- `subscription_current_period_end` = ~30 days from now
- `stripe_trial_ends_at` = **`null`** (this is the key field — confirms no trial was applied)

If `stripe_trial_ends_at` is set to a date, the trial removal didn't take effect.

- [ ] **Step 6: Confirm in Stripe Dashboard**

Open the Stripe Dashboard (test mode) → Customers → find your customer → open their subscription. Confirm:
- Status: `Active` (NOT `Trialing`)
- Next invoice: ~30 days from today (one month after the immediate charge)
- Trial end: `—` or empty

---

## Task 7: Merge to master and push

**Files:** None.

Per project preference, merge directly to master and push — no PR. You're working in a git worktree, which makes the master checkout a little awkward (master may already be checked out by the parent repo). The fast-forward push approach below avoids needing to switch branches.

- [ ] **Step 1: Confirm a clean working tree and a sane commit log**

```powershell
git status
git log --oneline origin/master..HEAD
```

Expected:
- `git status`: `nothing to commit, working tree clean`
- `git log`: 4–6 commits matching the work done in Tasks 1–5, plus the spec + plan commits from earlier.

- [ ] **Step 2: Make sure your branch is fast-forwardable onto origin/master**

```powershell
git fetch origin
git rebase origin/master
```

Expected: `Successfully rebased and updated`. If you get conflicts here, **stop** — someone pushed to master while you were working. Resolve conflicts carefully (almost certainly in the 4 files we touched, against whatever new changes landed). If resolution gets tricky, ask before continuing.

- [ ] **Step 3: Push your branch's commits to origin/master directly**

```powershell
git push origin HEAD:master
```

This pushes the current branch's commits onto master on origin — no merge commit, no need to checkout master locally. Since we just rebased, this should be a fast-forward.

Expected: push succeeds, output includes `<old-sha>..<new-sha>  HEAD -> master`. Netlify auto-deploys.

If the push is rejected (non-FF), it means master moved again between Step 2 and Step 3. Re-run Step 2 and Step 3.

- [ ] **Step 4: Update your local worktree branch reference**

```powershell
git fetch origin
```

This refreshes your local view so `git status` shows the worktree branch is no longer "ahead of master" (since master now contains all your commits).

- [ ] **Step 5: Smoke test in production after deploy**

Once Netlify finishes deploying (check the Netlify dashboard or wait ~2 minutes):

1. Visit the production landing page → confirm the new badge says `Cancel anytime — no contract` and the CTA says `⭐ Upgrade to Pro — $19.99/month`.
2. (Optional but recommended) If production Stripe is in **test mode**, repeat Task 6's checkout flow against production. If production is in **live mode**, **do not** run a real $19.99 charge. Instead just visually verify the landing page and dashboard panels.

---

## Done criteria

All of the following must be true before declaring this work complete:

- ✅ `netlify/functions/stripe-checkout-url.js` no longer contains `trial_period_days`
- ✅ All four UI files updated per Tasks 2–4
- ✅ `npm test` passes
- ✅ `npm run lint` passes with no new errors
- ✅ `npm run build` succeeds
- ✅ Manual Stripe-test-mode checkout creates a subscription with `status: active` and `trial_end: null`
- ✅ Production landing page shows the new copy after deploy
