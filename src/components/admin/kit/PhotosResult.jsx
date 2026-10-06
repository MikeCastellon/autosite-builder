import { useMemo, useState } from 'react';
import {
  CROP_ASPECTS, GALLERY_SLOTS, PHOTO_ROLE_LABELS, boxStyle, cropPreviewStyle, pairAfters, photoCounts, photoSlots,
  picksByRole, sanitizePhotos,
} from '../../../lib/kit/photos.js';

// The photo desk's result (Launch kit > Photo desk, skill
// launch-photo-desk): the picks with their roles, crops and blur
// proposals drawn over the customer's own photos, the before/after pairs,
// what was skipped and why, and the shot list for their next job.
// LaunchKitPanel shows the run's files (contact_sheet.png) and notes above
// it. The stored data is re-checked with the same sanitizer the server
// used (src/lib/kit/photos.js), so a record from an older run can't break
// the view.
//
//   run      design.kit.photos (status 'ready'); run.data is photos.json
//   project  the project as the admin page loaded it: project.files carries
//            each upload's signed link (an hour), matched to picks by path
//   urls     { [kit file name]: signed link } (the panel shows those)
//   onApply  optional ({ hero, about, gallery }) => void: "Use these picks"
//            hands the Design setup its photo slots as stored upload paths
//            (photoSlots: '' / [] where the desk picked none, which the
//            setup should read as "keep yours"). Without it the button
//            isn't shown.

const ROLE_STYLES = {
  hero: 'bg-[#cc0000] text-white',
  about: 'bg-[#1e5ac8] text-white',
  gallery: 'bg-[#00825a] text-white',
  before: 'bg-[#965a14] text-white',
  after: 'bg-[#7828a0] text-white',
  skip: 'bg-[#5a5a5a] text-white',
};
const BTN = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-black/[0.12] text-[12px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-60 text-white text-[13px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40 focus-visible:ring-offset-2';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function RoleBadge({ role, order }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${ROLE_STYLES[role] || ROLE_STYLES.skip}`}>
      {PHOTO_ROLE_LABELS[role] || role}{order ? ` ${order}` : ''}
    </span>
  );
}

