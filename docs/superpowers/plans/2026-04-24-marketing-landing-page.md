# Marketing Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public marketing landing page at `/` that unauthenticated visitors see before the login form.

**Architecture:** Single new `LandingPage.jsx` component rendered from `App.jsx` when there is no session. Landing page has Get Started / Sign In CTAs that switch a local `authView` state to `'login'`, revealing the existing `LoginPage`. `LoginPage` gets a back link returning to the landing view. Signed-in users, reset-password flow, and all other existing behavior are untouched.

**Tech Stack:** React 19, Vite, Tailwind CSS. No test framework is installed — verification is `npm run build`, `npm run lint`, and manual browser QA at `npm run dev`.

**Spec:** `docs/superpowers/specs/2026-04-24-marketing-landing-page-design.md`

**Conventions:**
- Hardcoded hex colors matching the rest of the codebase — `#faf9f7` cream background, `#1a1a1a` primary text, `#888` secondary text, `#cc0000` accent, `#aa0000` accent hover. Design-token extraction is out of scope (spec, "Out-of-scope but flagged").
- Rounded-xl for buttons/inputs, rounded-2xl for cards.
- User workflow is push-to-master with no PRs (user memory).
- Commit after each task.

---

## File Structure

**Create:**
- `src/components/landing/LandingPage.jsx` — full marketing page. Contains a private `FeatureSection` helper component used by the three split feature sections.

**Modify:**
- `src/App.jsx` — add `authView` state and render `LandingPage` instead of `LoginPage` by default for unauthenticated users.
- `src/components/auth/LoginPage.jsx` — add optional `onBack` prop and a small back link above the heading.

---

## Task 1: Scaffold `LandingPage` component and wire routing

