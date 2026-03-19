import { useState } from 'react';
import { exportHtml } from '../../lib/exportHtml.js';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../lib/AuthContext.jsx';

export default function StepExport({ businessInfo, generatedCopy, templateId, templateMeta, images, selectedWidgetIds, onBack, onStartOver }) {
  const { session } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState(null);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await exportHtml(templateId, businessInfo, generatedCopy, templateMeta, images, selectedWidgetIds || []);

      // Save site to Supabase
      if (session?.user?.id) {
        await supabase.from('sites').insert({
          user_id: session.user.id,
          business_info: businessInfo,
          template_id: templateId,
          generated_content: generatedCopy,
          widget_config_ids: selectedWidgetIds || [],
        });
      }

      setDownloaded(true);
    } catch (err) {
      setError(err.message || 'Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Success header */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-[#cc0000]/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#cc0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="text-[clamp(24px,4vw,32px)] font-[900] text-[#1a1a1a] mb-2 tracking-[-1px] leading-[1.1]">Your website is ready</h1>
        <p className="text-[#555] text-[15px]">
          {businessInfo.businessName} &mdash; {businessInfo.city}, {businessInfo.state}
        </p>
      </div>

      {/* SEO checklist */}
      <div className="border border-black/[0.07] rounded-xl p-5 mb-6 bg-[#faf9f7]">
        <p className="text-[11px] font-semibold text-[#cc0000] uppercase tracking-[1.5px] mb-4">Included in your download</p>
        <ul className="space-y-3">
          {[
            [`Local SEO title tag`, `Includes "${businessInfo.city}" for search visibility`],
            [`City-specific meta description`, `150-character optimized for Google`],
            [`Local Business schema markup`, `JSON-LD structured data, Google-ready`],
            [`Meta keywords`, `Your services + city + state`],
            [`Mobile-responsive layout`, `Works on all devices`],
            [`Self-contained HTML`, `Upload anywhere, no build step needed`],
          ].map(([title, desc]) => (
            <li key={title} className="flex items-start gap-3">
              <div className="w-4 h-4 rounded-full bg-[#cc0000] flex items-center justify-center mt-0.5 shrink-0">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 4l1.5 1.5L6.5 2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <span className="text-[#1a1a1a] text-[13px] font-medium">{title}</span>
                <span className="text-[#888] text-[12px] block">{desc}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Download button */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        className={`w-full py-3.5 px-6 rounded-xl font-semibold text-[15px] transition-all mb-3
          ${downloading
            ? 'bg-[#f2f0ec] text-[#888] cursor-not-allowed'
            : 'bg-[#1a1a1a] hover:bg-[#cc0000] text-white'}`}
      >
        {downloading
          ? 'Preparing download...'
          : downloaded
            ? 'Download again'
            : 'Download HTML Website'}
      </button>

      {downloaded && (
        <div className="border border-black/[0.07] rounded-xl p-4 mb-5 text-sm bg-[#faf9f7]">
          <p className="font-bold text-[#1a1a1a] mb-1">File is downloading</p>
          <p className="text-[#555] text-[13px]">Open the .html file in any browser. Share with a developer or upload to any host to go live.</p>
        </div>
      )}

      {error && (
        <div className="border border-[#cc0000]/20 rounded-xl p-4 mb-4 text-sm text-[#cc0000] bg-[#cc0000]/5">
          {error}
        </div>
      )}

      {/* Secondary actions */}
      <div className="flex gap-2.5 mt-1">
        <button
          onClick={onBack}
          className="flex-1 py-2.5 px-4 rounded-xl border border-black/[0.07] text-[#555] hover:border-[#cc0000]/30 hover:text-[#cc0000] font-medium transition-colors text-[13px]"
        >
          Back to Preview
        </button>
        <button
          onClick={onStartOver}
          className="flex-1 py-2.5 px-4 rounded-xl bg-[#faf9f7] hover:bg-[#f2f0ec] text-[#555] font-medium transition-colors text-[13px]"
        >
          Build Another Site
        </button>
      </div>
    </div>
  );
}
