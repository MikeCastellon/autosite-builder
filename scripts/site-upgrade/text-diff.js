// A short, readable summary of what a visitor would see change: the text
// blocks only the live page shows, the ones only the new page shows, and
// the photos, call/email links and social links on each side. For people
// reading a plan, not a check: the checks are siteUpgrade.js's.
import { decodeEntities, normText } from '../../src/lib/siteUpgrade.js';

const MAX_LINES = 60;

// The page's visible text blocks, in order, without duplicates.
export function textBlocks(html) {
  const body = String(html || '')
    .replace(/<head\b[\s\S]*?<\/head\s*>/i, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  const out = [];
  const seen = new Set();
  for (const piece of body.split(/<[^>]*>/)) {
    const text = decodeEntities(piece).replace(/\s+/g, ' ').trim();
    const key = normText(text);
    if (key.length < 3 || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function attrValues(html, attr) {
  const re = new RegExp(`\\b${attr}\\s*=\\s*"([^"]*)"`, 'gi');
  return [...String(html || '').matchAll(re)].map((m) => decodeEntities(m[1]).trim()).filter(Boolean);
}

function imageNames(html) {
  const set = new Set();
  for (const src of attrValues(html, 'src')) {
    if (/^https?:\/\//i.test(src) && /\.(?:jpe?g|png|webp|gif|avif|svg)(?:[?#]|$)/i.test(src)) set.add(src.split(/[?#]/)[0]);
    else if (/^data:image\//i.test(src) && src.length > 2000) set.add(`inline ${src.slice(5, src.indexOf(';'))} (${Math.round(src.length / 1024)} KB)`);
  }
  for (const m of String(html || '').matchAll(/url\(\s*['"]?(https?:\/\/[^'")\s]+)/gi)) set.add(m[1].split(/[?#]/)[0]);
  return set;
}

function links(html) {
  const set = new Set();
  for (const href of attrValues(html, 'href')) {
    if (/^(tel|mailto|sms):/i.test(href)) set.add(href.split('?')[0].toLowerCase());
    else if (/^https?:\/\/(?:www\.)?(facebook|instagram|tiktok|youtube|x|twitter|yelp|google|g)\.[a-z.]+\//i.test(href)) set.add(href.split(/[?#]/)[0]);
  }
  return set;
}

function only(a, b) {
  return [...a].filter((x) => !b.has(x));
}

// { onlyLive, onlyNew, images: { onlyLive, onlyNew }, links: { … } }
export function diffSummary(liveHtml, newHtml) {
  const liveBlocks = textBlocks(liveHtml);
  const newBlocks = textBlocks(newHtml);
  const liveAll = normText(liveBlocks.join(' '));
  const newAll = normText(newBlocks.join(' '));
  // A block counts as kept when the other page says it anywhere (templates
  // split and join text differently).
  const onlyLive = liveBlocks.filter((t) => !newAll.includes(normText(t)));
  const onlyNew = newBlocks.filter((t) => !liveAll.includes(normText(t)));
  const li = imageNames(liveHtml);
  const ni = imageNames(newHtml);
  const ll = links(liveHtml);
  const nl = links(newHtml);
  return {
    onlyLive, onlyNew,
    images: { onlyLive: only(li, ni), onlyNew: only(ni, li) },
    links: { onlyLive: only(ll, nl), onlyNew: only(nl, ll) },
  };
}

export function formatDiff(d) {
  const lines = [];
  const list = (title, items) => {
    lines.push(`${title} (${items.length})`);
    for (const t of items.slice(0, MAX_LINES)) lines.push(`  ${t.length > 160 ? `${t.slice(0, 157)}...` : t}`);
    if (items.length > MAX_LINES) lines.push(`  ... ${items.length - MAX_LINES} more`);
  };
  list('Text only on the live page', d.onlyLive);
  list('Text only on the new page', d.onlyNew);
  list('Photos only on the live page', d.images.onlyLive);
  list('Photos only on the new page', d.images.onlyNew);
  list('Call / email / social links only on the live page', d.links.onlyLive);
  list('Call / email / social links only on the new page', d.links.onlyNew);
  return lines.join('\n');
}
