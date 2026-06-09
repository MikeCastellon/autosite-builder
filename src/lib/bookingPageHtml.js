// Builds the thin HTML shell published for a standalone booking page.
// The shell loads scheduler.js in full-page mode; all config + theming
// is fetched at runtime, so theme/service edits never need a republish.

export const SCHEDULER_WIDGET_URL =
  (typeof window !== 'undefined' && window.location && window.location.origin
    ? window.location.origin
    : 'https://app.autocaregenius.com') + '/scheduler.js';

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildBookingPageHtml({ siteId, businessName }) {
  const title = escapeHtml(businessName || 'Book an appointment');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="robots" content="index,follow">
<style>body{margin:0;background:#f0f1f3;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.acg-loading{display:flex;min-height:100vh;align-items:center;justify-content:center;color:#888;font-size:14px}</style>
</head>
<body>
<div class="acg-loading">Loading booking…</div>
<noscript>Please enable JavaScript to book an appointment.</noscript>
<script src="${SCHEDULER_WIDGET_URL}" data-site-id="${escapeHtml(siteId)}" data-full-page="true" defer></script>
</body>
</html>`;
}
