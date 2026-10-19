import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { geniusStoreCall, storeLook, ratePercent } from '../../../lib/geniusStore.js';
import { buildTemplateMeta, resolveSiteRender, unpackGeneratedContent, withWidgetKeys } from '../../../lib/siteRender.js';
import { publishSite } from '../../../lib/publishSite.js';
import { isEffectiveSchedulerActive } from '../../../lib/subscriptionGating.js';
import { affiliateLink, STORE_ORIGIN } from '../../preview/templates/kit/store.js';
import { templateReads } from '../../preview/editorCapabilities.js';
import { Terms } from '../../preview/editor/GeniusStorePanel.jsx';
import { useAlert } from '../../ui/AlertProvider.jsx';

// Genius Store in the business menu: where an owner finds the store, turns it
// on, and gets their affiliate link and discount code. The editor's Genius
// Store tab does the same for the Shop section's heading; this page is the
// one owners actually see. Turning it on here also puts the Shop section on
// the site (genius-store.js saves copy.store) when the site's design has one,
// and a live site can be republished from here so it shows.
// Spec: docs/superpowers/specs/2026-10-19-genius-store-design.md

// The site the store is for: a published website on a design with the Shop
// section first, then any published website, then any website.
export function pickStoreSite(sites) {
  const list = Array.isArray(sites) ? sites : [];
  const shop = (s) => templateReads(s.template_id, 'store');
  return list.find((s) => s.published_url && shop(s))
    || list.find((s) => s.published_url)
    || list[0]
    || null;
}

