import { useState } from 'react';
import {
  PAGE_LABELS, QR_KIND_LABELS, printPieceSpec, printShopNotes, qrTargetLabel, sanitizePrint,
} from '../../../lib/kit/print.js';
import { safeFileUrl } from '../../../lib/customSiteKit.js';
import { copyText } from '../customSiteUi.jsx';

// Print studio's result (Launch kit > Print studio, skill
// launch-print-studio): one card per print piece with its trim size,
// bleed, pages, the codes on it and exactly what each one opens, the PDF
// download and the note for the print shop; the pieces left out and why;
// the fonts and colors the PDFs use, with the ones that may shift in CMYK.
// LaunchKitPanel shows the run's files, notes and warnings above it.
//
//   run      design.kit.print (status 'ready'); run.data is the sanitized
//            print.json, read again through sanitizePrint (view mode: an
//            older or broken record can't break the view)
//   project  unused (the facts are in the data)
//   urls     { [kit file name]: signed link } from custom-site-kit `get`

const BTN = 'inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-black/[0.12] text-[12px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40';
const H = 'text-[12px] font-[800] uppercase tracking-wide text-[#4a4a4a]';
const LINK = 'text-[#1a1a1a] underline decoration-black/25 underline-offset-2 hover:decoration-[#cc0000] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40 rounded-sm break-all';

const inches = (n) => `${Number(n).toFixed(2).replace(/\.?0+$/, '')} in`;

// What a page list reads as: "Front, back and die-line".
function pagesLabel(pages) {
  const names = pages.map((p, i) => {
    const label = (PAGE_LABELS[p] || p).replace(/ \(.*\)$/, '');
    return i ? label.toLowerCase() : label;
  });
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] || '';
}

