import { useEffect, useId, useRef, useState } from 'react';
import { kitFiles } from '../../../lib/customSiteKit.js';
import { SOCIAL_LIMITS, SOCIAL_ROLE_LABELS, captionsText, downloadHref, socialView } from '../../../lib/kit/social.js';
import { copyText } from '../customSiteUi.jsx';

// The Social kit's view (Launch Kit skill "social"): every image that came
// back with its download, what it is for, the words on it and its alt text
// (to paste where the platform asks for one), then each post's caption with
// a copy button. What the server's second look flagged (a line the
// customer's facts don't back) shows in amber next to the image or caption
// it concerns. LaunchKitPanel shows the run's files, notes and warnings
// above this view.
//
//   run      design.kit.social (status 'ready'); run.data is the stored
//            social.json (src/lib/kit/social.js sanitizeSocial)
//   project  the custom_site_projects row (unused; the panel passes it)
//   urls     signed links by file name (10 minutes; the panel refreshes them)

const BTN = 'inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md bg-white border border-black/[0.12] text-[12px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40';
const BTN_SMALL = 'shrink-0 inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-black/[0.12] text-[11px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40';
const HEAD = 'text-[11px] font-bold uppercase tracking-[1px] text-[#4a4a4a]';

// copied: '' | id (copied) | '!' + id (the browser refused the clipboard).
function useCopied() {
  const [copied, setCopied] = useState('');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (id, text) => {
    const ok = await copyText(text);
    clearTimeout(timer.current);
    setCopied(ok ? id : `!${id}`);
    timer.current = setTimeout(() => setCopied(''), 1800);
  };
  return [copied, copy];
}

function CopyButton({ id, text, what, copied, onCopy, idle = 'Copy', className = BTN_SMALL }) {
  const state = copied === id ? 'Copied' : copied === `!${id}` ? 'Copy failed' : idle;
  return (
    <button
      type="button"
      onClick={() => onCopy(id, text)}
      className={className}
      aria-label={state === 'Copy failed' ? `Copy failed: select ${what} and copy it by hand` : `${idle} ${what}`}
    >
      {state}
    </button>
  );
}

function Checks({ checks }) {
  if (!checks.length) return null;
  return (
    <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[12px] text-amber-900" role="note">
      <p className="font-semibold">Check before posting</p>
      <ul className="mt-0.5 list-disc pl-4 space-y-0.5">
        {checks.map((c, i) => <li key={i} className="break-words">{c}</li>)}
      </ul>
    </div>
  );
}

