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
    <div className="max-w-xl mx-auto text-center">
      <div className="mb-8">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
          🎉
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">Your website is ready!</h1>
        <p className="text-gray-400 text-lg">
          {businessInfo.businessName} in {businessInfo.city}, {businessInfo.state}
        </p>
      </div>

      {/* SEO callout */}
      <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-5 mb-8 text-left">
        <p className="text-blue-400 font-semibold text-sm uppercase tracking-wider mb-3">✅ Included in your download</p>
        <ul className="space-y-2 text-gray-300 text-sm">
          <li>🔍 Local SEO title tag — includes <span className="text-blue-300 font-medium">{businessInfo.city}</span></li>
          <li>📝 City-specific meta description (150 chars)</li>
          <li>📍 Local Business JSON-LD schema (Google-ready)</li>
          <li>🏷 Meta keywords for your services + city</li>
          <li>📱 Mobile-responsive layout</li>
          <li>⚡ Ready to upload — no build step required</li>
        </ul>
      </div>

      {/* Download button */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all mb-4
          ${downloading
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : downloaded
              ? 'bg-green-600 hover:bg-green-500 text-white'
              : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
      >
        {downloading
          ? '⏳ Preparing download...'
          : downloaded
            ? '✅ Downloaded! Click to download again'
            : '⬇️ Download HTML Website'}
      </button>

      {downloaded && (
        <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 mb-6 text-sm text-green-300">
          <p className="font-semibold mb-1">Your file is downloading!</p>
          <p className="text-green-400">Open the .html file in any browser to view it. Upload it to any web host or share it with a developer to go live.</p>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-6 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 mt-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 px-4 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 font-medium transition-colors text-sm"
        >
          ← Back to Preview
        </button>
        <button
          onClick={onStartOver}
          className="flex-1 py-3 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors text-sm"
        >
          🔄 Start a New Site
        </button>
      </div>
    </div>
  );
}
