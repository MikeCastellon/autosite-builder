// Google rating badge + SVG star rows, shared by theme-ready templates.
//
// The rating and review count are owner facts only when they come from the
// owner's connected Google place (businessInfo.googlePlace, a snapshot the
// wizard's place search stores: { placeId, placeName, rating, reviewCount },
// optionally url). So the badge renders nothing unless that object has BOTH a
// rating and a review count; nothing here ever supplies a default.
// Stars are drawn as SVG (theme:check bans the star glyphs) and the wording
// avoids the phrasings BANNED_CLAIMS rejects ("5.0 Rating", "Five-Star").
//
// Kit files are not theme-ready template modules, so theme:check's
// no-hard-coded-colors scan does not read them: GOOGLE_STAR_GOLD is Google's
// own rating-star yellow, kept as a brand constant for the "Google" badge
// only. Everything else takes its colors from the template (currentColor,
// className, or the starColor prop).

export const GOOGLE_STAR_GOLD = '#fbbc04';

const num = (v) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(/[,\s+]/g, '')) : NaN;
  return Number.isFinite(n) ? n : NaN;
};

// Link to the place on Google Maps: the owner's own https link, else one
// built from the place id, else null (the badge then renders without a link).
export function googlePlaceUrl(place) {
  if (!place || typeof place !== 'object') return null;
  const url = typeof place.url === 'string' ? place.url.trim() : '';
  if (/^https:\/\//i.test(url)) return url;
  const id = typeof place.placeId === 'string' ? place.placeId.trim() : '';
  return id ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(id)}` : null;
}

// { rating, reviewCount, ratingText, countText, url, name } when the place has
// a usable rating (0 < r <= 5) and review count (>= 1), else null.
export function googleRatingOf(place) {
  if (!place || typeof place !== 'object') return null;
  const rating = num(place.rating);
  const reviewCount = Math.floor(num(place.reviewCount));
  if (!(rating > 0 && rating <= 5) || !(reviewCount >= 1)) return null;
  return {
    rating,
    reviewCount,
    ratingText: rating.toFixed(1),
    countText: reviewCount.toLocaleString('en-US'),
    url: googlePlaceUrl(place),
    name: typeof place.placeName === 'string' ? place.placeName.trim() : '',
  };
}

// copy.googleBadge.placements, or the template's default list. [] = nowhere.
export function googleBadgePlacements(googleBadge, defaults = []) {
  const list = googleBadge && typeof googleBadge === 'object' ? googleBadge.placements : undefined;
  return Array.isArray(list) ? list.filter((p) => typeof p === 'string') : defaults;
}

const STAR_D = 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z';

function Star({ size, fill = 1, color }) {
  const svg = (style) => (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" style={{ display: 'block', ...style }}>
      <path d={STAR_D} fill={color} stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
  if (fill >= 1) return svg();
  // Partial star: a faint full star under a clipped solid one (no <defs>,
  // so any number of badges can share a page without id clashes).
  return (
    <span style={{ position: 'relative', display: 'inline-block', flex: 'none', width: size, height: size }}>
      {svg({ opacity: 0.28 })}
      {fill > 0 && svg({ position: 'absolute', inset: 0, clipPath: `inset(0 ${Math.round((1 - fill) * 100)}% 0 0)` })}
    </span>
  );
}

// A row of `count` stars filled to exactly `rating` (4.8 = four stars and a
// star 80% filled; rounding would draw 4.8 as five full stars next to the
// "4.8"). Decorative (aria-hidden): the surrounding text carries the rating.
export function StarRow({ rating = 5, count = 5, size = 16, color = 'currentColor', gap = 2, className, style }) {
  const r = Math.max(0, Math.min(count, num(rating) || 0));
  return (
    <span className={className} aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', gap, flex: 'none', ...style }}>
      {Array.from({ length: count }, (_, i) => (
        <Star key={i} size={size} color={color} fill={Math.max(0, Math.min(1, r - i))} />
      ))}
    </span>
  );
}

// variant 'pill':   Google ***** 4.8 · 52 reviews   (hero / nav pill)
// variant 'inline': * 4.8 · 52 Google reviews        (footer / small print)
// The template styles it through className (pill border, padding, font
// size); class hooks: acg-gbadge, -src, -stars, -rating, -count.
// starSize / starGap size the pill's star row (any CSS length).
// The accessible name starts with the visible words (WCAG 2.5.3, so "click
// Google 4.8" works for voice control), then spells the scale out.
// Returns null without a usable googlePlace.
export function GoogleRatingBadge({ place, variant = 'pill', className = '', style, starColor = GOOGLE_STAR_GOLD, starSize = '1em', starGap = '0.06em' }) {
  const g = googleRatingOf(place);
  if (!g) return null;
  const visible = variant === 'inline'
    ? `${g.ratingText} · ${g.countText} Google reviews`
    : `Google ${g.ratingText} · ${g.countText} reviews`;
  const label = `${visible} (rating out of 5${g.url ? ', opens Google Maps' : ''})`;
  const Tag = g.url ? 'a' : 'span';
  const link = g.url ? { href: g.url, target: '_blank', rel: 'noopener noreferrer' } : { role: 'img' };
  const base = { display: 'inline-flex', alignItems: 'center', gap: '0.5em', ...style };
  if (variant === 'inline') {
    return (
      <Tag className={`acg-gbadge acg-gbadge-inline ${className}`.trim()} aria-label={label} {...link} style={base}>
        <StarRow rating={5} count={1} size={starSize} color={starColor} className="acg-gbadge-stars" />
        <span className="acg-gbadge-count">{g.ratingText} · {g.countText} Google reviews</span>
      </Tag>
    );
  }
  return (
    <Tag className={`acg-gbadge acg-gbadge-pill ${className}`.trim()} aria-label={label} {...link} style={base}>
      <span className="acg-gbadge-src" style={{ fontWeight: 700 }}>Google</span>
      <StarRow rating={g.rating} size={starSize} color={starColor} gap={starGap} className="acg-gbadge-stars" />
      <strong className="acg-gbadge-rating" style={{ fontWeight: 700 }}>{g.ratingText}</strong>
      <span className="acg-gbadge-count">· {g.countText} reviews</span>
    </Tag>
  );
}

export default GoogleRatingBadge;
