import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { TEMPLATE_COMPONENT_MAP } from '../../data/templates.js';
import { normalizeBusinessInfo } from '../../lib/normalizeBusinessInfo.js';
import PreviewToolbar from './PreviewToolbar.jsx';
import ContentEditor from './ContentEditor.jsx';
import EditorTour from '../onboarding/EditorTour.jsx';
import { useAuth } from '../../lib/AuthContext.jsx';
import { isEffectiveSchedulerActive } from '../../lib/subscriptionGating.js';

const ACG_LOGO = 'https://www.autocaregenius.com/cdn/shop/files/v11_1.svg?v=1760731533&width=160';

export default function WebsitePreview({ businessInfo, onBusinessInfoChange, generatedCopy, editedCopy, onEditedCopyChange, images, onImagesChange, templateId, templateMeta, customColors, onCustomColors, customFonts, onCustomFonts, onBack, backLabel, onExport, onStartOver, onSwitchTemplate, isDemoPreview, editingExistingSite }) {
  const { profile } = useAuth();
  const isPro = isEffectiveSchedulerActive(profile);
  const normalizedInfo = useMemo(() => normalizeBusinessInfo(businessInfo), [businessInfo]);
  const [viewMode, setViewMode] = useState('desktop');
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    if (editingExistingSite) {
      try { localStorage.setItem('editor_tour_done_v2', '1'); } catch { /* ignore */ }
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
    window.scrollTo(0, 0);
  }, [templateId]);

  const TemplateComponent = useMemo(
    () => lazy(TEMPLATE_COMPONENT_MAP[templateId]),
    [templateId]
  );

  const containerStyle = viewMode === 'mobile'
    ? { maxWidth: 390, margin: '0 auto', boxShadow: '0 0 0 1px #374151, 0 20px 60px #000' }
    : {};

  return (
    <div className="min-h-screen bg-gray-900">
      {!editingExistingSite && !isDemoPreview && <EditorTour />}
      <PreviewToolbar
        viewMode={viewMode}
        onViewMode={setViewMode}
        onBack={onBack}
        backLabel={backLabel}
        onExport={isDemoPreview ? null : onExport}
        onStartOver={onStartOver}
        onEdit={() => setEditorOpen((o) => !o)}
        editorOpen={editorOpen}
        isDemoPreview={isDemoPreview}
      />

      <ContentEditor
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
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
      {/* Inject CSS so sticky template navs sit below our fixed toolbar (52px) */}
      <style>{`.preview-wrap nav { top: 52px !important; z-index: 10 !important; }`}</style>
      <div className="min-h-screen" style={{ position: 'relative', marginTop: 52, paddingBottom: isPro ? 0 : 48 }}>
        {/* Cover bar: hides template content that scrolls up behind toolbar */}
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 52, background: '#fff', zIndex: 40 }} />
        <div className="preview-wrap" style={{ ...containerStyle, position: 'relative' }}>
          <Suspense
              fallback={
                <div className="flex items-center justify-center min-h-screen">
                  <div className="w-10 h-10 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
                </div>
              }
            >
              <TemplateComponent
                businessInfo={normalizedInfo}
                generatedCopy={editedCopy}
                templateMeta={templateMeta}
                images={images}
              />
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