function ImageCard({ image, copied, onCopy }) {
  const { file, label, purpose, px, sizeLabel, url, alt, text, checks, kind } = image;
  const href = url ? downloadHref(url, file) : '';
  return (
    <li className="min-w-0 rounded-lg border border-black/[0.08] bg-white p-3">
      <div className="flex h-44 items-center justify-center overflow-hidden rounded-md bg-[#f2f0ec]">
        {url ? (
          <img
            src={url}
            alt={alt || label}
            width={px[0]}
            height={px[1]}
            loading="lazy"
            className={`block max-h-full max-w-full w-auto h-auto object-contain ${kind === 'profile' ? 'rounded-full' : ''}`}
          />
        ) : (
          <span className="px-3 text-center text-[11px] text-ink-tertiary">Link expired: reload</span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2">
        <p className="text-[13px] font-bold text-[#1a1a1a]">{label}</p>
        <p className="text-[11px] text-ink-tertiary">{px[0]}×{px[1]}{sizeLabel ? ` · ${sizeLabel}` : ''}</p>
      </div>
      <p className="text-[12px] text-[#4a4a4a]">{purpose}{kind === 'profile' ? '. Shown in the circle above.' : '.'}</p>
      {url && (
        <div className="mt-2 flex flex-wrap gap-2">
          {href && (
            <a href={href} download={file} className={BTN}>
              Download<span className="sr-only"> {label} ({file})</span>
            </a>
          )}
          <a href={url} target="_blank" rel="noreferrer" className={BTN}>
            Open<span className="sr-only"> {label} full size in a new tab</span>
          </a>
        </div>
      )}
      {text.length > 0 && (
        <dl className="mt-2 space-y-0.5 text-[12px]">
          {text.map((t, i) => (
            <div key={i} className="flex gap-2">
              <dt className="w-16 shrink-0 text-ink-tertiary">{SOCIAL_ROLE_LABELS[t.role] || t.role}</dt>
              <dd className="min-w-0 break-words text-[#1a1a1a]">{t.text}</dd>
            </div>
          ))}
        </dl>
      )}
      {alt && (
        <div className="mt-2 flex items-start gap-2 text-[12px]">
          <p className="min-w-0 flex-1 break-words text-[#4a4a4a] select-text">
            <span className="font-semibold text-[#1a1a1a]">Alt text: </span>{alt}
          </p>
          <CopyButton id={`alt:${file}`} text={alt} what={`the alt text of ${label}`} copied={copied} onCopy={onCopy} />
        </div>
      )}
      <Checks checks={checks} />
    </li>
  );
}

function CaptionCard({ caption, copied, onCopy }) {
  const { file, label, text, source, checks, url } = caption;
  return (
    <li className="rounded-lg border border-black/[0.08] bg-white p-3">
      <div className="flex items-start gap-3">
        {url ? (
          <img src={url} alt="" width={56} height={56} loading="lazy" className="h-14 w-14 shrink-0 rounded object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-bold text-[#1a1a1a]">{label}</p>
            <span className={`inline-flex px-1.5 py-px rounded-full text-[10px] font-bold ${source === 'words' ? 'bg-emerald-50 text-emerald-800' : 'bg-black/[0.05] text-[#4a4a4a]'}`}>
              {source === 'words' ? 'From the Words kit' : 'Written for this post'}
            </span>
            <span className="text-[11px] text-ink-tertiary">{text.length} / {SOCIAL_LIMITS.caption}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-[13px] text-[#1a1a1a] select-text">{text}</p>
          <Checks checks={checks} />
        </div>
        <CopyButton id={`caption:${file}`} text={text} what={`the caption for ${label}`} copied={copied} onCopy={onCopy} />
      </div>
    </li>
  );
}

export default function SocialResult({ run, urls }) {
  const imagesId = useId();
  const captionsId = useId();
  const [copied, onCopy] = useCopied();
  const view = socialView(run?.data, kitFiles('social', run, urls || {}));
  const { images, captions, fonts } = view;

  return (
    <div className="space-y-5">
      {fonts && (fonts.heading || fonts.body) && (
        <p className="text-[12px] text-[#4a4a4a]">
          {fonts.standIn
            ? `The brand fonts (${[fonts.heading, fonts.body].filter(Boolean).join(' and ')}) couldn't be fetched, so the text is set in DejaVu Sans. Rebuild to try again.`
            : `Set in ${fonts.heading === fonts.body ? fonts.heading : `${fonts.heading} and ${fonts.body}`}.`}
        </p>
      )}

      <section aria-labelledby={imagesId}>
        <h5 id={imagesId} className={HEAD}>Images</h5>
        {images.length ? (
          <ul className="mt-2 grid gap-3 sm:grid-cols-2">
            {images.map((im) => <ImageCard key={im.file} image={im} copied={copied} onCopy={onCopy} />)}
          </ul>
        ) : (
          <p className="mt-1 text-[12px] text-ink-tertiary">No images came back from this run.</p>
        )}
      </section>

      <section aria-labelledby={captionsId}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h5 id={captionsId} className={HEAD}>Captions</h5>
          {captions.length > 1 && (
            <CopyButton id="captions:all" idle="Copy all" text={captionsText(captions)} what="captions" copied={copied} onCopy={onCopy} />
          )}
        </div>
        {captions.length ? (
          <ul className="mt-2 space-y-2">
            {captions.map((c) => <CaptionCard key={c.file} caption={c} copied={copied} onCopy={onCopy} />)}
          </ul>
        ) : (
          <p className="mt-1 text-[12px] text-ink-tertiary">No captions in this run.</p>
        )}
      </section>

      <p className="sr-only" aria-live="polite">
        {copied && !copied.startsWith('!') ? 'Copied to the clipboard.' : copied ? 'Could not copy: select the text instead.' : ''}
      </p>
    </div>
  );
}
