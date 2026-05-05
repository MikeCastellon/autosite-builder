import { useEffect, useRef, useState } from 'react';

const SAVED_FLASH_MS = 2000;

export default function PreviewToolbar({ viewMode, onViewMode, onBack, backLabel = 'Back to Templates', onExport, onSaveDraft, onPublish, onEdit, editorOpen, isDemoPreview, onPreviewDemo }) {
  const [savingDraft, setSavingDraft] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const flashTimers = useRef({ draft: null, publish: null });
  // Clear any pending flash timers on unmount so they don't setState on a
  // dead component (no-op warning in dev).
  useEffect(() => () => {
    if (flashTimers.current.draft) clearTimeout(flashTimers.current.draft);
    if (flashTimers.current.publish) clearTimeout(flashTimers.current.publish);
  }, []);

  const handleSaveDraftClick = async () => {
    setSavingDraft(true);
    try {
      await onSaveDraft();
      setSavedDraft(true);
      flashTimers.current.draft = setTimeout(() => setSavedDraft(false), SAVED_FLASH_MS);
    } catch { /* parent already toasted */ }
    finally { setSavingDraft(false); }
  };
  const handlePublishClick = async () => {
    setPublishing(true);
    try {
      await onPublish();
      setPublished(true);
      flashTimers.current.publish = setTimeout(() => setPublished(false), SAVED_FLASH_MS);
    } catch { /* parent already toasted */ }
    finally { setPublishing(false); }
  };

  const Check = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 6.5l2 2 5-6" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  return (
    <div className="fixed top-0 left-0 z-50 bg-white border-b border-gray-200 px-3 sm:px-5 h-13 flex items-center justify-between gap-2 sm:gap-4" style={{ height: 52, right: editorOpen ? 320 : 0, transition: 'right 0.2s ease' }}>
      {/* Left: back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] font-semibold px-3 sm:px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:border-[#cc0000] hover:bg-[#cc0000] hover:text-white active:scale-[0.98] transition-all shrink-0 shadow-sm"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="hidden sm:inline">{backLabel}</span>
        <span className="sm:hidden">Back</span>
      </button>

      {/* Center: view toggle */}
      <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-0.5">
        <button
          onClick={() => onViewMode('desktop')}
          className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${viewMode === 'desktop' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Desktop
        </button>
        <button
          onClick={() => onViewMode('mobile')}
          className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${viewMode === 'mobile' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Mobile
        </button>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 shrink-0">
        {onPreviewDemo && (
          <button
            type="button"
            onClick={() => onPreviewDemo()}
            title="Switch the editor to demo content (admin only — for testing & showcasing)"
            className="hidden sm:inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-colors"
          >
            Preview Demo
          </button>
        )}
        <button
          onClick={onEdit}
          data-tour="edit-btn"
          className={`flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-lg border transition-all ${
            editorOpen
              ? 'bg-gray-900 text-white border-gray-900'
              : 'border-gray-200 hover:border-gray-400 text-gray-600 hover:text-gray-900'
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M9.5 1.5a1.414 1.414 0 012 2L4 11H1.5V8.5L9.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Edit
        </button>
        {!isDemoPreview && onExport && (
          <button
            onClick={onExport}
            data-tour="finalize-btn"
            className="bg-gray-900 hover:bg-gray-800 text-white text-[13px] font-semibold px-3 sm:px-4 py-2 rounded-lg transition-colors"
          >
            <span className="hidden sm:inline">Finalize Website</span>
            <span className="sm:hidden">Finalize</span>
          </button>
        )}
        {!isDemoPreview && onSaveDraft && (
          <button
            onClick={handleSaveDraftClick}
            data-tour="save-draft-btn"
            disabled={savingDraft || publishing}
            className={`text-[13px] font-semibold px-3 sm:px-4 py-2 rounded-lg border transition-colors disabled:cursor-wait
              ${savedDraft
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-white hover:bg-gray-50 border-gray-300 hover:border-gray-400 text-gray-800 disabled:opacity-60'}`}
          >
            <span className="inline-flex items-center gap-1">
              {savedDraft && <Check />}
              <span className="hidden sm:inline">{savedDraft ? 'Saved' : savingDraft ? 'Saving…' : 'Save Draft'}</span>
              <span className="sm:hidden">{savedDraft ? 'Saved' : savingDraft ? 'Saving…' : 'Save'}</span>
            </span>
          </button>
        )}
        {!isDemoPreview && onPublish && (
          <button
            onClick={handlePublishClick}
            data-tour="publish-btn"
            disabled={publishing || savingDraft}
            className={`text-[13px] font-semibold px-3 sm:px-4 py-2 rounded-lg transition-colors disabled:cursor-wait
              ${published
                ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
                : 'bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-60'}`}
          >
            <span className="inline-flex items-center gap-1">
              {published && <Check />}
              <span className="hidden sm:inline">{published ? 'Published' : publishing ? 'Publishing…' : 'Publish'}</span>
              <span className="sm:hidden">{published ? 'Done' : publishing ? '…' : 'Publish'}</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
