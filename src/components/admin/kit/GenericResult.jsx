import { kitFiles } from '../../../lib/customSiteKit.js';

// The generic result of a Launch Kit run: its stored files, images as
// thumbnails (each opens full size), everything else as a download link.
// LaunchKitPanel shows it on every ready tile; a skill's own
// kit/<Key>Result.jsx adds its view of the data below it.
//
//   run    design.kit[skill] (status 'ready')
//   urls   { [file name]: signed link } from custom-site-kit `get`
//   skill  the KIT_SKILLS key (labels and order); without it the files are
//          listed as stored

const KIND_BADGE = { pdf: 'PDF', zip: 'ZIP', vcard: 'vCard', json: 'JSON', file: 'File' };

export function KitFileList({ run, urls, skill }) {
  const files = kitFiles(skill, run, urls);
  if (!files.length) return <p className="text-[12px] text-ink-tertiary">No files came back from this run.</p>;
  const images = files.filter((f) => f.kind === 'image');
  const others = files.filter((f) => f.kind !== 'image');
  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-label="Images">
          {images.map((f) => (
            <li key={f.name} className="min-w-0">
              {f.url ? (
                <a href={f.url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-black/[0.08] bg-[#faf9f7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40">
                  <img
                    src={f.url}
                    alt={f.label}
                    loading="lazy"
                    className="block w-full h-24 object-contain"
                    {...(f.px ? { width: f.px[0], height: f.px[1] } : {})}
                  />
                  <span className="sr-only"> (opens full size in a new tab)</span>
                </a>
              ) : (
                <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-black/[0.12] bg-[#faf9f7] px-2 text-center text-[11px] text-ink-tertiary">
                  Link expired: reload
                </div>
              )}
              <p className="mt-1 text-[11px] font-semibold text-[#1a1a1a] truncate" title={f.name}>{f.label}</p>
              <p className="text-[10px] text-ink-tertiary">
                {f.px ? `${f.px[0]}×${f.px[1]}` : f.name}{f.sizeLabel ? ` · ${f.sizeLabel}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Downloads">
          {others.map((f) => (
            <li key={f.name}>
              {f.url ? (
                <a
                  href={f.url}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-black/[0.12] text-[12px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40"
                >
                  <span className="px-1 rounded bg-black/[0.06] text-[10px] font-bold text-[#4a4a4a]">{KIND_BADGE[f.kind] || 'File'}</span>
                  {f.label}
                  {f.sizeLabel && <span className="font-normal text-ink-tertiary">{f.sizeLabel}</span>}
                  <span className="sr-only"> (download {f.name})</span>
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-black/[0.12] text-[12px] text-ink-tertiary">
                  {f.label}: link expired, reload
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function GenericResult({ run, urls, skill }) {
  return <KitFileList run={run} urls={urls} skill={skill} />;
}