**Files:**
- Create: `src/components/landing/LandingPage.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create the placeholder `LandingPage` component**

Create `src/components/landing/LandingPage.jsx`:

```jsx
export default function LandingPage({ onGetStarted }) {
  return (
    <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-3xl font-black text-[#1a1a1a]">Genius Websites</h1>
        <p className="text-[#888] mt-2">Landing page placeholder</p>
        <button
          onClick={onGetStarted}
          className="mt-6 px-6 py-3 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold text-sm transition-colors"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire `LandingPage` into `App.jsx`**

In `src/App.jsx`, add the import at the top near the other component imports:

```jsx
import LandingPage from './components/landing/LandingPage.jsx';
```

Add a new state near the other `useState` declarations inside `App()` (around the existing `view` state at line 31):

```jsx
const [authView, setAuthView] = useState('landing'); // 'landing' | 'login'
```

Replace the existing line:

```jsx
if (!session) return <LoginPage />;
```

with:

```jsx
if (!session) {
  if (authView === 'login') {
    return <LoginPage onBack={() => setAuthView('landing')} />;
  }
  return <LandingPage onGetStarted={() => setAuthView('login')} />;
}
```

- [ ] **Step 3: Verify build and lint**

Run:

```bash
npm run build
npm run lint
```

Expected: both complete without errors.

- [ ] **Step 4: Manual smoke test**

Run `npm run dev`, open `http://127.0.0.1:5190/` in a browser in an incognito/private window (no existing session).

Expected:
- Landing placeholder loads with "Genius Websites" headline and a "Get Started" button.
- Clicking "Get Started" switches to the existing login form.
- (Back link comes in Task 2 — for now LoginPage has no way back, which is expected.)

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/LandingPage.jsx src/App.jsx
git commit -m "feat(landing): scaffold LandingPage and wire unauth routing"
```

---

## Task 2: Add back link to `LoginPage`

**Files:**
- Modify: `src/components/auth/LoginPage.jsx`

- [ ] **Step 1: Accept `onBack` prop and render a back link**

In `src/components/auth/LoginPage.jsx`, change the function signature:

```jsx
export default function LoginPage({ onBack }) {
```

Inside the outer `<div className="w-full max-w-sm">`, above `<div className="mb-6">`, add:

```jsx
{onBack && (
  <button
    type="button"
    onClick={onBack}
    className="mb-4 text-xs text-[#888] hover:text-[#1a1a1a] transition-colors"
  >
    ← Back
  </button>
)}
```

- [ ] **Step 2: Manual smoke test**

Run `npm run dev`. From the landing placeholder, click Get Started, then click "← Back".

Expected:
- Back link appears at the top of the login form.
- Clicking it returns to the landing placeholder.

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/LoginPage.jsx
git commit -m "feat(auth): add back link on LoginPage"
```

---

## Task 3: Nav bar

**Files:**
- Modify: `src/components/landing/LandingPage.jsx`

- [ ] **Step 1: Replace the placeholder with a page shell + nav bar**

Replace the entire contents of `src/components/landing/LandingPage.jsx` with:

```jsx
export default function LandingPage({ onGetStarted }) {
  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#1a1a1a]">
      <Nav onGetStarted={onGetStarted} />
      {/* Sections added in later tasks */}
    </div>
  );
}

function Nav({ onGetStarted }) {
  return (
    <nav className="sticky top-0 z-40 bg-[#faf9f7]/90 backdrop-blur border-b border-black/5">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="font-black text-lg tracking-tight">Genius Websites</div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={onGetStarted}
            className="hidden sm:inline text-sm text-[#1a1a1a] hover:text-[#cc0000] transition-colors"
          >
            Sign in
          </button>
          <button
            onClick={onGetStarted}
            className="px-4 py-2 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold text-sm transition-colors"
          >
            Get Started
          </button>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Manual smoke test**

Run `npm run dev` and reload the landing page.

Expected:
- Sticky nav bar visible at top with "Genius Websites" on left and "Sign in" + "Get Started" on right.
- Clicking either button opens LoginPage.
- At screen widths < 640px, "Sign in" hides and only "Get Started" shows.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/LandingPage.jsx
git commit -m "feat(landing): nav bar"
```

---

## Task 4: Hero section

**Files:**
- Modify: `src/components/landing/LandingPage.jsx`

- [ ] **Step 1: Add `Hero` sub-component and mount it**

In `src/components/landing/LandingPage.jsx`, add the `Hero` component below `Nav`:

```jsx
function Hero({ onGetStarted }) {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        backgroundImage:
          'radial-gradient(circle at 85% 10%, rgba(204,0,0,0.08), transparent 55%)',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 text-center">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] max-w-4xl mx-auto">
          Free AI-built websites for auto shops —
          <br className="hidden md:block" />
          <span className="text-[#cc0000]">
            {' '}now with payments, booking &amp; a CRM
          </span>
        </h1>
        <p className="text-[#555] text-base md:text-lg mt-6 max-w-2xl mx-auto">
          Detailers, tint shops, wheel shops, mechanics &amp; mobile pros. Launch a site
          in minutes, take deposits, and manage customers — all in one place.
        </p>
        <div className="mt-8 flex items-center justify-center">
          <button
            onClick={onGetStarted}
            className="px-6 py-3.5 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold text-base transition-colors"
          >
            Build my site free
          </button>
        </div>
        <p className="text-[#888] text-xs mt-4">Free forever · No credit card required</p>
      </div>
    </section>
  );
}
```

Update the `LandingPage` return to include `<Hero />`:

```jsx
export default function LandingPage({ onGetStarted }) {
  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#1a1a1a]">
      <Nav onGetStarted={onGetStarted} />
      <Hero onGetStarted={onGetStarted} />
      {/* Sections added in later tasks */}
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke test**

Run `npm run dev` and reload.

Expected:
- Large headline, red accent on the second half.
- Subhead below.
- Primary CTA button; clicking opens LoginPage.
- Subtle red glow in top-right corner (radial gradient).
- At mobile widths the headline shrinks and wraps without a manual break.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/LandingPage.jsx
git commit -m "feat(landing): hero section"
```

---

## Task 5: Core product strip (4 feature tiles)

**Files:**
- Modify: `src/components/landing/LandingPage.jsx`

- [ ] **Step 1: Add `CoreStrip` sub-component and mount it**

Add below `Hero` in `src/components/landing/LandingPage.jsx`:

```jsx
function CoreStrip() {
  const tiles = [
    {
      title: 'AI site generation',
      body: 'Describe your shop. We generate your site in about 30 seconds.',
    },
    {
      title: '23 industry templates',
      body: 'Designs built for detailers, tint, wheels, mechanics, and car washes.',
    },
    {
      title: 'Custom domain',
      body: 'Bring your own, or connect one for free.',
    },
    {
      title: 'Google Reviews',
      body: 'Pull your 5-star reviews into any template.',
    },
  ];
  return (
    <section className="border-t border-b border-black/5 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {tiles.map((t) => (
          <div
            key={t.title}
            className="p-5 rounded-2xl border border-black/5 bg-[#faf9f7]"
          >
            <div className="font-black text-[#1a1a1a] text-base">{t.title}</div>
            <div className="text-sm text-[#555] mt-1">{t.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

Update the `LandingPage` return:

```jsx
<Nav onGetStarted={onGetStarted} />
<Hero onGetStarted={onGetStarted} />
<CoreStrip />
{/* Sections added in later tasks */}
```

- [ ] **Step 2: Manual smoke test**

Run `npm run dev` and reload.

Expected:
- 4 tiles visible in a row on desktop, 2×2 on tablet (≥640px), 1-up on mobile.
- White strip background, cream tiles.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/LandingPage.jsx
git commit -m "feat(landing): core product strip"
```

---

## Task 6: `FeatureSection` helper + Customer CRM section

**Files:**
- Modify: `src/components/landing/LandingPage.jsx`

- [ ] **Step 1: Add the reusable `FeatureSection` component**

Add below `CoreStrip` in `src/components/landing/LandingPage.jsx`:

```jsx
function FeatureSection({ eyebrow, title, lede, bullets, visual, reverse }) {
  return (
    <section className="border-b border-black/5">
      <div
        className={`max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 md:grid-cols-2 gap-10 items-center ${
          reverse ? 'md:[&>*:first-child]:order-2' : ''
        }`}
      >
        <div>
          {eyebrow && (
            <div className="text-xs font-bold tracking-widest uppercase text-[#cc0000] mb-3">
              {eyebrow}
            </div>
          )}
          <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">
            {title}
          </h2>
          <p className="text-[#555] text-base md:text-lg mt-4">{lede}</p>
          <ul className="mt-6 space-y-2">
            {bullets.map((b) => (
              <li key={b} className="flex gap-3 text-[#1a1a1a]">
                <span className="text-[#cc0000] font-bold">✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>{visual}</div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add the `CrmVisual` CSS mock**

Add below `FeatureSection`:

```jsx
function CrmVisual() {
  const rows = [
    { name: 'Marcus Reyes', note: 'VIP · Monthly detail', tag: 'VIP' },
    { name: 'Jordan Smith', note: 'Booked 3 times', tag: 'Repeat' },
    { name: 'Sam Okafor', note: 'Last: tint removal', tag: 'New' },
    { name: 'Lia Chen', note: 'No-show risk', tag: 'Flag' },
  ];
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="font-black">Customers</div>
        <div className="text-xs text-[#888]">248 total</div>
      </div>
      <div className="divide-y divide-black/5">
        {rows.map((r) => (
          <div key={r.name} className="py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm">{r.name}</div>
              <div className="text-xs text-[#888]">{r.note}</div>
            </div>
            <div className="text-[11px] px-2 py-1 rounded-full bg-[#faf0f0] text-[#cc0000] font-semibold">
              {r.tag}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Mount the CRM section**

Update the `LandingPage` return:

```jsx
<Nav onGetStarted={onGetStarted} />
<Hero onGetStarted={onGetStarted} />
<CoreStrip />
<FeatureSection
  eyebrow="Customer CRM"
  title="Your customers in one place"
  lede="Every booking becomes a customer record automatically. Add notes, tag your VIPs, and export whenever you need to."
  bullets={[
    'Booking history per customer',
    'Tags and notes, searchable across the list',
    'CSV export of your full customer list',
    'Email any customer from inside the app',
  ]}
  visual={<CrmVisual />}
/>
{/* Sections added in later tasks */}
```

- [ ] **Step 4: Manual smoke test**

Run `npm run dev` and reload.

Expected:
- New CRM section visible with red eyebrow "Customer CRM", big headline, lede, 4 checkmark bullets, and a customer-list mock on the right.
- On mobile, copy stacks above the visual.

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/LandingPage.jsx
git commit -m "feat(landing): Customer CRM section"
```

---

## Task 7: Stripe payments section

**Files:**
- Modify: `src/components/landing/LandingPage.jsx`

- [ ] **Step 1: Add the `StripeVisual` CSS mock**

Add below `CrmVisual` in `src/components/landing/LandingPage.jsx`:

```jsx
function StripeVisual() {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-[#888] font-semibold uppercase tracking-wider">
          Tap to Pay
        </div>
        <div className="text-xs font-bold" style={{ color: '#635bff' }}>
          Stripe
        </div>
      </div>
      <div className="rounded-xl bg-[#1a1a1a] text-white p-5">
        <div className="text-sm text-white/70">Deposit</div>
        <div className="text-3xl font-black mt-1">$75.00</div>
        <div className="text-xs text-white/50 mt-3">Full Detail · Marcus R.</div>
      </div>
      <button className="mt-4 w-full py-3 rounded-xl bg-[#cc0000] text-white text-sm font-semibold">
        Tap card to charge
      </button>
      <div className="text-[11px] text-[#888] mt-3 text-center">
        Funds land in your bank — not an app wallet
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount the Stripe section**

In the `LandingPage` return, add a second `FeatureSection` after the CRM one (note `reverse` so the visual is on the left):

```jsx
<FeatureSection
  reverse
  eyebrow="Payments"
  title="Get paid. Actually paid."
  lede="Onboard as a merchant in minutes with our partner Stripe. Take cards in person, online, or at booking."
  bullets={[
    'Tap to Pay — accept cards with just your phone',
    'Card-not-present for invoices and deposits',
    'Payouts land in your bank, not an app wallet',
    'No monthly fees — pay only per transaction',
  ]}
  visual={<StripeVisual />}
/>
```

- [ ] **Step 3: Manual smoke test**

Run `npm run dev` and reload.

Expected:
- Stripe section with eyebrow "Payments", headline "Get paid. Actually paid.", and the deposit/Tap-to-Pay mock.
- On desktop: visual on the LEFT, copy on the right (reversed from CRM).
- On mobile: copy stacks above visual.

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/LandingPage.jsx
git commit -m "feat(landing): Stripe payments section"
```

---

## Task 8: Booking deposits section

**Files:**
- Modify: `src/components/landing/LandingPage.jsx`

- [ ] **Step 1: Add the `BookingVisual` CSS mock**

Add below `StripeVisual` in `src/components/landing/LandingPage.jsx`:

```jsx
function BookingVisual() {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="text-xs text-[#888] font-semibold uppercase tracking-wider mb-3">
        New Booking
      </div>
      <div className="font-black text-lg">Ceramic Coating — Full</div>
      <div className="text-sm text-[#555] mt-1">Sat, May 2 · 10:00 AM</div>
      <div className="mt-4 divide-y divide-black/5 border-y border-black/5">
        <div className="py-3 flex justify-between text-sm">
          <span className="text-[#555]">Service total</span>
          <span className="font-semibold">$600.00</span>
        </div>
        <div className="py-3 flex justify-between text-sm bg-[#faf0f0] -mx-6 px-6">
          <span className="font-semibold text-[#cc0000]">Deposit today</span>
          <span className="font-black text-[#cc0000]">$100.00</span>
        </div>
      </div>
      <div className="text-[11px] text-[#888] mt-3">
        Cancellation policy · Deposit applies to final bill
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount the Booking deposits section**

In the `LandingPage` return, add a third `FeatureSection` after the Stripe one:

```jsx
<FeatureSection
  eyebrow="Booking deposits"
  title="Stop the no-shows"
  lede="Require a deposit when a customer books. They show up — or you keep the deposit."
  bullets={[
    'Set a deposit amount per service',
    'Link to your cancellation policy on every booking',
    'Shareable booking link for Instagram bio, email, or SMS',
    'Deposits apply to the final bill automatically',
  ]}
  visual={<BookingVisual />}
/>
```

- [ ] **Step 3: Manual smoke test**

Run `npm run dev` and reload.

Expected:
- Booking section appears below Stripe.
- On desktop: copy left, visual right (matches CRM direction, opposite of Stripe).
- Visual shows a booking card with the deposit line highlighted in red.

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/LandingPage.jsx
git commit -m "feat(landing): booking deposits section"
```

---

## Task 9: Social proof strip

**Files:**
- Modify: `src/components/landing/LandingPage.jsx`

- [ ] **Step 1: Add `SocialProof` sub-component and mount it**

Add below `BookingVisual`:

```jsx
function SocialProof() {
  // PLACEHOLDER quotes for v1 — swap with real testimonials when available.
  const quotes = [
    {
      quote:
        'Went from a piece of paper to a real business. The CRM alone changed how I run my weekends.',
      who: 'Jake R.',
      biz: 'Mobile Detailer',
    },
    {
      quote:
        'My no-show rate dropped to zero after I turned on deposits. Built the site in 20 minutes.',
      who: 'Mira S.',
      biz: 'Tint Shop Owner',
    },
    {
      quote:
        'I was paying $200/mo for a clunky site builder. This was free and looked better.',
      who: 'Danny L.',
      biz: 'Auto Mechanic',
    },
  ];
  return (
    <section className="border-b border-black/5 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-6">
        {quotes.map((q) => (
          <div
            key={q.who}
            className="p-6 rounded-2xl border border-black/5 bg-[#faf9f7]"
          >
            <div className="text-[#1a1a1a] text-base leading-relaxed">
              &ldquo;{q.quote}&rdquo;
            </div>
            <div className="mt-4 text-sm font-semibold">{q.who}</div>
            <div className="text-xs text-[#888]">{q.biz}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

Update the `LandingPage` return to add `<SocialProof />` after the three feature sections:

```jsx
<SocialProof />
{/* Closer CTA + Footer in next tasks */}
```

- [ ] **Step 2: Manual smoke test**

Run `npm run dev` and reload.

Expected:
- 3 testimonial cards in a row on desktop, stacked on mobile.
- White section background, cream cards.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/LandingPage.jsx
git commit -m "feat(landing): social proof strip (placeholder quotes)"
```

---

## Task 10: Closer CTA + Footer + final QA

**Files:**
- Modify: `src/components/landing/LandingPage.jsx`

- [ ] **Step 1: Add `CloserCTA` and `Footer` sub-components**

Add below `SocialProof` in `src/components/landing/LandingPage.jsx`:

```jsx
function CloserCTA({ onGetStarted }) {
  return (
    <section>
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-black tracking-tight">
          Ready to get paid on time and booked up?
        </h2>
        <p className="text-[#555] text-base md:text-lg mt-4 max-w-xl mx-auto">
          Build your free site in minutes. Turn on deposits and payments when you&apos;re ready.
        </p>
        <button
          onClick={onGetStarted}
          className="mt-8 px-6 py-3.5 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold text-base transition-colors"
        >
          Get Started Free
        </button>
      </div>
    </section>
  );
}

function Footer() {
  // TODO: confirm real destinations with user before final ship.
  // For v1, stub any link whose target doesn't exist in the app to '#'.
  const links = [
    { label: 'Help', href: '#' },
    { label: 'Contact', href: '#' },
    { label: 'Terms', href: '#' },
    { label: 'Privacy', href: '#' },
  ];
  return (
    <footer className="border-t border-black/5 bg-[#faf9f7]">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-[#888]">© 2026 Auto Care Genius</div>
        <div className="flex items-center gap-5 text-xs">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-[#888] hover:text-[#1a1a1a] transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
```

Update the `LandingPage` return to its final form:

```jsx
export default function LandingPage({ onGetStarted }) {
  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#1a1a1a]">
      <Nav onGetStarted={onGetStarted} />
      <Hero onGetStarted={onGetStarted} />
      <CoreStrip />
      <FeatureSection
        eyebrow="Customer CRM"
        title="Your customers in one place"
        lede="Every booking becomes a customer record automatically. Add notes, tag your VIPs, and export whenever you need to."
        bullets={[
          'Booking history per customer',
          'Tags and notes, searchable across the list',
          'CSV export of your full customer list',
          'Email any customer from inside the app',
        ]}
        visual={<CrmVisual />}
      />
      <FeatureSection
        reverse
        eyebrow="Payments"
        title="Get paid. Actually paid."
        lede="Onboard as a merchant in minutes with our partner Stripe. Take cards in person, online, or at booking."
        bullets={[
          'Tap to Pay — accept cards with just your phone',
          'Card-not-present for invoices and deposits',
          'Payouts land in your bank, not an app wallet',
          'No monthly fees — pay only per transaction',
        ]}
        visual={<StripeVisual />}
      />
      <FeatureSection
        eyebrow="Booking deposits"
        title="Stop the no-shows"
        lede="Require a deposit when a customer books. They show up — or you keep the deposit."
        bullets={[
          'Set a deposit amount per service',
          'Link to your cancellation policy on every booking',
          'Shareable booking link for Instagram bio, email, or SMS',
          'Deposits apply to the final bill automatically',
        ]}
        visual={<BookingVisual />}
      />
      <SocialProof />
      <CloserCTA onGetStarted={onGetStarted} />
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Responsive QA pass**

Run `npm run dev` and open the landing page. Use browser devtools responsive mode and verify at each width:

- **375px (mobile):**
  - Nav: logo + "Get Started" only (no "Sign in" visible).
  - Hero headline fits without overflow; CTA full-width is OK.
  - CoreStrip tiles stacked 1-up.
  - Feature sections: copy stacks above visual every time.
  - Testimonials stacked 1-up.
  - Footer: copyright and links stack vertically.
- **768px (tablet):**
  - CoreStrip tiles 2×2.
  - Feature sections still stack (md:grid-cols-2 kicks in at ≥768px — verify section shows 2 cols here).
  - Testimonials 3-up.
- **1024px+ (desktop):**
  - CoreStrip tiles 4-up in a row.
  - Feature sections 2 cols, alternating direction (CRM right → Stripe left → Booking right).
  - Nav full-width max-6xl centered.

Fix any overflow, cramped spacing, or layout breakage found during this pass.

- [ ] **Step 3: Verify auth flow end-to-end**

Still in `npm run dev`:

1. Load `/` in an incognito window. Confirm landing page renders.
2. Click nav "Get Started" → LoginPage appears with "← Back" link.
3. Click "← Back" → landing page returns.
4. Click hero "Build my site free" → LoginPage appears.
5. Click nav "Sign in" (desktop width) → LoginPage appears.
6. Sign in with a real account → wizard/dashboard renders (landing is skipped for authed users).
7. Sign out → landing page shows again.

Expected: all transitions work, no console errors.

- [ ] **Step 4: Build + lint**

Run:

```bash
npm run build
npm run lint
```

Expected: both complete without errors or new warnings.

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/LandingPage.jsx
git commit -m "feat(landing): closer CTA, footer, responsive pass"
```

- [ ] **Step 6: Push to master**

User workflow is direct-to-master (user memory). After the local branch is merged or rebased to master by the user, this change ships via Netlify on the next deploy.

```bash
git log --oneline -11
```

Expected: 10 new commits from tasks 1-10 on top of the prior tip.

Stop here and hand back to user — they decide when to merge to master and deploy.

---

## Notes for the implementer

- **Hardcoded colors**: the codebase uses arbitrary Tailwind classes with hex literals (e.g. `bg-[#faf9f7]`). Match this pattern — don't invent a token system mid-task (spec, "Out-of-scope but flagged").
- **No test framework installed**. Verification is browser + `npm run build` + `npm run lint`. Don't try to add Vitest or Jest as part of this work.
- **Dev server port**: `vite.config.js` runs on port 5190 per `netlify.toml`. Use `http://127.0.0.1:5190/` for local QA.
- **Session reset for QA**: if you stay signed in between QA runs, use an incognito window or Supabase auth sign-out.
- **Do not merge the sibling feature branches** (CRM, Stripe, bookings) into this branch as part of this task. The landing page describes those features as shipped marketing-side; the actual backend landing from those branches is a separate merge task.
- **Footer link destinations**: links are stubbed to `#`. Before shipping, confirm with user whether real URLs exist for Help / Contact / Terms / Privacy. If any exist, update them. If the user wants them removed entirely, drop from the list.
