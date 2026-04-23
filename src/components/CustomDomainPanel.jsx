import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { getStatusDisplay } from './customDomain/statusMachine.js';
import { normalizeDomain, isValidDomain } from '../lib/domainUtils.js';

const POLL_INTERVAL_MS = 3000;

export default function CustomDomainPanel({ siteId, initialDomain = null, initialStatus = 'disconnected' }) {
  const [input, setInput] = useState('');
  const [domain, setDomain] = useState(initialDomain);
  const [status, setStatus] = useState(initialStatus);
  const [cnameInstructions, setCnameInstructions] = useState(null);
  const [applyUrl, setApplyUrl] = useState(null);
  const [provider, setProvider] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const pollingRef = useRef(null);

  const display = getStatusDisplay(status);

  async function authHeader() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
  }

  const handleConnect = async () => {
    setErr(null);
    const apex = normalizeDomain(input);
    if (!isValidDomain(apex)) {
      setErr('Please enter a valid domain (e.g., mybusiness.com)');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/.netlify/functions/connect-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ siteId, domain: apex }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connect failed');

      setDomain(apex);
      setCnameInstructions(data.cnameInstructions);
      setApplyUrl(data.applyUrl);
      setProvider(data.detectedProvider);
      setStatus(data.status);

      if (data.applyUrl) {
        const popup = window.open(data.applyUrl, 'domainconnect', 'width=600,height=700');
        if (!popup) {
          window.location.href = data.applyUrl;
        }
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Remove your custom domain? Your site will continue to serve on its subdomain.')) return;
    setBusy(true);
    try {
      const res = await fetch('/.netlify/functions/disconnect-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ siteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Disconnect failed');
      setDomain(null);
      setInput('');
      setStatus('disconnected');
      setCnameInstructions(null);
      setApplyUrl(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (status === 'disconnected' || status === 'active_ssl') {
      clearInterval(pollingRef.current);
      return;
    }
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/.netlify/functions/domain-status?siteId=${siteId}`, {
          headers: { ...(await authHeader()) },
        });
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data.status);
      } catch {}
    }, POLL_INTERVAL_MS);
    return () => clearInterval(pollingRef.current);
  }, [status, siteId]);

  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'domain-connected') {
        fetch(`/.netlify/functions/domain-status?siteId=${siteId}`).catch(() => {});
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [siteId]);

  if (!domain) {
    return (
      <div className="border border-black/[0.07] rounded-xl p-5">
        <p className="text-[13px] font-semibold text-[#1a1a1a] mb-2">Use your own domain</p>
        <p className="text-xs text-[#999] mb-3">Connect a domain you already own (like mybusiness.com).</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="mybusiness.com"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 border border-black/[0.10] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30 focus:border-[#cc0000]"
          />
          <button
            onClick={handleConnect}
            disabled={busy || !input}
            className={`px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors ${busy || !input ? 'bg-[#f2f0ec] text-[#888] cursor-not-allowed' : 'bg-[#cc0000] hover:bg-[#aa0000] text-white'}`}
          >
            {busy ? 'Connecting…' : 'Connect'}
          </button>
        </div>
        {err && <p className="text-xs text-[#cc0000] mt-2">{err}</p>}
      </div>
    );
  }

  return (
    <div className="border border-black/[0.07] rounded-xl p-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[16px] font-bold text-[#1a1a1a]">{domain}</p>
        <button onClick={handleDisconnect} disabled={busy} className="text-[12px] text-[#888] hover:text-[#cc0000] font-medium">
          Remove
        </button>
      </div>
      <div className={`inline-flex items-center gap-2 text-[12px] font-semibold px-2.5 py-1 rounded-full mb-5 ${
        display.tone === 'success' ? 'bg-green-50 text-green-700 border border-green-200'
        : display.tone === 'error' ? 'bg-red-50 text-[#cc0000] border border-red-200'
        : 'bg-amber-50 text-amber-700 border border-amber-200'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${
          display.tone === 'success' ? 'bg-green-500'
          : display.tone === 'error' ? 'bg-[#cc0000]'
          : 'bg-amber-500 animate-pulse'
        }`} />
        {display.label}
      </div>

      {status !== 'active_ssl' && (
        <div className="space-y-4">
          <div className="bg-[#faf9f7] border border-black/[0.07] rounded-lg p-4">
            <p className="text-[13px] font-bold text-[#1a1a1a] mb-2">What's happening</p>
            <ol className="text-[12px] text-[#555] space-y-1.5 list-decimal list-inside">
              <li>You add the DNS records below at your domain registrar (GoDaddy, Namecheap, etc.).</li>
              <li>Cloudflare verifies the records — usually 1-5 min, sometimes up to a few hours depending on your registrar.</li>
              <li>Once verified, an SSL certificate is provisioned automatically (HTTPS).</li>
              <li>You'll get an email when your domain is fully live.</li>
            </ol>
          </div>

          {provider && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-[13px] font-bold text-blue-900 mb-1">Auto-setup available</p>
              <p className="text-[12px] text-blue-800 mb-2.5">
                Detected registrar: <strong>{provider}</strong>. If the popup didn't open, click below to authorize the DNS update automatically.
              </p>
              <a href={applyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md transition-colors">
                Authorize {provider} →
              </a>
            </div>
          )}

          {cnameInstructions && cnameInstructions.length > 0 && (
            <div>
              <p className="text-[13px] font-bold text-[#1a1a1a] mb-2">
                {provider ? 'Or add these DNS records manually' : 'Add these DNS records at your registrar'}
              </p>
              <div className="bg-white border border-black/[0.10] rounded-lg overflow-hidden">
                <div className="grid grid-cols-[80px_120px_1fr] gap-2 px-3 py-2 bg-[#faf9f7] border-b border-black/[0.07] text-[10px] font-bold uppercase tracking-wider text-[#888]">
                  <div>Type</div>
                  <div>Host / Name</div>
                  <div>Value / Points to</div>
                </div>
                {cnameInstructions.map((r, i) => (
                  <div key={i} className="grid grid-cols-[80px_120px_1fr] gap-2 px-3 py-2.5 border-b border-black/[0.05] last:border-b-0 font-mono text-[12px] text-[#1a1a1a]">
                    <div className="font-semibold">{r.type}</div>
                    <div>{r.host}</div>
                    <div className="break-all">{r.value}</div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[#888] mt-2">
                Status updates automatically every few seconds — no need to refresh.
              </p>
            </div>
          )}
        </div>
      )}

      {status === 'active_ssl' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-[14px] font-bold text-green-800 mb-1">🎉 Your domain is live</p>
          <p className="text-[12px] text-green-700">
            Visitors can now reach your site at <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="underline font-semibold">https://{domain}</a> with HTTPS enabled automatically.
          </p>
        </div>
      )}

      {err && <p className="text-[12px] text-[#cc0000] mt-3">{err}</p>}
    </div>
  );
}
