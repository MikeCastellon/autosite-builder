import { useMemo, useState } from 'react';
import { ACTION_KIND_LABELS, MOBILE_LIMITS, headSnippet, mobileView } from '../../../lib/kit/mobile.js';
import { kitFiles } from '../../../lib/customSiteKit.js';
import { copyText } from '../customSiteUi.jsx';
import { readableOn } from '../../preview/templates/kit/theme.js';

// The mobile kit's result (Launch kit > Mobile kit, skill
// launch-mobile-kit): the icons as phones and browsers show them (iPhone's
// rounded square, Android's masks with the safe circle, the browser tab),
// the browser bar color, the phone headline, the tap actions, the
// text-for-a-quote link, the contact card with its download, the phone
// section order against the site's, the scorecard, and the head tags that
// put it all on the site. LaunchKitPanel shows the run's files, notes and
// warnings above it.
//
//   run      design.kit.mobile (status 'ready'); run.data is the sanitized
//            mobile.json (src/lib/kit/mobile.js), read through mobileView so
//            an older or broken record can't break the view
//   project  unused (the facts are in the data)
//   urls     { [kit file name]: signed link } from custom-site-kit `get`

const BTN = 'inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-black/[0.12] text-[12px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40';
const H = 'text-[12px] font-[800] uppercase tracking-wide text-[#4a4a4a]';
const CODE = 'block w-full overflow-x-auto whitespace-pre rounded-md bg-[#1a1a1a] text-[#f5f5f5] px-3 py-2 text-[11px] leading-relaxed';

// Android launchers cut the same square icon to their own shape; iOS
// rounds its corners. Radii as a share of the side.
const MASKS = [
  { id: 'circle', label: 'Circle', radius: '50%' },
  { id: 'squircle', label: 'Squircle', radius: '32%' },
  { id: 'rounded', label: 'Rounded square', radius: '18%' },
];

function useCopy() {
  const [copied, setCopied] = useState('');
  async function copy(key, text) {
    const ok = await copyText(text);
    setCopied(ok ? key : '');
    if (ok) setTimeout(() => setCopied((k) => (k === key ? '' : k)), 2000);
  }
  return [copied, copy];
}

function CopyButton({ id, text, copied, copy, label = 'Copy' }) {
  return (
    <button type="button" className={BTN} onClick={() => copy(id, text)} aria-label={`${label}: ${id}`}>
      {copied === id ? 'Copied' : label}
    </button>
  );
}

function Missing({ size, label }) {
  return (
    <div
      className="flex items-center justify-center rounded-[22%] border border-dashed border-black/[0.15] bg-[#faf9f7] text-center text-[9px] leading-tight text-ink-tertiary px-1"
      style={{ width: size, height: size }}
    >
      {label} missing
    </div>
  );
}

function Icon({ url, size, radius, alt, label }) {
  if (!url) return <Missing size={size} label={label} />;
  return (
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      className="block shadow-sm"
      style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover' }}
    />
  );
}

