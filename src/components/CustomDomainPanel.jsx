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
    <div className="border border-black/[0.07] rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-semibold text-[#1a1a1a]">{domain}</p>
        <button onClick={handleDisconnect} disabled={busy} className="text-xs text-[#888] hover:text-[#cc0000]">
          Remove
        </button>
      </div>
      <p className={`text-xs mb-3 ${display.tone === 'success' ? 'text-green-600' : display.tone === 'error' ? 'text-[#cc0000]' : 'text-[#888]'}`}>
        {display.label}
      </p>

      {provider && status !== 'active_ssl' && (
        <p className="text-xs text-[#555] mb-3">
          Detected registrar: <strong>{provider}</strong>. If the popup didn't open, <a href={applyUrl} className="text-[#cc0000] underline">click here to authorize</a>.
        </p>
      )}

      {!provider && status !== 'active_ssl' && cnameInstructions && (
        <div className="bg-[#eef4fb] border border-black/[0.07] rounded-lg p-3 font-mono text-xs text-[#555] space-y-1">
          <p className="font-semibold text-[#1a1a1a] mb-2">Add these DNS records at your registrar:</p>
          {cnameInstructions.map((r, i) => (
            <div key={i} className="flex gap-3">
              <span className="w-16 shrink-0 text-[#888]">{r.type}</span>
              <span className="w-24 shrink-0">{r.host}</span>
              <span className="break-all">{r.value}</span>
            </div>
          ))}
        </div>
      )}

      {err && <p className="text-xs text-[#cc0000] mt-2">{err}</p>}
    </div>
  );
}
