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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
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
      setStatus(data.status);
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
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/.netlify/functions/domain-status?siteId=${siteId}`, {
          headers: { ...(await authHeader()) },
        });
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data.status);
        if (data.cnameInstructions?.length) setCnameInstructions(data.cnameInstructions);
      } catch {}
    };
    // Fetch immediately so users opening the panel see the records right away,
    // not after a 3s delay.
    fetchStatus();
    pollingRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
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
        <p className="text-[14px] font-semibold text-[#1a1a1a] mb-1.5">Use your own domain</p>
        <p className="text-[12px] text-[#888] mb-4">
          Connect a domain you already own. Your site will be live at <span className="font-semibold text-[#1a1a1a]">www.yourdomain.com</span>.
        </p>
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
              <li>Add the two DNS records below at your domain registrar — that's the only step on your end.</li>
              <li>Cloudflare verifies them automatically (1-5 min, sometimes longer depending on the registrar).</li>
              <li>HTTPS certificate provisions automatically once verified.</li>
              <li>You'll get an email when your site is live at <span className="font-semibold">www.{domain}</span>.</li>
            </ol>
          </div>

          {cnameInstructions && cnameInstructions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <p className="text-[13px] font-bold text-[#1a1a1a]">
                  Add these DNS records at your registrar
                </p>
                <button
                  type="button"
                  onClick={() => setShowHelp((v) => !v)}
                  className="text-[11px] text-[#cc0000] hover:text-[#aa0000] font-semibold transition-colors"
                >
                  {showHelp ? 'Hide help ↑' : 'How do I add these? ↓'}
                </button>
              </div>

              {showHelp && (
                <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 mb-3 text-[12px] text-[#444] space-y-2">
                  <p className="font-semibold text-[#1a1a1a]">Where to paste these in your registrar:</p>
                  <ul className="space-y-1.5 list-disc pl-4">
                    <li><strong>Squarespace</strong> — Domains → your domain → DNS Settings → Custom Records → Add (set Type, Host, points-to-data exactly as shown).</li>
                    <li><strong>GoDaddy</strong> — Domains → your domain → DNS → Add → CNAME.</li>
                    <li><strong>Namecheap</strong> — Domain List → your domain → Manage → Advanced DNS → Add New Record.</li>
                    <li><strong>Google Domains</strong> — DNS → Manage custom records → Create new record.</li>
                  </ul>
                  <p className="text-[11px] text-[#666] pt-1">
                    Your registrar might call them "host", "name", or "alias" — they all mean the same thing. If <code className="text-[11px] bg-white px-1 rounded">@</code> isn't accepted, leave the host field blank.
                  </p>
                </div>
              )}

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
            Visitors can now reach your site at <a href={`https://www.${domain}`} target="_blank" rel="noopener noreferrer" className="underline font-semibold">https://www.{domain}</a> with HTTPS enabled automatically.
          </p>
          <p className="text-[11px] text-green-700/80 mt-2">
            Want bare <code className="bg-white px-1 rounded">{domain}</code> to work too? Set up a domain forward at your registrar pointing to <code className="bg-white px-1 rounded">https://www.{domain}</code> (optional).
          </p>
        </div>
      )}

      {err && <p className="text-[12px] text-[#cc0000] mt-3">{err}</p>}
    </div>
  );
}
