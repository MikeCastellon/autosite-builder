import { useEffect, useMemo, useState } from 'react';
import { ARTICLES } from './articles.js';
import { formatInline } from './formatInline.jsx';
import { isEffectiveSchedulerActive } from '../../lib/subscriptionGating.js';

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

function ProBadge() {
  return (
    <span className="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#cc0000]/10 text-[#cc0000]">
      Pro
    </span>
  );
}

function ArticleStep({ step }) {
  return (
    <div className="mb-6">
      <h3 className="font-semibold text-[#1a1a1a] mb-2">{step.heading}</h3>
      <div className="text-sm text-[#1a1a1a] leading-relaxed">{formatInline(step.body)}</div>
      {step.screenshot && (
        <div className="relative mt-3 rounded-lg overflow-hidden border border-black/[0.07]">
          <img src={step.screenshot} alt={step.heading} className="block w-full" />
        </div>
      )}
      <Callout callout={step.callout} />
    </div>
  );
}

function ArticleView({ article, onBack }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-4 border-b border-black/[0.07]">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-[#cc0000] hover:underline flex items-center gap-1 mb-3"
        >
          ← Help Center
        </button>
        <h1 className="text-xl font-semibold text-[#1a1a1a] flex items-center">
          {article.title}
          {article.isPro && <ProBadge />}
        </h1>
        <div className="text-xs text-[#888] mt-1">{article.readTime}</div>
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
          className="w-full px-3 py-2 rounded-lg border border-black/[0.07] bg-white text-sm focus:outline-none focus:border-[#cc0000] focus:ring-1 focus:ring-[#cc0000]"
        />
      </div>
      <div className="p-4 pt-2 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-sm text-[#888] text-center py-8">
            No articles match "{query}"
          </div>
        ) : (
          filtered.map(article => (
            <button
              key={article.slug}
              type="button"
              onClick={() => onSelect(article.slug)}
              className="w-full text-left bg-white border border-black/[0.07] rounded-xl p-4 hover:border-[#cc0000] transition-colors duration-150 flex gap-3 items-start"
            >
              <span className="text-2xl leading-none" aria-hidden="true">{article.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[#1a1a1a] flex items-center">
                  {article.title}
                  {article.isPro && <ProBadge />}
                </div>
                <div className="text-sm text-[#888] mt-1">{article.description}</div>
                <div className="text-xs text-[#888] mt-2">{article.readTime}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default function HelpDrawer({ open, onClose, profile, initialSlug }) {
  const [selectedSlug, setSelectedSlug] = useState(initialSlug || null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const visibleArticles = useMemo(() => {
    // All articles show to all users — Pro-gated articles just get a badge.
    // If an article has `hiddenUnlessPro: true`, respect it.
    const isPro = isEffectiveSchedulerActive(profile);
    return ARTICLES.filter(a => !a.hiddenUnlessPro || isPro);
  }, [profile]);

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
        <header className="flex items-center justify-between px-6 py-4 border-b border-black/[0.07]">
          <h2 className="text-lg font-semibold text-[#1a1a1a]">Help Center</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center text-xl leading-none text-[#888]"
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
