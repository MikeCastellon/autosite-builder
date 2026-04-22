import { useState } from 'react';
import { publishSite } from '../../lib/publishSite.js';
import { generateSlug } from '../../lib/publishUtils.js';

const PUBLISH_DOMAIN = import.meta.env.VITE_PUBLISH_DOMAIN || 'autocaregenius.com';

export default function StepExport({ siteId: passedSiteId, businessInfo, generatedCopy, templateId, templateMeta, images, selectedWidgetIds, onBack, onStartOver }) {
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(null);
  const [publishError, setPublishError] = useState(null);
  const [customDomain, setCustomDomain] = useState('');
  const siteId = passedSiteId || crypto.randomUUID();
  const [useCustomDomain, setUseCustomDomain] = useState(false);

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
        customDomain: useCustomDomain && customDomain ? customDomain : null,
      });
      setPublished(result);
    } catch (err) {
      setPublishError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
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
          {/* Subdomain preview */}
          <div className="border border-black/[0.07] rounded-xl p-5 mb-5 bg-[#faf9f7]">
            <p className="text-[11px] font-semibold text-[#cc0000] uppercase tracking-[1.5px] mb-3">Your site will be live at</p>
            <div className="flex items-center gap-2 bg-white border border-black/[0.10] rounded-lg px-4 py-3">
              <span className="text-green-500 text-sm">🔒</span>
              <span className="font-mono text-sm text-[#1a1a1a] break-all">https://{subdomain}</span>
            </div>
          </div>

          {/* Custom domain option */}
          <div className="border border-black/[0.07] rounded-xl p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-semibold text-[#1a1a1a]">Use your own domain</p>
              <button
                type="button"
                role="switch"
                aria-checked={useCustomDomain}
                onClick={() => setUseCustomDomain(!useCustomDomain)}
                className={`relative w-9 h-5 rounded-full transition-colors ${useCustomDomain ? 'bg-[#cc0000]' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${useCustomDomain ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
            {useCustomDomain && (
              <>
                <input
                  type="text"
                  placeholder="www.mybusiness.com"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  className="w-full border border-black/[0.10] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30 focus:border-[#cc0000] mb-2"
                />
                <p className="text-xs text-[#999]">You'll get DNS setup instructions after publishing.</p>
              </>
            )}
          </div>

          {/* Publish button */}
          <button
            onClick={handlePublish}
            disabled={publishing}
            className={`w-full py-3.5 px-6 rounded-xl font-semibold text-[15px] transition-all mb-4
              ${publishing ? 'bg-[#f2f0ec] text-[#888] cursor-not-allowed' : 'bg-[#cc0000] hover:bg-[#aa0000] text-white'}`}
          >
            {publishing ? 'Publishing...' : '🚀 Publish Website'}
          </button>

          {/* What's included */}
          <div className="border border-black/[0.07] rounded-xl p-5 bg-[#faf9f7]">
            <p className="text-[11px] font-semibold text-[#888] uppercase tracking-[1.5px] mb-3">Included</p>
            <ul className="space-y-2">
              {[
                'Free SSL certificate (HTTPS)',
                'Local SEO optimized (title, meta, schema)',
                'Mobile responsive on all devices',
                'Lightning-fast CDN hosting',
                'Custom subdomain on autocaregenius.com',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-[13px] text-[#555]">
                  <span className="text-green-500 text-xs">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <>
          {/* Published success */}
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
            <p className="text-xs text-green-600 mt-2">DNS may take 1–5 minutes to propagate globally.</p>
          </div>

          <div className="flex gap-2 mb-5">
            <button
              onClick={() => navigator.clipboard.writeText(published.publishedUrl)}
              className="flex-1 py-2.5 px-4 border border-black/[0.07] rounded-xl text-sm font-medium hover:border-[#cc0000]/30 hover:text-[#cc0000] transition-colors"
            >
              📋 Copy Link
            </button>
            <a
              href={published.publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 px-4 border border-black/[0.07] rounded-xl text-sm font-medium hover:border-[#cc0000]/30 hover:text-[#cc0000] transition-colors text-center"
            >
              🔗 Visit Site
            </a>
          </div>

          {/* Upgrade CTA */}
          <a
            href="https://www.autocaregenius.com"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#cc0000] to-[#aa0000] hover:from-[#aa0000] hover:to-[#880000] text-white text-center font-semibold text-[15px] transition-all shadow-sm hover:shadow-md mb-5"
          >
            ⭐ Upgrade to Pro
          </a>

          {published.cnameInstructions && (
            <div className="border border-black/[0.07] rounded-xl p-5 mb-5 bg-[#faf9f7]">
              <p className="font-semibold text-[#1a1a1a] text-sm mb-3">DNS Setup for Custom Domain</p>
              <div className="font-mono text-xs space-y-2 text-[#555] bg-white border border-black/[0.07] rounded-lg p-3">
                <p><span className="font-semibold text-[#1a1a1a]">Type:</span> CNAME</p>
                <p><span className="font-semibold text-[#1a1a1a]">Name:</span> {published.cnameInstructions.name}</p>
                <p><span className="font-semibold text-[#1a1a1a]">Value:</span> {published.cnameInstructions.value}</p>
              </div>
              <p className="text-xs text-[#999] mt-2">Add this record at your domain registrar. SSL will activate automatically.</p>
            </div>
          )}
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
  );
}
