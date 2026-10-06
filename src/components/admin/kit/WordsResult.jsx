import { useEffect, useRef, useState } from 'react';
import { copyText } from '../customSiteUi.jsx';
import { wordsPlainText, wordsSections } from '../../../lib/kit/words.js';

// The Words kit's result (design.kit.words): the launch copy deck as the
// admin hands it over. One block per paste-ready piece, with its character
// count against the limit it has to fit and a Copy button, the deck's PDF
// and a "Copy everything" for an email or a doc. What the server changed
// or flagged in the skill's file comes first ("Server checks"), so nothing
// unsourced goes out unread.
//
//   run   design.kit.words (ready); run.data is the sanitized deck
//   urls  { [file name]: signed link } (words.pdf when it came back)

const BTN_SMALL = 'inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-black/[0.12] text-[11px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40';

// "Copied" for a moment on the button that was pressed.
function useCopied() {
  const [copied, setCopied] = useState('');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (id, text) => {
    const ok = await copyText(text);
    setCopied(ok ? id : `!${id}`);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(''), 1800);
  };
  return [copied, copy];
}

function CopyButton({ id, text, label, copied, onCopy, idle = 'Copy' }) {
  const state = copied === id ? 'Copied' : copied === `!${id}` ? 'Copy failed' : idle;
  return (
    <button type="button" className={BTN_SMALL} onClick={() => onCopy(id, text)} aria-label={`Copy ${label}`}>
      <span aria-hidden="true">{state}</span>
    </button>
  );
}

// Characters against the limit the piece has to fit (String length, as
// the server and the skill count). Pieces without a limit show none.
function Count({ text, max }) {
  if (!(max > 0)) return null;
  const n = text.length;
  return (
    <span className={`text-[11px] tabular-nums ${n > max ? 'font-bold text-[#cc0000]' : 'text-ink-tertiary'}`}>
      {n} / {max}<span className="sr-only"> characters</span>
    </span>
  );
}

function Piece({ item, copied, onCopy }) {
  return (
    <li className="rounded-lg border border-black/[0.08] bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="min-w-0 flex-1 text-[12px] font-bold text-[#1a1a1a]">{item.label}</p>
        <Count text={item.text} max={item.max} />
        <CopyButton id={item.id} text={item.text} label={item.label} copied={copied} onCopy={onCopy} />
      </div>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-[#2a2a2a]">{item.text}</p>
      {item.meta.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {item.meta.map((m, i) => <li key={i} className="text-[11px] text-ink-tertiary break-words">{m}</li>)}
        </ul>
      )}
    </li>
  );
}

export default function WordsResult({ run, urls }) {
  const data = run?.data;
  const sections = wordsSections(data);
  const [copied, onCopy] = useCopied();
  if (!sections.length) return <p className="text-[12px] text-ink-tertiary">This run has no copy to show.</p>;
  const adjustments = (Array.isArray(data?.adjustments) ? data.adjustments : []).filter((a) => typeof a === 'string');
  // The signed storage link, and only an http(s) one, is ever an href.
  const pdf = typeof urls?.['words.pdf'] === 'string' && /^https?:\/\//i.test(urls['words.pdf']) ? urls['words.pdf'] : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton id="all" idle="Copy everything" text={wordsPlainText(data)} label="the whole deck as text" copied={copied} onCopy={onCopy} />
        <span className="text-[11px] text-ink-tertiary">as plain text, for an email or a doc</span>
        {pdf && (
          <a href={pdf} className={`${BTN_SMALL} ml-auto`}>
            Printable deck (PDF)<span className="sr-only"> (download words.pdf)</span>
          </a>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {copied && !copied.startsWith('!') ? 'Copied to the clipboard.' : copied ? 'Could not copy: select the text instead.' : ''}
      </p>

      {adjustments.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
          <p className="text-[12px] font-bold text-amber-900">Server checks ({adjustments.length})</p>
          <p className="text-[11px] text-amber-900">What the server changed in the skill's file, and what to check before this goes out.</p>
          <ul className="mt-1 list-disc pl-5 space-y-0.5 text-[12px] text-amber-900">
            {adjustments.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      {sections.map((s, i) => (
        <details key={s.id} open={i === 0} className="group">
          <summary className="cursor-pointer select-none text-[13px] font-[800] text-[#1a1a1a]">
            {s.title}
          </summary>
          <p className="mt-1 text-[11px] text-[#4a4a4a]">{s.hint}</p>
          <ul className="mt-2 space-y-2">
            {s.items.map((item) => <Piece key={item.id} item={item} copied={copied} onCopy={onCopy} />)}
          </ul>
        </details>
      ))}
    </div>
  );
}
