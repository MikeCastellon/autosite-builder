import { useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useAlert } from '../ui/AlertProvider.jsx';
import StepBusinessInfo from '../wizard/StepBusinessInfo.jsx';

// Edit-an-existing-site wrapper around the wizard's StepBusinessInfo so the
// edit form is byte-for-byte the same questions as the original signup flow
// (common fields, type-specific services/packages, payment methods, reviews).
export default function EditBusinessInfoModal({ site, onClose, onSaved }) {
  const { toast } = useAlert();

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (newValues) => {
    if (!site?.id) return;
    const { error } = await supabase
      .from('sites')
      .update({ business_info: newValues })
      .eq('id', site.id);
    if (error) {
      toast(`Couldn't save: ${error.message}`, 'error');
      return;
    }
    toast('Business info updated. Republish to push it live.', 'success');
    onSaved?.({ ...site, business_info: newValues });
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] shrink-0">
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-[#1a1a1a]">Edit Business Info</p>
            <p className="text-[11px] text-[#888] mt-0.5 truncate">
              Same questions as the signup form. Save then Republish to push changes live.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[#888] hover:text-[#cc0000] transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-6 flex-1">
          <StepBusinessInfo
            businessType={site?.business_info?.businessType || site?.business_type}
            initialValues={site?.business_info || {}}
            onSubmit={handleSubmit}
            submitLabel="Save Changes"
          />
        </div>
      </div>
    </div>
  );
}
