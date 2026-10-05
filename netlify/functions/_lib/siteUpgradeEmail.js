// The "your website just got an upgrade" email to the owners of live
// websites, sent from Admin > Site upgrades > Owner emails
// (admin-site-upgrade: emailPreview / emailSend) once their site is on the
// new designs. Built from the shared shell and cards in postmark.js, so it
// looks like every other email we send.
//
// Sending goes straight to Postmark's REST API (POST /email) with the same
// server token and sender as postmark.js, instead of postmark.js's client:
// postmark.js keeps its send helper to itself, and a plain fetch lets the
// tests answer it with a fake (they stub fetch, so nothing can ever reach
// Postmark).
import { cardHeading, infoCard, linkFallback, renderEmailShell, tipList } from './postmark.js';
import { PRODUCTION_APP_ORIGIN, isEmailAddress } from '../../../src/lib/siteUpgrade.js';

const TAG = '[site-upgrade-email]';
const POSTMARK_API = 'https://api.postmarkapp.com';

export const UPGRADE_EMAIL_SUBJECT = 'Your website just got an upgrade';
// An owner with more than one upgraded site gets one email about all of them.
export const UPGRADE_EMAIL_SUBJECT_PLURAL = 'Your websites just got an upgrade';
// Postmark Tag: the upgrade emails can be found together in Activity.
export const UPGRADE_EMAIL_TAG = 'site-upgrade';
// Owner emails go only on the stream named in POSTMARK_UPGRADE_STREAM:
// one admin-started email to every owner is what Postmark calls a
// broadcast, and the transactional stream ('outbound', every booking email
// in postmark.js) must not carry it by default. Without it set, only the
// admin's own test copy can be sent, on this stream.
export const TEST_EMAIL_STREAM = 'outbound';
// One send must finish well inside the function's time limit. A send that
// times out may still have gone out, so the caller treats it as unknown.
const SEND_TIMEOUT_MS = 4000;
const LOOKUP_TIMEOUT_MS = 3000;