// The photo at its own aspect, with the desktop crop (solid yellow), the
// phone crop (dashed blue), the blur proposals (red) and the focal point
// drawn over it. Without a signed link, a placeholder says why.
function PhotoFrame({ pick, url, overlays, className = '' }) {
  const ratio = pick.width && pick.height ? `${pick.width} / ${pick.height}` : '4 / 3';
  if (!url) {
    return (
      <div className={`flex items-center justify-center rounded-md border border-dashed border-black/[0.15] bg-[#faf9f7] px-2 text-center text-[11px] text-ink-tertiary ${className}`} style={{ aspectRatio: ratio }}>
        Photo link missing or expired: reload the page
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden rounded-md bg-[#1a1a1a] ${className}`} style={{ aspectRatio: ratio }}>
      <img src={url} alt={pick.alt || ''} loading="lazy" className="absolute inset-0 w-full h-full" style={{ objectFit: 'fill' }} />
      {overlays && pick.width && (
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
          {pick.role === 'skip' && <div className="absolute inset-0 bg-black/40" />}
          <div className="absolute border-2 border-[#ffe65a] shadow-[0_0_0_1px_rgba(0,0,0,.6)]" style={boxStyle(pick.crops.desktop)} />
          <div className="absolute border-2 border-dashed border-[#5adcff]" style={boxStyle(pick.crops.phone)} />
          {pick.blur.map((b, i) => (
            <div key={i} className="absolute bg-[#e61e1e]/45 border border-[#ff3c3c]" style={boxStyle(b)} title={b.kind === 'face' ? 'Face to blur' : 'Plate to blur'} />
          ))}
          <div
            className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,.6)]"
            style={{ left: `${pick.focal.x * 100}%`, top: `${pick.focal.y * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

// The crop exactly as the site shows it on a wide screen and on a phone.
function CropPreviews({ pick, url }) {
  if (!url || !pick.width) return null;
  const frame = (key, width) => {
    const [w, h] = CROP_ASPECTS[key];
    return (
      <figure className="min-w-0" style={{ width }}>
        <div className="relative overflow-hidden rounded bg-[#1a1a1a]" style={{ aspectRatio: `${w} / ${h}` }}>
          <img src={url} alt="" aria-hidden="true" loading="lazy" style={cropPreviewStyle(pick.crops[key])} />
        </div>
        <figcaption className="mt-0.5 text-[10px] text-ink-tertiary">{key === 'desktop' ? 'Desktop 16:9' : 'Phone 4:5'}</figcaption>
      </figure>
    );
  };
  return (
    <div className="flex items-end gap-2">
      {frame('desktop', 168)}
      {frame('phone', 76)}
    </div>
  );
}

function blurLabel(pick) {
  const plates = pick.blur.filter((b) => b.kind === 'plate').length;
  const faces = pick.blur.filter((b) => b.kind === 'face').length;
  return [plates && plural(plates, 'plate'), faces && plural(faces, 'face')].filter(Boolean).join(', ');
}

function PickCard({ pick, url, overlays, order, large }) {
  const blur = blurLabel(pick);
  return (
    <li className={`min-w-0 rounded-lg border border-black/[0.08] bg-white p-2 ${large ? 'sm:col-span-2' : ''}`}>
      <PhotoFrame pick={pick} url={url} overlays={overlays} />
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <RoleBadge role={pick.role} order={order} />
        <span className="text-[11px] font-semibold text-[#1a1a1a]">{pick.score.toFixed(1)}</span>
        {blur && <span className="text-[11px] text-[#b42318]">Blur to confirm: {blur}</span>}
      </div>
      {pick.reason && <p className="mt-1 text-[12px] text-[#4a4a4a]">{pick.reason}</p>}
      {pick.alt && (
        <p className="mt-1 text-[11px] text-ink-tertiary"><span className="font-semibold">Alt text:</span> {pick.alt}</p>
      )}
      {large && <div className="mt-2"><CropPreviews pick={pick} url={url} /></div>}
    </li>
  );
}

export default function PhotosResult({ run, project, onApply }) {
  const data = useMemo(() => sanitizePhotos(run?.data, { projectId: project?.id }), [run?.data, project?.id]);
  // The signed links custom-site-admin made for the uploads; anything that
  // isn't an http(s) link is treated as missing.
  const links = useMemo(() => new Map((Array.isArray(project?.files) ? project.files : [])
    .filter((f) => f && typeof f.path === 'string' && typeof f.url === 'string' && /^https?:\/\//i.test(f.url))
    .map((f) => [f.path, f.url])), [project?.files]);
  const [overlays, setOverlays] = useState(true);
  const [applied, setApplied] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!data) return <p className="text-[12px] text-ink-tertiary">This run has no photo picks to show.</p>;

  const by = picksByRole(data);
  const counts = photoCounts(data);
  const slots = photoSlots(data);
  const fromPairs = slots.gallery.filter((p) => pairAfters(data).includes(p) && !by.gallery.some((g) => g.path === p)).length;
  const byPath = new Map(data.picks.map((p) => [p.path, p]));
  const url = (path) => links.get(path) || '';
  const summary = [
    counts.hero ? 'a hero' : 'no hero',
    counts.about ? 'an about photo' : 'no about photo',
    plural(counts.gallery, 'gallery photo'),
    plural(counts.pairs, 'before/after pair'),
    counts.skip ? `${counts.skip} skipped` : '',
  ].filter(Boolean).join(' · ');
  const blurTotal = counts.plates + counts.faces;
  const canApply = typeof onApply === 'function' && !!(slots.hero || slots.about || slots.gallery.length);

  function apply() {
    onApply({ hero: slots.hero, about: slots.about, gallery: [...slots.gallery] });
    setApplied(true);
  }

  async function copyShots() {
    try {
      await navigator.clipboard.writeText(data.shotList.map((s, i) => `${i + 1}. ${s}`).join('\n'));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const used = [...by.hero, ...by.about, ...by.gallery];
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-[12px] text-[#1a1a1a] font-semibold">{summary}</p>
        {blurTotal > 0 && (
          <p className="text-[12px] text-[#4a4a4a]">
            {plural(counts.plates, 'plate')} and {plural(counts.faces, 'face')} proposed for blurring (red boxes). Nothing is blurred
            yet: check each box before the photos go on the site.
          </p>
        )}
      </div>

      {(typeof onApply === 'function') && (
        <div className="rounded-lg border border-black/[0.08] bg-white px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={BTN_PRIMARY} onClick={apply} disabled={!canApply}>Use these picks</button>
            {applied && <span role="status" className="text-[12px] font-semibold text-[#00825a]">Handed to the Design setup.</span>}
          </div>
          <p className="mt-1.5 text-[11px] text-ink-tertiary">
            Sets the hero{slots.about ? ', the about photo' : ''} and {plural(slots.gallery.length, 'gallery photo')}
            {fromPairs ? ` (${fromPairs} of them the "after" half of a pair, filling free slots of ${GALLERY_SLOTS})` : ''}.
            {!slots.hero && ' There is no hero pick: the hero slot is left as it is.'}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-tertiary">
        <label className="inline-flex items-center gap-1.5 font-semibold text-[#1a1a1a]">
          <input type="checkbox" checked={overlays} onChange={(e) => setOverlays(e.target.checked)} />
          Show crops and blur boxes
        </label>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-4 h-2.5 border-2 border-[#ffe65a] bg-black/70" />Desktop 16:9</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2.5 h-3 border-2 border-dashed border-[#5adcff] bg-black/70" />Phone 4:5</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-2.5 bg-[#e61e1e]/60 border border-[#ff3c3c]" />Blur (to confirm)</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-[#1a1a1a]" />Focal point</span>
      </div>

      {used.length > 0 ? (
        <section aria-label="Picks">
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {by.hero.map((p) => <PickCard key={p.path} pick={p} url={url(p.path)} overlays={overlays} large />)}
            {by.about.map((p) => <PickCard key={p.path} pick={p} url={url(p.path)} overlays={overlays} />)}
            {by.gallery.map((p, i) => <PickCard key={p.path} pick={p} url={url(p.path)} overlays={overlays} order={i + 1} />)}
          </ul>
        </section>
      ) : (
        <p className="text-[12px] text-[#4a4a4a]">No photo is good enough for the site yet: the shot list below says what to take.</p>
      )}

      {data.pairs.length > 0 && (
        <section aria-label="Before and after">
          <h4 className="text-[12px] font-bold text-[#1a1a1a]">Before and after</h4>
          <ul className="mt-1.5 space-y-2">
            {data.pairs.map((pr) => (
              <li key={`${pr.before}|${pr.after}`} className="rounded-lg border border-black/[0.08] bg-white p-2">
                <div className="grid grid-cols-2 gap-2">
                  {[pr.before, pr.after].map((path) => {
                    const pick = byPath.get(path);
                    return pick ? (
                      <div key={path} className="min-w-0">
                        <PhotoFrame pick={pick} url={url(path)} overlays={overlays} />
                        <div className="mt-1 flex items-center gap-1.5">
                          <RoleBadge role={pick.role} />
                          {blurLabel(pick) && <span className="text-[11px] text-[#b42318]">Blur: {blurLabel(pick)}</span>}
                        </div>
                      </div>
                    ) : null;
                  })}
                </div>
                {pr.note && <p className="mt-1.5 text-[12px] text-[#4a4a4a]">{pr.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {by.skip.length > 0 && (
        <details className="rounded-lg border border-black/[0.06] bg-white px-3 py-2">
          <summary className="cursor-pointer text-[12px] font-semibold text-[#1a1a1a]">Skipped ({by.skip.length})</summary>
          <ul className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {by.skip.map((p) => (
              <li key={p.path} className="min-w-0">
                <PhotoFrame pick={p} url={url(p.path)} overlays={false} />
                <p className="mt-1 text-[11px] text-[#4a4a4a]">{p.reason || 'No reason given'}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {data.shotList.length > 0 && (
        <section aria-label="Shot list">
          <h4 className="text-[12px] font-bold text-[#1a1a1a]">Shot list for their next job</h4>
          <ol className="mt-1 list-decimal pl-5 space-y-0.5 text-[12px] text-[#4a4a4a]">
            {data.shotList.map((s) => <li key={s}>{s}</li>)}
          </ol>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" className={BTN} onClick={copyShots}>Copy the shot list</button>
            {copied && <span role="status" className="text-[11px] text-[#00825a]">Copied</span>}
          </div>
        </section>
      )}
    </div>
  );
}
