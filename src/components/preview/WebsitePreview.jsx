import { Suspense, lazy, useMemo, useState } from 'react';
import { TEMPLATE_COMPONENT_MAP } from '../../data/templates.js';
import { normalizeBusinessInfo } from '../../lib/normalizeBusinessInfo.js';
import PreviewToolbar from './PreviewToolbar.jsx';
import ContentEditor from './ContentEditor.jsx';

export default function WebsitePreview({ businessInfo, generatedCopy, editedCopy, onEditedCopyChange, images, onImagesChange, templateId, templateMeta, customColors, onCustomColors, onBack, onExport, onStartOver, isDemoPreview }) {
  const normalizedInfo = useMemo(() => normalizeBusinessInfo(businessInfo), [businessInfo]);
  const [viewMode, setViewMode] = useState('desktop');
  const [editorOpen, setEditorOpen] = useState(false);

  const TemplateComponent = useMemo(
    () => lazy(TEMPLATE_COMPONENT_MAP[templateId]),
    [templateId]
  );

  const containerStyle = viewMode === 'mobile'
    ? { maxWidth: 390, margin: '0 auto', boxShadow: '0 0 0 1px #374151, 0 20px 60px #000' }
    : {};

  return (
    <div className="min-h-screen bg-gray-900">
      <PreviewToolbar
        viewMode={viewMode}
        onViewMode={setViewMode}
        onBack={onBack}
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
      />

      {/* Preview frame */}
      {/* Inject CSS so sticky template navs sit below our fixed toolbar (52px) */}
      <style>{`.preview-wrap nav { top: 52px !important; z-index: 10 !important; }`}</style>
      <div className="pt-14 min-h-screen" style={{ position: 'relative' }}>
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
    </div>
  );
}
