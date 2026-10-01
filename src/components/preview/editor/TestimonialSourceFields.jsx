// Per-review "From Google" switch + star rating (Edit > Reviews, one review).
//
// A review marked From Google gets the "Google" label, its stars and a link
// to the connected listing on the published page. That is a claim about where
// the words came from, so the switch is offered only while a Google listing is
// connected (or to un-mark a review already marked), and the warning under it
// always shows: AI-written sample reviews must never be marked.
// Stars are drawn as SVG, never as star characters (theme:check bans them).
import { Label, Help, SwitchRow } from './fields.jsx';
import { sourcePatch, ratingPatch } from './googleRating.js';
import { googlePlaceUrl } from '../templates/kit/GoogleRatingBadge.jsx';

const STAR_POINTS = '8,1.2 10.1,5.6 14.9,6.2 11.4,9.5 12.3,14.3 8,11.9 3.7,14.3 4.6,9.5 1.1,6.2 5.9,5.6';
const NOT_CONNECTED = "No Google listing connected (Edit > Google Rating), so this review won't link to Google.";
const RULE = 'Only for a review a customer posted on your Google listing, copied word for word. Never for the sample reviews written for you.';

// Once at the top of the Reviews list (ContentEditor mounts it for
// templates that read review sources): the From Google rule in full while a
// listing is connected (each review then shows a short reminder), else
// where to connect one.
export function ReviewSourcesIntro({ googlePlace }) {
  if (googlePlaceUrl(googlePlace)) {
    return <Help tone="warn" className="-mt-1 mb-3">{`From Google (on each review): ${RULE}`}</Help>;
  }
  return <Help className="-mt-1 mb-3">{'To label reviews as From Google with their stars, connect your Google listing in Edit > Google Rating.'}</Help>;
}

function StarButton({ n, rating, onPick }) {
  const filled = n <= rating;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={n === rating}
      aria-label={n === 1 ? '1 star' : `${n} stars`}
      title={n === 1 ? '1 star' : `${n} stars`}
      onClick={() => onPick(n)}
      className={`w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition ${filled ? 'text-amber-500' : 'text-gray-300'}`}
    >
      <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <polygon points={STAR_POINTS} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// compact: the full rule is shown once above the list (ReviewSourcesIntro),
// so each review carries a short reminder instead of repeating it.
export function TestimonialSourceFields({ testimonial, onPatch, googlePlace, compact = false }) {
  // Connected = the page has a Google link for the review (the place id, or
  // the owner's own https link on an older snapshot), exactly what the
  // template's googlePlaceUrl uses.
  const connected = Boolean(googlePlaceUrl(googlePlace));
  const marked = testimonial?.source === 'google';
  if (!connected && !marked) return null;
  // Whole stars 1-5 (a numeric string from older data counts); 0 = none picked.
  const n = Number(testimonial?.rating);
  const rating = Number.isInteger(n) && n >= 1 && n <= 5 ? n : 0;

  return (
    <div className="mb-3">
      <SwitchRow
        label="From Google"
        on={marked}
        onChange={(on) => onPatch(sourcePatch(on))}
        help={compact ? 'Only reviews copied from your Google listing.' : RULE}
        helpTone="warn"
      />
      {marked && (
        <div className="-mt-1">
          <Label>Stars in that review</Label>
          <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Stars in that review">
            {[1, 2, 3, 4, 5].map((n) => (
              <StarButton key={n} n={n} rating={rating} onPick={(v) => onPatch(ratingPatch(v))} />
            ))}
          </div>
          {!rating && <Help>Pick the stars the customer gave. No stars show until you do.</Help>}
          {!connected && <Help tone="warn">{NOT_CONNECTED}</Help>}
        </div>
      )}
    </div>
  );
}

export default TestimonialSourceFields;
