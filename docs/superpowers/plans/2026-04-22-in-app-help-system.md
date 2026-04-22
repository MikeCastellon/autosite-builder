# In-App Help System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an in-app help system with a floating help button, a slide-in drawer listing seven tutorial articles, and real screenshots captured from the live production site.

**Architecture:** A `<HelpChrome />` component mounts via React Portal and owns the open/close state. It renders a fixed floating button and a slide-in drawer. The drawer has two views (article list with search + article view with steps). Content lives in a single `articles.js` file. Screenshots are real PNGs in `public/help/`, captured from https://sitebuilder.autocaregenius.com/ via Chrome MCP. Annotations (red circle callouts) are rendered as CSS overlays, not baked into the images.

**Tech Stack:** React 19, Vite 6, Tailwind 3, Vitest (for the one pure-function test), Chrome MCP (for screenshot capture).

**Spec:** See `docs/superpowers/specs/2026-04-22-in-app-help-system-design.md` for full design rationale and content outlines.

**Files created:**
- `src/components/help/formatInline.js` — inline markdown-lite parser
- `src/components/help/articles.js` — content source of truth
- `src/components/help/HelpButton.jsx` — floating help button
- `src/components/help/HelpDrawer.jsx` — slide-in drawer with list + article views
- `src/components/help/HelpChrome.jsx` — portal-mounted wrapper
- `tests/formatInline.test.js` — unit test for the formatter
- `public/help/*.png` — screenshot assets (added in Task 10)

**Files modified:**
- `src/App.jsx` — mount `<HelpChrome />` in each non-auth return branch

---

## Task 1: formatInline Utility

Builds the tiny markdown-lite parser the article body uses for `**bold**`, `*italic*`, `` `code` ``, and paragraph breaks. Pure function → TDD.

**Files:**
- Create: `src/components/help/formatInline.js`
- Test: `tests/formatInline.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/formatInline.test.js
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatInline } from '../src/components/help/formatInline.js';

function render(nodes) {
  return renderToStaticMarkup(nodes);
}

describe('formatInline', () => {
  it('returns plain text unchanged', () => {
    expect(render(formatInline('hello world'))).toBe('hello world');
  });

  it('renders **bold** as <strong>', () => {
    expect(render(formatInline('click **Save**'))).toBe('click <strong>Save</strong>');
  });

  it('renders *italic* as <em>', () => {
    expect(render(formatInline('*Business name* field'))).toBe('<em>Business name</em> field');
  });

  it('renders `code` as <code>', () => {
    expect(render(formatInline('open `/dashboard`'))).toBe('open <code>/dashboard</code>');
  });

  it('renders paragraph breaks from \\n\\n', () => {
    expect(render(formatInline('one\n\ntwo'))).toBe('<p>one</p><p>two</p>');
  });

  it('escapes HTML to prevent injection', () => {
    expect(render(formatInline('<script>alert(1)</script>'))).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('combines multiple formats in one string', () => {
    expect(render(formatInline('Use **bold** and *italic* with `code`')))
      .toBe('Use <strong>bold</strong> and <em>italic</em> with <code>code</code>');
  });

  it('returns empty array for empty string', () => {
    expect(formatInline('')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/formatInline.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement formatInline**

```js
// src/components/help/formatInline.js
import { Fragment } from 'react';

// Order matters: bold before italic (both use asterisks).
const TOKEN_REGEX = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

function renderSegment(segment, key) {
  if (segment.startsWith('**') && segment.endsWith('**')) {
    return <strong key={key}>{segment.slice(2, -2)}</strong>;
  }
  if (segment.startsWith('*') && segment.endsWith('*')) {
    return <em key={key}>{segment.slice(1, -1)}</em>;
  }
  if (segment.startsWith('`') && segment.endsWith('`')) {
    return <code key={key}>{segment.slice(1, -1)}</code>;
  }
  return <Fragment key={key}>{segment}</Fragment>;
}

function renderParagraph(text, keyPrefix) {
  const parts = text.split(TOKEN_REGEX).filter(Boolean);
  return parts.map((part, i) => renderSegment(part, `${keyPrefix}-${i}`));
}