function CopyRow({ label, value, help }) {
  const { toast } = useAlert();
  if (!value) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copied`, 'success');
    } catch {
      toast('Could not copy. Select it and copy it yourself.', 'error');
    }
  };
  return (
    <div className="py-3 border-b border-black/[0.06] last:border-0">
      <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 text-[14px] font-semibold text-[#1a1a1a] bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 break-all">{value}</code>
        <button type="button" onClick={copy} className="shrink-0 px-3 py-2 text-[13px] font-semibold text-white bg-[#1a1a1a] rounded-lg hover:bg-black transition">
          Copy
        </button>
      </div>
      {help && <p className="text-[12px] text-gray-500 mt-1.5">{help}</p>}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <section className="bg-white border border-black/[0.07] rounded-2xl p-5 sm:p-6 mb-5">
      {title && <h2 className="text-[17px] font-bold text-[#1a1a1a] mb-3">{title}</h2>}
      {children}
    </section>
  );
}

export default function GeniusStorePage({ userId, profile }) {
  const { toast } = useAlert();
  const [sites, setSites] = useState(null);
  const [siteId, setSiteId] = useState(null);
  const [status, setStatus] = useState(null);
  const [terms, setTerms] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data, error: err } = await supabase
        .from('sites')
        .select('id, user_id, business_info, template_id, slug, published_url, site_type, widget_config_ids')
        .eq('user_id', userId)
        .eq('site_type', 'website')
        .order('created_at', { ascending: false });
      if (err) { setError('Could not load your website. Please refresh.'); setSites([]); return; }
      setSites(data || []);
      setSiteId(pickStoreSite(data)?.id || null);
    })();
  }, [userId]);

  const site = useMemo(() => (sites || []).find((s) => s.id === siteId) || null, [sites, siteId]);

  const loadStatus = async (id) => {
    setStatus(null);
    try { setStatus(await geniusStoreCall('status', { siteId: id })); }
    catch (e) { setError(e.message); }
  };
  useEffect(() => { if (siteId) loadStatus(siteId); }, [siteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const showTerms = async () => {
    setError('');
    try { setTerms(await geniusStoreCall('terms')); } catch (e) { setError(e.message); }
  };

  // The website's colours (owner overrides included), so the store starts
  // looking like the site.
  const siteLook = async () => {
    const { data } = await supabase.from('sites').select('generated_content').eq('id', site.id).single();
    const { customColors } = unpackGeneratedContent(data?.generated_content);
    return storeLook(buildTemplateMeta(site.template_id, customColors)?.colors);
  };

  const enable = async (termsVersion) => {
    setBusy('enable');
    setError('');
    try {
      const r = await geniusStoreCall('enable', { siteId: site.id, termsVersion, ...(await siteLook()) });
      setStatus(r);
      toast('Your Genius Store is on', 'success');
    } catch (e) {
      if (e.code === 'terms_changed') { setAgreed(false); showTerms(); }
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  // Republish the live site so the Shop section shows: the same inputs the
  // dashboard's Republish uses (owner images, colours, fonts, widgets).
  const publish = async () => {
    setBusy('publish');
    setError('');
    try {
      const { data, error: err } = await supabase.from('sites').select('generated_content').eq('id', site.id).single();
      if (err) throw new Error('Could not load your site. Please try again.');
      const render = resolveSiteRender(site, data?.generated_content);
      if (!render.templateMeta) throw new Error('This site has no design yet. Open it in the editor first.');
      const generatedCopy = site.business_info?.customProjectId
        ? render.generatedCopy
        : await withWidgetKeys(render.generatedCopy, site.user_id, supabase);
      await publishSite({ ...render, generatedCopy, isPro: isEffectiveSchedulerActive(profile) });
      toast('Your site is updated with your store', 'success');
    } catch (e) {
      setError(`Could not update your site: ${e.message}`);
    } finally {
      setBusy('');
    }
  };

  if (sites === null) {
    return <main className="max-w-3xl mx-auto px-4 py-10"><p className="text-[#888] text-sm">Loading...</p></main>;
  }

  const partner = status?.partner;
  const storefront = status?.storefront;
  const on = Boolean(storefront?.slug) && partner?.status === 'approved';
  const rate = ratePercent(partner?.rate);
  const link = affiliateLink(partner?.refCode);
  const name = site?.business_info?.businessName || 'your website';

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl sm:text-4xl font-black text-[#1a1a1a] tracking-tight mb-3 mt-8">Genius Store</h1>
      <p className="text-[15px] text-gray-600 mb-6">
        Sell Auto Care Genius car care products to your customers and earn a commission on every sale. Customers order
        online, Auto Care Genius ships to them, and you hold no stock.
      </p>

      {sites.length === 0 && (
        <Card>
          <p className="text-[14px] text-gray-600">Create your website first: your store is made for it.</p>
        </Card>
      )}

      {sites.length > 1 && (
        <label className="block mb-5">
          <span className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Website</span>
          <select
            value={siteId || ''}
            onChange={(e) => { setSiteId(e.target.value); setTerms(null); setAgreed(false); }}
            className="w-full sm:w-auto text-[14px] border border-gray-200 rounded-lg px-3 py-2 bg-white"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {(s.business_info?.businessName || 'Untitled site') + (s.published_url ? '' : ' (not published)')}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && (
        <div className="border border-[#cc0000]/20 rounded-xl p-4 text-sm text-[#cc0000] bg-[#cc0000]/5 mb-5">{error}</div>
      )}

      {site && !status && !error && <p className="text-[#888] text-sm">Loading your store...</p>}

      {site && status && partner?.status === 'suspended' && (
        <Card>
          <p className="text-[14px] text-gray-700">Your store account is on hold. Contact Auto Care Genius support to turn it back on.</p>
        </Card>
      )}

      {site && status && !on && partner?.status !== 'suspended' && (
        <Card title={`Turn on your store for ${name}`}>
          <ul className="text-[14px] text-gray-700 space-y-1.5 mb-5 list-disc pl-5">
            <li>A shop of Auto Care Genius products on your website{status.siteHasShop ? '' : ' (on designs that have a Shop section)'}.</li>
            <li>Your own affiliate link to share anywhere, and a discount code for your customers.</li>
            <li>A commission on every order that comes through your store, link or code{rate ? ` (${rate} of the product total)` : ''}.</li>
          </ul>
          {!terms ? (
            <button type="button" onClick={showTerms} className="px-5 py-2.5 text-[14px] font-semibold text-white bg-[#cc0000] rounded-lg hover:bg-[#b30000] transition">
              Set up my store
            </button>
          ) : (
            <>
              <p className="text-[13px] font-semibold text-gray-800 mb-2">Store terms</p>
              <Terms terms={terms.terms} />
              <label className="flex items-start gap-2 mb-4 text-[14px] text-gray-700">
                <input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span>I agree to the Genius Store terms.</span>
              </label>
              <button
                type="button"
                disabled={!agreed || Boolean(busy)}
                onClick={() => enable(terms.version)}
                className="px-5 py-2.5 text-[14px] font-semibold text-white bg-[#cc0000] rounded-lg hover:bg-[#b30000] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy === 'enable' ? 'Setting up your store…' : 'Turn on my store'}
              </button>
            </>
          )}
        </Card>
      )}

      {site && status && on && (
        <>
          <Card title="Share your store">
            <CopyRow
              label="Your affiliate link"
              value={link}
              help="Post it on social media, text it to customers, add it to your Google profile. Orders through it count as yours."
            />
            <CopyRow
              label="Customer discount code"
              value={partner?.discountCode}
              help="Customers get a discount at checkout, and the order counts as yours."
            />
            <CopyRow label="Referral code" value={partner?.refCode} />
          </Card>

          <Card title="On your website">
            {!status.siteHasShop && (
              <p className="text-[14px] text-gray-600">
                Your website's design doesn't have a Shop section yet. Share your affiliate link and discount code instead:
                sales through them count the same.
              </p>
            )}
            {status.siteHasShop && !status.storeOnSite && (
              <>
                <p className="text-[14px] text-gray-600 mb-3">Your store isn't on {name} yet.</p>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => enable(status.termsVersion)}
                  className="px-4 py-2 text-[14px] font-semibold text-white bg-[#1a1a1a] rounded-lg hover:bg-black transition disabled:opacity-40"
                >
                  {busy === 'enable' ? 'Adding…' : 'Add the Shop section to my site'}
                </button>
              </>
            )}
            {status.siteHasShop && status.storeOnSite && (
              <>
                <p className="text-[14px] text-gray-600 mb-3">
                  The Shop section is saved on {name}.{' '}
                  {status.published
                    ? 'Update your live site to show it (or after any change to its heading in the editor).'
                    : 'It will show once you publish your site.'}
                </p>
                {status.published && (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={publish}
                    className="px-4 py-2 text-[14px] font-semibold text-white bg-[#1a1a1a] rounded-lg hover:bg-black transition disabled:opacity-40"
                  >
                    {busy === 'publish' ? 'Updating your site…' : 'Update my live site'}
                  </button>
                )}
                <p className="text-[12px] text-gray-500 mt-3">Change its heading or move it in the editor: Edit &gt; Genius Store, and Sections.</p>
              </>
            )}
          </Card>

          <Card title="Sales and payouts">
            <p className="text-[14px] text-gray-600">
              See your sales and commission, choose which products your store shows, and set up how you get paid at{' '}
              <a className="font-semibold text-[#cc0000] underline" href={status.dashboardUrl || STORE_ORIGIN} target="_blank" rel="noopener noreferrer">
                storefronts.autocaregenius.com
              </a>
              {status.email ? <> (sign in with {status.email})</> : null}.
            </p>
          </Card>
        </>
      )}
    </main>
  );
}
