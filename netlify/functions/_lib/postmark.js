import { ServerClient } from 'postmark';
import {
  ASSET_KINDS, FORM_SECTIONS, answerText, firstName, formatBytes, isFieldShown, missingRecommended, safeHref,
} from '../../../src/lib/customSiteForm.js';

const client = process.env.POSTMARK_API_KEY
  ? new ServerClient(process.env.POSTMARK_API_KEY)
  : null;

const FROM = process.env.POSTMARK_FROM_EMAIL || 'bookings@example.com';
const APP_URL = process.env.MAIN_APP_URL || 'https://app.example.com';

function logPostmarkFailure(where, err) {
  // Postmark errors have .code and .message (server response) — surface both.
  const code = err?.code ?? err?.status ?? 'unknown';
  const message = err?.message ?? String(err);
  console.error(`[postmark:${where}] code=${code} from=${FROM} error=${message}`);
  if (err?.response) console.error(`[postmark:${where}] response=`, JSON.stringify(err.response));
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  }[c]));
}

// Plain-text copy of an esc()-built HTML snippet: tags dropped, entities
// back to characters (the text email showed "O&#39;Brien").
function htmlToText(html) {
  return String(html ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[e]));
}

const WHEN_FORMAT = {
  weekday: 'short', month: 'short', day: 'numeric',
  year: 'numeric', hour: 'numeric', minute: '2-digit',
};

// Booking times. preferred_at is the shop's wall-clock time stored as UTC
// (slot-math.js; no shop time zone is stored), so read it in UTC
// explicitly: Lambda happens to run in UTC, `netlify dev` on a laptop does
// not. Same rule as the dashboard's formatBookingTime (src/lib/bookings.js).
export function formatWhen(iso) {
  return new Date(iso).toLocaleString('en-US', { ...WHEN_FORMAT, timeZone: 'UTC' });
}

// Support-call times. scheduled_at is a real instant (support-slots.js
// converts from SUPPORT_TIMEZONE), and the emails label it "ET", so show it
// in that zone; formatWhen would print the UTC clock time.
export function formatSupportWhen(iso) {
  return new Date(iso).toLocaleString('en-US', {
    ...WHEN_FORMAT,
    timeZone: process.env.SUPPORT_TIMEZONE || 'America/New_York',
  });
}

function formatHoursBlock(hours) {
  if (!hours) return '';
  if (typeof hours === 'string') return hours.trim();
  if (typeof hours === 'object') {
    return Object.entries(hours)
      .map(([d, h]) => `${d}: ${h}`)
      .join(' · ');
  }
  return '';
}

function formatCents(cents) {
  if (typeof cents !== 'number' || cents <= 0) return '';
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}

// HTML breakdown showing the locked-in service price, each add-on, and the
// total. Renders nothing when there's no add-ons AND no numeric price —
// legacy bookings without any snapshot pricing get nothing extra in the email.
function addonsBreakdownHtml(booking) {
  const addons = Array.isArray(booking?.addons) ? booking.addons : [];
  const hasService = typeof booking?.service_price_cents === 'number' && booking.service_price_cents > 0;
  if (!hasService && addons.length === 0) return '';
  const rows = [];
  if (hasService) {
    rows.push(`<tr><td style="padding:4px 0;font-size:13px;color:#52525b;">${esc(booking.service_name || 'Service')}</td><td align="right" style="padding:4px 0;font-size:13px;color:#52525b;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${esc(formatCents(booking.service_price_cents))}</td></tr>`);
  }
  for (const a of addons) {
    const cents = typeof a?.price_cents === 'number' && a.price_cents > 0 ? a.price_cents : 0;
    rows.push(`<tr><td style="padding:4px 0;font-size:13px;color:#52525b;">+ ${esc(a?.name || 'Add-on')}</td><td align="right" style="padding:4px 0;font-size:13px;color:#52525b;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${esc(formatCents(cents))}</td></tr>`);
  }
  const totalRow = typeof booking?.total_cents === 'number' && booking.total_cents > 0
    ? `<tr><td style="padding:8px 0 0;border-top:1px solid #e4e4e7;font-size:14px;font-weight:700;color:#18181b;">Total</td><td align="right" style="padding:8px 0 0;border-top:1px solid #e4e4e7;font-size:14px;font-weight:700;color:#18181b;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${esc(formatCents(booking.total_cents))}</td></tr>`
    : '';
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #f4f4f5;border-radius:12px;padding:14px 18px;margin-bottom:8px;">${rows.join('')}${totalRow}</table>`;
}

// Plain-text equivalent of addonsBreakdownHtml.
function addonsBreakdownText(booking) {
  const addons = Array.isArray(booking?.addons) ? booking.addons : [];
  const hasService = typeof booking?.service_price_cents === 'number' && booking.service_price_cents > 0;
  if (!hasService && addons.length === 0) return '';
  const lines = [];
  if (hasService) lines.push(`${booking.service_name || 'Service'}: ${formatCents(booking.service_price_cents)}`);
  for (const a of addons) {
    const cents = typeof a?.price_cents === 'number' && a.price_cents > 0 ? a.price_cents : 0;
    lines.push(`+ ${a?.name || 'Add-on'}: ${formatCents(cents)}`);
  }
  if (typeof booking?.total_cents === 'number' && booking.total_cents > 0) {
    lines.push(`Total: ${formatCents(booking.total_cents)}`);
  }
  return `\n\n${lines.join('\n')}`;
}

// Compact business-info block (HTML) shown in customer-facing emails.
function businessInfoHtmlBlock(site) {
  const biz = site?.business_info || {};
  const copy = site?.generated_content || {};
  const fullAddress = [biz.address, [biz.city, biz.state].filter(Boolean).join(', ')]
    .filter(Boolean).join(', ');
  const hoursText = formatHoursBlock(biz.hours);
  const publishedUrl = site?.published_url || (site?.slug ? `https://${site.slug}.autocaregeniushub.com` : null);

  const rows = [];
  if (biz.businessName) rows.push(`<p style="margin:0 0 6px;font-weight:700;font-size:15px;color:#18181b;">${esc(biz.businessName)}</p>`);
  if (fullAddress) rows.push(`<p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Address:</strong> ${esc(fullAddress)}</p>`);
  if (biz.phone) rows.push(`<p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Phone:</strong> <a href="tel:${esc(biz.phone)}" style="color:#cc0000;text-decoration:none;font-weight:600;">${esc(biz.phone)}</a></p>`);
  if (biz.email) rows.push(`<p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Email:</strong> <a href="mailto:${esc(biz.email)}" style="color:#cc0000;text-decoration:none;">${esc(biz.email)}</a></p>`);
  if (hoursText) rows.push(`<p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Hours:</strong> ${esc(hoursText)}</p>`);
  if (publishedUrl) rows.push(`<p style="margin:6px 0 0;font-size:12px;"><a href="${esc(publishedUrl)}" style="color:#cc0000;text-decoration:none;font-weight:600;">Visit our site →</a></p>`);

  if (rows.length === 0) return '';
  return `<div style="margin-top:24px;padding:16px 18px;background:#fafafa;border:1px solid #f4f4f5;border-radius:12px;">${rows.join('')}</div>`;
}

