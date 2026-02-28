import { useState } from 'react';
import { exportHtml } from '../../lib/exportHtml.js';

export default function StepExport({ businessInfo, generatedCopy, templateId, templateMeta, onBack, onStartOver }) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState(null);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await exportHtml(templateId, businessInfo, generatedCopy, templateMeta);
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
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Your website is ready</h1>
        <p className="text-gray-500 text-[15px]">
          {businessInfo.businessName} &mdash; {businessInfo.city}, {businessInfo.state}
        </p>
      </div>

      {/* SEO checklist */}
      <div className="border border-gray-200 rounded-xl p-5 mb-6">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">Included in your download</p>
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
              <div className="w-4 h-4 rounded-full bg-gray-900 flex items-center justify-center mt-0.5 shrink-0">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 4l1.5 1.5L6.5 2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <span className="text-gray-900 text-[13px] font-medium">{title}</span>
                <span className="text-gray-400 text-[12px] block">{desc}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Download button */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        className={`w-full py-3.5 px-6 rounded-lg font-semibold text-[15px] transition-all mb-3
          ${downloading
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : downloaded
              ? 'bg-gray-900 hover:bg-gray-800 text-white'
              : 'bg-gray-900 hover:bg-gray-800 text-white'}`}
      >
        {downloading
          ? 'Preparing download...'
          : downloaded
            ? 'Download again'
            : 'Download HTML Website'}
      </button>

      {downloaded && (
        <div className="border border-gray-200 rounded-lg p-4 mb-5 text-sm text-gray-600 bg-gray-50">
          <p className="font-medium text-gray-900 mb-1">File is downloading</p>
          <p className="text-gray-500 text-[13px]">Open the .html file in any browser. Share with a developer or upload to any host to go live.</p>
        </div>
      )}

      {error && (
        <div className="border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-600 bg-red-50">
          {error}
        </div>
      )}

      {/* Secondary actions */}
      <div className="flex gap-2.5 mt-1">
        <button
          onClick={onBack}
          className="flex-1 py-2.5 px-4 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900 font-medium transition-colors text-[13px]"
        >
          Back to Preview
        </button>
        <button
          onClick={onStartOver}
          className="flex-1 py-2.5 px-4 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors text-[13px]"
        >
          Build Another Site
        </button>
      </div>
    </div>
  );
}
