// Design Studio > Google profile: find the business's Google listing and
// confirm it, which fills design.levers.googlePlace ({ placeId, placeName,
// rating, reviewCount, url }). The site then shows that rating wherever its
// template has the Google badge, and "From Google" reviews link to it.
//
// Real data only, as in the editor's Google Rating tab: the rating and
// review count come from Google's search results (lib/googlePlaces.js, the
// same search the wizard and the editor use) and nothing else. There is no
// rating input, and the customer's answer only seeds the search.
//
// The search runs when the admin asks (Search button or Enter), not while
// the page opens: each search is a call to Google on the SocialFeeds quota.
import { useId, useRef, useState } from 'react';
import { refreshPlace, searchPlaces } from '../../../lib/googlePlaces.js';
import { safeHref } from '../../../lib/customSiteForm.js';
import { refreshMessage } from '../../preview/editor/googleRating.js';
import {
  answerMatch, isLinkLike, linkMatch, placeFromSearch, placeSummary, rankResults, searchPlan, suggestedQuery, toLeverPlace,
} from './googlePlaceField.js';

const BTN = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-black/[0.12] text-[12px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 disabled:opacity-50 transition-colors';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-60 text-white text-[12px] font-bold transition-colors';
const INPUT = 'w-full px-3 py-2 rounded-lg border border-black/[0.12] text-sm bg-white focus:outline-none focus:border-[#cc0000]';
const LINK = 'text-[12px] font-semibold text-[#cc0000] hover:text-[#a80000] hover:underline';
const TONE = { ok: 'text-emerald-800', warn: 'text-amber-800', error: 'text-[#cc0000]' };
const SEARCH_ERROR = "Couldn't reach Google search. Try again in a minute.";
const IDLE = { status: 'idle', results: [], plan: null, note: '' };

function ExternalLink({ href, children }) {
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>{children}</a> : null;
}

// The customer's own answer to "Google Business Profile link", as a hint.
function AnswerHint({ answer, onSearch, searching }) {
  const text = typeof answer === 'string' ? answer.trim() : '';
  if (!text) {
    return <p className="text-[12px] text-ink-tertiary">They didn't give a Google profile link.</p>;
  }
  const href = isLinkLike(text) ? safeHref(text) : null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-[#faf9f7] border border-black/[0.06] px-3 py-2 text-[12px]">
      <span className="min-w-0 text-[#4a4a4a]">
        Their answer:{' '}
        {href
          ? <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#1a1a1a] underline break-all">{text}</a>
          : <span className="font-semibold text-[#1a1a1a] break-words">{text}</span>}
      </span>
      {onSearch && (
        <button type="button" onClick={onSearch} disabled={searching} className={LINK}>
          {href ? 'Search from their link' : 'Search this'}
        </button>
      )}
    </div>
  );
}

// One search result, as a button that opens the confirm step.
function ResultRow({ result, plan, currentId, onPick }) {
  const s = placeSummary(placeFromSearch(result));
  const match = linkMatch(result, plan);
  return (
    <button
      type="button"
      onClick={() => onPick(result)}
      className="block w-full text-left px-3 py-2 bg-white hover:bg-[#faf9f7] border-b border-black/[0.06] last:border-0 transition-colors"
    >
      <span className="flex flex-wrap items-baseline gap-x-2 text-[13px] font-semibold text-[#1a1a1a] leading-snug">
        {result.name || 'Unnamed listing'}
        {match === 'id' && <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Their link</span>}
        {match === 'name' && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Same name as their link</span>}
        {currentId && result.placeId === currentId && <span className="text-[11px] font-normal text-emerald-700">(chosen now)</span>}
      </span>
      {result.address && <span className="block text-[11px] text-ink-tertiary leading-snug">{result.address}</span>}
      <span className="block text-[11px] text-[#4a4a4a] leading-snug mt-0.5">{s.ratingText}</span>
    </button>
  );
}

/**
 * Picks the business's Google listing for levers.googlePlace.
 *
 * Props
 *   value         levers.googlePlace (or null): what is chosen now
 *   onChange      (place | null) => void, place in the levers shape
 *   businessName, city, state   seed the search ("name city") and refresh
 *   profileLink   the customer's answer (project.form.googleProfile), shown as a hint
 *   disabled      locks the buttons (e.g. while the page saves)
 */
export default function GooglePlaceField({ value, onChange, businessName = '', city = '', state = '', profileLink = '', disabled = false }) {
  const inputId = useId();
  const place = value?.placeId ? value : null;
  const [typed, setTyped] = useState(null); // null = follow the business name and city
  const [search, setSearch] = useState(IDLE);
  const [candidate, setCandidate] = useState(null); // { place, address, match }
  const [changing, setChanging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState(null);
  const seq = useRef(0);

  // The place as it is now, read after a refresh's await: if the admin
  // cleared or changed it meanwhile, the late answer is dropped.
  const placeRef = useRef(place);
  placeRef.current = place;

  const business = { businessName, city, state };
  const query = typed ?? suggestedQuery(business);
  const showSearch = !place || changing;
  const matchAnswer = answerMatch(place, profileLink);

  // Searches for what the box (or the customer's answer) holds. Only the
  // newest search may set the results: a slow older answer is dropped.
  async function runSearch(text) {
    const plan = searchPlan(text, business);
    const id = ++seq.current;
    setCandidate(null);
    if (plan.query.length < 3) {
      setSearch({ ...IDLE, plan, note: plan.note || 'Type at least 3 characters.' });
      return;
    }
    setSearch({ status: 'loading', results: [], plan, note: plan.note });
    try {
      const results = await searchPlaces(plan.query);
      if (id === seq.current) setSearch({ status: 'done', results: rankResults(results, plan), plan, note: plan.note });
    } catch {
      if (id === seq.current) setSearch({ status: 'error', results: [], plan, note: plan.note });
    }
  }

  function searchAnswer() {
    const text = typeof profileLink === 'string' ? profileLink.trim() : '';
    setTyped(text);
    runSearch(text);
  }

  function pick(result) {
    setCandidate({ place: placeFromSearch(result), address: result.address || '', match: linkMatch(result, search.plan) });
  }

  function confirm() {
    onChange?.(candidate.place);
    seq.current += 1;
    setCandidate(null);
    setChanging(false);
    setSearch(IDLE);
    setMessage(null);
  }

  function clear() {
    onChange?.(null);
    setChanging(false);
    setMessage(null);
  }

  function cancelChange() {
    seq.current += 1;
    setChanging(false);
    setCandidate(null);
    setSearch(IDLE);
  }

  async function refresh() {
    if (!place || refreshing) return;
    const before = place;
    setRefreshing(true);
    setMessage(null);
    const result = await refreshPlace(before, { city });
    setRefreshing(false);
    if (placeRef.current?.placeId !== before.placeId) return;
    if (result.status === 'updated') onChange?.(toLeverPlace(result.place));
    setMessage(refreshMessage(result, before));
  }

  const chosen = place ? placeSummary(place) : null;
  const picked = candidate ? placeSummary(candidate.place) : null;
  const plan = search.plan;
  const searchedFor = plan && plan.query && plan.query !== query.trim() ? plan.query : '';

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-ink-tertiary">
        The site shows this listing's rating and review count wherever the template has a Google badge, exactly as Google has them.
        Nothing here can be typed in.
      </p>

      <AnswerHint answer={profileLink} onSearch={showSearch && !candidate ? searchAnswer : null} searching={disabled || search.status === 'loading'} />

      {chosen && (
        <div className="rounded-xl border border-black/[0.08] bg-white px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Chosen listing</p>
          <p className="mt-0.5 text-[14px] font-bold text-[#1a1a1a]">{chosen.name}</p>
          <p className="text-[13px] text-[#4a4a4a]">{chosen.ratingText}</p>
          {!chosen.hasRating && <p className="text-[12px] text-amber-800">No rating badge shows on the site until Google has a rating for it.</p>}
          {matchAnswer === 'same' && <p className="mt-0.5 text-[12px] text-emerald-800">Same listing as their link.</p>}
          {matchAnswer === 'different' && <p className="mt-0.5 text-[12px] text-amber-800">Their link points to a different Google listing. Check which one is theirs.</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ExternalLink href={chosen.href}>View on Google</ExternalLink>
            <span className="flex-1" />
            <button type="button" onClick={refresh} disabled={disabled || refreshing} className={BTN}>{refreshing ? 'Checking Google…' : 'Refresh rating'}</button>
            {!changing && <button type="button" onClick={() => { setChanging(true); setMessage(null); }} disabled={disabled || refreshing} className={BTN}>Change listing</button>}
            <button type="button" onClick={clear} disabled={disabled || refreshing} className={`${BTN} hover:text-[#cc0000]`}>Clear</button>
          </div>
          {message && <p role="status" className={`mt-2 text-[12px] ${TONE[message.tone] || TONE.warn}`}>{message.text}</p>}
        </div>
      )}

      {showSearch && (candidate ? (
        <div className="rounded-xl border border-[#cc0000]/30 bg-[#cc0000]/[0.03] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#cc0000]">Is this their listing?</p>
          <p className="mt-0.5 text-[14px] font-bold text-[#1a1a1a]">{candidate.place.placeName || 'Unnamed listing'}</p>
          {candidate.address && <p className="text-[12px] text-ink-tertiary">{candidate.address}</p>}
          <p className="text-[13px] text-[#4a4a4a]">{picked.ratingText}</p>
          {candidate.match === 'id' && <p className="text-[12px] text-emerald-800">This is the listing their link points to.</p>}
          {!picked.hasRating && (
            <p className="text-[12px] text-amber-800">Google has no rating for it yet, so the site shows no rating badge. Reviews marked From Google still link to it.</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ExternalLink href={picked.href}>Check it on Google</ExternalLink>
            <span className="flex-1" />
            <button type="button" onClick={() => setCandidate(null)} disabled={disabled} className={BTN}>Back to results</button>
            <button type="button" onClick={confirm} disabled={disabled} className={BTN_PRIMARY}>Use this listing</button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <label htmlFor={inputId} className="text-[12px] font-semibold text-[#1a1a1a]">Find the business on Google</label>
            {place && <button type="button" onClick={cancelChange} className={LINK}>Cancel</button>}
          </div>
          <div className="flex gap-2">
            <input
              id={inputId}
              type="text"
              value={query}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                // Enter obeys the same lock as the Search button: no search
                // while the page saves, and no second call while one runs.
                if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                e.preventDefault();
                if (!disabled && search.status !== 'loading') runSearch(query);
              }}
              placeholder="Business name and city, or a Google Maps link"
              autoComplete="off"
              className={INPUT}
            />
            <button type="button" onClick={() => runSearch(query)} disabled={disabled || search.status === 'loading'} className={`${BTN_PRIMARY} shrink-0`}>
              Search
            </button>
          </div>
          <div role="status" className="mt-1 space-y-0.5 text-[11px]">
            {search.note && <p className="text-amber-800">{search.note}</p>}
            {searchedFor && search.status !== 'idle' && <p className="text-ink-tertiary">Searched Google for "{searchedFor}".</p>}
            {search.status === 'loading' && <p className="text-ink-tertiary">Searching…</p>}
            {search.status === 'error' && <p className="text-[#cc0000]">{SEARCH_ERROR}</p>}
            {search.status === 'done' && search.results.length === 0 && <p className="text-ink-tertiary">No matches. Try the name the way it shows on Google, plus the city.</p>}
            {search.status === 'done' && plan?.linkPlaceId && !search.results.some((r) => r.placeId === plan.linkPlaceId) && (
              <p className="text-ink-tertiary">The listing their link points to isn't in these results. Try the exact name it shows on Google.</p>
            )}
          </div>
          {search.results.length > 0 && (
            <div className="mt-1.5 border border-black/[0.08] rounded-lg overflow-hidden">
              {search.results.map((r) => (
                <ResultRow key={r.placeId} result={r} plan={plan} currentId={place?.placeId || ''} onPick={pick} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
