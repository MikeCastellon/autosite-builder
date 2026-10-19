// Edit > Genius Store: put the owner's Genius Storefronts store on their
// site (copy.store, kit/store.js). Turning it on asks netlify/functions/
// genius-store.js, which makes the owner an approved partner and this site's
// storefront in Genius Storefronts and answers with its slug; the panel then
// saves copy.store = { slug } like any other edit. Turning it off only takes
// the section off the site: the partner account and storefront stay, so
// turning it back on gets the same store (and the same address) again.
//   confirm(message, { title, confirmText }) -> Promise<boolean>: the
//                       editor's dialog, before the store comes off the page
//   colors             the site's colours (templateMeta.colors): the store
//                      starts with its accent, and dark on a dark site
import { useEffect, useState } from 'react';
import { Label, Help, Note, Field, linkButtonClass } from './fields.jsx';
import { storeOf, affiliateLink, STORE_DEFAULTS, STORE_ORIGIN } from '../templates/kit/store.js';
import { geniusStoreCall as call, storeLook, ratePercent as pct } from '../../../lib/geniusStore.js';

export function Terms({ terms }) {
  return (
    <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg px-3 py-2 mb-3 bg-white">
      {terms.map((section) => (
        <div key={section.heading} className="mb-2">
          <p className="text-[12px] font-semibold text-gray-800">{section.heading}</p>
          {section.body.map((line, i) => <p key={i} className="text-[11px] leading-snug text-gray-600 mt-1">{line}</p>)}
        </div>
      ))}
    </div>
  );
}

function Code({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2 mb-1">
      <span className="text-[11px] text-gray-500">{label}</span>
      <code className="text-[12px] font-semibold text-gray-900 bg-gray-100 rounded px-2 py-0.5">{value}</code>
    </div>
  );
}

export function GeniusStorePanel({ copy, setCopy, siteId, colors, confirm }) {
  const raw = copy?.store && typeof copy.store === 'object' ? copy.store : null;
  const store = storeOf(raw);
  const hidden = Array.isArray(copy?.hiddenSections) && copy.hiddenSections.includes('shop');

  const [status, setStatus] = useState(null);
  const [terms, setTerms] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!siteId) return undefined;
    let live = true;
    call('status', { siteId }).then((s) => { if (live) setStatus(s); }).catch(() => {});
    return () => { live = false; };
  }, [siteId]);

  const loadTerms = async () => {
    setError('');
    try { setTerms(await call('terms')); } catch (e) { setError(e.message); }
  };

  const turnOn = async () => {
    if (!terms || !agreed) return;
    setBusy(true);
    setError('');
    try {
      const r = await call('enable', { siteId, termsVersion: terms.version, ...storeLook(colors) });
      if (!r.storefront?.slug) throw new Error('The store didn\'t come back. Please try again.');
      setStatus(r);
      setCopy('store', { ...(raw || {}), slug: r.storefront.slug });
    } catch (e) {
      // The terms moved on since they were shown: show the new ones.
      if (e.code === 'terms_changed') { setAgreed(false); loadTerms(); }
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    const ok = typeof confirm === 'function'
      ? await confirm('Take the store off your site? Your store account and earnings stay, and you can put it back any time.', { title: 'Remove store?', confirmText: 'Remove' })
      : true;
    if (ok) setCopy('store', null);
  };

  const setText = (key, value) => setCopy('store', { ...raw, [key]: value });

  if (!siteId) {
    return <Note title="Save your site first.">The store is made for this website, so it needs the site saved once.</Note>;
  }

  const partner = status?.partner;
  const rate = pct(partner?.rate);
  const email = status?.email;

  if (!store) {
    return (
      <>
        <Help className="mt-0 mb-3">
          Add a shop of Auto Care Genius car care products to your site. Customers order online and Auto Care Genius ships to them; you hold no stock.
          You earn {rate || 'a'} commission on every sale your store sends.
        </Help>
        {partner?.status === 'suspended' && <Note tone="error" title="Your store account is on hold.">Contact Auto Care Genius support to turn it back on.</Note>}
        {!terms ? (
          <button type="button" className="w-full py-2 mb-2 text-[12px] font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition" onClick={loadTerms}>
            Set up my store
          </button>
        ) : (
          <>
            <Label>Store terms</Label>
            <Terms terms={terms.terms} />
            <label className="flex items-start gap-2 mb-3 text-[12px] text-gray-700">
              <input type="checkbox" className="mt-0.5" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I agree to the Genius Store terms.</span>
            </label>
            <button
              type="button"
              disabled={!agreed || busy}
              onClick={turnOn}
              className="w-full py-2 mb-2 text-[12px] font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? 'Setting up your store…' : 'Turn on my store'}
            </button>
          </>
        )}
        {error && <Help tone="warn">{error}</Help>}
      </>
    );
  }

  return (
    <>
      {hidden && <Note tone="warn" title="This section is switched off in Sections." />}
      <Note tone="ok" title="Your store is on your site.">
        Customers order from it and Auto Care Genius ships to them.{rate ? ` You earn ${rate} of each order's product total.` : ''}
      </Note>
      <Field label="Heading" value={raw?.title || ''} onChange={(v) => setText('title', v)} placeholder={STORE_DEFAULTS.title} maxLength={120} />
      <Field label="Intro line" value={raw?.intro || ''} onChange={(v) => setText('intro', v)} placeholder={STORE_DEFAULTS.intro} maxLength={400} multiline rows={2} />
      <Help className="-mt-2 mb-4">Under the store your site also says that you earn a commission on its sales. That line always shows.</Help>

      <Label>Your codes</Label>
      <Code label="Affiliate link" value={affiliateLink(partner?.refCode)} />
      <Code label="Referral code" value={partner?.refCode} />
      <Code label="Customer discount code" value={partner?.discountCode} />
      <Help className="mt-1 mb-4">Share the link anywhere (social posts, texts, your Google profile) and give the discount code to customers in person: orders through either count as yours. Copy them from Genius Store in the main menu.</Help>

      <Label>Sales and payouts</Label>
      <Help className="mt-0 mb-4">
        Track your sales and set up how you get paid at{' '}
        <a className="underline" href={status?.dashboardUrl || STORE_ORIGIN} target="_blank" rel="noopener noreferrer">storefronts.autocaregenius.com</a>
        {email ? <> (sign in with {email})</> : null}. You can change which products your store shows there too.
      </Help>
      <button type="button" className={linkButtonClass} onClick={turnOff}>Remove the store from my site</button>
    </>
  );
}

export default GeniusStorePanel;
