import { ServerClient } from 'postmark';

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

function formatWhen(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: 'numeric', minute: '2-digit',
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
function renderEmailShell({ icon = '✉', eyebrow = 'Genius Websites', title, intro, cta, body }) {
  const ctaHtml = cta
    ? `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:28px;">
         <a href="${esc(cta.href)}" style="display:inline-block;background:linear-gradient(135deg,#cc0000,#8a0000);color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:14px 36px;border-radius:12px;letter-spacing:0.01em;">${esc(cta.label)}</a>
       </td></tr></table>`
    : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:40px 16px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
  <tr><td align="center" style="padding-bottom:32px;">
    <img src="https://www.autocaregenius.com/cdn/shop/files/v11_1.svg?v=1760731533&width=200" alt="Auto Care Genius" width="160" style="display:block;margin:0 auto 12px;height:auto;" />
    <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#a1a1aa;">${esc(eyebrow)}</p>
  </td></tr>
  <tr><td style="background:#ffffff;border-radius:20px;border:1px solid #e4e4e7;padding:40px 36px;box-shadow:0 1px 3px rgba(0,0,0,0.04),0 8px 32px rgba(0,0,0,0.04);">
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:24px;">
      <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#cc0000,#8a0000);display:inline-block;margin:0 auto;text-align:center;line-height:52px;font-size:24px;color:#ffffff;">${icon}</div>
    </td></tr></table>
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

export async function newBookingToOwner({ booking, site, ownerEmail }) {
  if (!client) { console.warn('Postmark not configured; skipping email'); return; }
  const b = booking;
  const name = site?.business_info?.businessName || 'your site';
  const dashLink = `${APP_URL}/?bookings=${encodeURIComponent(b.id)}`;

  const vehicleLine = [b.vehicle_year, b.vehicle_make, b.vehicle_model].filter(Boolean).join(' ');
  const detailCard = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #f4f4f5;border-radius:12px;padding:16px 18px;margin-bottom:8px;"><tr><td>
      <p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Customer:</strong> ${esc(b.customer_name)}</p>
      <p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Email:</strong> <a href="mailto:${esc(b.customer_email)}" style="color:#cc0000;text-decoration:none;">${esc(b.customer_email)}</a></p>
      <p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Phone:</strong> <a href="tel:${esc(b.customer_phone)}" style="color:#cc0000;text-decoration:none;">${esc(b.customer_phone)}</a></p>
      ${vehicleLine ? `<p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Vehicle:</strong> ${esc(vehicleLine)}${b.vehicle_size ? ' (' + esc(b.vehicle_size) + ')' : ''}</p>` : ''}
      ${b.service_address ? `<p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Service address:</strong> ${esc(b.service_address)}</p>` : ''}
      ${b.notes ? `<p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Notes:</strong> ${esc(b.notes)}</p>` : ''}
      ${b.referral_source ? `<p style="margin:0;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Heard via:</strong> ${esc(b.referral_source)}</p>` : ''}
    </td></tr></table>`;
  const html = renderEmailShell({
    icon: '📅',
    title: `${esc(b.customer_name)} wants to book`,
    intro: `Preferred time: <strong style="color:#18181b;">${esc(formatWhen(b.preferred_at))}</strong>`,
    cta: { label: 'Open in your dashboard', href: dashLink },
    body: detailCard,
  });
  const text = `New booking request for ${name}\n\n${b.customer_name} (${b.customer_email}, ${b.customer_phone}) wants to book for ${formatWhen(b.preferred_at)}.\nVehicle: ${b.vehicle_year} ${b.vehicle_make} ${b.vehicle_model} (${b.vehicle_size})\n${b.service_address ? 'Service address: ' + b.service_address + '\n' : ''}${b.notes ? 'Notes: ' + b.notes + '\n' : ''}Open: ${dashLink}`;

  try {
    const res = await client.sendEmail({
      From: FROM,
      To: ownerEmail,
      Subject: `New booking request from ${b.customer_name} — ${formatWhen(b.preferred_at)}`,
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
export async function bookingReceivedToCustomer({ booking, site, isSimple }) {
  if (!client) { console.warn('Postmark not configured; skipping email'); return; }
  const b = booking;
  const name = site?.business_info?.businessName || 'the business';
  const bizBlockHtml = businessInfoHtmlBlock(site);
  const bizBlockText = businessInfoTextBlock(site);
  const vehicleLine = [b.vehicle_year, b.vehicle_make, b.vehicle_model].filter(Boolean).join(' ');

  const timeLine = isSimple
    ? 'We\'ll reach out shortly to confirm a time that works for you.'
    : `You requested <strong>${esc(formatWhen(b.preferred_at))}</strong>. We'll confirm availability shortly.`;

  const detailCard = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #f4f4f5;border-radius:12px;padding:16px 18px;margin-bottom:8px;"><tr><td>
      ${b.service_name ? `<p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Service:</strong> ${esc(b.service_name)}</p>` : ''}
      ${vehicleLine ? `<p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Vehicle:</strong> ${esc(vehicleLine)}${b.vehicle_size ? ' (' + esc(b.vehicle_size) + ')' : ''}</p>` : ''}
      ${b.service_address ? `<p style="margin:0 0 4px;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Service address:</strong> ${esc(b.service_address)}</p>` : ''}
      ${b.notes ? `<p style="margin:0;font-size:13px;color:#52525b;"><strong style="color:#a1a1aa;font-weight:600;">Notes:</strong> ${esc(b.notes).replace(/\n/g, '<br/>')}</p>` : ''}
    </td></tr></table>
    ${bizBlockHtml}
    <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa;text-align:center;">If you need to change anything, just reply to this email.</p>`;
  const html = renderEmailShell({
    icon: '✓',
    title: `Thanks for your request, ${esc(b.customer_name)}!`,
    intro: timeLine,
    body: detailCard,
  });
  const text =
    `Request received — ${name}\n\n` +
    `Thanks for your request, ${b.customer_name}!\n\n` +
    (isSimple
      ? `We'll reach out shortly to confirm a time that works for you.\n`
      : `You requested ${formatWhen(b.preferred_at)}. We'll confirm availability shortly.\n`) +
    (b.service_name ? `\nService: ${b.service_name}` : '') +
    (vehicleLine ? `\nVehicle: ${vehicleLine}${b.vehicle_size ? ' (' + b.vehicle_size + ')' : ''}` : '') +
    (b.service_address ? `\nService address: ${b.service_address}` : '') +
    (b.notes ? `\nNotes: ${b.notes}` : '') +
    bizBlockText +
    `\n\nIf you need to change anything, just reply to this email.`;

  try {
    const res = await client.sendEmail({
      From: FROM,
      To: b.customer_email,
      Subject: `We got your request — ${name}`,
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

export async function statusUpdateToCustomer({ booking, site, status, reason }) {
  if (!client) { console.warn('Postmark not configured; skipping email'); return; }
  const b = booking;
  const name = site?.business_info?.businessName || 'the business';
  const bizBlockHtml = businessInfoHtmlBlock(site);
  const bizBlockText = businessInfoTextBlock(site);

  const map = {
    confirmed: {
      subject: `Your booking is confirmed — ${name}`,
      heading: `You're confirmed for ${formatWhen(b.preferred_at)}`,
      body: `Thanks ${esc(b.customer_name)} — we'll see you then. Reply to this email if you need to change anything.`,
    },
    declined: {
      subject: `Your booking request — ${name}`,
      heading: `We couldn't confirm that time`,
      body: `Sorry ${esc(b.customer_name)} — we can't make ${esc(formatWhen(b.preferred_at))} work.${reason ? ' Reason: ' + esc(reason) : ''} Feel free to submit another request.`,
    },
    cancelled: {
      subject: `Your booking was cancelled — ${name}`,
      heading: `Your booking was cancelled`,
      body: `Your booking for ${esc(formatWhen(b.preferred_at))} has been cancelled.`,
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
  const text = `${m.heading}\n\n${m.body.replace(/<[^>]+>/g,'')}${bizBlockText}`;

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