// Render the same branded shell used by the Supabase auth emails
// (confirm-signup, reset-password) so every Postmark email looks like
// it came out of the same system. Accepts a block of inner HTML for the
// content area — keep it simple paragraphs + optional cards.
function renderEmailShell({ icon = '✉', eyebrow = 'Websites', title, intro, cta, body }) {
  const ctaHtml = cta
    ? `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:28px;">
         <a href="${esc(cta.href)}" style="display:inline-block;background:linear-gradient(135deg,#cc0000,#8a0000);color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:14px 36px;border-radius:12px;letter-spacing:0.01em;">${esc(cta.label)}</a>
       </td></tr></table>`
    : '';
  // Allow callers to skip the red icon square entirely by passing `icon: null`.
  // Existing callers that don't pass anything still get the default ✉ envelope
  // icon, so this is backward-compatible.
  const iconHtml = icon
    ? `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:24px;">
         <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#cc0000,#8a0000);display:inline-block;margin:0 auto;text-align:center;line-height:52px;font-size:24px;color:#ffffff;">${icon}</div>
       </td></tr></table>`
    : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:40px 16px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
  <tr><td align="center" style="padding-bottom:32px;">
    <img src="https://www.autocaregenius.com/cdn/shop/files/v11_1.svg?v=1760731533&width=400" alt="Auto Care Genius" width="130" style="display:block;width:130px;max-width:80%;height:auto;margin:0 auto 14px;border:0;outline:none;text-decoration:none;">
    <div style="font-family:'Lucida Sans','Lucida Sans Unicode','Lucida Grande',Verdana,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#999999;letter-spacing:1.5px;text-transform:uppercase;line-height:1;margin:0;">${esc(eyebrow)}</div>
  </td></tr>
  <tr><td style="background:#ffffff;border-radius:20px;border:1px solid #e4e4e7;padding:40px 36px;box-shadow:0 1px 3px rgba(0,0,0,0.04),0 8px 32px rgba(0,0,0,0.04);">
    ${iconHtml}
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;text-align:center;letter-spacing:-0.02em;">${title}</h1>
    ${intro ? `<p style="margin:0 0 24px;font-size:14px;color:#71717a;text-align:center;line-height:1.6;">${intro}</p>` : ''}
    ${ctaHtml}
    ${body || ''}
  </td></tr>
  <tr><td align="center" style="padding-top:24px;">
    <p style="margin:0;font-size:12px;color:#d4d4d8;">&copy; 2026 Auto Care Genius &middot; All rights reserved</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

// Plain-text equivalent for the business-info block.
function businessInfoTextBlock(site) {
  const biz = site?.business_info || {};
  const fullAddress = [biz.address, [biz.city, biz.state].filter(Boolean).join(', ')]
    .filter(Boolean).join(', ');
  const hoursText = formatHoursBlock(biz.hours);
  const publishedUrl = site?.published_url || (site?.slug ? `https://${site.slug}.autocaregeniushub.com` : null);
  const lines = [];
  if (biz.businessName) lines.push(biz.businessName);
  if (fullAddress) lines.push(`Address: ${fullAddress}`);
  if (biz.phone) lines.push(`Phone: ${biz.phone}`);
  if (biz.email) lines.push(`Email: ${biz.email}`);
  if (hoursText) lines.push(`Hours: ${hoursText}`);
  if (publishedUrl) lines.push(`Website: ${publishedUrl}`);
  return lines.length ? `\n\n---\n${lines.join('\n')}` : '';
}

// requestedTimeText: set for a request-form booking (booking_mode 'simple'),
// whose preferred_at is only a placeholder; the customer's own words are
// shown instead of that time.
export async function newBookingToOwner({ booking, site, ownerEmail, requestedTimeText = null }) {
  if (!client) { console.warn('Postmark not configured; skipping email'); return; }
  const b = booking;
  const name = site?.business_info?.businessName || 'your site';
  const dashLink = `${APP_URL}/?bookings=${encodeURIComponent(b.id)}`;
  const whenText = requestedTimeText ? `asks for: ${requestedTimeText}` : formatWhen(b.preferred_at);

  const vehicleLine = [b.vehicle_year, b.vehicle_make, b.vehicle_model].filter(Boolean).join(' ');
  const detailCard = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #f4f4f5;border-radius:12px;padding:16px 18px;margin-bottom:8px;"><tr><td>
      <p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Customer:</strong> ${esc(b.customer_name)}</p>
      <p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Email:</strong> <a href="mailto:${esc(b.customer_email)}" style="color:#cc0000;text-decoration:none;">${esc(b.customer_email)}</a></p>
      <p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Phone:</strong> <a href="tel:${esc(b.customer_phone)}" style="color:#cc0000;text-decoration:none;">${esc(b.customer_phone)}</a></p>
      ${vehicleLine ? `<p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Vehicle:</strong> ${esc(vehicleLine)}${(b.vehicle_type_name || b.vehicle_size) ? ' (' + esc(b.vehicle_type_name || b.vehicle_size) + ')' : ''}</p>` : ''}
      ${b.service_name ? `<p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Service:</strong> ${esc(b.service_name)}</p>` : ''}
      ${b.service_address ? `<p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Service address:</strong> ${esc(b.service_address)}</p>` : ''}
      ${b.notes ? `<p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Notes:</strong> ${esc(b.notes)}</p>` : ''}
      ${b.referral_source ? `<p style="margin:0;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Heard via:</strong> ${esc(b.referral_source)}</p>` : ''}
    </td></tr></table>
    ${addonsBreakdownHtml(b)}`;
  const html = renderEmailShell({
    icon: '📅',
    title: `${esc(b.customer_name)} wants to book`,
    intro: requestedTimeText
      ? `Requested time, in their words: <strong style="color:#18181b;">${esc(requestedTimeText)}</strong>. Set the time when you confirm it.`
      : `Preferred time: <strong style="color:#18181b;">${esc(formatWhen(b.preferred_at))}</strong>`,
    cta: { label: 'Open in your dashboard', href: dashLink },
    body: detailCard,
  });
  const text = `New booking request for ${name}\n\n${b.customer_name} (${b.customer_email}, ${b.customer_phone}) wants to book ${requestedTimeText ? `and ${whenText}` : `for ${whenText}`}.\nVehicle: ${b.vehicle_year} ${b.vehicle_make} ${b.vehicle_model} (${b.vehicle_type_name || b.vehicle_size})\n${b.service_name ? 'Service: ' + b.service_name + '\n' : ''}${b.service_address ? 'Service address: ' + b.service_address + '\n' : ''}${b.notes ? 'Notes: ' + b.notes + '\n' : ''}${addonsBreakdownText(b)}\nOpen: ${dashLink}`;

  try {
    const res = await client.sendEmail({
      From: FROM,
      To: ownerEmail,
      Subject: `New booking request from ${b.customer_name} — ${requestedTimeText ? 'time to arrange' : formatWhen(b.preferred_at)}`,
      HtmlBody: html,
      TextBody: text,
      MessageStream: 'outbound',
    });
    console.log(`[postmark:newBookingToOwner] sent to=${ownerEmail} messageId=${res?.MessageID}`);
    return res;
  } catch (err) {
    logPostmarkFailure('newBookingToOwner', err);
    throw err;
  }
}

// Customer receipt — sent immediately when a booking request is created.
// Gives the customer a record of what they submitted, an at-a-glance
// reminder of the business's contact details, and sets expectations.
// confirmed: the owner booked it from the dashboard (owner-create-booking),
// so it is already confirmed and the email says so instead of "we'll confirm".
export async function bookingReceivedToCustomer({ booking, site, isSimple, confirmed = false }) {
  if (!client) { console.warn('Postmark not configured; skipping email'); return; }
  const b = booking;
  const name = site?.business_info?.businessName || 'the business';
  const bizBlockHtml = businessInfoHtmlBlock(site);
  const bizBlockText = businessInfoTextBlock(site);
  const vehicleLine = [b.vehicle_year, b.vehicle_make, b.vehicle_model].filter(Boolean).join(' ');

  const timeLine = confirmed
    ? `You're booked for <strong>${esc(formatWhen(b.preferred_at))}</strong>.`
    : isSimple
      ? 'We\'ll reach out shortly to confirm a time that works for you.'
      : `You requested <strong>${esc(formatWhen(b.preferred_at))}</strong>. We'll confirm availability shortly.`;

  const detailCard = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #f4f4f5;border-radius:12px;padding:16px 18px;margin-bottom:8px;"><tr><td>
      ${b.service_name ? `<p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Service:</strong> ${esc(b.service_name)}</p>` : ''}
      ${vehicleLine ? `<p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Vehicle:</strong> ${esc(vehicleLine)}${(b.vehicle_type_name || b.vehicle_size) ? ' (' + esc(b.vehicle_type_name || b.vehicle_size) + ')' : ''}</p>` : ''}
      ${b.service_address ? `<p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Service address:</strong> ${esc(b.service_address)}</p>` : ''}
      ${b.notes ? `<p style="margin:0;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Notes:</strong> ${esc(b.notes).replace(/\n/g, '<br/>')}</p>` : ''}
    </td></tr></table>
    ${addonsBreakdownHtml(b)}
    ${bizBlockHtml}
    <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa;text-align:center;">If you need to change anything, just reply to this email.</p>`;
  const html = renderEmailShell({
    icon: '✓',
    title: confirmed ? `You're booked, ${esc(b.customer_name)}!` : `Thanks for your request, ${esc(b.customer_name)}!`,
    intro: timeLine,
    body: detailCard,
  });
  const text =
    (confirmed ? `Booking confirmed — ${name}\n\n` : `Request received — ${name}\n\n`) +
    (confirmed ? `You're booked, ${b.customer_name}!\n\n` : `Thanks for your request, ${b.customer_name}!\n\n`) +
    (confirmed
      ? `You're booked for ${formatWhen(b.preferred_at)}.\n`
      : isSimple
        ? `We'll reach out shortly to confirm a time that works for you.\n`
        : `You requested ${formatWhen(b.preferred_at)}. We'll confirm availability shortly.\n`) +
    (b.service_name ? `\nService: ${b.service_name}` : '') +
    (vehicleLine ? `\nVehicle: ${vehicleLine}${(b.vehicle_type_name || b.vehicle_size) ? ' (' + (b.vehicle_type_name || b.vehicle_size) + ')' : ''}` : '') +
    (b.service_address ? `\nService address: ${b.service_address}` : '') +
    (b.notes ? `\nNotes: ${b.notes}` : '') +
    addonsBreakdownText(b) +
    bizBlockText +
    `\n\nIf you need to change anything, just reply to this email.`;

  try {
    const res = await client.sendEmail({
      From: FROM,
      To: b.customer_email,
      Subject: confirmed ? `Your booking is confirmed — ${name}` : `We got your request — ${name}`,
      HtmlBody: html,
      TextBody: text,
      MessageStream: 'outbound',
    });
    console.log(`[postmark:bookingReceivedToCustomer] to=${b.customer_email} messageId=${res?.MessageID}`);
    return res;
  } catch (err) {
    logPostmarkFailure('bookingReceivedToCustomer', err);
    throw err;
  }
}

// requestedTime: a request-form booking declined or cancelled before the
// owner set a time. Its preferred_at is a placeholder, so the email names
// what the customer asked for instead.
export async function statusUpdateToCustomer({ booking, site, status, reason, requestedTime = null }) {
  if (!client) { console.warn('Postmark not configured; skipping email'); return; }
  const b = booking;
  const name = site?.business_info?.businessName || 'the business';
  const bizBlockHtml = businessInfoHtmlBlock(site);
  const bizBlockText = businessInfoTextBlock(site);
  const whatHtml = requestedTime
    ? `your request (${esc(requestedTime)})`
    : esc(formatWhen(b.preferred_at));

  const map = {
    confirmed: {
      subject: `Your booking is confirmed — ${name}`,
      heading: `You're confirmed for ${formatWhen(b.preferred_at)}`,
      body: `Thanks ${esc(b.customer_name)} — we'll see you then. Reply to this email if you need to change anything.`,
    },
    declined: {
      subject: `Your booking request — ${name}`,
      heading: `We couldn't confirm that time`,
      body: `Sorry ${esc(b.customer_name)} — we can't make ${whatHtml} work.${reason ? ' Reason: ' + esc(reason) : ''} Feel free to submit another request.`,
    },
    cancelled: {
      subject: `Your booking was cancelled — ${name}`,
      heading: `Your booking was cancelled`,
      body: requestedTime
        ? `Your request (${esc(requestedTime)}) has been cancelled.`
        : `Your booking for ${esc(formatWhen(b.preferred_at))} has been cancelled.`,
    },
  };
  const m = map[status];
  if (!m) return;

  const icon = status === 'confirmed' ? '✓' : status === 'declined' ? '✕' : '⊘';
  const html = renderEmailShell({
    icon,
    title: m.heading,
    intro: m.body,
    body: bizBlockHtml,
  });
  const text = `${m.heading}\n\n${htmlToText(m.body)}${bizBlockText}`;

  try {
    const res = await client.sendEmail({
      From: FROM,
      To: b.customer_email,
      Subject: m.subject,
      HtmlBody: html,
      TextBody: text,
      MessageStream: 'outbound',
    });
    console.log(`[postmark:statusUpdateToCustomer] status=${status} to=${b.customer_email} messageId=${res?.MessageID}`);
    return res;
  } catch (err) {
    logPostmarkFailure('statusUpdateToCustomer', err);
    throw err;
  }
}

// Owner-triggered booking reminder to the customer. Sent from the booking
// detail drawer. Reuses the branded shell + business-info footer so it
// matches the rest of the booking emails. Storage is unchanged — this just
// composes and sends; no DB writes.
export async function bookingReminderToCustomer({ booking, site, customMessage }) {
  if (!client) { console.warn('Postmark not configured; skipping email'); return; }
  const b = booking;
  const name = site?.business_info?.businessName || 'your appointment';
  const bizBlockHtml = businessInfoHtmlBlock(site);
  const bizBlockText = businessInfoTextBlock(site);
  const vehicleLine = [b.vehicle_year, b.vehicle_make, b.vehicle_model].filter(Boolean).join(' ');

  const intro = customMessage
    ? esc(customMessage)
    : `Just a friendly reminder — your appointment is on <strong style="color:#18181b;">${esc(formatWhen(b.preferred_at))}</strong>.`;

  const detailCard = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #f4f4f5;border-radius:12px;padding:16px 18px;margin-bottom:8px;"><tr><td>
      <p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">When:</strong> ${esc(formatWhen(b.preferred_at))}</p>
      ${b.service_name ? `<p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Service:</strong> ${esc(b.service_name)}</p>` : ''}
      ${vehicleLine ? `<p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Vehicle:</strong> ${esc(vehicleLine)}${(b.vehicle_type_name || b.vehicle_size) ? ' (' + esc(b.vehicle_type_name || b.vehicle_size) + ')' : ''}</p>` : ''}
      ${b.service_address ? `<p style="margin:0;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Address:</strong> ${esc(b.service_address)}</p>` : ''}
    </td></tr></table>
    ${bizBlockHtml}
    <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa;text-align:center;">Need to reschedule? Just reply to this email.</p>`;
  const html = renderEmailShell({
    icon: '⏰',
    title: `Reminder: your appointment with ${esc(name)}`,
    intro,
    body: detailCard,
  });
  const text =
    `Reminder: your appointment with ${name}\n\n` +
    (customMessage || `Your appointment is on ${formatWhen(b.preferred_at)}.`) +
    `\n\nWhen: ${formatWhen(b.preferred_at)}` +
    (b.service_name ? `\nService: ${b.service_name}` : '') +
    (vehicleLine ? `\nVehicle: ${vehicleLine}${(b.vehicle_type_name || b.vehicle_size) ? ' (' + (b.vehicle_type_name || b.vehicle_size) + ')' : ''}` : '') +
    (b.service_address ? `\nAddress: ${b.service_address}` : '') +
    bizBlockText +
    `\n\nNeed to reschedule? Just reply to this email.`;

  try {
    const res = await client.sendEmail({
      From: FROM,
      To: b.customer_email,
      Subject: `Reminder: your appointment with ${name}`,
      HtmlBody: html,
      TextBody: text,
      MessageStream: 'outbound',
    });
    console.log(`[postmark:bookingReminderToCustomer] to=${b.customer_email} messageId=${res?.MessageID}`);
    return res;
  } catch (err) {
    logPostmarkFailure('bookingReminderToCustomer', err);
    throw err;
  }
}

// Free-form owner → customer message, sent from the Customer detail page.
// Rendered in the same branded shell as the automated emails so replies land
// back to the owner (replyTo) and customer sees a familiar layout. Body is
// plain text (from a textarea) and gets newline → <br/> conversion for HTML.
export async function ownerToCustomerMessage({ toEmail, subject, body, site, replyTo }) {
  if (!client) { console.warn('Postmark not configured; skipping email'); return; }
  const name = site?.business_info?.businessName || 'your business';
  const bizBlockHtml = businessInfoHtmlBlock(site);
  const bizBlockText = businessInfoTextBlock(site);

  const bodyHtml = `
    <div style="font-size:14px;color:#3f3f46;line-height:1.65;white-space:pre-wrap;">${esc(body).replace(/\n/g, '<br/>')}</div>
    ${bizBlockHtml}`;
  const html = renderEmailShell({
    icon: '✉',
    eyebrow: name,
    title: esc(subject),
    body: bodyHtml,
  });
  const text = `${subject}\n\n${body}${bizBlockText}`;

  try {
    const res = await client.sendEmail({
      From: FROM,
      To: toEmail,
      ReplyTo: replyTo || FROM,
      Subject: subject,
      HtmlBody: html,
      TextBody: text,
      MessageStream: 'outbound',
    });
    console.log(`[postmark:ownerToCustomerMessage] to=${toEmail} replyTo=${replyTo} messageId=${res?.MessageID}`);
    return res;
  } catch (err) {
    logPostmarkFailure('ownerToCustomerMessage', err);
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────────────
// Support-Zoom booking emails
// ──────────────────────────────────────────────────────────────────────

const SUPPORT_HOST_NAME = process.env.SUPPORT_HOST_NAME || 'Genius Websites Support';

// Build a minimal RFC 5545 .ics calendar invite as a base64-encoded string
// suitable for Postmark's Attachments[].Content. Both the customer and the
// host get this attached so the meeting drops straight into their calendar
// app (Google Calendar, Apple Calendar, Outlook).
function buildIcsAttachment({ uid, startISO, endISO, summary, description, joinUrl, organizerEmail }) {
  function fmt(iso) {
    // ICS wants UTC stamps in YYYYMMDDTHHMMSSZ form. Date#toISOString returns
    // "2026-05-04T15:00:00.000Z" — strip dashes/colons and the .000.
    return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }
  function escIcs(s) {
    return String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  }
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Genius Websites//Support Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(startISO)}`,
    `DTEND:${fmt(endISO)}`,
    `SUMMARY:${escIcs(summary)}`,
    `DESCRIPTION:${escIcs(description)}`,
    `LOCATION:${escIcs(joinUrl)}`,
    `ORGANIZER;CN=${escIcs(SUPPORT_HOST_NAME)}:mailto:${organizerEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  return {
    Name: 'invite.ics',
    ContentType: 'text/calendar; method=REQUEST; charset=UTF-8',
    Content: Buffer.from(lines, 'utf-8').toString('base64'),
  };
}

// Confirms the support-Zoom booking with the customer. Includes the join URL
// inline and a .ics calendar invite as an attachment.
export async function supportBookingToCustomer({ booking }) {
  if (!client) { console.warn('Postmark not configured; skipping email'); return; }
  const b = booking;
  const ics = buildIcsAttachment({
    uid: `support-${b.id}@geniuswebsites`,
    startISO: b.scheduled_at,
    endISO: b.ends_at,
    summary: 'Genius Websites — Support call',
    description: `Join here: ${b.zoom_join_url}\n\nTopic: ${b.topic || 'General support'}`,
    joinUrl: b.zoom_join_url,
    organizerEmail: FROM,
  });

  const detailCard = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #f4f4f5;border-radius:12px;padding:16px 18px;margin-bottom:16px;"><tr><td>
      <p style="margin:0 0 6px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">When:</strong> ${esc(formatSupportWhen(b.scheduled_at))} ET</p>
      <p style="margin:0 0 6px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Duration:</strong> 30 minutes</p>
      ${b.topic ? `<p style="margin:0;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Topic:</strong> ${esc(b.topic)}</p>` : ''}
    </td></tr></table>
    ${b.zoom_password ? `<p style="margin:0 0 16px;font-size:13px;color:#71717a;text-align:center;">Passcode (only if asked): <strong style="color:#18181b;">${esc(b.zoom_password)}</strong></p>` : ''}
    <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;line-height:1.6;">A calendar invite is attached. Need to reschedule? Just reply to this email.</p>`;

  const html = renderEmailShell({
    icon: null,
    eyebrow: SUPPORT_HOST_NAME,
    title: 'Your support call is confirmed',
    intro: `We'll see you on Zoom at <strong style="color:#18181b;">${esc(formatSupportWhen(b.scheduled_at))} ET</strong>.`,
    cta: { label: 'Join Zoom call', href: b.zoom_join_url },
    body: detailCard,
  });
  const text = `Your support call is confirmed.\n\nWhen: ${formatSupportWhen(b.scheduled_at)} ET (30 min)\nJoin: ${b.zoom_join_url}\n${b.zoom_password ? `Passcode (if asked): ${b.zoom_password}\n` : ''}${b.topic ? `Topic: ${b.topic}\n` : ''}\nA calendar invite is attached. Reply to this email to reschedule.`;

  try {
    const res = await client.sendEmail({
      From: FROM,
      To: b.customer_email,
      Subject: `Zoom call with ${SUPPORT_HOST_NAME} — ${formatSupportWhen(b.scheduled_at)}`,
      HtmlBody: html,
      TextBody: text,
      Attachments: [ics],
      MessageStream: 'outbound',
    });
    console.log(`[postmark:supportBookingToCustomer] to=${b.customer_email} messageId=${res?.MessageID}`);
    return res;
  } catch (err) {
    logPostmarkFailure('supportBookingToCustomer', err);
    throw err;
  }
}

// Notifies the support host (you) of a new support-Zoom booking. Includes
// the start_url (host link, never share with customers) and the same .ics
// invite so it lands in your calendar too.
export async function supportBookingToHost({ booking, hostEmail }) {
  if (!client) { console.warn('Postmark not configured; skipping email'); return; }
  const b = booking;
  const ics = buildIcsAttachment({
    uid: `support-${b.id}@geniuswebsites`,
    startISO: b.scheduled_at,
    endISO: b.ends_at,
    summary: `Support call — ${b.customer_name}`,
    description: `Customer: ${b.customer_name} (${b.customer_email}${b.customer_phone ? ', ' + b.customer_phone : ''})\nTopic: ${b.topic || 'General support'}\n\nHost link: ${b.zoom_start_url}\nJoin link: ${b.zoom_join_url}`,
    joinUrl: b.zoom_start_url || b.zoom_join_url,
    organizerEmail: FROM,
  });

  const detailCard = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #f4f4f5;border-radius:12px;padding:16px 18px;margin-bottom:8px;"><tr><td>
      <p style="margin:0 0 6px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">When:</strong> ${esc(formatSupportWhen(b.scheduled_at))} ET (30 min)</p>
      <p style="margin:0 0 6px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Customer:</strong> ${esc(b.customer_name)}</p>
      <p style="margin:0 0 6px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Email:</strong> <a href="mailto:${esc(b.customer_email)}" style="color:#cc0000;text-decoration:none;">${esc(b.customer_email)}</a></p>
      ${b.customer_phone ? `<p style="margin:0 0 6px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Phone:</strong> <a href="tel:${esc(b.customer_phone)}" style="color:#cc0000;text-decoration:none;">${esc(b.customer_phone)}</a></p>` : ''}
      ${b.topic ? `<p style="margin:0;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Topic:</strong> ${esc(b.topic)}</p>` : ''}
    </td></tr></table>`;

  const html = renderEmailShell({
    icon: null,
    eyebrow: 'Support booking',
    title: `${esc(b.customer_name)} booked a Zoom`,
    intro: `<strong style="color:#18181b;">${esc(formatSupportWhen(b.scheduled_at))} ET</strong> — calendar invite attached.`,
    cta: { label: 'Start meeting (host link)', href: b.zoom_start_url || b.zoom_join_url },
    body: detailCard,
  });
  const text = `New support call booked.\n\nWhen: ${formatSupportWhen(b.scheduled_at)} ET (30 min)\nCustomer: ${b.customer_name} (${b.customer_email}${b.customer_phone ? ', ' + b.customer_phone : ''})\n${b.topic ? `Topic: ${b.topic}\n` : ''}\nHost link: ${b.zoom_start_url}\nJoin link: ${b.zoom_join_url}`;

  try {
    const res = await client.sendEmail({
      From: FROM,
      To: hostEmail,
      Subject: `Support call — ${b.customer_name} — ${formatSupportWhen(b.scheduled_at)}`,
      HtmlBody: html,
      TextBody: text,
      Attachments: [ics],
      MessageStream: 'outbound',
    });
    console.log(`[postmark:supportBookingToHost] to=${hostEmail} messageId=${res?.MessageID}`);
    return res;
  } catch (err) {
    logPostmarkFailure('supportBookingToHost', err);
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────────────
// Custom website emails (Admin > Custom websites, /custom-site form)
// ──────────────────────────────────────────────────────────────────────

// Where customer replies land when no admin address is known (the
// functions pass the admin's own address as replyTo when they have it).
const CUSTOM_SITES_REPLY_TO = (process.env.CUSTOM_SITES_EMAIL || '').split(',')[0].trim()
  || process.env.SUPPORT_HOST_EMAIL || FROM;

function infoCard(inner, marginBottom = 16) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #f4f4f5;border-radius:12px;margin-bottom:${marginBottom}px;"><tr><td style="padding:16px 18px;">${inner}</td></tr></table>`;
}

function cardHeading(text) {
  return `<p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#a1a1aa;letter-spacing:1px;text-transform:uppercase;">${esc(text)}</p>`;
}

function linkFallback(href) {
  return `<p style="margin:20px 0 0;font-size:12px;color:#a1a1aa;text-align:center;line-height:1.6;">Button not working? Copy this link into your browser:<br/><a href="${esc(href)}" style="color:#cc0000;text-decoration:none;word-break:break-all;">${esc(href)}</a></p>`;
}

const HAVE_READY = [
  'Your logo (the best file you have)',
  'Your brand colors, if you have them',
  'A few websites or designs you like',
  'Photos of your work, shop or team',
  'Your services and prices',
];

const HOW_IT_WORKS = [
  ['Fill out the form', 'Tell us about your business and the look you want.'],
  ['We design your site', 'Built around your brand, your services and your photos.'],
  ['You review it', 'We fine-tune it with you until it feels right.'],
  ['You go live', 'We launch it and your customers can find you.'],
];

// Welcome email for a new custom-website customer: links to their intake
// form. Pure (returns the message) so it can be tested and previewed.
export function customSiteWelcomeEmail({ firstName: givenName, clientName, businessName, formUrl, note }) {
  const first = String(givenName || '').trim() || firstName(clientName);
  const forBiz = businessName ? ` for <strong style="color:#18181b;">${esc(businessName)}</strong>` : '';
  const subject = businessName
    ? `Welcome! Let's build the ${businessName} website`
    : 'Welcome! Let\'s build your new website';

  const noteHtml = note
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f5;border-left:3px solid #cc0000;border-radius:0 12px 12px 0;margin-bottom:16px;"><tr><td style="padding:14px 18px;">
         <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#cc0000;letter-spacing:1px;text-transform:uppercase;">A note from our team</p>
         <p style="margin:0;font-size:14px;color:#3f3f46;line-height:1.6;">${esc(note).replace(/\n/g, '<br/>')}</p>
       </td></tr></table>`
    : '';
  const readyRows = HAVE_READY.map((item) =>
    `<tr><td width="18" valign="top" style="padding:3px 0;font-size:13px;color:#cc0000;font-weight:700;">&#10003;</td><td style="padding:3px 0;font-size:13px;color:#52525b;line-height:1.5;">${esc(item)}</td></tr>`).join('');
  const stepRows = HOW_IT_WORKS.map(([title, text], i) =>
    `<tr><td width="34" valign="top" style="padding:4px 0;"><div style="width:22px;height:22px;border-radius:11px;background:#18181b;color:#ffffff;font-size:11px;font-weight:700;line-height:22px;text-align:center;">${i + 1}</div></td>
       <td style="padding:4px 0 8px;"><p style="margin:0;font-size:13px;font-weight:700;color:#18181b;">${esc(title)}</p><p style="margin:2px 0 0;font-size:13px;color:#71717a;line-height:1.5;">${esc(text)}</p></td></tr>`).join('');

  const body = `${noteHtml}
    ${infoCard(`${cardHeading('Good to have handy')}<table width="100%" cellpadding="0" cellspacing="0">${readyRows}</table>
      <p style="margin:10px 0 0;font-size:12px;color:#a1a1aa;line-height:1.5;">Don't have everything? Send what you have. You can add the rest later.</p>`)}
    ${infoCard(`${cardHeading('How it works')}<table width="100%" cellpadding="0" cellspacing="0">${stepRows}</table>`, 0)}
    ${linkFallback(formUrl)}
    <p style="margin:12px 0 0;font-size:12px;color:#a1a1aa;text-align:center;line-height:1.6;">This link is just for you, so please don't share it.<br/>Questions? Just reply to this email.</p>`;

  const html = renderEmailShell({
    icon: null,
    eyebrow: 'Custom Websites',
    title: first ? `Welcome, ${esc(first)}!` : 'Welcome!',
    intro: `Thanks for choosing a custom website${forBiz}. Step one is a short form about your business and your style. It saves as you go, so you can come back and finish it anytime.`,
    cta: { label: 'Start my website form', href: formUrl },
    body,
  });

  const text = [
    first ? `Welcome, ${first}!` : 'Welcome!',
    '',
    `Thanks for choosing a custom website${businessName ? ` for ${businessName}` : ''}. Step one is a short form about your business and your style. It saves as you go, so you can come back and finish it anytime.`,
    '',
    `Start your website form: ${formUrl}`,
    ...(note ? ['', 'A note from our team:', note] : []),
    '',
    'Good to have handy:',
    ...HAVE_READY.map((i) => `- ${i}`),
    'Don\'t have everything? Send what you have. You can add the rest later.',
    '',
    'How it works:',
    ...HOW_IT_WORKS.map(([t, d], i) => `${i + 1}. ${t}: ${d}`),
    '',
    'This link is just for you, so please don\'t share it. Questions? Just reply to this email.',
  ].join('\n');

  return { subject, html, text };
}

// Sent to the customer after they submit the form.
export function customSiteReceivedEmail({ firstName: givenName, clientName, businessName, formUrl }) {
  const first = String(givenName || '').trim() || firstName(clientName);
  const biz = businessName ? `<strong style="color:#18181b;">${esc(businessName)}</strong>` : 'your website';
  const html = renderEmailShell({
    icon: '&#10003;',
    eyebrow: 'Custom Websites',
    title: first ? `Thanks, ${esc(first)}! We've got it.` : 'Thanks! We\'ve got it.',
    intro: `Your answers and files for ${biz} are in. We'll start on your design and reach out if we have any questions.`,
    cta: { label: 'Review my answers', href: formUrl },
    body: `<p style="margin:0;font-size:13px;color:#71717a;text-align:center;line-height:1.6;">Remembered something? Use the same link to add photos or change an answer anytime. Your changes come straight to us.</p>
      ${linkFallback(formUrl)}
      <p style="margin:12px 0 0;font-size:12px;color:#a1a1aa;text-align:center;">Questions? Just reply to this email.</p>`,
  });
  const text = `${first ? `Thanks, ${first}!` : 'Thanks!'} We've got it.\n\nYour answers and files${businessName ? ` for ${businessName}` : ''} are in. We'll start on your design and reach out if we have any questions.\n\nRemembered something? Use the same link to add photos or change an answer anytime:\n${formUrl}\n\nQuestions? Just reply to this email.`;
  return { subject: 'We\'ve got your website details', html, text };
}

// One answer as email HTML: color swatches, linked sites, line breaks kept.
function answerHtml(field, value) {
  if (field.type === 'colors') {
    return value.map((c) => `<span style="display:inline-block;margin:0 12px 4px 0;white-space:nowrap;"><span style="display:inline-block;width:14px;height:14px;border-radius:3px;border:1px solid #e4e4e7;background:${esc(c)};vertical-align:-2px;"></span> ${esc(c)}</span>`).join('');
  }
  if (field.type === 'sites') {
    return value.map((r) => {
      const href = safeHref(r.url);
      const link = href ? `<a href="${esc(href)}" style="color:#cc0000;text-decoration:none;font-weight:600;">${esc(r.url)}</a>` : esc(r.url || '');
      return `<div style="margin-bottom:6px;">${link}${r.note ? `<br/><span style="color:#52525b;">${esc(r.note)}</span>` : ''}</div>`;
    }).join('');
  }
  const text = answerText(field, value);
  const href = field.type === 'url' ? safeHref(value) : null;
  if (href) return `<a href="${esc(href)}" style="color:#cc0000;text-decoration:none;">${esc(text)}</a>`;
  return esc(text).replace(/\n/g, '<br/>');
}

function answeredFields(section, form) {
  return section.fields.filter((f) => f.type !== 'files' && isFieldShown(f, form) && answerText(f, form[f.id]));
}

// Sent to the team when a customer submits (or resubmits) the form: every
// answer, and links to their files (assets[].url, signed for a few days).
export function customSiteFormToAdminEmail({ project, form, assets, adminUrl, resubmitted }) {
  const who = project.business_name || form.businessName || project.client_name;
  const counts = Object.entries(ASSET_KINDS)
    .map(([kind, k]) => [k.label, assets.filter((a) => a.kind === kind).length])
    .filter(([, n]) => n > 0);
  const missing = missingRecommended(form, assets).map((m) => m.label);
  const row = (label, value) => `<p style="margin:0 0 6px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">${esc(label)}:</strong> ${value}</p>`;
  const email = form.contactEmail || project.client_email;
  const phone = form.contactPhone || project.client_phone;
  const details = [
    row('Customer', esc(form.contactName || project.client_name)),
    row('Email', `<a href="mailto:${esc(email)}" style="color:#cc0000;text-decoration:none;">${esc(email)}</a>`),
    phone ? row('Phone', `<a href="tel:${esc(phone)}" style="color:#cc0000;text-decoration:none;">${esc(phone)}</a>`) : '',
    row('Files', counts.length ? esc(counts.map(([l, n]) => `${l}: ${n}`).join(' · ')) : 'None yet'),
    missing.length ? row('Still missing', esc(missing.join(', '))) : '',
  ].join('');

  const answers = FORM_SECTIONS.map((s) => {
    const rows = answeredFields(s, form).map((f) => `<tr>
        <td valign="top" style="padding:7px 12px 7px 0;width:36%;border-top:1px solid #f4f4f5;font-size:12px;color:#a1a1aa;font-weight:600;line-height:1.4;">${esc(f.label)}</td>
        <td valign="top" style="padding:7px 0;border-top:1px solid #f4f4f5;font-size:13px;color:#18181b;line-height:1.5;">${answerHtml(f, form[f.id])}</td>
      </tr>`).join('');
    return rows ? `${cardHeading(s.title)}<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">${rows}</table>` : '';
  }).join('');

  const fileGroups = Object.entries(ASSET_KINDS).map(([kind, k]) => {
    const list = assets.filter((a) => a.kind === kind);
    if (!list.length) return '';
    const items = list.map((a) => {
      const name = a.url ? `<a href="${esc(a.url)}" style="color:#cc0000;text-decoration:none;font-weight:600;">${esc(a.name)}</a>` : esc(a.name);
      const size = formatBytes(a.size);
      return `<p style="margin:0 0 6px;font-size:13px;color:#18181b;line-height:1.45;">${name}${size ? ` <span style="color:#a1a1aa;">· ${esc(size)}</span>` : ''}${a.note ? `<br/><span style="color:#52525b;">"${esc(a.note)}"</span>` : ''}</p>`;
    }).join('');
    return `<p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#18181b;">${esc(k.label)} (${list.length})</p>${items}<div style="height:8px;"></div>`;
  }).join('');
  const filesHtml = fileGroups
    ? `${cardHeading('Files')}${fileGroups}<p style="margin:4px 0 0;font-size:11px;color:#a1a1aa;">File links work for 7 days. The admin always has fresh ones.</p>`
    : '';

  const html = renderEmailShell({
    icon: null,
    eyebrow: 'Custom Websites',
    title: resubmitted ? `${esc(who)} updated their form` : `${esc(who)} sent in their form`,
    intro: resubmitted
      ? 'They changed their answers or files after submitting. Here is everything as it stands now.'
      : 'Here is everything they sent. Reply to this email to answer them directly.',
    cta: { label: 'Open in admin', href: adminUrl },
    body: `${infoCard(details, 20)}${answers}${filesHtml ? infoCard(filesHtml, 0) : ''}`,
  });

  const answerLines = FORM_SECTIONS.flatMap((s) => {
    const rows = answeredFields(s, form);
    if (!rows.length) return [];
    return ['', s.title.toUpperCase(), ...rows.map((f) => {
      const v = answerText(f, form[f.id]);
      return v.includes('\n') ? `${f.label}:\n${v}` : `${f.label}: ${v}`;
    })];
  });
  const fileLines = assets.length
    ? ['', 'FILES (links work for 7 days)', ...assets.map((a) => `${ASSET_KINDS[a.kind]?.label || a.kind}: ${a.name}${a.url ? ` ${a.url}` : ''}${a.note ? ` ("${a.note}")` : ''}`)]
    : [];
  const text = [
    resubmitted ? `${who} updated their custom website form.` : `${who} sent in their custom website form.`,
    '',
    `Customer: ${form.contactName || project.client_name}`,
    `Email: ${email}`,
    phone ? `Phone: ${phone}` : null,
    `Files: ${counts.length ? counts.map(([l, n]) => `${l}: ${n}`).join(', ') : 'none yet'}`,
    missing.length ? `Still missing: ${missing.join(', ')}` : null,
    ...answerLines,
    ...fileLines,
    '',
    `Open in admin: ${adminUrl}`,
  ].filter((l) => l !== null).join('\n');
  const subject = resubmitted ? `Updated: ${who}'s custom website form` : `Custom website form received: ${who}`;
  return { subject, html, text };
}

function noteCard(note) {
  if (!note) return '';
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f5;border-left:3px solid #cc0000;border-radius:0 12px 12px 0;margin-bottom:16px;"><tr><td style="padding:14px 18px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#cc0000;letter-spacing:1px;text-transform:uppercase;">A note from our team</p>
      <p style="margin:0;font-size:14px;color:#3f3f46;line-height:1.6;">${esc(note).replace(/\n/g, '<br/>')}</p>
    </td></tr></table>`;
}

function tipList(heading, items) {
  const rows = items.map((item) =>
    `<tr><td width="18" valign="top" style="padding:3px 0;font-size:13px;color:#cc0000;font-weight:700;">&#10003;</td><td style="padding:3px 0;font-size:13px;color:#52525b;line-height:1.5;">${esc(item)}</td></tr>`).join('');
  return infoCard(`${cardHeading(heading)}<table width="100%" cellpadding="0" cellspacing="0">${rows}</table>`, 0);
}

const DRAFT_TIPS = [
  'Look at it on your phone too: most of your customers will.',
  'Say which section you mean and what to change.',
  'Screenshots with notes are perfect.',
  'Send all your notes in one reply so nothing gets missed.',
];

// "Your draft is ready": links to the draft; feedback comes back as a reply.
export function customSiteDraftEmail({ firstName: givenName, businessName, siteUrl, note }) {
  const first = String(givenName || '').trim();
  const whose = businessName ? `the ${esc(businessName)} website` : 'your new website';
  const html = renderEmailShell({
    icon: null,
    eyebrow: 'Custom Websites',
    title: first ? `Your draft is ready, ${esc(first)}!` : 'Your draft is ready!',
    intro: `Take a look at the first version of ${whose}. Tell us what you'd like changed: just reply to this email with your notes.`,
    cta: { label: 'View my draft', href: siteUrl },
    body: `${noteCard(note)}${tipList('Giving feedback', DRAFT_TIPS)}${linkFallback(siteUrl)}`,
  });
  const text = [
    first ? `Your draft is ready, ${first}!` : 'Your draft is ready!',
    '',
    `Take a look at the first version of ${businessName ? `the ${businessName} website` : 'your new website'}: ${siteUrl}`,
    'Tell us what you\'d like changed: just reply to this email with your notes.',
    ...(note ? ['', 'A note from our team:', note] : []),
    '',
    'Giving feedback:',
    ...DRAFT_TIPS.map((t) => `- ${t}`),
  ].join('\n');
  return { subject: businessName ? `Your ${businessName} website draft is ready` : 'Your website draft is ready', html, text };
}

const LIVE_TIPS = [
  'Add the link to your Google Business Profile.',
  'Put it in your Instagram and Facebook bios.',
  'Send it to a few regular customers.',
];

// "You're live": the site is launched.
export function customSiteLiveEmail({ firstName: givenName, businessName, siteUrl, note }) {
  const first = String(givenName || '').trim();
  const whose = businessName ? `The ${esc(businessName)} website` : 'Your new website';
  const html = renderEmailShell({
    icon: null,
    eyebrow: 'Custom Websites',
    title: first ? `You're live, ${esc(first)}!` : 'You\'re live!',
    intro: `${whose} is up and running. Thanks for building it with us.`,
    cta: { label: 'Visit my website', href: siteUrl },
    body: `${noteCard(note)}${tipList('Spread the word', LIVE_TIPS)}${linkFallback(siteUrl)}
      <p style="margin:12px 0 0;font-size:12px;color:#a1a1aa;text-align:center;">Need a change? Just reply to this email.</p>`,
  });
  const text = [
    first ? `You're live, ${first}!` : 'You\'re live!',
    '',
    `${businessName ? `The ${businessName} website` : 'Your new website'} is up and running: ${siteUrl}`,
    ...(note ? ['', 'A note from our team:', note] : []),
    '',
    'Spread the word:',
    ...LIVE_TIPS.map((t) => `- ${t}`),
    '',
    'Need a change? Just reply to this email.',
  ].join('\n');
  return { subject: businessName ? `The ${businessName} website is live!` : 'Your new website is live!', html, text };
}

const HANDOVER_TIPS = [
  'Bookings, customers and messages from your site now show up in your dashboard.',
  'Connect Stripe under Payments to take deposits and card payments.',
  'Need a change? Just reply to this email.',
];

// A free website goes to a free account: no bookings or payments to point at.
const FREE_HANDOVER_TIPS = [
  'Change your text, photos and colors any time, then press Publish.',
  'Messages from your site\'s contact form show up in your dashboard.',
  'Need a change? Just reply to this email.',
];

// Hand-over: the custom website now lives in the customer's own account.
// newAccount: the link sets their password (first sign-in); otherwise it
// opens the sign-in page.
// eyebrow / tips: a free website's hand-over (freeSiteHandover) shares this
// email with its own heading and free-plan tips.
export function customSiteHandoverEmail({ firstName: givenName, businessName, siteUrl, actionUrl, newAccount, email, eyebrow = 'Custom Websites', tips = HANDOVER_TIPS }) {
  const first = String(givenName || '').trim();
  const whose = businessName ? `the ${esc(businessName)} website` : 'your new website';
  const intro = newAccount
    ? `We've set up your account so you can manage ${whose}: bookings, customers and more. Set a password to sign in for the first time.`
    : `${businessName ? `The ${esc(businessName)} website` : 'Your new website'} is now in your account. Sign in to manage bookings, customers and more.`;
  const site = siteUrl
    ? `<p style="margin:0 0 16px;font-size:13px;color:#52525b;text-align:center;">Your site: <a href="${esc(siteUrl)}" style="color:#cc0000;text-decoration:none;font-weight:600;">${esc(siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a></p>`
    : '';
  const html = renderEmailShell({
    icon: null,
    eyebrow,
    title: first ? `It's all yours, ${esc(first)}!` : 'It\'s all yours!',
    intro,
    cta: { label: newAccount ? 'Set my password' : 'Sign in', href: actionUrl },
    body: `${site}${tipList('What you can do now', tips)}
      <p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;text-align:center;line-height:1.6;">Your sign-in email is <strong style="color:#52525b;">${esc(email)}</strong>.${newAccount ? ' If the button has expired, use "Forgot password" on the sign-in page.' : ''}</p>
      ${linkFallback(actionUrl)}`,
  });
  const text = [
    first ? `It's all yours, ${first}!` : 'It\'s all yours!',
    '',
    newAccount
      ? `We've set up your account so you can manage ${businessName ? `the ${businessName} website` : 'your new website'}. Set a password to sign in for the first time:`
      : `${businessName ? `The ${businessName} website` : 'Your new website'} is now in your account. Sign in:`,
    actionUrl,
    ...(siteUrl ? ['', `Your site: ${siteUrl}`] : []),
    '',
    'What you can do now:',
    ...tips.map((t) => `- ${t}`),
    '',
    `Your sign-in email is ${email}.${newAccount ? ' If the link has expired, use "Forgot password" on the sign-in page.' : ''}`,
  ].join('\n');
  return { subject: businessName ? `The ${businessName} website is in your account` : 'Your new website is in your account', html, text };
}

// Unlike the booking emails, a missing Postmark key is an error here: the
// admin pressed "send" and must see that nothing went out.
async function sendCustomSiteEmail(where, { to, replyTo, subject, html, text }) {
  if (!client) throw new Error('Email is not set up on this server (POSTMARK_API_KEY)');
  try {
    const res = await client.sendEmail({
      From: FROM,
      To: to,
      ReplyTo: replyTo,
      Subject: subject,
      HtmlBody: html,
      TextBody: text,
      MessageStream: 'outbound',
    });
    console.log(`[postmark:${where}] to=${to} messageId=${res?.MessageID}`);
    return res;
  } catch (err) {
    logPostmarkFailure(where, err);
    throw err;
  }
}

// replyTo: the admin who sent it, so the customer's answer reaches them.
export function customSiteWelcome({ to, replyTo, ...message }) {
  return sendCustomSiteEmail('customSiteWelcome', {
    to,
    replyTo: replyTo || CUSTOM_SITES_REPLY_TO,
    ...customSiteWelcomeEmail(message),
  });
}

export function customSiteReceivedToCustomer({ to, replyTo, ...message }) {
  return sendCustomSiteEmail('customSiteReceivedToCustomer', {
    to,
    replyTo: replyTo || CUSTOM_SITES_REPLY_TO,
    ...customSiteReceivedEmail(message),
  });
}

export function customSiteDraft({ to, replyTo, ...message }) {
  return sendCustomSiteEmail('customSiteDraft', {
    to,
    replyTo: replyTo || CUSTOM_SITES_REPLY_TO,
    ...customSiteDraftEmail(message),
  });
}

export function customSiteLive({ to, replyTo, ...message }) {
  return sendCustomSiteEmail('customSiteLive', {
    to,
    replyTo: replyTo || CUSTOM_SITES_REPLY_TO,
    ...customSiteLiveEmail(message),
  });
}

export function customSiteHandover({ to, replyTo, ...message }) {
  return sendCustomSiteEmail('customSiteHandover', {
    to,
    replyTo: replyTo || CUSTOM_SITES_REPLY_TO,
    ...customSiteHandoverEmail(message),
  });
}

// Admin > Free websites: the same access email for a site the team built
// with the normal builder. `pro`: the hand-over included Pro, so the
// bookings and payments tips apply.
export function freeSiteHandoverEmail({ pro, ...message }) {
  return customSiteHandoverEmail({ ...message, eyebrow: 'Genius Websites', tips: pro ? HANDOVER_TIPS : FREE_HANDOVER_TIPS });
}

export function freeSiteHandover({ to, replyTo, ...message }) {
  return sendCustomSiteEmail('freeSiteHandover', {
    to,
    replyTo: replyTo || CUSTOM_SITES_REPLY_TO,
    ...freeSiteHandoverEmail(message),
  });
}

// `to`: the team addresses (custom-site-form decides who); replying goes
// straight to the customer.
export function customSiteFormToAdmin({ to, project, form, assets, adminUrl, resubmitted }) {
  return sendCustomSiteEmail('customSiteFormToAdmin', {
    to,
    replyTo: form.contactEmail || project.client_email,
    ...customSiteFormToAdminEmail({ project, form, assets, adminUrl, resubmitted }),
  });
}

// Shared building blocks for other email builders (e.g. a site-upgrade
// announcement in its own module), so every email uses the same shell.
export { renderEmailShell, infoCard, cardHeading, linkFallback, noteCard, tipList };
