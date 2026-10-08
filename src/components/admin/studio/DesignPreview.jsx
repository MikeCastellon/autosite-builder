import { useEffect, useRef, useState } from 'react';
import {
  PREVIEW_SANDBOX, PREVIEW_SCROLL_MESSAGE, SAMPLE_TAG, buildPreviewInput, framePreviewHtml, publishedTabHtml, renderPreviewHtml,
} from './designPreview.js';

// Live preview of a custom site as the Design setup has it configured: the
// published page (exportHtml.js) at a real desktop or phone width, scaled
// to the panel, rebuilt a moment after the inputs stop changing. See
// designPreview.js for what goes in.
//
// Limits: the booking and contact widgets don't load (the page has no live
// site id), so Book buttons scroll to the contact section; review and
// Instagram widgets may not load inside the sandbox; photo links from the
// customer's uploads expire an hour after the project page loaded.

const BTN = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-black/[0.12] text-[13px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 disabled:opacity-50 transition-colors';

// Logical page sizes: a laptop and an iPhone (visible web area).
const DEVICES = {
  desktop: { label: 'Desktop', width: 1280, height: 900 },
  phone: { label: 'Phone', width: 390, height: 760 },
};
// Typing in a field rebuilds the page once, after this pause.
const DEBOUNCE_MS = 400;

export default function DesignPreview({
  templateId, businessInfo, copy, images, customColors, customFonts, levers, projectId, existingInfo, beforeAfter,
  isPro = true, defaultDevice = 'desktop', className = '',
}) {
  const input = buildPreviewInput({ templateId, businessInfo, copy, images, customColors, customFonts, levers, projectId, existingInfo, beforeAfter });
  // Props arrive as fresh objects on every parent render: rebuild only when
  // what they say changes. The input is plain data, so the key is the input.
  const inputKey = input ? JSON.stringify(input) : '';

  const [device, setDevice] = useState(DEVICES[defaultDevice] ? defaultDevice : 'desktop');
  const [html, setHtml] = useState('');
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');
  // Up to two stacked frames: the one showing, and the next one loading
  // behind it, so an update swaps in without a blank flash.
  const [frames, setFrames] = useState([]); // [{ key, srcDoc }]
  const [shownKey, setShownKey] = useState(null);
  const shownRef = useRef(null);
  const frameEls = useRef(new Map());
  const seq = useRef(0);
  const scrollY = useRef(0);
  const built = useRef(false);
  const blobUrls = useRef([]);

  const boxRef = useRef(null);
  const [boxW, setBoxW] = useState(0);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setBoxW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build the page (debounced; the first build runs at once). A newer input
  // drops a build still running.
  useEffect(() => {
    if (!inputKey) {
      setHtml('');
      setBuilding(false);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setBuilding(true);
      try {
        const page = await renderPreviewHtml(JSON.parse(inputKey), { isPro });
        if (cancelled) return;
        built.current = true;
        setHtml(page);
        setError('');
      } catch (e) {
        if (!cancelled) setError(e?.message || 'The preview could not be built');
      } finally {
        if (!cancelled) setBuilding(false);
      }
    }, built.current ? DEBOUNCE_MS : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [inputKey, isPro]);

  // A different template is a different page: start it at the top.
  useEffect(() => { scrollY.current = 0; }, [templateId]);

  // Each new page loads behind the one showing, at the same scroll spot.
  useEffect(() => {
    if (!html) {
      setFrames([]);
      setShownKey(null);
      shownRef.current = null;
      return;
    }
    seq.current += 1;
    const key = seq.current;
    const srcDoc = framePreviewHtml(html, { scrollY: scrollY.current });
    setFrames((prev) => [...prev.filter((f) => f.key === shownRef.current), { key, srcDoc }]);
  }, [html]);

  function onFrameLoad(key) {
    // An older page that finishes after a newer one is already showing.
    if (shownRef.current != null && key < shownRef.current) return;
    shownRef.current = key;
    setShownKey(key);
    setFrames((prev) => prev.filter((f) => f.key >= key));
  }

  // The showing page reports where it is scrolled to. Its origin is opaque
  // ("null"), so the sender is checked by window, not origin.
  useEffect(() => {
    function onMessage(e) {
      const d = e.data;
      if (!d || d.type !== PREVIEW_SCROLL_MESSAGE) return;
      const win = frameEls.current.get(shownRef.current)?.contentWindow;
      if (!win || e.source !== win) return;
      scrollY.current = Math.max(0, Number(d.y) || 0);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => () => {
    blobUrls.current.forEach((u) => URL.revokeObjectURL(u));
    blobUrls.current = [];
  }, []);

  function openPublished() {
    if (!html) return;
    const url = URL.createObjectURL(new Blob([publishedTabHtml(html)], { type: 'text/html;charset=utf-8' }));
    // Kept until this panel closes: the tab may be reloaded.
    blobUrls.current.push(url);
    // Cut the link back to this tab, so the framed page can't reach the
    // admin page through top.opener. Done by hand rather than with the
    // 'noopener' feature, which some browsers apply oddly to blob: URLs.
    const tab = window.open(url, '_blank');
    if (tab) tab.opener = null;
  }

  const size = DEVICES[device];
  const scale = boxW ? Math.min(1, boxW / size.width) : 0.4;
  const left = Math.max(0, (boxW - size.width * scale) / 2);
  const noTemplate = !input;
  const sample = !!input?.sample;
  const waiting = !noTemplate && shownKey == null;

  return (
    <section className={`bg-white rounded-2xl border border-black/[0.07] p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h3 className="text-[11px] font-bold text-[#1a1a1a] uppercase tracking-[1.5px]">Preview</h3>
        {building && !waiting && <span role="status" className="text-[12px] text-ink-tertiary">Updating…</span>}
        {error && <span role="alert" className="text-[12px] font-medium text-[#cc0000]">{error}</span>}
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-black/[0.12] p-0.5" role="group" aria-label="Preview width">
            {Object.entries(DEVICES).map(([id, d]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDevice(id)}
                aria-pressed={device === id}
                className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${device === id ? 'bg-[#1a1a1a] text-white' : 'text-[#4a4a4a] hover:text-[#1a1a1a]'}`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={openPublished} disabled={!html} className={BTN} title="The same page in a new tab, full size">
            Open as published
          </button>
        </div>
      </div>

      {sample && (
        <p className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-900">
          Sample text: the site hasn't been written yet, so the words marked {`"${SAMPLE_TAG}"`} are placeholders built from the business details. Layout, colors, fonts, sections and photos are real.
        </p>
      )}

      <div
        ref={boxRef}
        className="relative overflow-hidden rounded-xl border border-black/[0.07] bg-[#faf9f7]"
        style={{ height: Math.round(size.height * scale) }}
      >
        {frames.map((f) => (
          <iframe
            key={f.key}
            ref={(el) => { if (el) frameEls.current.set(f.key, el); else frameEls.current.delete(f.key); }}
            title={`Site preview (${size.label.toLowerCase()})`}
            srcDoc={f.srcDoc}
            sandbox={PREVIEW_SANDBOX}
            onLoad={() => onFrameLoad(f.key)}
            aria-hidden={f.key !== shownKey && shownKey != null ? true : undefined}
            tabIndex={f.key !== shownKey && shownKey != null ? -1 : undefined}
            style={{
              position: 'absolute',
              top: 0,
              left,
              width: size.width,
              height: size.height,
              border: 0,
              background: '#fff',
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              // The loading page sits under the showing one. Covered, not
              // visibility:hidden: browsers stop painting hidden cross-origin
              // frames, so it would flash white when swapped in.
              zIndex: f.key === shownKey ? 1 : 0,
              pointerEvents: shownKey == null || f.key === shownKey ? 'auto' : 'none',
            }}
          />
        ))}
        {(noTemplate || waiting) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 bg-[#faf9f7] px-6 text-center text-[13px] text-ink-tertiary">
            {noTemplate ? (
              'Pick a template to see the preview.'
            ) : error ? (
              'The preview could not be built.'
            ) : (
              <>
                <span className="w-5 h-5 border-[3px] border-black/10 border-t-[#cc0000] rounded-full motion-safe:animate-spin shrink-0" aria-hidden="true" />
                Building the preview…
              </>
            )}
          </div>
        )}
      </div>
      <p className="mt-2 text-[11px] text-ink-tertiary">
        Booking and contact forms don't run in the preview; they work once the site is published.
      </p>
    </section>
  );
}
