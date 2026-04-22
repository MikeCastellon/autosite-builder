import { useEffect, useRef } from 'react';

export default function PreviewTab({ siteId }) {
  const hostRef = useRef(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const host = hostRef.current;
    host.id = 'acg-scheduler-preview-host';
    host.innerHTML = '';

    const oldScript = document.getElementById('acg-scheduler-preview-script');
    if (oldScript) oldScript.remove();

    const s = document.createElement('script');
    s.id = 'acg-scheduler-preview-script';
    s.src = window.location.origin + '/scheduler.js?t=' + Date.now();
    s.setAttribute('data-site-id', siteId);
    s.setAttribute('data-preview-mode', 'true');
    s.defer = true;
    document.body.appendChild(s);

    return () => {
      s.remove();
      const modal = document.getElementById('acg-scheduler-modal');
      if (modal) modal.remove();
    };
  }, [siteId]);

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">This is exactly what customers see. Changes in other tabs show up after you save and revisit this tab.</p>
      <div ref={hostRef} className="border border-dashed border-gray-200 rounded-xl p-4 min-h-[320px] bg-gray-50" />
    </div>
  );
}
