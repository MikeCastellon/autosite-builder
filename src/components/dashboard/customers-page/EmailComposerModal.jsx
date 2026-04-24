import { useEffect, useRef, useState } from 'react';
import { sendCustomerEmail } from '../../../lib/customers.js';
import { useAlert } from '../../ui/AlertProvider.jsx';

// Modal composer for the "Send email" action on the Customer detail page.
// Sends through the branded Postmark shell with replyTo set to the site
// owner so the customer's reply lands in the owner's inbox, not no-reply.
export default function EmailComposerModal({ open, onClose, customer, siteId, ownerEmail }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const subjectRef = useRef(null);
  const { toast } = useAlert();

  useEffect(() => {
    if (!open) return;
    setSubject('');
    setBody('');
    setBusy(false);
    // Focus the subject field after the modal mounts so the keyboard cursor
    // lands somewhere useful instead of nowhere.
    setTimeout(() => subjectRef.current?.focus(), 50);
  }, [open, customer?.key]);

  // Close on Escape (ignored while sending so we don't lose a message mid-send).
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open || !customer) return null;
  const toEmail = customer.email;
  const canSend = !!toEmail && subject.trim() && body.trim() && !!siteId;

  async function handleSend() {
    if (!canSend) return;
    setBusy(true);
    try {
      await sendCustomerEmail({
        siteId,
        toEmail,
        subject: subject.trim(),
        body: body.trim(),
      });
      toast(`Email sent to ${customer.name}.`, 'success');
      onClose();
    } catch (e) {
      toast(e.message || 'Email failed', 'error');
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-[17px] font-bold text-[#1a1a1a]">Email {customer.name}</h3>
            <p className="text-[12px] text-[#888] mt-0.5">
              To {toEmail || '(no email on file)'}
              {ownerEmail && <> · Replies go to <span className="text-[#555]">{ownerEmail}</span></>}
            </p>
          </div>
          <button
            onClick={() => !busy && onClose()}
            aria-label="Close"
            className="w-8 h-8 -mr-1 -mt-1 rounded-full bg-black/[0.04] hover:bg-[#cc0000]/10 hover:text-[#cc0000] text-[#555] flex items-center justify-center transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {!toEmail && (
          <div className="mb-4 border border-amber-200 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-[13px]">
            This customer has no email on file. Email can't be sent.
          </div>
        )}

        <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#888] mb-1">Subject</label>
        <input
          ref={subjectRef}
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          placeholder="Quick question about your booking"
          disabled={busy || !toEmail}
          className="w-full border border-black/[0.10] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30 focus:border-[#cc0000] disabled:bg-gray-50 disabled:text-gray-400 mb-4"
        />

        <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#888] mb-1">Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={10000}
          rows={8}
          placeholder={`Hi ${customer.name?.split(' ')[0] || 'there'},\n\n`}
          disabled={busy || !toEmail}
          className="w-full border border-black/[0.10] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30 focus:border-[#cc0000] disabled:bg-gray-50 disabled:text-gray-400 resize-y"
        />
        <p className="text-[11px] text-[#888] mt-1.5">
          Sent through your site's branded email. Your business info appears in the footer.
        </p>

        <div className="mt-6 flex gap-2 justify-end">
          <button
            onClick={() => !busy && onClose()}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-black/10 hover:border-black/30 text-[13px] font-medium text-[#555] hover:text-[#1a1a1a] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend || busy}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-[#cc0000] hover:bg-[#aa0000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Sending…' : 'Send email'}
          </button>
        </div>
      </div>
    </div>
  );
}
