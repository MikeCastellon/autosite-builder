import { Suspense, lazy, useMemo, useState } from 'react';
import { TEMPLATE_COMPONENT_MAP } from '../../data/templates.js';
import { normalizeBusinessInfo } from '../../lib/normalizeBusinessInfo.js';
import PreviewToolbar from './PreviewToolbar.jsx';

export default function WebsitePreview({ businessInfo, generatedCopy, templateId, templateMeta, onBack, onExport, onStartOver }) {
  const normalizedInfo = useMemo(() => normalizeBusinessInfo(businessInfo), [businessInfo]);
  const [viewMode, setViewMode] = useState('desktop');

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
        onExport={onExport}
        onStartOver={onStartOver}
      />

      {/* Preview frame — transform creates a containing block so template fixed navs stay inside */}
      <div className="pt-14 min-h-screen">
        <div style={{ ...containerStyle, transform: 'translateZ(0)', position: 'relative' }}>
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-screen">
                <div className="w-10 h-10 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
              </div>
            }
          >
            <TemplateComponent
              businessInfo={normalizedInfo}
              generatedCopy={generatedCopy}
              templateMeta={templateMeta}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