// The 512 icon with the circle every Android mask keeps (radius 40%).
function SafeZone({ url }) {
  if (!url) return <Missing size={128} label="icon-512.png" />;
  return (
    <div className="relative" style={{ width: 128, height: 128 }}>
      <img src={url} alt="App icon 512 with the maskable safe zone" width={128} height={128} className="block rounded-md" />
      <span aria-hidden="true" className="absolute rounded-full border-2 border-dashed border-[#00b4d8]" style={{ inset: '10%' }} />
    </div>
  );
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

// A phone at a glance: the browser bar in the theme color, the phone
// headline and the first two actions as buttons.
function PhoneMock({ view }) {
  const bar = view.themeColor || '#ffffff';
  // Black rather than near-black: one of white and black always reads at
  // 4.5:1 on the bar.
  const ink = readableOn(bar, { dark: '#000000' });
  const host = hostOf(view.vcard.url) || 'your-site';
  const buttons = view.actions.filter((a) => a.kind !== 'save').slice(0, 2);
  return (
    <figure className="shrink-0" aria-label="Phone preview">
      <div className="w-[200px] rounded-[28px] border-[6px] border-[#1a1a1a] bg-[#1a1a1a] overflow-hidden shadow-md">
        <div className="px-3 pt-2 pb-2" style={{ background: bar, color: ink }}>
          <div className="text-[9px] font-semibold opacity-80 text-center">9:41</div>
          <div className="mt-1 rounded-full px-2 py-0.5 text-[9px] text-center truncate" style={{ background: ink === '#ffffff' ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.08)' }}>
            {host}
          </div>
        </div>
        <div className="px-3 pt-4 pb-3 min-h-[180px] flex flex-col justify-between" style={{ background: bar, color: ink }}>
          <p className="text-[17px] font-[800] leading-tight break-words">{view.phoneHeadline || 'No phone headline'}</p>
          <div className="mt-3 flex gap-1.5">
            {buttons.map((a, i) => (
              <span
                key={a.kind}
                className="flex-1 truncate rounded-md px-1.5 py-1.5 text-center text-[10px] font-bold"
                style={i === 0 ? { background: ink, color: bar } : { border: `1px solid ${ink}`, color: ink }}
              >
                {a.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="mt-1 text-center text-[10px] text-ink-tertiary">Browser bar in {view.themeColor || 'no color'}</figcaption>
    </figure>
  );
}

const MOVE_TEXT = (m) => (m > 0 ? `up ${m}` : m < 0 ? `down ${-m}` : '');

const PASS_STYLE = {
  true: ['Pass', 'bg-emerald-50 text-emerald-800'],
  false: ['To fix', 'bg-[#fff5f5] text-[#cc0000]'],
  null: ['Check', 'bg-amber-50 text-amber-900'],
};

function CheckList({ title, items }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#4a4a4a]">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((c) => {
          const [badge, cls] = PASS_STYLE[String(c.pass)] || PASS_STYLE.null;
          return (
            <li key={c.id || c.check} className="flex items-start gap-2 text-[12px]">
              <span className={`mt-px shrink-0 inline-flex px-1.5 py-px rounded text-[10px] font-bold uppercase tracking-wide ${cls}`}>{badge}</span>
              <span className="min-w-0">
                <span className="font-semibold text-[#1a1a1a]">{c.check}</span>
                {c.note ? <span className="text-[#4a4a4a]">{`: ${c.note}`}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// The link to try an action: a call or a text opens on a phone; the
// booking and maps links open in a tab; "save" downloads the card. Only
// these schemes ever become a link (a stored record is still data).
const tryHref = (href) => (typeof href === 'string' && /^(tel:|sms:|https:\/\/)/.test(href) ? href : '');

function actionLink(a, cardUrl) {
  if (a.kind === 'save') return cardUrl || '';
  return tryHref(a.href);
}

export default function MobileResult({ run, urls }) {
  const view = useMemo(() => mobileView(run?.data), [run?.data]);
  const snippet = useMemo(() => headSnippet(run?.data), [run?.data]);
  const files = useMemo(() => Object.fromEntries(kitFiles('mobile', run, urls).map((f) => [f.name, f.url])), [run, urls]);
  const [copied, copy] = useCopy();
  const card = view.vcard;
  const cardUrl = files['contact.vcf'] || '';
  const fields = [
    ['Name', card.fn],
    ['Phone', card.tel],
    ['Email', card.email],
    ['Website', card.url],
    ['Address', card.adr],
  ];
  const tabTitle = view.shortName || card.fn || 'Site';

  return (
    <div className="space-y-5">
      {view.changes.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <p className="text-[12px] font-semibold text-amber-900">The server corrected mobile.json before storing it:</p>
          <ul className="mt-1 list-disc pl-5 text-[12px] text-amber-900 space-y-0.5">
            {view.changes.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-5">
        <PhoneMock view={view} />
        <div className="min-w-0 flex-1 basis-64 space-y-4">
          <section aria-labelledby="mk-icons" className="space-y-2">
            <h5 id="mk-icons" className={H}>Home-screen icons</h5>
            <div className="flex flex-wrap items-end gap-4 rounded-lg bg-gradient-to-br from-[#2b3a55] to-[#6b4e71] px-4 py-3">
              <div className="flex flex-col items-center gap-1">
                <Icon url={files['apple-touch-icon.png']} size={60} radius="22.5%" alt="iPhone home-screen icon" label="apple-touch-icon.png" />
                <span className="max-w-[72px] truncate text-[10px] text-white">{view.shortName || 'No name'}</span>
                <span className="text-[9px] text-white/80">iPhone</span>
              </div>
              {MASKS.map((m) => (
                <div key={m.id} className="flex flex-col items-center gap-1">
                  <Icon url={files['icon-192.png']} size={56} radius={m.radius} alt={`Android icon, ${m.label.toLowerCase()} mask`} label="icon-192.png" />
                  <span className="max-w-[72px] truncate text-[10px] text-white">{view.shortName || 'No name'}</span>
                  <span className="text-[9px] text-white/80">{m.label}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-start gap-4">
              <div className="space-y-1">
                <SafeZone url={files['icon-512.png']} />
                <p className="max-w-[128px] text-[10px] text-ink-tertiary">The mark stays inside the dashed circle, so no mask cuts it.</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 rounded-t-lg bg-[#e8e8ea] px-2 pt-1.5">
                  <div className="flex items-center gap-1.5 rounded-t-md bg-white px-2 py-1 max-w-[180px]">
                    {files['favicon-32.png']
                      ? <img src={files['favicon-32.png']} alt="Favicon in a browser tab" width={16} height={16} className="block" />
                      : <span className="w-4 h-4 rounded-sm border border-dashed border-black/20" aria-hidden="true" />}
                    <span className="truncate text-[11px] text-[#1a1a1a]">{tabTitle}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {files['favicon-32.png']
                    ? <img src={files['favicon-32.png']} alt="Favicon at full size" width={32} height={32} className="block border border-black/[0.08]" style={{ imageRendering: 'pixelated' }} />
                    : <Missing size={32} label="favicon" />}
                  <span className="text-[10px] text-ink-tertiary">32 px, as a bookmark shows it</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-6 h-6 rounded border border-black/[0.12]" style={{ background: view.themeColor || 'transparent' }} aria-hidden="true" />
                  <span className="text-[12px] font-mono text-[#1a1a1a]">{view.themeColor || 'none'}</span>
                </div>
                <p className="text-[10px] text-ink-tertiary">Browser bar color{view.icons?.bg && view.icons.bg !== view.themeColor ? `; icons on ${view.icons.bg}` : ''}</p>
                {view.icons?.source === 'monogram' && (
                  <p className="text-[11px] text-amber-900">A monogram ({view.icons.monogram}) until the customer has a logo.</p>
                )}
              </div>
            </div>
          </section>

          <section aria-labelledby="mk-headline" className="space-y-1">
            <h5 id="mk-headline" className={H}>Phone headline</h5>
            <p className="text-[15px] font-[800] text-[#1a1a1a]">{view.phoneHeadline || 'None: the site headline stays as it is'}</p>
            <p className="text-[11px] text-ink-tertiary">
              {view.phoneHeadline.length} of {MOBILE_LIMITS.phoneHeadline} characters, condensed from the site's own headline (no new claims).
              {' '}Home-screen name: <span className="font-semibold text-[#1a1a1a]">{view.shortName || 'none'}</span>
            </p>
          </section>
        </div>
      </div>

      <section aria-labelledby="mk-actions" className="space-y-2">
        <h5 id="mk-actions" className={H}>Tap actions</h5>
        {view.actions.length ? (
          <ul className="divide-y divide-black/[0.06] rounded-lg border border-black/[0.08] bg-white">
            {view.actions.map((a) => {
              const href = actionLink(a, cardUrl);
              return (
                <li key={a.kind} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#4a4a4a]">{ACTION_KIND_LABELS[a.kind]}</span>
                  <span className="text-[13px] font-semibold text-[#1a1a1a]">{a.label}</span>
                  <code className="min-w-0 flex-1 basis-40 truncate text-[11px] text-[#4a4a4a]" title={a.href}>{a.href}</code>
                  <CopyButton id={`${a.kind} link`} text={a.href} copied={copied} copy={copy} />
                  {href && (
                    <a className={BTN} href={href} {...(/^https:/.test(href) ? { target: '_blank', rel: 'noreferrer' } : {})}>
                      {a.kind === 'save' ? 'Download' : 'Try it'}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[12px] text-ink-tertiary">No actions: the site shows no phone number, booking or address.</p>
        )}
      </section>

      <section aria-labelledby="mk-sms" className="space-y-2">
        <h5 id="mk-sms" className={H}>Text us a photo for a quote</h5>
        {view.smsQuote ? (
          <div className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 space-y-2">
            <p className="text-[13px] text-[#1a1a1a]">{view.smsQuote.body}</p>
            <code className="block truncate text-[11px] text-[#4a4a4a]" title={view.smsQuote.href}>{view.smsQuote.href}</code>
            <div className="flex flex-wrap gap-2">
              <CopyButton id="text link" text={view.smsQuote.href} copied={copied} copy={copy} label="Copy link" />
              <CopyButton id="message" text={view.smsQuote.body} copied={copied} copy={copy} label="Copy message" />
              {/^sms:/.test(view.smsQuote.href) && <a className={BTN} href={view.smsQuote.href}>Try it on a phone</a>}
            </div>
            <p className="text-[11px] text-ink-tertiary">
              Opens Messages on iPhone and Android with this text ready; the visitor adds the photo. Confirm the number takes texts.
            </p>
          </div>
        ) : (
          <p className="text-[12px] text-ink-tertiary">No text link: the site shows no phone number that can take texts.</p>
        )}
      </section>

      <section aria-labelledby="mk-card" className="space-y-2">
        <h5 id="mk-card" className={H}>Contact card</h5>
        <div className="rounded-lg border border-black/[0.08] bg-white px-3 py-2">
          <dl className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1 text-[12px]">
            {fields.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-[#4a4a4a]">{label}</dt>
                <dd className={`min-w-0 break-words ${value ? 'text-[#1a1a1a]' : 'text-ink-tertiary'}`}>{value || 'not on the site'}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {cardUrl
              ? <a className={BTN} href={cardUrl}>Download contact.vcf</a>
              : <span className="text-[11px] text-ink-tertiary">contact.vcf link expired: reload</span>}
            <span className="text-[11px] text-ink-tertiary">vCard 3.0 from the facts the site shows; opens in Contacts on iPhone and Android.</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="mk-order" className="space-y-2">
        <h5 id="mk-order" className={H}>Section order on phones</h5>
        {view.order.length ? (
          <>
            <ol className="grid gap-1 sm:grid-cols-2">
              {view.order.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2 rounded-md border border-black/[0.06] bg-white px-2 py-1 text-[12px]">
                  <span className="w-5 text-right font-bold text-[#4a4a4a]">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[#1a1a1a]">{s.label}</span>
                  {s.move !== 0 && (
                    <span className={`text-[10px] font-semibold ${s.move > 0 ? 'text-emerald-800' : 'text-[#4a4a4a]'}`}>{MOVE_TEXT(s.move)}</span>
                  )}
                </li>
              ))}
            </ol>
            {view.siteOrder.length > 0 && (
              <p className="text-[11px] text-ink-tertiary">Site now: {view.siteOrder.map((s) => s.label).join(' \u00b7 ')}</p>
            )}
            <p className="text-[11px] text-ink-tertiary">The site has one order for every screen: apply it in the editor's Sections list when it suits desktop too.</p>
          </>
        ) : (
          <p className="text-[12px] text-ink-tertiary">No section order.</p>
        )}
      </section>

      <section aria-labelledby="mk-score" className="space-y-2">
        <h5 id="mk-score" className={H}>
          Phone scorecard
          <span className="ml-2 normal-case tracking-normal font-semibold text-ink-tertiary">
            {`${view.passed.length} pass \u00b7 ${view.toFix.length} to fix \u00b7 ${view.toCheck.length} to check`}
          </span>
        </h5>
        <div className="space-y-3">
          <CheckList title="To fix" items={view.toFix} />
          <CheckList title="Check by hand or in preview" items={view.toCheck} />
          <CheckList title="Passes" items={view.passed} />
        </div>
      </section>

      <details className="rounded-lg border border-black/[0.06] bg-white px-3 py-2">
        <summary className="cursor-pointer text-[12px] font-semibold text-[#1a1a1a]">Head tags and web manifest</summary>
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-ink-tertiary">
            With the icons at the site's root, these put the icons, the home-screen name and the browser bar color on the site.
          </p>
          <code className={CODE}>{snippet.tags}</code>
          <CopyButton id="head tags" text={snippet.tags} copied={copied} copy={copy} />
          <p className="text-[11px] text-ink-tertiary">site.webmanifest:</p>
          <code className={CODE}>{snippet.manifest}</code>
          <CopyButton id="manifest" text={snippet.manifest} copied={copied} copy={copy} />
        </div>
      </details>
    </div>
  );
}
