// Edit > Google Rating: connect the business's Google listing, refresh its
// rating, and pick where the template shows the rating badge.
//
// Real data only. businessInfo.googlePlace is written from Google's search
// results and nothing else (lib/googlePlaces.js): there is no rating or
// review-count input, and the text below never shows stars or words like
// "verified". copy.googleBadge only says WHERE the badge goes; the badge
// itself still renders only when the place has a rating and a review count.
import { useEffect, useRef, useState } from 'react';
import { searchPlaces, placeFromResult, refreshPlace } from '../../../lib/googlePlaces.js';
import { BADGE_SPOTS, effectivePlacements, togglePlacement, placeStatus, refreshMessage, resultRatingText, typedGoogleFacts } from './googleRating.js';
import { Label, Help, Note, SwitchRow, inputClass, linkButtonClass } from './fields.jsx';
import { googlePlaceUrl } from '../templates/kit/GoogleRatingBadge.jsx';
import { footerColumns } from './footerBuilder.js';

const smallButtonClass = 'text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg px-2.5 py-1 hover:border-gray-400 transition disabled:opacity-50 disabled:cursor-not-allowed';
const SEARCH_ERROR = "Couldn't reach Google search. Try again in a minute.";

// The place search box. Debounced (400 ms, like the wizard), at least 3
// characters, and an answer to an older query is dropped so a slow response
// can never replace the results for what the owner typed last.
function PlaceSearch({ onPick, onCancel, currentId }) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState({ status: 'idle', results: [] });
  const latest = useRef('');

  useEffect(() => {
    const q = query.trim();
    latest.current = q;
    if (q.length < 3) {
      setSearch({ status: 'idle', results: [] });
      return undefined;
    }
    const timer = setTimeout(() => {
      setSearch((prev) => ({ ...prev, status: 'loading' }));
      searchPlaces(q).then(
        (results) => { if (latest.current === q) setSearch({ status: 'done', results }); },
        () => { if (latest.current === q) setSearch({ status: 'error', results: [] }); },
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor="google-place-search">Find your business on Google</Label>
        {onCancel && <button type="button" className={linkButtonClass} onClick={onCancel}>Cancel</button>}
      </div>
      <input
        id="google-place-search"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Business name and city"
        aria-label="Search Google for your business"
        autoComplete="off"
        className={inputClass}
      />
      {query.trim().length > 0 && query.trim().length < 3 && <Help>Type at least 3 characters.</Help>}
      {search.status === 'loading' && <Help>Searching…</Help>}
      {search.status === 'error' && <Help tone="error">{SEARCH_ERROR}</Help>}
      {search.status === 'done' && search.results.length === 0 && <Help>No matches. Try your business name and city.</Help>}
      {search.results.length > 0 && (
        <div className="mt-1.5 border border-gray-200 rounded-lg overflow-hidden">
          {search.results.map((r) => (
            <button
              key={r.placeId}
              type="button"
              onClick={() => onPick(r)}
              className="block w-full text-left px-3 py-2 bg-white hover:bg-gray-50 border-b border-gray-100 last:border-0 transition"
            >
              <span className="block text-[13px] font-semibold text-gray-900 leading-snug">
                {r.name || 'Unnamed listing'}
                {currentId && r.placeId === currentId && <span className="ml-1.5 text-[11px] font-normal text-green-700">(connected now)</span>}
              </span>
              {r.address && <span className="block text-[11px] text-gray-500 leading-snug">{r.address}</span>}
              <span className="block text-[11px] text-gray-600 leading-snug mt-0.5">{resultRatingText(r)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function GoogleRatingPanel({
  businessInfo,
  setBiz,
  copy,
  setCopy,
  defaultPlacements = ['hero', 'footer'],
  supportedPlacements = BADGE_SPOTS.map((s) => s.id),
  canEditBusiness = true,
}) {
  const place = businessInfo?.googlePlace || null;
  const status = placeStatus(place);
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  // The place as it is now, read after the refresh's await: when the owner
  // disconnected or picked another listing meanwhile, the late answer is
  // dropped instead of writing the old listing back.
  const placeRef = useRef(place);
  placeRef.current = place;

  const refresh = async () => {
    if (busy || !place) return;
    const before = place;
    setBusy(true);
    setMessage(null);
    const result = await refreshPlace(before, { city: businessInfo?.city || '' });
    if ((placeRef.current?.placeId || null) !== (before.placeId || null)) {
      setBusy(false);
      return;
    }
    if (result.status === 'updated') setBiz('googlePlace', result.place);
    setMessage(refreshMessage(result, before));
    setBusy(false);
  };

  const pick = (result) => {
    setBiz('googlePlace', placeFromResult(result));
    setChanging(false);
    setMessage(null);
  };

  const disconnect = () => {
    // Only the listing: the owner's badge spots stay for when they reconnect.
    setBiz('googlePlace', null);
    setChanging(false);
    setMessage(null);
  };

  const placements = effectivePlacements(copy, defaultPlacements);
  // The listing on Google, so the owner can check it is the right one.
  const listingUrl = googlePlaceUrl(place);
  // The footer rating sits in the footer's logo column; with that column
  // switched off (Edit > Footer) the template shows it in the bottom line.
  const footerBrandOff = Array.isArray(copy?.footer?.columns) && !footerColumns(copy.footer).some((c) => c.type === 'brand' && c.show);
  const spots = BADGE_SPOTS.filter((s) => supportedPlacements.includes(s.id));
  const saved = copy?.googleBadge != null;
  const showSearch = canEditBusiness && (!status.connected || changing);

  return (
    <>
      <Help className="mt-0 mb-3">
        Show your real Google rating on your site. It comes straight from your Google listing: you can't type a rating or review count, and it only changes when you refresh it.
      </Help>

      {status.connected ? (
        <>
          <Note tone="ok" title={status.name || 'Google listing'}>
            {status.address && <p>{status.address}</p>}
            <p>{status.hasRating ? `${status.ratingText} · ${status.countText} Google reviews` : 'No Google rating yet'}</p>
            <p>{status.legacy ? 'Saved when you set up your site' : `${status.hasRating ? 'Rating as of' : 'Checked on Google'} ${status.asOf}`}</p>
            {listingUrl && (
              <p className="mt-0.5">
                <a href={listingUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:no-underline">View on Google</a>
              </p>
            )}
          </Note>
          {canEditBusiness && (
            <div className="flex flex-wrap gap-1.5 -mt-1 mb-2">
              <button type="button" className={smallButtonClass} onClick={refresh} disabled={busy}>
                {busy ? 'Checking Google…' : 'Refresh rating'}
              </button>
              {!changing && (
                <button type="button" className={smallButtonClass} onClick={() => { setChanging(true); setMessage(null); }} disabled={busy}>
                  Change listing
                </button>
              )}
              <button type="button" className={`${smallButtonClass} text-red-500 hover:text-red-600`} onClick={disconnect} disabled={busy}>
                Disconnect
              </button>
            </div>
          )}
          {message && <Help tone={message.tone} className="mt-0 mb-3">{message.text}</Help>}
          {message && <StaleTypedNote copy={copy} />}
        </>
      ) : (
        !canEditBusiness && <Note title="No Google listing connected" />
      )}

      {showSearch && <PlaceSearch onPick={pick} onCancel={status.connected ? () => setChanging(false) : null} currentId={place?.placeId || ''} />}

      {status.connected && status.hasRating && (
        <div className="mt-3 mb-2">
          <Label>Show the badge in</Label>
          {spots.map((s) => (
            <SwitchRow
              key={s.id}
              label={s.label}
              on={placements.includes(s.id)}
              onChange={(on) => setCopy('googleBadge', togglePlacement(copy, defaultPlacements, s.id, on))}
              help={s.id === 'footer' && footerBrandOff && placements.includes('footer') ? "Your footer's logo column is off (Edit > Footer), so the rating shows in the footer's bottom line." : undefined}
            />
          ))}
          {saved ? (
            <button type="button" className={linkButtonClass} onClick={() => setCopy('googleBadge', null)}>
              Use the design&apos;s default spots
            </button>
          ) : (
            <Help className="mt-0">These are the design&apos;s default spots.</Help>
          )}
          {placements.length === 0 && <Help tone="warn">The badge is switched off everywhere.</Help>}
        </div>
      )}
      {status.connected && !status.hasRating && (
        <Note tone="warn" title="This listing has no Google rating yet, so no badge shows on your site." />
      )}

      <Help className="mt-3">{'Reviews you mark as From Google (Edit > Reviews) link to this listing.'}</Help>
      {!canEditBusiness && <Help>Open this site from your dashboard to connect or refresh a listing.</Help>}
    </>
  );
}

// Under the About stats of a template with the Google badge: the rating
// belongs in Edit > Google Rating, where it comes from the listing. Typed
// Google numbers (a stat, the Reviews heading) get a warning that names
// them, since they will drift from the badge.
export function TypedRatingNote({ copy }) {
  const facts = typedGoogleFacts(copy);
  if (!facts.length) {
    return <Help className="mt-0">{'For your Google rating use Edit > Google Rating: it comes from your listing and stays current.'}</Help>;
  }
  return (
    <Help tone="warn" className="mt-0">
      {`Typed Google numbers go out of date (${facts.map((f) => `${f.where}: "${f.text}"`).join('; ')}). Your real rating shows from your listing: Edit > Google Rating.`}
    </Help>
  );
}

// After a refresh: typed Google numbers did not follow it. Names each one
// and the tab where it is edited.
const TYPED_FACT_TABS = { 'About stats': 'Edit > About', 'Reviews heading': 'Edit > Headings' };
function StaleTypedNote({ copy }) {
  const facts = typedGoogleFacts(copy);
  if (!facts.length) return null;
  const tabs = [...new Set(facts.map((f) => TYPED_FACT_TABS[f.where]).filter(Boolean))];
  return (
    <Help tone="warn" className="mt-0 mb-3">
      {`Typed numbers did not change: ${facts.map((f) => `${f.where} "${f.text}"`).join('; ')}. Check them in ${tabs.join(' and ')}.`}
    </Help>
  );
}

export default GoogleRatingPanel;
