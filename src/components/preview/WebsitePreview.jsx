import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { TEMPLATE_COMPONENT_MAP } from '../../data/templates.js';
import { normalizeBusinessInfo } from '../../lib/normalizeBusinessInfo.js';
import PreviewToolbar from './PreviewToolbar.jsx';
import ContentEditor from './ContentEditor.jsx';
import EditorTour from '../onboarding/EditorTour.jsx';
import { useAuth } from '../../lib/AuthContext.jsx';
import { isEffectiveSchedulerActive } from '../../lib/subscriptionGating.js';
import { isImpersonationTab } from '../../lib/supabase.js';
import { IMPERSONATION_BAR_HEIGHT } from '../admin/ImpersonationBanner.jsx';
import { EditorModeProvider } from './templates/kit/EditorMode.jsx';
import { SITE_BASE_CSS } from '../../lib/siteRuntime.js';
import { attachBeforeAfter } from './beforeAfterPreview.js';
import { attachScrollers } from './scrollerPreview.js';
import { buildFontHref } from '../../lib/fontCatalog.js';

const ACG_LOGO = 'https://www.autocaregenius.com/cdn/shop/files/v11_1.svg?v=1760731533&width=160';

export default function WebsitePreview({ siteId, businessInfo, onBusinessInfoChange, generatedCopy, editedCopy, onEditedCopyChange, images, onImagesChange, templateId, templateMeta, customColors, onCustomColors, customFonts, onCustomFonts, onBack, backLabel, onExport, onSaveDraft, onPublish, onStartOver, onSwitchTemplate, isDemoPreview, editingExistingSite, onPreviewDemo }) {
  const { profile } = useAuth();
  const isPro = isEffectiveSchedulerActive(profile);
  const isAdmin = !!profile?.is_super_admin;
  const normalizedInfo = useMemo(() => normalizeBusinessInfo(businessInfo), [businessInfo]);
  const [viewMode, setViewMode] = useState('desktop');
  const [editorOpen, setEditorOpen] = useState(false);
  // In an impersonation tab the sticky "VIEWING AS" bar occupies the top of the
  // page; offset the editor's fixed chrome (toolbar, cover bar, sticky template
  // nav) down by its height so the toolbar buttons aren't hidden behind it.
  const bannerOffset = isImpersonationTab ? IMPERSONATION_BAR_HEIGHT : 0;

  useEffect(() => {
    if (editingExistingSite) {
      try { localStorage.setItem('editor_tour_done_v3', '1'); } catch { /* ignore */ }
    }
  }, [editingExistingSite]);

  // Pin the preview to the top whenever we land on a new template. Browser
  // scroll-restoration + templates with 100vh heroes otherwise leave the page
  // offset a few dozen pixels down on first render.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    // 'instant': SITE_BASE_CSS turns on smooth scrolling for the page.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [templateId]);

  // Preview twin of the published runtime (siteRuntime.js): the scrolled
  // flag templates style their nav with (html[data-acg-scrolled]), the
  // phone menu (details.acg-menu) closing on a link tap or outside click,
  // the Before & After sliders (SITE_BA_JS, beforeAfterPreview.js) and
  // scrollers' prev/next buttons (SITE_SCROLL_JS, scrollerPreview.js).
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const root = document.documentElement;
    const detachBeforeAfter = attachBeforeAfter(document);
    const detachScrollers = attachScrollers(document);
    let last = null;
    const onScroll = () => {
      const scrolled = window.scrollY > 20;
      if (scrolled === last) return;
      last = scrolled;
      if (scrolled) root.setAttribute('data-acg-scrolled', '');
      else root.removeAttribute('data-acg-scrolled');
    };
    const onClick = (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      const menu = t.closest('details.acg-menu');
      if (menu && t.closest('a')) menu.removeAttribute('open');
      document.querySelectorAll('details.acg-menu[open]').forEach((m) => {
        if (m !== menu) m.removeAttribute('open');
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick);
      detachBeforeAfter();
      detachScrollers();
      root.removeAttribute('data-acg-scrolled');
    };
  }, []);

  const TemplateComponent = useMemo(
    () => lazy(TEMPLATE_COMPONENT_MAP[templateId]),
    [templateId]
  );

  // Load the template's fonts from the same catalog the published page
  // uses (exportHtml.js): heading + body font and the module's extraFonts.
  // index.html only preloads a fixed subset. Links accumulate while the
  // preview is mounted so switching fonts never flashes a fallback face.
  const [extraFonts, setExtraFonts] = useState([]);
  useEffect(() => {
    let cancelled = false;
    const load = TEMPLATE_COMPONENT_MAP[templateId];
    if (!load) return undefined;
    load()
      .then((mod) => { if (!cancelled) setExtraFonts(Array.isArray(mod.extraFonts) ? mod.extraFonts : []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [templateId]);
  const fontHref = useMemo(
    () => buildFontHref([templateMeta?.font, templateMeta?.bodyFont, extraFonts]),
    [templateMeta?.font, templateMeta?.bodyFont, extraFonts]
  );
  const fontLinks = useRef(new Map());
  useEffect(() => {
    if (!fontHref || fontLinks.current.has(fontHref)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = fontHref;
    document.head.appendChild(link);
    fontLinks.current.set(fontHref, link);
  }, [fontHref]);
  useEffect(() => {
    const links = fontLinks.current;
    return () => {
      links.forEach((link) => link.remove());
      links.clear();
    };
  }, []);

  const containerStyle = viewMode === 'mobile'
    ? { maxWidth: 390, margin: '0 auto', boxShadow: '0 0 0 1px #374151, 0 20px 60px #000' }
    : {};

  return (
    <div className="min-h-screen bg-gray-900">
      {!editingExistingSite && <EditorTour />}
      <PreviewToolbar
        viewMode={viewMode}
        onViewMode={setViewMode}
        onBack={onBack}
        backLabel={backLabel}
        onExport={isDemoPreview ? null : onExport}
        onSaveDraft={isDemoPreview ? null : onSaveDraft}
        onPublish={isDemoPreview ? null : onPublish}
        onStartOver={onStartOver}
        onEdit={() => setEditorOpen((o) => !o)}
        editorOpen={editorOpen}
        isDemoPreview={isDemoPreview}
        onPreviewDemo={isAdmin && !isDemoPreview ? onPreviewDemo : null}
        topOffset={bannerOffset}
      />

      <ContentEditor
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        topOffset={bannerOffset}
        siteId={siteId}
        copy={editedCopy}
        images={images}
        onCopyChange={onEditedCopyChange}
        onImagesChange={onImagesChange}
        templateMeta={templateMeta}
        templateId={templateId}
        customColors={customColors}
        onCustomColors={onCustomColors}
        customFonts={customFonts}
        onCustomFonts={onCustomFonts}
        businessType={businessInfo?.businessType}
        onSwitchTemplate={onSwitchTemplate}
        businessInfo={businessInfo}
        onBusinessInfoChange={onBusinessInfoChange}
      />

      {/* Preview frame */}
      {/* Inject CSS so sticky template navs sit below our fixed toolbar (52px,
          plus the impersonation bar when present) */}
      <style>{`.preview-wrap nav { top: ${52 + bannerOffset}px !important; z-index: 10 !important; }${isPro ? '' : ' .preview-wrap .acg-actionbar { bottom: 48px; }'}`}</style>
      {/* Same base CSS the published page gets. Reveal styles stay inert here
          because the app never adds html.acg-js, so nothing is hidden. */}
      <style>{SITE_BASE_CSS}</style>
      <div className="min-h-screen" style={{ position: 'relative', marginTop: 52, paddingBottom: isPro ? 0 : 48 }}>
        {/* Cover bar: hides template content that scrolls up behind toolbar */}
        <div style={{ position: 'fixed', top: bannerOffset, left: 0, right: 0, height: 52, background: '#fff', zIndex: 40 }} />
        <div className="preview-wrap" style={{ ...containerStyle, position: 'relative' }}>
          <Suspense
              fallback={
                <div className="flex items-center justify-center min-h-screen">
                  <div className="w-10 h-10 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
                </div>
              }
            >
              <EditorModeProvider>
                <TemplateComponent
                  businessInfo={normalizedInfo}
                  generatedCopy={editedCopy}
                  templateMeta={templateMeta}
                  images={images}
                />
              </EditorModeProvider>
            </Suspense>
        </div>
      </div>

      {/* "Powered by" sticky bar — mirrors the published-site footer so the
          preview matches what customers will see. Hidden for Pro users since
          their published sites won't have it either. */}
      {!isPro && (
        <div
          style={{
            position: 'fixed', bottom: 0, left: 0, right: editorOpen ? 320 : 0, zIndex: 41,
            background: 'rgba(250, 249, 247, 0.96)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            padding: '12px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            borderTop: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 -2px 12px rgba(0,0,0,0.04)',
            transition: 'right 0.2s ease',
          }}
        >
          <span style={{ fontSize: 12, color: '#999', letterSpacing: '0.02em' }}>Powered by</span>
          <a
            href="https://www.autocaregenius.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
          >
            <img src={ACG_LOGO} alt="Auto Care Genius" style={{ height: 18 }} />
            <span style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.1)' }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a', letterSpacing: '-0.3px' }}>
              Genius <span style={{ color: '#cc0000' }}>Websites</span>
            </span>
          </a>
        </div>
      )}
    </div>
  );
}