// What changed, in the owner's words, and only what every new design does
// (NEW_DESIGN_TEMPLATES in src/lib/siteUpgrade.js), worded like the What's
// New entry (src/data/changelog.js). The booking line only for sites that
// take bookings, where it means something.
export const UPGRADE_CHANGES = Object.freeze([
  'It looks great on phones, with an easy menu and Call and Book buttons.',
  'Your colors and fonts carry through the whole page.',
  'Cleaner layouts and sharper type.',
]);
export const UPGRADE_BOOKING_CHANGE = 'Your booking calendar works better on phones.';
export const UPGRADE_CARRIED_OVER = 'Your photos, services, prices and contact details carried over.';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Owner-entered text on one line: no control characters (a newline in a
// business name must not start a new line in the plain-text email).
function oneLine(s, max = 80) {
  return String(s ?? '').replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Only http(s) links reach the email.
function httpUrl(u) {
  const s = String(u ?? '').trim();
  return /^https?:\/\/[^\s"'<>]+$/i.test(s) ? s : '';
}

function hostOf(u) {
  return u.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

// The first name to greet the owner with, from the first usable candidate
// (profiles.first_name, then the sign-up metadata's first_name, full_name
// or name). Anything that does not look like a name is skipped, and an
// all-lowercase or all-caps one is written the usual way.
export function ownerFirstName(...candidates) {
  for (const c of candidates) {
    const first = oneLine(c, 200).split(' ')[0] || '';
    if (!first || first.length > 30 || /[@\d<>]/.test(first) || !/\p{L}/u.test(first)) continue;
    const plain = first === first.toLowerCase() || first === first.toUpperCase();
    return plain ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : first;
  }
  return '';
}

// ownerFirstName, minus a business name saved as the owner's name: some
// owners typed their business into the sign-up name ("Vivid Detailing" for
// Vivid Detailing & Customs), which would greet them "Hi Vivid". A
// candidate whose word is the first word of one of their business names is
// passed over. A possessive stays a different word, so Eddie of "Eddie's
// Detailing" is still greeted.
export function greetingName(candidates = [], businessNames = []) {
  const avoid = new Set(businessNames.map((n) => oneLine(n, 200).toLowerCase().split(' ')[0]).filter(Boolean));
  for (const c of candidates) {
    const name = ownerFirstName(c);
    if (name && !avoid.has(name.toLowerCase())) return name;
  }
  return '';
}

// The email. One per owner: `businessName` / `siteUrl` are the owner's
// (first) upgraded site, `otherSites` [{ businessName, siteUrl }] any more
// of theirs upgraded with it. `booking`: one of them takes bookings.
// Returns { subject, html, text }; the plain text says the same as the HTML.
//
// Worded so it is true however the site reached the new design (an admin's
// upgrade or the owner's own Republish).
export function siteUpgradeEmail({
  firstName, businessName, siteUrl, editorUrl = PRODUCTION_APP_ORIGIN, booking = false, otherSites = [],
} = {}) {
  const site = httpUrl(siteUrl);
  if (!site) throw new Error('siteUpgradeEmail needs the site\'s http(s) address');
  const editor = httpUrl(editorUrl) || PRODUCTION_APP_ORIGIN;
  const name = oneLine(businessName);
  const others = (Array.isArray(otherSites) ? otherSites : [])
    .map((o) => ({ name: oneLine(o?.businessName), url: httpUrl(o?.siteUrl) }))
    .filter((o) => o.url);
  const plural = others.length > 0;
  const first = greetingName([firstName], [businessName, ...others.map((o) => o.name)]);
  const changes = booking ? [...UPGRADE_CHANGES, UPGRADE_BOOKING_CHANGE] : [...UPGRADE_CHANGES];

  const subject = plural ? UPGRADE_EMAIL_SUBJECT_PLURAL : UPGRADE_EMAIL_SUBJECT;
  const title = first ? `Hi ${first}, ${subject.charAt(0).toLowerCase()}${subject.slice(1)}` : subject;
  const linkStyle = 'color:#cc0000;text-decoration:none;font-weight:600;';
  // "The Garage Shop website", never "the The Garage Shop website".
  const lead = name && !/^the\s/i.test(name) ? 'The ' : '';
  const live = plural ? 'They\'re already live' : 'It\'s already live';
  const introHtml = plural
    ? 'Your websites are now on our new design.'
    : `${name ? `${lead}<strong style="color:#18181b;">${esc(name)}</strong> website` : 'Your website'} at <a href="${esc(site)}" style="${linkStyle}">${esc(hostOf(site))}</a> is now on our new design.`;
  const introText = plural
    ? 'Your websites are now on our new design.'
    : `${name ? `${lead}${name} website` : 'Your website'} at ${site} is now on our new design.`;
  const all = [{ name, url: site }, ...others];
  const sitesHtml = plural
    ? `<div style="margin-bottom:16px;">${infoCard(`${cardHeading('Your websites')}${all.map((o) =>
      `<p style="margin:0 0 6px;font-size:13px;color:#52525b;line-height:1.5;">${o.name ? `${esc(o.name)}: ` : ''}<a href="${esc(o.url)}" style="${linkStyle}">${esc(hostOf(o.url))}</a></p>`).join('')}`, 0)}</div>`
    : '';
  const editHtml = infoCard(`${cardHeading('Want to change something?')}
      <p style="margin:0;font-size:13px;color:#52525b;line-height:1.6;">To change your photos, colors or text, <a href="${esc(editor)}" style="${linkStyle}">sign in</a>, click Edit on your site, then Publish.</p>`, 0);

  const html = renderEmailShell({
    icon: null,
    eyebrow: 'Websites',
    title: esc(title),
    intro: `${introHtml} ${esc(UPGRADE_CARRIED_OVER)} ${live}, so there's nothing you need to do.`,
    cta: { label: 'See my website', href: site },
    body: `${sitesHtml}<div style="margin-bottom:16px;">${tipList('What\'s new', changes)}</div>${editHtml}
      ${linkFallback(site)}
      <p style="margin:12px 0 0;font-size:12px;color:#a1a1aa;text-align:center;">Questions? Just reply to this email.</p>`,
  });

  const text = [
    title,
    '',
    `${introText} ${UPGRADE_CARRIED_OVER} ${live}, so there's nothing you need to do.`,
    ...(plural ? ['', 'Your websites:', ...all.map((o) => `- ${o.name ? `${o.name}: ` : ''}${o.url}`)] : []),
    '',
    'What\'s new:',
    ...changes.map((c) => `- ${c}`),
    '',
    'Want to change something?',
    `To change your photos, colors or text, sign in at ${editor}, click Edit on your site, then Publish.`,
    '',
    'Questions? Just reply to this email.',
  ].join('\n');

  return { subject, html, text };
}

// Who sends it and on which stream, or why it can't be sent.
// Same server token and sender as postmark.js (POSTMARK_API_KEY,
// POSTMARK_FROM_EMAIL); POSTMARK_SERVER_TOKEN is the name the older
// _shared/postmark.js reads, accepted as a fallback.
//   ready       the admin's test copy can be sent (token, sender, valid
//               settings); on POSTMARK_UPGRADE_STREAM, else TEST_EMAIL_STREAM
//   ownerReady  owners can be emailed: also POSTMARK_UPGRADE_STREAM is set
//   missing / invalid / ownerMissing   the settings to fix
export function upgradeEmailConfig() {
  const token = (process.env.POSTMARK_API_KEY || process.env.POSTMARK_SERVER_TOKEN || '').trim();
  const from = (process.env.POSTMARK_FROM_EMAIL || '').trim();
  const streamEnv = (process.env.POSTMARK_UPGRADE_STREAM || '').trim();
  // Replies reach UPGRADE_EMAIL_REPLY_TO when set, else the admin who sent it.
  const replyTo = (process.env.UPGRADE_EMAIL_REPLY_TO || '').trim() || null;
  const missing = [!token && 'POSTMARK_API_KEY', !from && 'POSTMARK_FROM_EMAIL'].filter(Boolean);
  // A bad ReplyTo or stream id would make Postmark refuse every email.
  const invalid = [
    replyTo && !isEmailAddress(replyTo) && 'UPGRADE_EMAIL_REPLY_TO',
    streamEnv && !/^[A-Za-z0-9_-]{1,64}$/.test(streamEnv) && 'POSTMARK_UPGRADE_STREAM',
  ].filter(Boolean);
  const ready = missing.length === 0 && invalid.length === 0;
  const ownerMissing = streamEnv ? [] : ['POSTMARK_UPGRADE_STREAM'];
  return {
    token, from, replyTo, ready, missing, invalid,
    stream: streamEnv || TEST_EMAIL_STREAM,
    streamSet: !!streamEnv,
    ownerReady: ready && !!streamEnv,
    ownerMissing,
  };
}

// What config can't send, in words.
export function upgradeEmailConfigProblem(cfg, { toOwner = false } = {}) {
  if (cfg.missing.length) return `Email is not set up on this server (${cfg.missing.join(', ')})`;
  if (cfg.invalid.length) return `Email settings are not valid (${cfg.invalid.join(', ')})`;
  if (toOwner && !cfg.streamSet) {
    return 'Set POSTMARK_UPGRADE_STREAM to the Postmark stream for owner emails (a Broadcasts stream) before emailing owners';
  }
  return null;
}

function postmarkError(message, extra) {
  return Object.assign(new Error(message), extra);
}

// Postmark ErrorCodes about this one recipient: 406 inactive recipient
// (bounced, unsubscribed or marked as spam), and 300 (invalid request)
// only when it names the To address; a 300 about From, ReplyTo or the
// body would hit every owner.
function isRecipientError(code, message) {
  if (code === 406) return true;
  if (code === 300) return /\bTo\b/.test(String(message || '')) || /recipient/i.test(String(message || ''));
  return false;
}

// Sends one message. Resolves { messageId, submittedAt, stream } once
// Postmark has accepted it. Throws an Error with:
//   recipient: true  Postmark refused this address only (the run goes on)
//   uncertain: true  no answer (timeout, network) or a Postmark server
//                    error: it may have gone out
//   config: true     not set up; nothing was tried
// Any other error is a definite refusal: nothing went out.
// toOwner: an owner email, which needs POSTMARK_UPGRADE_STREAM. Never
// called without the admin's confirmation (admin-site-upgrade).
export async function sendSiteUpgradeEmail({ to, replyTo, subject, html, text, siteId, toOwner = false }) {
  const cfg = upgradeEmailConfig();
  const problem = upgradeEmailConfigProblem(cfg, { toOwner });
  if (problem) throw postmarkError(problem, { config: true });
  let res;
  try {
    res = await fetch(`${POSTMARK_API}/email`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': cfg.token,
      },
      body: JSON.stringify({
        From: cfg.from,
        To: to,
        ...(replyTo ? { ReplyTo: replyTo } : {}),
        Subject: subject,
        HtmlBody: html,
        TextBody: text,
        MessageStream: cfg.stream,
        Tag: UPGRADE_EMAIL_TAG,
        ...(siteId ? { Metadata: { siteId: String(siteId) } } : {}),
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch (e) {
    console.error(`${TAG} no answer from Postmark: ${e?.message || e}`);
    throw postmarkError(`Postmark did not answer (${e?.message || 'network error'}). It may have been sent: check Postmark's Activity before sending again.`, { uncertain: true });
  }
  const body = await res.json().catch(() => ({}));
  const code = Number(body?.ErrorCode) || 0;
  if (res.status >= 500) {
    console.error(`${TAG} server error status=${res.status} code=${code} message=${body?.Message || '-'}`);
    throw postmarkError(`Postmark had a server error (${res.status}). It may have been sent: check Postmark's Activity before sending again.`, { uncertain: true, status: res.status, code });
  }
  if (!res.ok || code !== 0) {
    console.error(`${TAG} refused status=${res.status} code=${code} message=${body?.Message || '-'}`);
    throw postmarkError(`Postmark refused it (${res.status}${code ? `, code ${code}` : ''}): ${body?.Message || 'unknown error'}`, {
      status: res.status, code, recipient: isRecipientError(code, body?.Message),
    });
  }
  console.log(`${TAG} accepted messageId=${body.MessageID || '-'} stream=${cfg.stream}`);
  return { messageId: body.MessageID || null, submittedAt: body.SubmittedAt || null, stream: cfg.stream };
}

// The stream's kind from Postmark (GET /message-streams/{id}), so Admin >
// Site upgrades can show a wrong or transactional stream before anything
// is sent: { found: true, type ('Broadcasts' | 'Transactional' | ...) },
// { found: false } when Postmark has no such stream, { found: null, error }
// when it could not be asked. Read-only.
export async function upgradeEmailStreamInfo() {
  const cfg = upgradeEmailConfig();
  if (!cfg.token) return { found: null, error: 'POSTMARK_API_KEY is not set' };
  let res;
  try {
    res = await fetch(`${POSTMARK_API}/message-streams/${encodeURIComponent(cfg.stream)}`, {
      method: 'GET',
      headers: { Accept: 'application/json', 'X-Postmark-Server-Token': cfg.token },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
  } catch (e) {
    return { found: null, error: `Postmark did not answer (${e?.message || 'network error'})` };
  }
  const body = await res.json().catch(() => ({}));
  if (res.ok) return { found: true, type: typeof body?.MessageStreamType === 'string' ? body.MessageStreamType : null };
  // 1226: no stream with that id.
  if (res.status === 404 || Number(body?.ErrorCode) === 1226) return { found: false };
  return { found: null, error: `Postmark answered ${res.status}${body?.Message ? `: ${body.Message}` : ''}` };
}