export function formatInline(str) {
  if (!str) return [];
  const paragraphs = str.split('\n\n');
  if (paragraphs.length === 1) {
    return renderParagraph(paragraphs[0], '0');
  }
  return paragraphs.map((p, i) => <p key={`p-${i}`}>{renderParagraph(p, `p${i}`)}</p>);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/formatInline.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/help/formatInline.js tests/formatInline.test.js
git commit -m "feat(help): add formatInline markdown-lite parser"
```

---

## Task 2: Articles Data File with Placeholder Content

Create `articles.js` with the full shape of all seven articles but placeholder text in every step. This unblocks UI development — we can render the drawer, navigate between articles, and test the schedulerOnly gate before real content exists.

**Files:**
- Create: `src/components/help/articles.js`

- [ ] **Step 1: Write articles.js with placeholders**

```js
// src/components/help/articles.js
//
// v1 content is placeholder text. Real prose + screenshot paths + annotations
// are filled in Task 11 after screenshots are captured in Task 10.

export const ARTICLES = [
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description: 'Zero to published site in 5 minutes.',
    icon: '🚀',
    readTime: '5 min read',
    schedulerOnly: false,
    steps: Array.from({ length: 7 }, (_, i) => ({
      heading: `Step ${i + 1}`,
      body: `Placeholder body for getting-started step ${i + 1}.`,
      screenshot: null,
    })),
  },
  {
    slug: 'business-type-and-template',
    title: 'Choosing a Business Type & Template',
    description: 'Pick what fits your business and customize colors.',
    icon: '🎨',
    readTime: '3 min read',
    schedulerOnly: false,
    steps: Array.from({ length: 6 }, (_, i) => ({
      heading: `Step ${i + 1}`,
      body: `Placeholder body for business-type-and-template step ${i + 1}.`,
      screenshot: null,
    })),
  },
  {
    slug: 'the-edit-menu',
    title: 'The Edit Menu',
    description: 'Edit text, images, colors, and fonts on your site.',
    icon: '✏️',
    readTime: '4 min read',
    schedulerOnly: false,
    steps: Array.from({ length: 10 }, (_, i) => ({
      heading: `Step ${i + 1}`,
      body: `Placeholder body for the-edit-menu step ${i + 1}.`,
      screenshot: null,
    })),
  },
  {
    slug: 'google-reviews',
    title: 'Adding Google Reviews',
    description: 'Show live Google reviews on your site.',
    icon: '⭐',
    readTime: '2 min read',
    schedulerOnly: false,
    steps: Array.from({ length: 4 }, (_, i) => ({
      heading: `Step ${i + 1}`,
      body: `Placeholder body for google-reviews step ${i + 1}.`,
      screenshot: null,
    })),
  },
  {
    slug: 'publishing',
    title: 'Publishing Your Site',
    description: 'Publish to a live URL and update later.',
    icon: '🌐',
    readTime: '3 min read',
    schedulerOnly: false,
    steps: Array.from({ length: 5 }, (_, i) => ({
      heading: `Step ${i + 1}`,
      body: `Placeholder body for publishing step ${i + 1}.`,
      screenshot: null,
    })),
  },
  {
    slug: 'managing-sites',
    title: 'Managing Your Sites',
    description: 'Edit, republish, or delete from your dashboard.',
    icon: '📁',
    readTime: '2 min read',
    schedulerOnly: false,
    steps: Array.from({ length: 4 }, (_, i) => ({
      heading: `Step ${i + 1}`,
      body: `Placeholder body for managing-sites step ${i + 1}.`,
      screenshot: null,
    })),
  },
  {
    slug: 'bookings',
    title: 'Bookings',
    description: 'Accept appointments directly from your site.',
    icon: '📅',
    readTime: '3 min read',
    schedulerOnly: true,
    steps: Array.from({ length: 6 }, (_, i) => ({
      heading: `Step ${i + 1}`,
      body: `Placeholder body for bookings step ${i + 1}.`,
      screenshot: null,
    })),
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/components/help/articles.js
git commit -m "feat(help): add articles data file with placeholder content"
```

---

## Task 3: HelpButton Component

The floating "?" button. Simple — just style and click handler.

**Files:**
- Create: `src/components/help/HelpButton.jsx`

- [ ] **Step 1: Write HelpButton.jsx**

```jsx
// src/components/help/HelpButton.jsx
export default function HelpButton({ open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? 'Close help' : 'Open help'}
      aria-expanded={open}
      className="fixed bottom-6 right-6 z-[60] w-12 h-12 rounded-full bg-[#cc0000] text-white font-semibold text-xl shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:bg-[#b30000] transition-colors duration-150 flex items-center justify-center"
      style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
    >
      {open ? '×' : '?'}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/help/HelpButton.jsx
git commit -m "feat(help): add floating HelpButton component"
```

---

## Task 4: HelpDrawer — Shell + List View

First pass of the drawer. Renders the article list from `articles.js` but has no article-view navigation yet. Closes via X button only (Esc, backdrop, and search come in later tasks).

**Files:**
- Create: `src/components/help/HelpDrawer.jsx`

- [ ] **Step 1: Write HelpDrawer.jsx (list-view-only version)**

```jsx
// src/components/help/HelpDrawer.jsx
import { useMemo } from 'react';
import { ARTICLES } from './articles.js';

export default function HelpDrawer({ open, onClose, profile }) {
  const visibleArticles = useMemo(
    () => ARTICLES.filter(a => !a.schedulerOnly || profile?.scheduler_enabled),
    [profile?.scheduler_enabled]
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-[55] transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!open}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Help Center"
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-[#faf9f7] z-[60] shadow-[0_0_30px_rgba(0,0,0,0.1)] transform transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col`}
        style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-[#e5e4e0]">
          <h2 className="text-lg font-semibold text-[#1a1a1a]">Help Center</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="w-8 h-8 rounded-full hover:bg-[#e5e4e0] flex items-center justify-center text-xl leading-none text-[#6b6b6b]"
          >
            ×
          </button>
        </header>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {visibleArticles.map(article => (
            <button
              key={article.slug}
              type="button"
              className="w-full text-left bg-white border border-[#e5e4e0] rounded-xl p-4 hover:border-[#cc0000] transition-colors duration-150 flex gap-3 items-start"
            >
              <span className="text-2xl leading-none" aria-hidden="true">{article.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[#1a1a1a]">{article.title}</div>
                <div className="text-sm text-[#6b6b6b] mt-1">{article.description}</div>
                <div className="text-xs text-[#6b6b6b] mt-2">{article.readTime}</div>
              </div>
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/help/HelpDrawer.jsx
git commit -m "feat(help): add HelpDrawer shell with article list view"
```

---

## Task 5: HelpDrawer — Article View + Navigation

Add selected-article state, article view rendering (steps, screenshots, annotations, callouts), and back-to-list navigation. Import `formatInline` for body rendering.

**Files:**
- Modify: `src/components/help/HelpDrawer.jsx`

- [ ] **Step 1: Update HelpDrawer to add article view**

Replace the entire file with:

```jsx
// src/components/help/HelpDrawer.jsx
import { useMemo, useState } from 'react';
import { ARTICLES } from './articles.js';
import { formatInline } from './formatInline.js';

function Callout({ callout }) {
  if (!callout) return null;
  const styles = callout.type === 'tip'
    ? 'bg-[#edf7ed] border-l-4 border-[#2e7d32] text-[#1b5e20]'
    : 'bg-[#fff8e1] border-l-4 border-[#f57c00] text-[#795500]';
  const label = callout.type === 'tip' ? 'Tip' : 'Heads up';
  return (
    <div className={`${styles} rounded-r-md px-4 py-3 mt-3 text-sm`}>
      <span className="font-semibold mr-1">{label}:</span>
      {formatInline(callout.text)}
    </div>
  );
}

function Annotation({ annotation }) {
  const { x, y, label } = annotation;
  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, transform: 'translate(-50%, -50%)' }}
    >
      <div className="w-8 h-8 rounded-full border-2 border-[#cc0000] bg-[#cc0000]/10 animate-pulse" />
      {label && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap bg-[#cc0000] text-white text-xs px-2 py-1 rounded">
          {label}
        </div>
      )}
    </div>
  );
}

function ArticleStep({ step }) {
  return (
    <div className="mb-6">
      <h3 className="font-semibold text-[#1a1a1a] mb-2">{step.heading}</h3>
      <div className="text-sm text-[#1a1a1a] leading-relaxed">{formatInline(step.body)}</div>
      {step.screenshot && (
        <div className="relative mt-3 rounded-lg overflow-hidden border border-[#e5e4e0]">
          <img src={step.screenshot} alt={step.heading} className="block w-full" />
          {step.annotations?.map((a, i) => <Annotation key={i} annotation={a} />)}
        </div>
      )}
      <Callout callout={step.callout} />
    </div>
  );
}

function ArticleView({ article, onBack }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-4 border-b border-[#e5e4e0]">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-[#cc0000] hover:underline flex items-center gap-1 mb-3"
        >
          ← Help Center
        </button>
        <h1 className="text-xl font-semibold text-[#1a1a1a]">{article.title}</h1>
        <div className="text-xs text-[#6b6b6b] mt-1">{article.readTime}</div>
      </div>
      <div className="p-6">
        {article.steps.map((step, i) => <ArticleStep key={i} step={step} />)}
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-[#cc0000] hover:underline mt-4"
        >
          ← Back to Help Center
        </button>
      </div>
    </div>
  );
}

function ArticleList({ articles, onSelect }) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {articles.map(article => (
        <button
          key={article.slug}
          type="button"
          onClick={() => onSelect(article.slug)}
          className="w-full text-left bg-white border border-[#e5e4e0] rounded-xl p-4 hover:border-[#cc0000] transition-colors duration-150 flex gap-3 items-start"
        >
          <span className="text-2xl leading-none" aria-hidden="true">{article.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[#1a1a1a]">{article.title}</div>
            <div className="text-sm text-[#6b6b6b] mt-1">{article.description}</div>
            <div className="text-xs text-[#6b6b6b] mt-2">{article.readTime}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function HelpDrawer({ open, onClose, profile, initialSlug }) {
  const [selectedSlug, setSelectedSlug] = useState(initialSlug || null);

  const visibleArticles = useMemo(
    () => ARTICLES.filter(a => !a.schedulerOnly || profile?.scheduler_enabled),
    [profile?.scheduler_enabled]
  );

  const selectedArticle = selectedSlug
    ? visibleArticles.find(a => a.slug === selectedSlug)
    : null;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-[55] transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!open}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Help Center"
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-[#faf9f7] z-[60] shadow-[0_0_30px_rgba(0,0,0,0.1)] transform transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col`}
        style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-[#e5e4e0]">
          <h2 className="text-lg font-semibold text-[#1a1a1a]">Help Center</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="w-8 h-8 rounded-full hover:bg-[#e5e4e0] flex items-center justify-center text-xl leading-none text-[#6b6b6b]"
          >
            ×
          </button>
        </header>

        {selectedArticle ? (
          <ArticleView article={selectedArticle} onBack={() => setSelectedSlug(null)} />
        ) : (
          <ArticleList articles={visibleArticles} onSelect={setSelectedSlug} />
        )}
      </aside>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/help/HelpDrawer.jsx
git commit -m "feat(help): add article view with steps, screenshots, callouts"
```

---

## Task 6: HelpDrawer — Search, Esc Key, Backdrop Close

Add client-side search filter on the list view, Esc key to close the drawer, and backdrop click to close.

**Files:**
- Modify: `src/components/help/HelpDrawer.jsx`

- [ ] **Step 1: Add search + Esc/backdrop close**

Find the top of the file (imports) and replace:

```jsx
import { useEffect, useMemo, useState } from 'react';
```

Find the `ArticleList` component and replace with:

```jsx
function ArticleList({ articles, query, onQueryChange, onSelect }) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q)
    );
  }, [articles, query]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 pt-4 pb-2">
        <input
          type="search"
          placeholder="Search help..."
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[#e5e4e0] bg-white text-sm focus:outline-none focus:border-[#cc0000] focus:ring-1 focus:ring-[#cc0000]"
        />
      </div>
      <div className="p-4 pt-2 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-sm text-[#6b6b6b] text-center py-8">
            No articles match "{query}"
          </div>
        ) : (
          filtered.map(article => (
            <button
              key={article.slug}
              type="button"
              onClick={() => onSelect(article.slug)}
              className="w-full text-left bg-white border border-[#e5e4e0] rounded-xl p-4 hover:border-[#cc0000] transition-colors duration-150 flex gap-3 items-start"
            >
              <span className="text-2xl leading-none" aria-hidden="true">{article.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[#1a1a1a]">{article.title}</div>
                <div className="text-sm text-[#6b6b6b] mt-1">{article.description}</div>
                <div className="text-xs text-[#6b6b6b] mt-2">{article.readTime}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
```

In the default-exported `HelpDrawer` component, replace the function body with:

```jsx
export default function HelpDrawer({ open, onClose, profile, initialSlug }) {
  const [selectedSlug, setSelectedSlug] = useState(initialSlug || null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const visibleArticles = useMemo(
    () => ARTICLES.filter(a => !a.schedulerOnly || profile?.scheduler_enabled),
    [profile?.scheduler_enabled]
  );

  const selectedArticle = selectedSlug
    ? visibleArticles.find(a => a.slug === selectedSlug)
    : null;

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/30 z-[55] transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!open}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Help Center"
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-[#faf9f7] z-[60] shadow-[0_0_30px_rgba(0,0,0,0.1)] transform transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col`}
        style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-[#e5e4e0]">
          <h2 className="text-lg font-semibold text-[#1a1a1a]">Help Center</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="w-8 h-8 rounded-full hover:bg-[#e5e4e0] flex items-center justify-center text-xl leading-none text-[#6b6b6b]"
          >
            ×
          </button>
        </header>

        {selectedArticle ? (
          <ArticleView article={selectedArticle} onBack={() => setSelectedSlug(null)} />
        ) : (
          <ArticleList
            articles={visibleArticles}
            query={query}
            onQueryChange={setQuery}
            onSelect={setSelectedSlug}
          />
        )}
      </aside>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/help/HelpDrawer.jsx
git commit -m "feat(help): add search, Esc key, and backdrop close"
```

---

## Task 7: HelpChrome Wrapper with Portal

Wrap the button and drawer in a portal-mounted component that owns state and handles deep-linking via `?help=<slug>`.

**Files:**
- Create: `src/components/help/HelpChrome.jsx`

- [ ] **Step 1: Write HelpChrome.jsx**

```jsx
// src/components/help/HelpChrome.jsx
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import HelpButton from './HelpButton.jsx';
import HelpDrawer from './HelpDrawer.jsx';

export default function HelpChrome({ profile }) {
  const [open, setOpen] = useState(false);
  const [initialSlug, setInitialSlug] = useState(null);

  // Deep link: ?help=<slug> opens drawer on that article once per mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('help');
    if (slug) {
      setInitialSlug(slug);
      setOpen(true);
      // Strip the param so it doesn't re-trigger on re-renders
      params.delete('help');
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <HelpButton open={open} onToggle={() => setOpen(v => !v)} />
      <HelpDrawer
        open={open}
        onClose={() => setOpen(false)}
        profile={profile}
        initialSlug={initialSlug}
      />
    </>,
    document.body
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/help/HelpChrome.jsx
git commit -m "feat(help): add HelpChrome portal wrapper with deep-link support"
```

---

## Task 8: App.jsx Integration

Mount `<HelpChrome />` at the bottom of each non-auth early-return branch in `App.jsx`. Do not mount on login or reset-password.

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add import at top of App.jsx**

Find the existing import block (lines 1–22) and add `HelpChrome`:

```jsx
import HelpChrome from './components/help/HelpChrome.jsx';
```

Place it after the other `./components/` imports (alphabetical order) — e.g., after the `DashboardPage` line.

- [ ] **Step 2: Wrap the `bookings-page` return**

Find this block (around line 243):

```jsx
  if (view === 'bookings-page') {
    return <BookingsPage userId={session?.user?.id} onExit={() => setView('dashboard')} />;
  }
```

Replace with:

```jsx
  if (view === 'bookings-page') {
    return <>
      <BookingsPage userId={session?.user?.id} onExit={() => setView('dashboard')} />
      <HelpChrome profile={profile} />
    </>;
  }
```

- [ ] **Step 3: Wrap the `booking-settings` return**

Find this block (around line 247):

```jsx
  if (view === 'booking-settings' && settingsSiteId) {
    return <BookingSettingsPage siteId={settingsSiteId} onExit={() => { setSettingsSiteId(null); setView('dashboard'); }} />;
  }
```

Replace with:

```jsx
  if (view === 'booking-settings' && settingsSiteId) {
    return <>
      <BookingSettingsPage siteId={settingsSiteId} onExit={() => { setSettingsSiteId(null); setView('dashboard'); }} />
      <HelpChrome profile={profile} />
    </>;
  }
```

- [ ] **Step 4: Wrap the `admin` return**

Find this block (around line 251):

```jsx
  if (view === 'admin') {
    return <AdminPage onExit={() => setView('dashboard')} />;
  }
```

Replace with:

```jsx
  if (view === 'admin') {
    return <>
      <AdminPage onExit={() => setView('dashboard')} />
      <HelpChrome profile={profile} />
    </>;
  }
```

- [ ] **Step 5: Wrap the `dashboard` return**

Find this block (around line 255):

```jsx
  if (view === 'dashboard') {
    return <DashboardPage
      onNewSite={() => { handleStartOver(); setView('wizard'); }}
      onEditSite={handleEditSite}
      onSignOut={handleSignOut}
      userEmail={session?.user?.email}
      profile={profile}
      onOpenAdmin={() => setView('admin')}
      onOpenBookings={() => setView('bookings-page')}
      onOpenBookingSettings={(siteId) => { setSettingsSiteId(siteId); setView('booking-settings'); }}
    />;
  }
```

Replace with:

```jsx
  if (view === 'dashboard') {
    return <>
      <DashboardPage
        onNewSite={() => { handleStartOver(); setView('wizard'); }}
        onEditSite={handleEditSite}
        onSignOut={handleSignOut}
        userEmail={session?.user?.email}
        profile={profile}
        onOpenAdmin={() => setView('admin')}
        onOpenBookings={() => setView('bookings-page')}
        onOpenBookingSettings={(siteId) => { setSettingsSiteId(siteId); setView('booking-settings'); }}
      />
      <HelpChrome profile={profile} />
    </>;
  }
```

- [ ] **Step 6: Wrap the `step === 5` (preview) return**

Find this block (around line 286):

```jsx
  if (step === 5 && generatedCopy) {
    return (
      <WebsitePreview
        // ... many props ...
        isDemoPreview={isDemoPreview}
      />
    );
  }
```

Replace with (preserving all existing props):

```jsx
  if (step === 5 && generatedCopy) {
    return (
      <>
        <WebsitePreview
          businessInfo={isDemoPreview ? DEMO_BUSINESS_INFO : businessInfo}
          generatedCopy={generatedCopy}
          editedCopy={editedCopy}
          onEditedCopyChange={(newCopy) => { setEditedCopy(newCopy); autoSave({ editedCopy: newCopy }); }}
          images={images}
          onImagesChange={(newImages) => { const resolved = typeof newImages === 'function' ? newImages(images) : newImages; setImages(resolved); autoSave({ images: resolved }); }}
          templateId={selectedTemplate}
          templateMeta={templateMeta}
          customColors={customColors}
          onCustomColors={(next) => {
            const resolved = typeof next === 'function' ? next(customColors) : next;
            setCustomColors(resolved);
            autoSave({ customColors: resolved });
          }}
          customFonts={customFonts}
          onCustomFonts={(next) => {
            const resolved = typeof next === 'function' ? next(customFonts) : next;
            setCustomFonts(resolved);
            autoSave({ customFonts: resolved });
          }}
          onBack={isDemoPreview ? handleBackFromDemo : () => goTo(3)}
          onExport={isDemoPreview ? null : () => goTo(6)}
          onStartOver={() => { handleStartOver(); setView('dashboard'); }}
          isDemoPreview={isDemoPreview}
        />
        <HelpChrome profile={profile} />
      </>
    );
  }
```

- [ ] **Step 7: Wrap the `step === 5.5` (social feeds) return**

Find this block:

```jsx
  if (step === 5.5) {
    return (
      <StepSocialFeeds
        // ... props ...
      />
    );
  }
```

Replace with (preserving all existing props):

```jsx
  if (step === 5.5) {
    return (
      <>
        <StepSocialFeeds
          selectedWidgetIds={selectedWidgetIds}
          onWidgetIdsChange={setSelectedWidgetIds}
          onWidgetKeysChange={({ googleWidgetKey, instagramWidgetKey }) => {
            setEditedCopy((prev) => ({ ...prev, googleWidgetKey, instagramWidgetKey }));
          }}
          onNext={() => goTo(6)}
          onBack={() => goTo(5)}
        />
        <HelpChrome profile={profile} />
      </>
    );
  }
```

- [ ] **Step 8: Wrap the `step === 6` (export) return**

Find the export return block and replace with (preserving all existing props):

```jsx
  if (step === 6 && generatedCopy) {
    return (
      <>
        <StepExport
          siteId={siteId}
          businessInfo={businessInfo}
          generatedCopy={editedCopy || generatedCopy}
          templateId={selectedTemplate}
          templateMeta={templateMeta}
          images={images}
          selectedWidgetIds={selectedWidgetIds}
          onBack={() => goTo(5)}
          onStartOver={() => { handleStartOver(); setView('dashboard'); }}
        />
        <HelpChrome profile={profile} />
      </>
    );
  }
```

- [ ] **Step 9: Wrap the default WizardShell return**

Find the final `return` in App.jsx (the WizardShell block at the bottom):

```jsx
  return (
    <WizardShell ...>
      {step === 1 && (...)}
      {step === 2 && (...)}
      {step === 3 && (...)}
      {step === 4 && (...)}
    </WizardShell>
  );
```

Replace with (preserving all existing children and props):

```jsx
  return (
    <>
      <WizardShell step={step} onBack={goBack} userEmail={session?.user?.email} profile={profile} onMySites={() => setView('dashboard')} onOpenBookings={() => setView('bookings-page')} onOpenAdmin={() => setView('admin')} onSignOut={handleSignOut}>
        {step === 1 && (
          <StepBusinessType onSelect={handleBusinessTypeSelect} />
        )}
        {step === 2 && (
          <StepBusinessInfo
            businessType={businessType}
            initialValues={businessInfo}
            onSubmit={handleBusinessInfoSubmit}
          />
        )}
        {step === 3 && (
          <StepTemplatePicker
            businessType={businessType}
            selected={selectedTemplate}
            onSelect={handleTemplateSelect}
            onGenerate={handleGenerate}
            onPreview={handlePreviewDemo}
            error={error}
            customColors={customColors}
            onCustomColors={setCustomColors}
          />
        )}
        {step === 4 && (
          <StepGenerating
            businessInfo={businessInfo}
            templateMeta={templateMeta}
            onSuccess={handleGenerateSuccess}
            onError={handleGenerateError}
          />
        )}
      </WizardShell>
      <HelpChrome profile={profile} />
    </>
  );
```

- [ ] **Step 10: Start dev server and manually verify**

Run: `npm run dev`

In a browser, open http://127.0.0.1:5173 and verify:
1. Sign in (or use an existing session)
2. On dashboard → floating red "?" button bottom-right ✅
3. Click it → drawer slides in from right with 7 articles (or 6 if `scheduler_enabled` is false) ✅
4. Click an article → see placeholder steps ✅
5. Click "← Help Center" → back to list ✅
6. Type in search → filters ✅
7. Press Esc → drawer closes ✅
8. Click backdrop → drawer closes ✅
9. Click "×" → drawer closes ✅
10. Navigate to wizard (new site) → button still visible ✅
11. Navigate into preview (step 5) → button still visible ✅
12. Sign out → landing page — **button should NOT appear** (help is signed-in-only for v1)

Note: Step 12 verifies the spec's "signed-in-only" constraint. The landing page renders from `<LandingPage>` before the session-gated branches, so HelpChrome is never mounted for signed-out users.

- [ ] **Step 11: Open /?help=the-edit-menu and verify deep link**

Open http://127.0.0.1:5173/?help=the-edit-menu

Expected: drawer opens on page load directly to "The Edit Menu" article. URL updates to remove `?help=` after opening.

- [ ] **Step 12: Commit**

```bash
git add src/App.jsx
git commit -m "feat(help): mount HelpChrome across all signed-in view branches"
```

---

## Task 9: Verify Build

Before moving to screenshots, make sure the app still builds cleanly with the new components.

**Files:** none (verification only)

- [ ] **Step 1: Run the build**

Run: `npm run build`

Expected: build succeeds, no errors, `dist/` populated.

- [ ] **Step 2: Run linter**

Run: `npm run lint`

Expected: no new lint errors. If any appear in the new `src/components/help/` files, fix them (most likely: unused imports, missing prop-types which this codebase doesn't enforce, or `no-unused-vars`).

- [ ] **Step 3: Run existing tests**

Run: `npm test`

Expected: all existing tests still pass + the 8 new `formatInline` tests pass.

- [ ] **Step 4: Commit any lint fixes**

If lint produced fixes:

```bash
git add -u
git commit -m "chore(help): lint cleanup"
```

Otherwise skip.

---

## Task 10: Capture Screenshots from Live Site

This task is an interactive browser-driven session using Chrome MCP against `https://sitebuilder.autocaregenius.com/`. It requires the user to confirm the verification email mid-session.

**Files:**
- Create: `public/help/getting-started-01.png` through `public/help/bookings-04.png` (~28 PNG files)

**Prerequisites:**
- Chrome MCP tools available: `mcp__Claude_in_Chrome__navigate`, `mcp__Claude_in_Chrome__computer`, `mcp__Claude_in_Chrome__find`, `mcp__Claude_in_Chrome__get_page_text`, `mcp__Claude_in_Chrome__resize_window`
- User has mailbox access for `dev@639hz.com` to confirm the verification email
- `public/help/` directory created

- [ ] **Step 1: Create screenshot directory**

Run: `mkdir -p public/help`

- [ ] **Step 2: Resize Chrome to desktop capture size**

Call `mcp__Claude_in_Chrome__resize_window` with `width=1440, height=900`.

- [ ] **Step 3: Navigate to live site, capture landing**

Call `mcp__Claude_in_Chrome__navigate` to `https://sitebuilder.autocaregenius.com/`.

Wait for page load. Capture a full-viewport screenshot via `mcp__Claude_in_Chrome__computer` with `action='screenshot'`.

Save to `public/help/getting-started-01.png` (landing page overview).

- [ ] **Step 4: Capture sign-up form**

Click **Sign In** → switch to sign-up form. Capture screenshot, save to `public/help/getting-started-02.png`.

- [ ] **Step 5: Create the test account**

Fill in sign-up form:
- Email: `dev+tutorial-<TIMESTAMP>@639hz.com` (replace `<TIMESTAMP>` with current epoch seconds)
- Password: generate a random 16-char password, store temporarily in the session

Submit. **PAUSE HERE** and ask the user:

> "Account created with email `dev+tutorial-<TIMESTAMP>@639hz.com`. Please check your inbox (dev@639hz.com), click the verification link, and tell me when you're signed in. I'll continue once confirmed."

Wait for user confirmation.

- [ ] **Step 6: Post-confirm — navigate back to site, sign in**

After user confirms, sign in with the new credentials. Capture dashboard empty state → `public/help/managing-sites-01.png`.

- [ ] **Step 7: Capture wizard step 1 (business type picker)**

Click **New Site**. Capture business type picker → `public/help/business-type-and-template-01.png`.

- [ ] **Step 8: Capture wizard step 2 (business info form)**

Select a business type (e.g., "Auto Repair"). Look for a **Fill Demo** button on the form — click it to populate. Capture the filled form → `public/help/business-type-and-template-02.png`.

- [ ] **Step 9: Capture wizard step 3 (template picker)**

Submit the form. Capture template grid → `public/help/business-type-and-template-03.png`.

Select a template. Wait for the customization panel (if any). Capture the color/font customization UI → `public/help/business-type-and-template-04.png`.

- [ ] **Step 10: Capture AI generation in progress**

Click **Generate Site**. Immediately capture the loading/generating view → `public/help/getting-started-03.png`.

- [ ] **Step 11: Capture edit menu — the 10 shots**

Wait for generation to complete. You land on the preview. Now capture the edit menu interactions:

1. `public/help/the-edit-menu-01.png` — full preview with top toolbar visible, pencil/edit icon highlighted (will add annotation in article data)
2. Click an editable text region. Capture inline edit state → `the-edit-menu-02.png`
3. Click an image. Capture image replace modal → `the-edit-menu-03.png`
4. Open color picker panel → `the-edit-menu-04.png`
5. Change a color → `the-edit-menu-05.png` (shows before/after or updated preview)
6. Open font picker panel → `the-edit-menu-06.png`
7. Section add/remove UI → `the-edit-menu-07.png`
8. Auto-save indicator state → `the-edit-menu-08.png`
9. Resize to mobile (390×844) → capture same preview in mobile → `the-edit-menu-09.png`
10. Resize back to 1440×900. Capture a "finished edited" state → `the-edit-menu-10.png`

Use `mcp__Claude_in_Chrome__resize_window` for step 9.

- [ ] **Step 12: Capture Google Reviews setup**

Click **Continue** / next to go to Social Feeds (step 5.5). Capture the Google Reviews widget key input → `public/help/google-reviews-01.png`.

Skip entering a real widget key (leave blank or use a known-safe demo key if one exists). Capture the resulting preview → `google-reviews-02.png`.

- [ ] **Step 13: Capture publish flow**

Continue to Export (step 6). Capture the export/publish screen → `public/help/publishing-01.png`.

Click **Publish**. Capture publishing in-progress state → `publishing-02.png`.

Capture published URL result → `publishing-03.png`.

- [ ] **Step 14: Capture dashboard with site**

Click **My Sites** or navigate back to dashboard. Capture with the new site card → `public/help/managing-sites-02.png`.

Click the per-site menu (delete/republish/etc) — capture → `managing-sites-03.png` (if the UI exposes a menu).

- [ ] **Step 15: Capture Bookings (conditional)**

Check the profile: does this new account have `scheduler_enabled = true`?

If NO:
- **PAUSE** and ask the user:
  > "The Bookings article needs 4 screenshots. The test account doesn't have `scheduler_enabled`. Can you flip this flag in Supabase for `dev+tutorial-<TIMESTAMP>@639hz.com`? Tell me when done, or tell me to skip bookings shots for now."
- If user skips: continue to Step 16 without bookings shots; note in Task 11 to leave Bookings article with text-only steps (no screenshots).
- If user enables: refresh the page, continue.

If YES (or after enabling):
- Navigate to Booking Settings for the site. Capture → `public/help/bookings-01.png`
- Capture the availability / calendar UI → `bookings-02.png`
- Navigate to Bookings page (My Bookings list). Capture empty state → `bookings-03.png`
- If possible, create a test booking via the published site, then screenshot the incoming booking row → `bookings-04.png` (optional — skip if booking flow is complex)

- [ ] **Step 16: Cleanup test site**

Navigate to dashboard. Delete the test site via the per-site menu.

Confirm the Supabase `sites` row was removed (the dashboard should show the empty state).

Do NOT delete the user account — keeping it lets us update screenshots later.

- [ ] **Step 17: Verify all files saved**

Run: `ls public/help/ | sort`

Expected: ~20–28 PNG files. If Bookings was skipped, expect ~20; if fully captured, ~28.

- [ ] **Step 18: Commit**

```bash
git add public/help/
git commit -m "feat(help): add captured screenshots from live production site"
```

---

## Task 11: Fill Real Article Content

Replace the placeholder text in `articles.js` with real prose, screenshot paths, and annotations. This is the bulk of the content work.

**Files:**
- Modify: `src/components/help/articles.js`

- [ ] **Step 1: Rewrite the `getting-started` article**

Open `src/components/help/articles.js`. Replace the `getting-started` entry with:

```js
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description: 'Zero to published site in 5 minutes.',
    icon: '🚀',
    readTime: '5 min read',
    schedulerOnly: false,
    steps: [
      {
        heading: 'Welcome',
        body: "This site builder turns a few details about your business into a live website — copy, images, colors, and all. No coding, no design skills. You'll finish in about 5 minutes.\n\nHere's the full flow, start to finish.",
        screenshot: '/help/getting-started-01.png',
      },
      {
        heading: 'Sign up',
        body: 'Click **Sign In** in the top-right corner of the landing page, then switch to sign-up. Enter your email and a password. You\'ll get a verification email — click the link inside to activate your account.',
        screenshot: '/help/getting-started-02.png',
        callout: { type: 'heads-up', text: 'Check your spam folder if the email doesn\'t arrive within 2 minutes.' },
      },
      {
        heading: 'Pick your business type',
        body: 'Once signed in, click **New Site** on the dashboard. Pick the option that best matches your business — this shapes the templates and copy the AI generates.',
      },
      {
        heading: 'Fill in the details',
        body: 'Add your business name, a short description, hours, and contact info. The more specific you are, the better the AI output. Short on time? Click **Fill Demo** to see how the form should look.',
      },
      {
        heading: 'Pick a template',
        body: 'Browse the template grid and pick one that matches the vibe you want. You can tweak colors and fonts before generation — or after, in the edit menu.',
      },
      {
        heading: 'Generate',
        body: 'Click **Generate Site**. The AI writes headlines, services, about-us copy, and more — tailored to the details you entered. This takes about 30 seconds.',
        screenshot: '/help/getting-started-03.png',
        callout: { type: 'tip', text: 'You can regenerate any section later from the edit menu if you don\'t love the first draft.' },
      },
      {
        heading: 'Edit, publish, share',
        body: "That's it — you're in the editor. Read **The Edit Menu** article to learn how to tweak text, images, colors, and fonts. When you're ready, publish from the **Export** step and share your live URL.",
      },
    ],
  },
```

- [ ] **Step 2: Rewrite the `business-type-and-template` article**

Replace the entry with:

```js
  {
    slug: 'business-type-and-template',
    title: 'Choosing a Business Type & Template',
    description: 'Pick what fits your business and customize colors.',
    icon: '🎨',
    readTime: '3 min read',
    schedulerOnly: false,
    steps: [
      {
        heading: 'Start a new site',
        body: 'From the dashboard, click **New Site** to open the wizard. Step 1 asks what type of business you run.',
        screenshot: '/help/business-type-and-template-01.png',
      },
      {
        heading: 'Pick the closest match',
        body: "If your exact business isn't listed, pick the closest option. The business type mostly shapes the default copy tone and which templates appear — you can override everything later.",
      },
      {
        heading: 'Fill in your details',
        body: 'Step 2 collects your business name, tagline, hours, contact info, and a brief description. Be specific — the AI uses these verbatim in headlines and body copy.',
        screenshot: '/help/business-type-and-template-02.png',
        callout: { type: 'tip', text: 'Click **Fill Demo** to auto-populate with example data if you want to preview the flow first.' },
      },
      {
        heading: 'Browse templates',
        body: 'Step 3 shows a grid of templates filtered to your business type. Each template has a distinct layout, font pairing, and mood. Click one to select it.',
        screenshot: '/help/business-type-and-template-03.png',
      },
      {
        heading: 'Customize colors and fonts',
        body: 'After selecting, a customization panel appears. Tweak primary and accent colors, switch between serif or sans-serif fonts, and preview changes live.',
        screenshot: '/help/business-type-and-template-04.png',
      },
      {
        heading: 'Generate',
        body: 'When you\'re happy with the template and colors, click **Generate Site**. The AI fills in all the text, sections, and structure using your details.',
      },
    ],
  },
```

- [ ] **Step 3: Rewrite the `the-edit-menu` article**

Replace with:

```js
  {
    slug: 'the-edit-menu',
    title: 'The Edit Menu',
    description: 'Edit text, images, colors, and fonts on your site.',
    icon: '✏️',
    readTime: '4 min read',
    schedulerOnly: false,
    steps: [
      {
        heading: 'Open the preview',
        body: 'After generating, you land directly in the preview. This is your live site — what you see here is what your visitors will see.',
        screenshot: '/help/the-edit-menu-01.png',
        callout: { type: 'tip', text: 'All changes save automatically as you work — there\'s no Save button to click.' },
      },
      {
        heading: 'Click any text to edit',
        body: 'Hover over any heading, paragraph, or list item. You\'ll see an edit outline appear. Click it to open an inline editor where you can rewrite the text.',
        screenshot: '/help/the-edit-menu-02.png',
      },
      {
        heading: 'Replace an image',
        body: "Click any image on your site to open the image editor. You can upload a new file, paste a URL, or pick from your previous uploads. For icons, you can also pick an emoji or icon name.",
        screenshot: '/help/the-edit-menu-03.png',
      },
      {
        heading: 'Change colors',
        body: 'Open the **Colors** panel from the top toolbar. Adjust primary, accent, background, and text colors. Changes apply instantly across the whole site.',
        screenshot: '/help/the-edit-menu-04.png',
      },
      {
        heading: 'Preview color changes',
        body: 'As you change colors, the preview updates live. Try a few combinations — you can always revert from the template\'s default if you want to start over.',
        screenshot: '/help/the-edit-menu-05.png',
      },
      {
        heading: 'Change fonts',
        body: 'Open the **Fonts** panel. Pick a heading font and a body font — the site applies the pairing immediately. Font pairings are curated for readability.',
        screenshot: '/help/the-edit-menu-06.png',
      },
      {
        heading: 'Add or remove sections',
        body: 'Each section on your site has controls to hide it or show it. Use these to streamline the page — remove what you don\'t need, keep what\'s most important for your visitors.',
        screenshot: '/help/the-edit-menu-07.png',
      },
      {
        heading: 'Auto-save',
        body: 'A small indicator in the top toolbar shows when changes are saved. You\'ll see "Saving..." briefly after each edit, then "Saved". You can close the browser without losing work.',
        screenshot: '/help/the-edit-menu-08.png',
        callout: { type: 'heads-up', text: 'Auto-save runs 1.5 seconds after your last edit. If you\'re making rapid changes, wait a moment before closing the tab.' },
      },
      {
        heading: 'Preview on mobile',
        body: 'Resize your browser or open the preview on your phone to see how your site looks on mobile. The layout adapts automatically — no extra work needed.',
        screenshot: '/help/the-edit-menu-09.png',
      },
      {
        heading: 'When you\'re done',
        body: 'When the site looks right, click **Continue** to move to Social Feeds (optional), then **Publish** to push it live. You can always come back and edit more from the **My Sites** dashboard.',
        screenshot: '/help/the-edit-menu-10.png',
      },
    ],
  },
```

- [ ] **Step 4: Rewrite the `google-reviews` article**

Replace with:

```js
  {
    slug: 'google-reviews',
    title: 'Adding Google Reviews',
    description: 'Show live Google reviews on your site.',
    icon: '⭐',
    readTime: '2 min read',
    schedulerOnly: false,
    steps: [
      {
        heading: 'Get your widget key',
        body: 'Google Reviews are pulled via SocialFeed — you\'ll need a widget key from your SocialFeed account. If you don\'t have one, sign up at `socialfeed.com` and connect your Google Business Profile.',
      },
      {
        heading: 'Open the Social Feeds step',
        body: 'After editing in the preview, click **Continue** to move to the Social Feeds step. You\'ll see a Google Reviews section with an input for the widget key.',
        screenshot: '/help/google-reviews-01.png',
      },
      {
        heading: 'Paste your key',
        body: 'Paste the widget key into the input and click **Save**. The key is stored with your account — you only need to enter it once.',
        callout: { type: 'tip', text: 'Your widget key is saved to your profile. Future sites you create will use the same key automatically.' },
      },
      {
        heading: 'Preview the reviews',
        body: 'Go back to the preview. A new Reviews section now shows your live Google reviews — the 5 most recent, in a carousel on desktop and a stack on mobile.',
        screenshot: '/help/google-reviews-02.png',
      },
    ],
  },
```

- [ ] **Step 5: Rewrite the `publishing` article**

Replace with:

```js
  {
    slug: 'publishing',
    title: 'Publishing Your Site',
    description: 'Publish to a live URL and update later.',
    icon: '🌐',
    readTime: '3 min read',
    schedulerOnly: false,
    steps: [
      {
        heading: 'Open the Export step',
        body: 'From the preview, click **Continue** until you reach the **Export** step. This is where you publish your site to a live URL.',
        screenshot: '/help/publishing-01.png',
      },
      {
        heading: 'Pick a slug',
        body: 'Your site will be published at `https://<slug>.autocaregenius.com`. Pick a short, memorable slug (your business name works well). The slug must be unique.',
      },
      {
        heading: 'Publish',
        body: 'Click **Publish**. The site deploys in a few seconds. You\'ll see a confirmation with your live URL — click to open.',
        screenshot: '/help/publishing-02.png',
      },
      {
        heading: 'Share your URL',
        body: 'Copy the URL and share it anywhere — social media, email, business cards, Google Business Profile. Your site is live and public.',
        screenshot: '/help/publishing-03.png',
      },
      {
        heading: 'Update your site later',
        body: 'To update a published site: go to **My Sites**, click **Edit** on the site card, make your changes, then click **Republish** from the dashboard. The live URL stays the same.',
        callout: { type: 'heads-up', text: 'Republishing overwrites the live version immediately. If you want to preview changes privately first, edit without clicking Republish.' },
      },
    ],
  },
```

- [ ] **Step 6: Rewrite the `managing-sites` article**

Replace with:

```js
  {
    slug: 'managing-sites',
    title: 'Managing Your Sites',
    description: 'Edit, republish, or delete from your dashboard.',
    icon: '📁',
    readTime: '2 min read',
    schedulerOnly: false,
    steps: [
      {
        heading: 'Open My Sites',
        body: 'Click **My Sites** in the top navigation. You\'ll see a list of every site you\'ve created, with the most recent first.',
        screenshot: '/help/managing-sites-01.png',
      },
      {
        heading: 'Edit a site',
        body: 'Click **Edit** on any site card to jump back into the preview and make changes. Your edits save automatically.',
        screenshot: '/help/managing-sites-02.png',
      },
      {
        heading: 'Republish after editing',
        body: 'After editing a published site, click **Republish** on the site card to push your changes live. The URL stays the same.',
        screenshot: '/help/managing-sites-03.png',
      },
      {
        heading: 'Delete a site',
        body: 'Click **Delete** on the site card to remove a site permanently. If the site is published, this also unpublishes it — the live URL will stop working.',
        callout: { type: 'heads-up', text: 'Deletion is permanent. Free accounts are limited to 1 site — deleting a site lets you create a new one.' },
      },
    ],
  },
```

- [ ] **Step 7: Rewrite the `bookings` article**

Replace with (screenshots conditional — use `null` if screenshots were skipped in Task 10, otherwise use the paths):

```js
  {
    slug: 'bookings',
    title: 'Bookings',
    description: 'Accept appointments directly from your site.',
    icon: '📅',
    readTime: '3 min read',
    schedulerOnly: true,
    steps: [
      {
        heading: 'Enable bookings on a site',
        body: 'Bookings are available when your account has the scheduler feature enabled. If you don\'t see Booking Settings on your dashboard, contact support.',
      },
      {
        heading: 'Configure availability',
        body: 'From the dashboard, click **Booking Settings** on any site card. Set your weekly availability — which days, which hours you\'re open for appointments.',
        screenshot: '/help/bookings-01.png',
      },
      {
        heading: 'Define services',
        body: 'Add the services customers can book: name, duration, and buffer time between appointments. Each service becomes a bookable option on your site.',
        screenshot: '/help/bookings-02.png',
      },
      {
        heading: 'Embed the booking widget',
        body: 'When bookings are enabled, a booking widget appears in your published site — visitors can pick a service, choose a time slot, and confirm directly.',
      },
      {
        heading: 'View incoming bookings',
        body: 'Open **Bookings** from the top navigation. You\'ll see every upcoming appointment, sortable by date or service. Click a booking for full details and contact info.',
        screenshot: '/help/bookings-03.png',
      },
      {
        heading: 'Manage bookings',
        body: 'Confirm, reschedule, or cancel any appointment. The customer receives an email for each status change.',
        screenshot: '/help/bookings-04.png',
        callout: { type: 'tip', text: 'Connect Google Calendar to sync confirmed bookings automatically. Settings → Calendar Integrations.' },
      },
    ],
  },
```

**If Task 10 skipped bookings screenshots:** remove the `screenshot:` lines from this article (set to the step-key without `screenshot`) so it renders text-only. Leave the rest of the article as-is.

- [ ] **Step 8: Start dev server and verify content**

Run: `npm run dev`

In browser at http://127.0.0.1:5173:
1. Sign in
2. Open help drawer
3. Click through each of the 7 articles (6 if no scheduler access)
4. Verify every screenshot loads — no broken image icons
5. Verify `**bold**`, `*italic*`, and `` `code` `` render correctly
6. Verify callouts (tip = green, heads-up = yellow) appear correctly
7. Resize browser to mobile width — verify drawer becomes full-screen

- [ ] **Step 9: Add annotations to key steps (optional but valuable for Edit Menu)**

Reopen `articles.js`. On `the-edit-menu` step 1 (`the-edit-menu-01.png`), identify the coordinates of the edit icon in the top toolbar (roughly top-right area of the screenshot — measure by opening the PNG and estimating the center of the icon as a fraction of width/height).

Add an annotation:

```js
      {
        heading: 'Open the preview',
        body: '...',
        screenshot: '/help/the-edit-menu-01.png',
        annotations: [{ x: 0.82, y: 0.06, label: 'Edit here' }],  // Adjust to actual position
        callout: { type: 'tip', text: 'All changes save automatically as you work — there\'s no Save button to click.' },
      },
```

Add 3–5 annotations total across the most-confusing steps (edit icon location, image replace modal trigger, color panel button). Verify each in the browser.

- [ ] **Step 10: Commit**

```bash
git add src/components/help/articles.js
git commit -m "feat(help): fill real article content with screenshots and annotations"
```

---

## Task 12: Final Verification

End-to-end check before pushing. Make sure nothing is broken.

**Files:** none (verification only)

- [ ] **Step 1: Full manual walkthrough**

Run: `npm run dev`

On desktop (1440×900):
- Sign in → help button visible on every signed-in screen ✅
- Open drawer → 7 articles render (or 6 if schedulerOnly is false) ✅
- Click each article → content renders, screenshots load, formatting applied ✅
- Search "edit" → only matches appear ✅
- Search "zzzzz" → empty state appears ✅
- Esc closes drawer ✅
- Backdrop click closes drawer ✅
- X button closes drawer ✅
- Deep link `?help=google-reviews` opens that article ✅

On mobile (resize to 390×844):
- Help button visible ✅
- Drawer opens full-screen ✅
- All articles still readable ✅
- Screenshots scale to width ✅

Sign out → landing page → help button should NOT appear ✅

- [ ] **Step 2: Build and test**

Run: `npm run build && npm run lint && npm test`

Expected: build succeeds, zero lint errors, all tests pass (including the 8 new `formatInline` tests).

- [ ] **Step 3: Push branch and open PR**

```bash
git push -u origin claude/youthful-pare-757eaa
gh pr create --title "feat: in-app help system with 7 tutorial articles" --body "$(cat <<'EOF'
## Summary
- Floating help button visible on every signed-in screen
- Slide-in drawer with 7 tutorial articles: Getting Started, Business Type & Template, The Edit Menu, Google Reviews, Publishing, Managing Sites, Bookings (scheduler-gated)
- Real screenshots captured from the live production site
- Deep links supported via `?help=<slug>` query param

## Test plan
- [ ] Sign in, verify floating "?" button appears on dashboard, wizard, preview, export, bookings, admin
- [ ] Open drawer, click through each of 7 articles, verify screenshots load
- [ ] Verify search filter on article list
- [ ] Verify Esc, backdrop, and X all close the drawer
- [ ] Verify mobile (≤640px) shows full-screen drawer
- [ ] Verify signed-out landing page does NOT show help button
- [ ] Verify `/?help=the-edit-menu` deep links directly to that article

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Report the PR URL back to the user.

- [ ] **Step 4: Final commit if any fixes needed from verification**

If Step 1 surfaced issues, fix them and commit:

```bash
git add -u
git commit -m "fix(help): address verification issues"
git push
```

Otherwise nothing to commit.

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Floating help button (Task 3)
- ✅ Slide-in drawer with list + article view (Tasks 4–5)
- ✅ Search, Esc, backdrop close (Task 6)
- ✅ HelpChrome portal wrapper with deep link (Task 7)
- ✅ App.jsx integration across all 8 non-auth branches (Task 8)
- ✅ 7 articles with real content (Task 11)
- ✅ Screenshot capture from live site (Task 10)
- ✅ schedulerOnly gating (Task 5/7)
- ✅ formatInline utility with 8 tests (Task 1)
- ✅ Annotation overlays (Task 11 step 9)
- ✅ Style tokens match existing codebase (Tasks 3–5)
- ✅ PR opened (Task 12)
- ⚠️ Focus trap — spec mentions "Focus trap while open; focus returns to button on close". This is a minor accessibility nicety and is NOT in the task list above to keep v1 shippable. Recommend adding as a follow-up issue post-merge. If you want it in v1, insert a small Task 6.5 using `focus-trap-react` or a hand-rolled trap — adds ~30 min.

**No placeholders in tasks:** all code is complete, all commands specified, all expected outcomes documented.

**Type consistency:** `formatInline` signature matches across tasks; `ARTICLES` array shape matches spec; `HelpChrome` / `HelpButton` / `HelpDrawer` props are consistent across tasks 3–8.
