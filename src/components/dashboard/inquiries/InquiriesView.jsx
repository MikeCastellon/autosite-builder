import { useEffect, useState } from 'react';
import InquiriesList from './InquiriesList.jsx';
import InquiryDetailDrawer from './InquiryDetailDrawer.jsx';
import { listInquiriesForOwner, listAllInquiries } from '../../../lib/inquiries.js';

export default function InquiriesView({ userId, isAdmin = false }) {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [selected, setSelected] = useState(null);

  async function refresh() {
    setLoading(true); setErr(null);
    try {
      const rows = isAdmin
        ? await listAllInquiries({})
        : await listInquiriesForOwner({ userId });
      setInquiries(rows);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [userId, isAdmin]);

  function onUpdated(updated) {
    setInquiries((prev) => prev.map((x) => x.id === updated.id ? updated : x));
    setSelected(updated);
  }

  return (
    <div>
      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      {!loading && !err && (
        <InquiriesList inquiries={inquiries} onSelect={setSelected} />
      )}

      {selected && (
        <InquiryDetailDrawer
          inquiry={selected}
          onClose={() => setSelected(null)}
          onUpdated={onUpdated}
        />
      )}
    </div>
  );
}
