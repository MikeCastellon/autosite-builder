import { useState } from 'react';
import { publishSite } from '../../lib/publishSite.js';
import { generateSlug } from '../../lib/publishUtils.js';
import UpgradeProPanel from '../ui/UpgradeProPanel.jsx';
import { useAuth } from '../../lib/AuthContext.jsx';
import { isEffectiveSchedulerActive } from '../../lib/subscriptionGating.js';

const PUBLISH_DOMAIN = import.meta.env.VITE_PUBLISH_DOMAIN || 'autocaregenius.com';

export default function StepExport({ siteId: passedSiteId, businessInfo, generatedCopy, templateId, templateMeta, images, selectedWidgetIds, onBack, onStartOver }) {
  const { profile } = useAuth();
  const isPro = isEffectiveSchedulerActive(profile);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(null);
  const [publishError, setPublishError] = useState(null);
  const siteId = passedSiteId || crypto.randomUUID();

  const slug = generateSlug(businessInfo.businessName);
  const subdomain = `${slug}.${PUBLISH_DOMAIN}`;

  const handlePublish = async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      const result = await publishSite({
        siteId,
        businessInfo,
        generatedCopy,
        templateId,
        templateMeta,
        images,
        selectedWidgetIds,
        isPro,
      });
      setPublished(result);
    } catch (err) {
      setPublishError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef4fb] flex flex-col">
      {/* Brand header */}
      <header className="border-b border-black/[0.07] bg-white/85 backdrop-blur-xl px-4 sm:px-8 h-16 flex items-center sticky top-0 z-50">
        <a
          href="https://www.autocaregenius.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5"
        >
          <img
            src="https://www.autocaregenius.com/cdn/shop/files/v11_1.svg?v=1760731533&width=200"
            alt="Auto Care Genius"
            className="h-7"
          />
          <div className="w-px h-6 bg-black/[0.07]" />
          <span className="font-bold text-[#1a1a1a] text-[17px] tracking-[-0.5px]">
            Genius <span className="text-[#cc0000]">Websites</span>
          </span>
        </a>
      </header>

      <main className="flex-1 px-4 sm:px-8 py-10">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-[#cc0000]/10 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#cc0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="text-[clamp(24px,4vw,32px)] font-[900] text-[#1a1a1a] mb-2 tracking-[-1px] leading-[1.1]">
              {published ? `Congratulations, ${businessInfo.businessName}!` : 'Publish Your Website'}
            </h1>
            <p className="text-[#555] text-[15px]">
              {published
                ? 'Your website is live and ready to share.'
                : <>{businessInfo.businessName} &mdash; {businessInfo.city}, {businessInfo.state}</>}
            </p>
          </div>

          {!published ? (
            <>
              <div className="border border-black/[0.07] rounded-xl p-5 mb-5 bg-white">
                <p className="text-[11px] font-semibold text-[#cc0000] uppercase tracking-[1.5px] mb-3">Your site will be live at</p>
                <div className="flex items-center gap-2 bg-white border border-black/[0.10] rounded-lg px-4 py-3">
                  <span className="text-green-500 text-sm">🔒</span>
                  <span className="font-mono text-sm text-[#1a1a1a] break-all">https://{subdomain}</span>
                </div>
              </div>

              <button
                onClick={handlePublish}
                disabled={publishing}
                className={`w-full py-3.5 px-6 rounded-xl font-semibold text-[15px] transition-all mb-4
                  ${publishing ? 'bg-[#f2f0ec] text-[#888] cursor-not-allowed' : 'bg-[#cc0000] hover:bg-[#aa0000] text-white'}`}
              >
                {publishing ? 'Publishing...' : '🚀 Publish Website'}
              </button>
            </>
          ) : (
            <>
              <div className="border border-green-200 bg-green-50 rounded-xl p-5 mb-5">
                <p className="font-semibold text-green-800 mb-2">🎉 Your site is live!</p>
                <a
                  href={published.publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-700 underline break-all font-mono"
                >
                  {published.publishedUrl}
                </a>
              </div>

              <div className="flex gap-2 mb-5">
                <button
                  onClick={() => navigator.clipboard.writeText(published.publishedUrl)}
                  className="flex-1 py-2.5 px-4 bg-white border border-black/[0.07] rounded-xl text-sm font-medium hover:border-[#cc0000]/30 hover:text-[#cc0000] transition-colors"
                >
                  📋 Copy Link
                </button>
                <a
                  href={published.publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-4 bg-white border border-black/[0.07] rounded-xl text-sm font-medium hover:border-[#cc0000]/30 hover:text-[#cc0000] transition-colors text-center"
                >
                  🔗 Visit Site
                </a>
              </div>

              {/* Upgrade to Pro panel — features list + CTA. Custom domain
                  lives behind this and only unlocks once the user upgrades. */}
              <div className="mb-5">
                <UpgradeProPanel />
              </div>
            </>
          )}

          {publishError && (
            <div className="border border-[#cc0000]/20 rounded-xl p-4 mt-3 text-sm text-[#cc0000] bg-[#cc0000]/5">
              {publishError}
            </div>
          )}

          {/* Bottom actions */}
          <div className="mt-4">
            <button
              onClick={onBack}
              className="w-full py-2.5 px-4 rounded-xl border border-black/[0.07] text-[#555] hover:border-[#cc0000]/30 hover:text-[#cc0000] font-medium transition-colors text-[13px]"
            >
              ← Back to Editor
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-black/[0.07] px-4 sm:px-8 py-5 flex items-center justify-center gap-2 text-xs text-[#888] bg-white">
        <span>Powered by</span>
        <a
          href="https://www.autocaregenius.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
        >
          <img
            src="https://www.autocaregenius.com/cdn/shop/files/v11_1.svg?v=1760731533&width=160"
            alt="Auto Care Genius"
            className="h-5"
          />
        </a>
      </footer>
    </div>
  );
}
