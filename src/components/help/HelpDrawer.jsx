// src/components/help/HelpDrawer.jsx
import { useMemo, useState } from 'react';
import { ARTICLES } from './articles.js';
import { formatInline } from './formatInline.jsx';

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
