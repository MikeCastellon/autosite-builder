const MAP = {
  disconnected:  { label: 'Not connected',              tone: 'neutral' },
  pending_dns:   { label: 'Waiting for DNS (1–5 min)',  tone: 'pending' },
  active_dns:    { label: 'DNS verified, issuing SSL',  tone: 'pending' },
  active_ssl:    { label: 'Live on your custom domain', tone: 'success' },
  error_dns:     { label: 'DNS setup issue',            tone: 'error'   },
  error_ssl:     { label: 'SSL issuance failed',        tone: 'error'   },
};

export function getStatusDisplay(status) {
  return MAP[status] || { label: 'Checking...', tone: 'pending' };
}
