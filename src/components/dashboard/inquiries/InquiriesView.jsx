import { useEffect, useState } from 'react';
import InquiriesList from './InquiriesList.jsx';
import InquiryDetailDrawer from './InquiryDetailDrawer.jsx';
import { listInquiriesForOwner, listAllInquiries } from '../../../lib/inquiries.js';

// Which inquiries a view lists. Every shop's only when the caller asks for
// allShops (Admin > All inquiries); otherwise strictly the owner's, so a
// super admin's own Inquiries page never shows other shops' leads. No userId
// in owner mode means nothing to list, never "everything".
export async function loadInquiries({ userId, allShops = false }) {
  if (allShops) return listAllInquiries({});
  if (!userId) return [];
  return listInquiriesForOwner({ userId });
}

// shopFor(inquiry) -> { business, owner, ownerEmail, siteUrl, ownerIsAdmin }
// names the shop an inquiry belongs to; only the all-shops view passes it.
export default function InquiriesView({ userId, allShops = false, shopFor = null }) {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [selected, setSelected] = useState(null);

  async function refresh() {
    setLoading(true); setErr(null);
    try {
      setInquiries(await loadInquiries({ userId, allShops }));
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [userId, allShops]);

  function onUpdated(updated) {
    setInquiries((prev) => prev.map((x) => x.id === updated.id ? updated : x));
    setSelected(updated);
  }

  return (
    <div>
      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      {!loading && !err && (
        <InquiriesList inquiries={inquiries} onSelect={setSelected} shopFor={shopFor} />
      )}

      {selected && (
        <InquiryDetailDrawer
          inquiry={selected}
          onClose={() => setSelected(null)}
          onUpdated={onUpdated}
          // These are other owners' leads: reading one must not mark it read
          // or touch their notes, same as a "View as user" tab.
          readOnly={allShops}
          shop={shopFor ? shopFor(selected) : null}
        />
      )}
    </div>
  );
}
