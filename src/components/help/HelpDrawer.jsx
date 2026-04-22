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
