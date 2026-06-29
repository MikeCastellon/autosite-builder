# Website Creator — Auth, Dashboard & Social Feeds Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Supabase auth (phone OTP + Google OAuth), a saved-sites dashboard, a social feeds wizard step, and updated HTML export with widget_key baked in.

**Architecture:** React + Vite (ES modules). Auth via Supabase client SDK (`@supabase/supabase-js`). New pages: `/login` route (guarded via state in App.jsx), `/dashboard` route. New wizard step 5.5 (Social Feeds panel, inserted between WebsitePreview and StepExport). Export updated to inject `<div data-widget>` + `<script>` tags and save site record to Supabase `sites` table. No backend changes needed — social feeds OAuth is handled by the SocialFeeds Netlify app; Website Creator only reads/saves widget configs from Supabase.

**Tech Stack:** React 19, Vite, Tailwind CSS, `@supabase/supabase-js`, existing Netlify Functions (generate-website.js), shared Supabase project with SocialFeeds.

---

## Prerequisites (manual, before running tasks)

1. Supabase project created (from SocialFeeds setup)
2. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` added to Netlify env vars for Website Creator site
3. Both env vars also added to `.env.local` for local dev

---

## Task 1: Install Supabase + Create Client Module

**Files:**
- Modify: `package.json`
- Create: `src/lib/supabase.js`

**Step 1: Install the Supabase client**

```bash
cd "C:/Users/mikec/Website Creator"
npm install @supabase/supabase-js
```

**Step 2: Create `src/lib/supabase.js`**

```js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Step 3: Create `.env.local` (not committed)**

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Step 4: Verify no build errors**

```bash
npm run build
```

Expected: build succeeds (module resolution OK).

**Step 5: Commit**

```bash
git add src/lib/supabase.js package.json package-lock.json
git commit -m "feat: install supabase-js and create client module"
```

---

## Task 2: Auth Context + Login Page

**Files:**
- Create: `src/lib/AuthContext.jsx`
- Create: `src/components/auth/LoginPage.jsx`
- Modify: `src/main.jsx`

**Step 1: Create `src/lib/AuthContext.jsx`**

```jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading: session === undefined }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

**Step 2: Create `src/components/auth/LoginPage.jsx`**

This matches the SocialFeeds login design — Google button + phone OTP flow.

```jsx
import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleLogin = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/dashboard' },
    });
    if (error) setError(error.message);
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formatted = phone.startsWith('+') ? phone : '+1' + phone.replace(/\D/g, '');
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
    if (error) setError(error.message);
    else setOtpSent(true);
    setLoading(false);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formatted = phone.startsWith('+') ? phone : '+1' + phone.replace(/\D/g, '');
    const { error } = await supabase.auth.verifyOtp({ phone: formatted, token: otp, type: 'sms' });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-black text-[#1a1a1a] mb-1 tracking-tight">Sign in</h1>
        <p className="text-[#888] text-sm mb-6">Continue to Website Creator</p>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-black/10 rounded-xl font-medium text-[#1a1a1a] hover:bg-white transition-colors mb-4"
        >
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.5 30.2 0 24 0 14.7 0 6.8 5.5 2.9 13.5l7.9 6.1C12.7 13.3 17.9 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17z"/><path fill="#FBBC05" d="M10.8 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.5 10.8l8.3-6.2z"/><path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.7 2.2-7.7 2.2-6.1 0-11.3-3.8-13.2-9.2l-8.3 6.2C6.8 42.5 14.7 48 24 48z"/></svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 border-t border-black/10" />
          <span className="text-[#aaa] text-xs">or</span>
          <div className="flex-1 border-t border-black/10" />
        </div>

        {!otpSent ? (
          <form onSubmit={handleSendOtp}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full border border-black/10 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:ring-2 focus:ring-[#cc0000]/30"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <p className="text-sm text-[#555] mb-3">Enter the 6-digit code sent to {phone}</p>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit code"
              maxLength={6}
              className="w-full border border-black/10 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:ring-2 focus:ring-[#cc0000]/30 text-center tracking-widest"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
            <button
              type="button"
              onClick={() => setOtpSent(false)}
              className="w-full mt-2 text-xs text-[#888] hover:text-[#1a1a1a] transition-colors"
            >
              Use a different number
            </button>
          </form>
        )}

        {error && (
          <p className="mt-3 text-xs text-[#cc0000] text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Wrap app in `AuthProvider` in `src/main.jsx`**

Current `src/main.jsx`:
```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

New `src/main.jsx`:
```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './lib/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
```

**Step 4: Add auth gate to `src/App.jsx`**

At the top of `App()`, before all existing state/logic, add:

```jsx
import { useAuth } from './lib/AuthContext.jsx';
import LoginPage from './components/auth/LoginPage.jsx';

// Inside App():
const { session, loading } = useAuth();
if (loading) return null; // or a spinner
if (!session) return <LoginPage />;
```

Insert this block at the very top of the `App()` function body, before the existing `useState` calls. The existing wizard logic is unchanged.

**Step 5: Test locally**

```bash
npm run dev
```

- Visit `http://localhost:5173` — should show login page
- Sign in with Google (requires Supabase Google OAuth configured)
- After login, should show the wizard (step 1)

**Step 6: Commit**

```bash
git add src/lib/AuthContext.jsx src/components/auth/LoginPage.jsx src/main.jsx src/App.jsx
git commit -m "feat: add Supabase auth with phone OTP and Google OAuth"
```

---

## Task 3: Dashboard Page

**Files:**
- Create: `src/components/dashboard/DashboardPage.jsx`
- Modify: `src/App.jsx`

**Goal:** Show a `/dashboard` view with the user's saved sites. New site button → goes to wizard. Sign out button. Route controlled by a `view` state in App.jsx (`'dashboard'` | `'wizard'`).

**Step 1: Create `src/components/dashboard/DashboardPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../lib/AuthContext.jsx';

export default function DashboardPage({ onNewSite }) {
  const { session } = useAuth();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSites() {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error) setSites(data || []);
      setLoading(false);
    }
    fetchSites();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this site?')) return;
    await supabase.from('sites').delete().eq('id', id);
    setSites((prev) => prev.filter((s) => s.id !== id));
  };

  const handleReExport = async (site) => {
    // Download a saved site's HTML again
    const { exportHtml } = await import('../../lib/exportHtml.js');
    const { TEMPLATES } = await import('../../data/templates.js');
    const templateMeta = TEMPLATES[site.template_id];
    await exportHtml(
      site.template_id,
      site.business_info,
      site.generated_content,
      { ...templateMeta, colors: templateMeta?.colors || {} },
      {},
      site.widget_config_ids || []
    );
  };

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-black/[0.07] bg-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-black text-[#1a1a1a] tracking-tight">Website Creator</h1>
        <button
          onClick={handleSignOut}
          className="text-sm text-[#888] hover:text-[#cc0000] transition-colors"
        >
          Sign out
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black text-[#1a1a1a] tracking-tight">Your Sites</h2>
            <p className="text-[#888] text-sm mt-1">
              {session?.user?.phone || session?.user?.email}
            </p>
          </div>
          <button
            onClick={onNewSite}
            className="px-5 py-2.5 bg-[#1a1a1a] hover:bg-[#cc0000] text-white rounded-xl font-semibold text-sm transition-colors"
          >
            + New Site
          </button>
        </div>

        {loading ? (
          <p className="text-[#888] text-sm">Loading...</p>
        ) : sites.length === 0 ? (
          <div className="text-center py-20 border border-black/[0.07] rounded-2xl bg-white">
            <p className="text-[#888] mb-4">No sites yet.</p>
            <button
              onClick={onNewSite}
              className="px-6 py-3 bg-[#1a1a1a] hover:bg-[#cc0000] text-white rounded-xl font-semibold text-sm transition-colors"
            >
              Create your first site
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {sites.map((site) => (
              <div
                key={site.id}
                className="bg-white border border-black/[0.07] rounded-xl p-5 flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold text-[#1a1a1a]">
                    {site.business_info?.businessName || 'Untitled'}
                  </p>
                  <p className="text-xs text-[#888] mt-0.5">
                    {site.business_info?.city}, {site.business_info?.state} &middot;{' '}
                    {new Date(site.created_at).toLocaleDateString()}
                    {site.widget_config_ids?.length > 0 && (
                      <span className="ml-2 text-[#cc0000]">
                        {site.widget_config_ids.length} widget{site.widget_config_ids.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReExport(site)}
                    className="px-3 py-1.5 text-xs font-medium border border-black/10 rounded-lg hover:border-[#cc0000]/30 hover:text-[#cc0000] transition-colors"
                  >
                    Re-export
                  </button>
                  <button
                    onClick={() => handleDelete(site.id)}
                    className="px-3 py-1.5 text-xs font-medium text-[#888] hover:text-[#cc0000] transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

**Step 2: Add `view` state and routing in `src/App.jsx`**

Add import at top:
```jsx
import DashboardPage from './components/dashboard/DashboardPage.jsx';
```

Add state after auth check:
```jsx
const [view, setView] = useState('dashboard'); // 'dashboard' | 'wizard'
```

Add dashboard route before the wizard return:
```jsx
if (view === 'dashboard') {
  return <DashboardPage onNewSite={() => { handleStartOver(); setView('wizard'); }} />;
}
```

Update `handleStartOver` to set view back to dashboard when done:
```jsx
const handleStartOver = () => {
  setStep(1);
  setBusinessType(null);
  setBusinessInfo({});
  setSelectedTemplate(null);
  setGeneratedCopy(null);
  setEditedCopy(null);
  setImages({});
  setError(null);
  setView('dashboard');
};
```

**Step 3: Test locally**

```bash
npm run dev
```

- After login, should see dashboard (empty)
- Click "+ New Site" → wizard starts at step 1
- "Build Another Site" → returns to dashboard

**Step 4: Commit**

```bash
git add src/components/dashboard/DashboardPage.jsx src/App.jsx
git commit -m "feat: add dashboard page with saved sites list"
```

---

## Task 4: Social Feeds Wizard Step

**Files:**
- Create: `src/components/wizard/StepSocialFeeds.jsx`
- Modify: `src/App.jsx`

**Goal:** New step 5.5 — after WebsitePreview, before StepExport. Shows connected widget configs and lets user connect Instagram (via redirect to socialfeeds.netlify.app OAuth flow) and add Google Reviews (via places-search Netlify Function). Selected widget_config_ids are carried through to export.

**Step 1: Create `src/components/wizard/StepSocialFeeds.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../lib/AuthContext.jsx';

const SOCIALFEEDS_URL = import.meta.env.VITE_SOCIALFEEDS_URL || 'https://socialfeeds.netlify.app';
const PLACES_SEARCH_URL = '/.netlify/functions/places-search';

export default function StepSocialFeeds({ selectedWidgetIds, onWidgetIdsChange, onNext, onBack }) {
  const { session } = useAuth();
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadWidgets();
  }, []);

  async function loadWidgets() {
    setLoading(true);
    const { data } = await supabase
      .from('widget_configs')
      .select('*')
      .order('created_at', { ascending: false });
    setWidgets(data || []);
    setLoading(false);
  }

  const toggleWidget = (id) => {
    const next = selectedWidgetIds.includes(id)
      ? selectedWidgetIds.filter((x) => x !== id)
      : [...selectedWidgetIds, id];
    onWidgetIdsChange(next);
  };

  const handleConnectInstagram = () => {
    if (!session?.user?.id) return;
    const state = session.user.id;
    const redirectUrl = encodeURIComponent(`${SOCIALFEEDS_URL}/.netlify/functions/instagram-auth-callback`);
    const fbAppId = import.meta.env.VITE_FB_APP_ID;
    const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${fbAppId}&redirect_uri=${redirectUrl}&scope=user_profile,user_media&response_type=code&state=${state}`;
    window.location.href = authUrl;
  };

  const handleSearchGoogle = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`${PLACES_SEARCH_URL}?q=${encodeURIComponent(searchQuery)}`);
      const json = await res.json();
      setSearchResults(json.results || []);
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectGoogleBusiness = async (result) => {
    setSavingGoogle(true);
    setError(null);
    try {
      const res = await fetch('/.netlify/functions/widget-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: session.user.id,
          type: 'google-reviews',
          place_id: result.place_id,
          label: result.name,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      await loadWidgets();
      onWidgetIdsChange([...selectedWidgetIds, json.id]);
      setSearchResults([]);
      setSearchQuery('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingGoogle(false);
    }
  };

  const instagramWidgets = widgets.filter((w) => w.type === 'instagram-feed');
  const googleWidgets = widgets.filter((w) => w.type === 'google-reviews');

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-2xl font-black text-[#1a1a1a] mb-1 tracking-tight">Add Social Feeds</h2>
      <p className="text-[#888] text-sm mb-6">Optional — embed live Instagram posts or Google Reviews on your site.</p>

      {loading ? (
        <p className="text-sm text-[#888]">Loading...</p>
      ) : (
        <>
          {/* Instagram section */}
          <div className="border border-black/[0.07] rounded-xl p-4 mb-4 bg-white">
            <p className="text-xs font-semibold text-[#1a1a1a] uppercase tracking-wider mb-3">Instagram Feed</p>
            {instagramWidgets.length > 0 ? (
              <div className="space-y-2 mb-3">
                {instagramWidgets.map((w) => (
                  <label key={w.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedWidgetIds.includes(w.id)}
                      onChange={() => toggleWidget(w.id)}
                      className="accent-[#cc0000]"
                    />
                    <span className="text-sm text-[#1a1a1a]">@{w.instagram_username}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#888] mb-3">No Instagram accounts connected yet.</p>
            )}
            <button
              onClick={handleConnectInstagram}
              className="text-sm text-[#cc0000] font-medium hover:underline"
            >
              + Connect Instagram
            </button>
          </div>

          {/* Google Reviews section */}
          <div className="border border-black/[0.07] rounded-xl p-4 mb-6 bg-white">
            <p className="text-xs font-semibold text-[#1a1a1a] uppercase tracking-wider mb-3">Google Reviews</p>
            {googleWidgets.length > 0 && (
              <div className="space-y-2 mb-3">
                {googleWidgets.map((w) => (
                  <label key={w.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedWidgetIds.includes(w.id)}
                      onChange={() => toggleWidget(w.id)}
                      className="accent-[#cc0000]"
                    />
                    <span className="text-sm text-[#1a1a1a]">{w.label || w.place_id}</span>
                  </label>
                ))}
              </div>
            )}
            <form onSubmit={handleSearchGoogle} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your business name"
                className="flex-1 border border-black/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#cc0000]/30"
              />
              <button
                type="submit"
                disabled={searching}
                className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#cc0000] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {searching ? '...' : 'Search'}
              </button>
            </form>
            {searchResults.length > 0 && (
              <div className="mt-2 border border-black/[0.07] rounded-lg divide-y divide-black/[0.05]">
                {searchResults.map((r) => (
                  <button
                    key={r.place_id}
                    onClick={() => handleSelectGoogleBusiness(r)}
                    disabled={savingGoogle}
                    className="w-full text-left px-3 py-2.5 hover:bg-[#faf9f7] transition-colors"
                  >
                    <p className="text-sm font-medium text-[#1a1a1a]">{r.name}</p>
                    <p className="text-xs text-[#888]">{r.address}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {error && (
        <p className="text-xs text-[#cc0000] mb-4">{error}</p>
      )}

      <div className="flex gap-2.5">
        <button
          onClick={onBack}
          className="flex-1 py-2.5 px-4 rounded-xl border border-black/[0.07] text-[#555] hover:border-[#cc0000]/30 hover:text-[#cc0000] font-medium transition-colors text-[13px]"
        >
          Back to Preview
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-2.5 px-4 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold transition-colors text-[13px]"
        >
          {selectedWidgetIds.length > 0 ? `Continue with ${selectedWidgetIds.length} widget${selectedWidgetIds.length > 1 ? 's' : ''}` : 'Skip'}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Add `selectedWidgetIds` state and step 5.5 to `src/App.jsx`**

Add import:
```jsx
import StepSocialFeeds from './components/wizard/StepSocialFeeds.jsx';
```

Add state (near top of App, with other wizard state):
```jsx
const [selectedWidgetIds, setSelectedWidgetIds] = useState([]);
```

Reset it in `handleStartOver`:
```jsx
setSelectedWidgetIds([]);
```

Insert the Social Feeds step between the WebsitePreview `if` block and the StepExport `if` block. Add a new step 5.5 state by using `5.5` as a float step value:

```jsx
// Step 5.5 — Social Feeds (between preview and export)
if (step === 5.5) {
  return (
    <StepSocialFeeds
      selectedWidgetIds={selectedWidgetIds}
      onWidgetIdsChange={setSelectedWidgetIds}
      onNext={() => goTo(6)}
      onBack={() => goTo(5)}
    />
  );
}
```

Update the WebsitePreview `onExport` prop to go to step 5.5 instead of 6:
```jsx
onExport={isDemoPreview ? null : () => goTo(5.5)}
```

**Step 3: Verify locally**

```bash
npm run dev
```

- Go through wizard to step 5 (preview)
- Click "Export" → should now show Social Feeds step
- "Skip" → should go to StepExport
- "Back to Preview" → back to step 5

**Step 4: Commit**

```bash
git add src/components/wizard/StepSocialFeeds.jsx src/App.jsx
git commit -m "feat: add social feeds wizard step with Instagram and Google Reviews"
```

---

## Task 5: Update Export — Save to Supabase + Inject Widgets

**Files:**
- Modify: `src/lib/exportHtml.js`
- Modify: `src/components/wizard/StepExport.jsx`
- Modify: `src/App.jsx`

**Goal:** When exporting:
1. Fetch the widget configs for `selectedWidgetIds`
2. Inject `<div data-widget="...">` + script tag into the exported HTML
3. Save the site record to Supabase `sites` table (upsert on existing site)

**Step 1: Update `exportHtml` signature to accept `widgetConfigIds`**

In `src/lib/exportHtml.js`, update the function signature and add widget HTML injection:

```js
// Add to imports at top:
import { supabase } from './supabase.js';

// Update function signature:
export async function exportHtml(templateId, businessInfo, generatedCopy, templateMeta, images, widgetConfigIds = []) {
  // ... existing code ...

  // Add widget injection before poweredByBar:
  let widgetsHtml = '';
  if (widgetConfigIds.length > 0) {
    const { data: widgetConfigs } = await supabase
      .from('widget_configs')
      .select('id, type, widget_key')
      .in('id', widgetConfigIds);

    if (widgetConfigs?.length > 0) {
      const divs = widgetConfigs.map((w) =>
        `<div data-widget="${w.type}" data-widget-key="${w.widget_key}"></div>`
      ).join('\n');
      widgetsHtml = `
<section style="padding:60px 24px;max-width:1200px;margin:0 auto;">
  <h2 style="font-family:'Inter',system-ui,sans-serif;font-size:24px;font-weight:700;color:#1a1a1a;margin-bottom:32px;">Reviews & Social</h2>
  ${divs}
</section>
<script src="https://socialfeeds.netlify.app/widgets.js"></script>`;
    }
  }

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
${seoHead}
</head>
<body>
${bodyHtml}
${widgetsHtml}
${poweredByBar}
</body>
</html>`;

  // ... rest of download trigger unchanged ...
}
```

**Step 2: Update `StepExport` to pass `widgetConfigIds` and save to Supabase**

In `src/components/wizard/StepExport.jsx`, update the props and `handleDownload`:

```jsx
// Add to imports:
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../lib/AuthContext.jsx';

// Update component signature:
export default function StepExport({ businessInfo, generatedCopy, templateId, templateMeta, images, selectedWidgetIds, onBack, onStartOver }) {
  const { session } = useAuth();
  // ... existing state ...

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await exportHtml(templateId, businessInfo, generatedCopy, templateMeta, images, selectedWidgetIds || []);

      // Save site to Supabase
      if (session?.user?.id) {
        await supabase.from('sites').insert({
          user_id: session.user.id,
          business_info: businessInfo,
          template_id: templateId,
          generated_content: generatedCopy,
          widget_config_ids: selectedWidgetIds || [],
        });
      }

      setDownloaded(true);
    } catch (err) {
      setError(err.message || 'Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };
  // ... rest of JSX unchanged ...
}
```

**Step 3: Pass `selectedWidgetIds` from `App.jsx` to `StepExport`**

In the StepExport `if` block in `src/App.jsx`:
```jsx
if (step === 6 && generatedCopy) {
  return (
    <StepExport
      businessInfo={businessInfo}
      generatedCopy={editedCopy || generatedCopy}
      templateId={selectedTemplate}
      templateMeta={templateMeta}
      images={images}
      selectedWidgetIds={selectedWidgetIds}
      onBack={() => goTo(5.5)}
      onStartOver={handleStartOver}
    />
  );
}
```

Note: `onBack` now goes to `5.5` (social feeds step), not `5`.

**Step 4: Test export with widgets**

```bash
npm run dev
```

- Complete wizard, connect a Google Reviews widget in step 5.5
- Click Export → download HTML
- Open downloaded HTML → should include `<div data-widget="google-reviews" data-widget-key="...">` and `<script src="https://socialfeeds.netlify.app/widgets.js">` before `</body>`
- Check Supabase dashboard → `sites` table should have a new row

**Step 5: Commit**

```bash
git add src/lib/exportHtml.js src/components/wizard/StepExport.jsx src/App.jsx
git commit -m "feat: save site to Supabase and inject widget_key into exported HTML"
```

---

## Task 6: Netlify Function — `places-search` Proxy

**Files:**
- Create: `netlify/functions/places-search.js`

**Note:** The SocialFeeds app already has this function. The Website Creator needs its own copy because it's a separate Netlify site.

**Step 1: Create `netlify/functions/places-search.js`**

```js
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  const query = event.queryStringParameters?.q;
  if (!query) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing q parameter' }) };
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=name,formatted_address,place_id,rating,user_ratings_total&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    const results = (data.candidates || []).map((p) => ({
      name: p.name,
      address: p.formatted_address,
      place_id: p.place_id,
      rating: p.rating,
      review_count: p.user_ratings_total,
    }));

    return { statusCode: 200, headers, body: JSON.stringify({ results }) };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Search request failed' }) };
  }
};
```

**Step 2: Add `GOOGLE_PLACES_API_KEY` to Netlify env**

In Netlify dashboard for Website Creator site → Site settings → Environment variables → Add `GOOGLE_PLACES_API_KEY`.

Also add to `.env.local` for local dev:
```
GOOGLE_PLACES_API_KEY=your-key-here
```

**Step 3: Test locally**

```bash
netlify dev
```

- Visit `http://localhost:8888/.netlify/functions/places-search?q=Joes+Auto+Repair`
- Should return JSON with business results

**Step 4: Commit**

```bash
git add netlify/functions/places-search.js
git commit -m "feat: add places-search Netlify function proxy"
```

---

## Task 7: Environment Variables + Netlify Config

**Files:**
- Modify: `netlify.toml` (verify functions directory set)
- Create: `.env.local` (local dev only, not committed)

**Step 1: Check `netlify.toml` has functions config**

Read current `netlify.toml`. Ensure it contains:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[functions]
  directory = "netlify/functions"
```

Add the `[functions]` block if missing.

**Step 2: Verify `.gitignore` excludes `.env.local`**

```bash
grep ".env" .gitignore
```

If not present, add `.env.local` and `.env` to `.gitignore`.

**Step 3: Document all required env vars**

For Netlify Website Creator site settings, the following are required:
```
VITE_SUPABASE_URL          = from Supabase project settings
VITE_SUPABASE_ANON_KEY     = from Supabase project settings
VITE_SOCIALFEEDS_URL       = https://socialfeeds.netlify.app
VITE_FB_APP_ID             = Facebook App ID (for Instagram OAuth redirect)
GOOGLE_PLACES_API_KEY      = Google Cloud API key (restricted to your domains)
```

**Step 4: Commit toml changes if any**

```bash
git add netlify.toml .gitignore
git commit -m "chore: ensure functions directory configured in netlify.toml"
```

---

## Task 8: Final Build + Smoke Test

**Step 1: Full build**

```bash
cd "C:/Users/mikec/Website Creator"
npm run build
```

Expected: no errors, `dist/` populated.

**Step 2: Check for console errors with `netlify dev`**

```bash
netlify dev
```

Walk through the full user flow:
1. Visit `http://localhost:8888`
2. See login page
3. Sign in with phone OTP or Google
4. See dashboard (empty)
5. Click "+ New Site" → wizard step 1
6. Complete all steps to step 5 (preview)
7. Click "Export" → Social Feeds step
8. Search for a business → select it → checkbox appears
9. Click "Continue with 1 widget" → StepExport
10. Click "Download HTML Website" → file downloads
11. Open HTML → widget `<div>` and `<script>` present
12. Return to dashboard → new site appears in list

**Step 3: Commit**

```bash
git add -u
git commit -m "chore: final build verification for social feeds integration"
```