function CodeTarget({ code }) {
  const target = qrTargetLabel(code);
  if (code.kind === 'contact') {
    return (
      <details className="min-w-0">
        <summary className="cursor-pointer text-[12px] text-[#1a1a1a]">{target}</summary>
        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-[#1a1a1a] text-[#f5f5f5] px-2.5 py-2 text-[11px] leading-relaxed">
          {code.vcard.replace(/\r\n/g, '\n')}
        </pre>
      </details>
    );
  }
  const href = safeFileUrl(code.url);
  return href ? (
    <a href={href} target="_blank" rel="noreferrer noopener" className={`text-[12px] ${LINK}`} title={code.url}>
      {target}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  ) : (
    <span className="text-[12px] text-[#1a1a1a] break-all">{target}</span>
  );
}

function PieceCard({ piece, url }) {
  const spec = printPieceSpec(piece.file);
  const download = safeFileUrl(url);
  return (
    <li className="rounded-lg border border-black/[0.08] bg-white px-3 py-3 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h6 className="text-[13px] font-[800] text-[#1a1a1a]">{piece.name}</h6>
          <p className="text-[11px] text-ink-tertiary">
            {piece.size} trim · {piece.bleed.replace('in', ' in')} bleed · {pagesLabel(piece.pages)}
          </p>
        </div>
        {download ? (
          <a href={download} className={BTN}>
            <span className="px-1 rounded bg-black/[0.06] text-[10px] font-bold text-[#4a4a4a]">PDF</span>
            Download
            <span className="sr-only"> {piece.file}</span>
          </a>
        ) : (
          <span className="text-[11px] text-ink-tertiary">PDF not stored</span>
        )}
      </div>

      {piece.qr.length > 0 ? (
        <ul className="mt-2 space-y-1.5" aria-label={`Codes on the ${piece.name.toLowerCase()}`}>
          {piece.qr.map((code, i) => (
            <li key={`${code.kind}-${i}`} className="rounded-md bg-[#faf9f7] border border-black/[0.06] px-2.5 py-1.5">
              <p className="text-[11px] text-[#4a4a4a]">
                <span className="font-bold text-[#1a1a1a]">{QR_KIND_LABELS[code.kind]}</span>
                {' '}code, {inches(code.sizeIn)} · printed with “{code.label}”
              </p>
              <CodeTarget code={code} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[12px] text-ink-tertiary">No codes on this piece.</p>
      )}

      {piece.note && <p className="mt-2 text-[11px] text-[#4a4a4a]">{piece.note}</p>}
      {spec?.pages.includes('die-line') && (
        <p className="mt-1 text-[11px] text-amber-900">The last page is the cut path: the print shop cuts with it and never prints it.</p>
      )}
      {piece.text.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] font-semibold text-[#4a4a4a]">Printed words ({piece.text.length})</summary>
          <ul className="mt-1 list-disc pl-5 text-[11px] text-[#4a4a4a] space-y-0.5">
            {piece.text.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </details>
      )}
    </li>
  );
}

function Swatch({ label, hex, risky }) {
  if (!hex) return null;
  return (
    <li className="flex items-center gap-2 min-w-0">
      <span className="w-6 h-6 rounded-md border border-black/[0.12] shrink-0" style={{ background: hex }} aria-hidden="true" />
      <span className="text-[11px] text-[#4a4a4a]">
        <span className="font-semibold text-[#1a1a1a]">{label}</span> {hex}
        {risky && <span className="ml-1 text-amber-900">· may shift in CMYK</span>}
      </span>
    </li>
  );
}

export default function PrintResult({ run, urls }) {
  const data = sanitizePrint(run?.data);
  const [copied, setCopied] = useState(false);
  if (!data) return <p className="text-[12px] text-ink-tertiary">This run has no print plan to show.</p>;
  const risky = new Set(data.colors.cmykRisk);

  async function copyNotes() {
    const ok = await copyText(printShopNotes(data));
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <section aria-label="Print pieces" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h5 className={H}>Pieces</h5>
          <button type="button" className={BTN} onClick={copyNotes}>{copied ? 'Copied' : 'Copy notes for the print shop'}</button>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.pieces.map((p) => <PieceCard key={p.file} piece={p} url={urls?.[p.file]} />)}
        </ul>
      </section>

      {data.omitted.length > 0 && (
        <section aria-label="Left out" className="space-y-1">
          <h5 className={H}>Left out</h5>
          <ul className="list-disc pl-5 text-[12px] text-[#4a4a4a] space-y-0.5">
            {data.omitted.map((o) => (
              <li key={o.file}>
                <span className="font-semibold text-[#1a1a1a]">{printPieceSpec(o.file)?.name || o.file}</span>: {o.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Fonts and colors" className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <h5 className={H}>Fonts</h5>
          <p className="text-[12px] text-[#4a4a4a]">
            Headings in <span className="font-semibold text-[#1a1a1a]">{data.fonts.heading || 'the default face'}</span>,
            {' '}text in <span className="font-semibold text-[#1a1a1a]">{data.fonts.body || 'the default face'}</span>.
          </p>
          {data.fonts.fallback && (
            <p className="text-[11px] text-amber-900">A brand font wasn't available, so DejaVu Sans stands in where it was missing.</p>
          )}
        </div>
        <div className="space-y-1">
          <h5 className={H}>Colors</h5>
          <ul className="space-y-1">
            <Swatch label="Panel" hex={data.colors.panel} risky={risky.has(data.colors.panel)} />
            <Swatch label="Text" hex={data.colors.ink} risky={risky.has(data.colors.ink)} />
            <Swatch label="Accent" hex={data.colors.accent} risky={risky.has(data.colors.accent)} />
          </ul>
          {data.colors.cmykRisk.filter((h) => ![data.colors.panel, data.colors.ink, data.colors.accent].includes(h)).length > 0 && (
            <p className="text-[11px] text-amber-900">
              Also may shift in CMYK: {data.colors.cmykRisk.filter((h) => ![data.colors.panel, data.colors.ink, data.colors.accent].includes(h)).join(', ')}
            </p>
          )}
          <p className="text-[11px] text-ink-tertiary">The PDFs are RGB; the print shop converts them. Ask for a proof before a big run.</p>
        </div>
      </section>
    </div>
  );
}
