import { checklistByWeek, claimsLine, handoverLinks, zipGroups } from '../../../lib/kit/handover.js';

// The handover pack's result (LaunchKitPanel shows it under "Show the
// details", below the tile's file list, which already has the PDF and zip
// downloads): the run's summary and claims line, what the PDF covers,
// which links it prints, what the zip holds folder by folder and what was
// left out of it, and the five things and the 30-day checklist the
// customer will read.
//
//   run   design.kit.handover (status 'ready'); run.data is sanitized
//         (src/lib/kit/handover.js sanitizeHandover)

const H = 'text-[11px] font-bold uppercase tracking-wide text-[#4a4a4a]';

export default function HandoverResult({ run }) {
  const data = run?.data;
  if (!data || !Array.isArray(data.sections) || !data.sections.length) {
    return <p className="text-[12px] text-ink-tertiary">This run has no handover outline to show.</p>;
  }
  const files = Array.isArray(data.files) ? data.files : [];
  const left = Array.isArray(data.left) ? data.left : [];
  const groups = zipGroups(files);
  const links = handoverLinks(data);
  const weeks = checklistByWeek(data.checklist);
  const thisWeek = Array.isArray(data.thisWeek) ? data.thisWeek : [];
  const claims = claimsLine(data.claims);
  const zipStored = (run.files || []).some((f) => f?.name === 'launch-kit.zip');

  return (
    <div className="space-y-4 text-[12px] text-[#1a1a1a]">
      <div className="space-y-1.5">
        {data.summary && <p className="font-semibold">{data.summary}</p>}
        {claims && (
          <p className={data.claims?.toConfirm ? 'text-amber-900' : 'text-[#4a4a4a]'}>
            Claims sign-off: {claims}
          </p>
        )}
        {!zipStored && files.length > 0 && (
          <p className="text-amber-900" role="status">The zip didn't come back from this run: send the PDF on its own, or rebuild.</p>
        )}
      </div>

      <section aria-labelledby="handover-pdf">
        <h5 id="handover-pdf" className={H}>
          Inside the PDF{data.pages ? ` (${data.pages} page${data.pages === 1 ? '' : 's'})` : ''}
        </h5>
        <ol className="mt-1 list-decimal pl-5 space-y-0.5 text-[#4a4a4a]">
          {data.sections.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </section>

      {links.length > 0 && (
        <section aria-labelledby="handover-links">
          <h5 id="handover-links" className={H}>Links it prints</h5>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            {links.map((l) => (
              <div key={l.key} className="contents">
                <dt className="text-[#4a4a4a]">{l.label}</dt>
                <dd className="min-w-0 truncate">
                  <a href={l.url} target="_blank" rel="noreferrer" className="text-[#cc0000] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]/40 rounded">
                    {l.url}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {groups.length > 0 && (
        <section aria-labelledby="handover-zip">
          <h5 id="handover-zip" className={H}>In launch-kit.zip ({files.length} file{files.length === 1 ? '' : 's'})</h5>
          <div className="mt-1 grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g.id} className="min-w-0">
                <p className="font-semibold">{g.folder ? `${g.folder}/` : g.label}</p>
                <ul className="text-[#4a4a4a]">
                  {g.files.map((f) => <li key={f.path} className="truncate" title={f.path}>{f.name}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {left.length > 0 && (
        <section aria-labelledby="handover-left" className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <h5 id="handover-left" className="text-[11px] font-bold uppercase tracking-wide text-amber-900">Not in the zip ({left.length})</h5>
          <p className="mt-0.5 text-[#4a4a4a]">The PDF tells the customer to ask for these; send them from the kit tiles above.</p>
          <ul className="mt-1 list-disc pl-5 space-y-0.5">
            {left.map((l) => <li key={l.file}><span className="font-semibold">{l.file}</span>: {l.reason}</li>)}
          </ul>
        </section>
      )}

      {thisWeek.length > 0 && (
        <section aria-labelledby="handover-week">
          <h5 id="handover-week" className={H}>Do these 5 things this week</h5>
          <ol className="mt-1 list-decimal pl-5 space-y-1">
            {thisWeek.map((t, i) => (
              <li key={i}>
                <span className="font-semibold">{t.title}</span>
                {t.detail && <span className="text-[#4a4a4a]">: {t.detail}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {weeks.length > 0 && (
        <section aria-labelledby="handover-month">
          <h5 id="handover-month" className={H}>The first 30 days</h5>
          <div className="mt-1 grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {weeks.map((w) => (
              <div key={w.week} className="min-w-0">
                <p className="font-semibold">Week {w.week}</p>
                <ul className="list-disc pl-5 text-[#4a4a4a] space-y-0.5">
                  {w.tasks.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
