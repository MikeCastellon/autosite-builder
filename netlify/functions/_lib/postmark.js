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
  if (biz.businessName) rows.push(`<p style="margin:0 0 6px;font-weight:700;font-size:15px;color:#1a1a1a;">${esc(biz.businessName)}</p>`);
  if (fullAddress) rows.push(`<p style="margin:0 0 4px;font-size:13px;color:#555;"><strong style="color:#999;font-weight:600;">Address:</strong> ${esc(fullAddress)}</p>`);
  if (biz.phone) rows.push(`<p style="margin:0 0 4px;font-size:13px;color:#555;"><strong style="color:#999;font-weight:600;">Phone:</strong> <a href="tel:${esc(biz.phone)}" style="color:#cc0000;text-decoration:none;font-weight:600;">${esc(biz.phone)}</a></p>`);
  if (biz.email) rows.push(`<p style="margin:0 0 4px;font-size:13px;color:#555;"><strong style="color:#999;font-weight:600;">Email:</strong> <a href="mailto:${esc(biz.email)}" style="color:#cc0000;text-decoration:none;">${esc(biz.email)}</a></p>`);
  if (hoursText) rows.push(`<p style="margin:0 0 4px;font-size:13px;color:#555;"><strong style="color:#999;font-weight:600;">Hours:</strong> ${esc(hoursText)}</p>`);
  if (publishedUrl) rows.push(`<p style="margin:6px 0 0;font-size:12px;"><a href="${esc(publishedUrl)}" style="color:#cc0000;text-decoration:none;font-weight:600;">Visit our site →</a></p>`);

  if (rows.length === 0) return '';
  return `<div style="margin-top:24px;padding:16px 18px;background:#faf9f7;border:1px solid #eee;border-radius:10px;">${rows.join('')}</div>`;
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

  const html = `
    <h2>New booking request for ${esc(name)}</h2>
    <p><strong>${esc(b.customer_name)}</strong> (${esc(b.customer_email)}, ${esc(b.customer_phone)}) wants to book for <strong>${esc(formatWhen(b.preferred_at))}</strong>.</p>
    <p><strong>Vehicle:</strong> ${esc(b.vehicle_year)} ${esc(b.vehicle_make)} ${esc(b.vehicle_model)} (${esc(b.vehicle_size)})</p>
    ${b.service_address ? `<p><strong>Service address:</strong> ${esc(b.service_address)}</p>` : ''}
    ${b.notes ? `<p><strong>Notes:</strong> ${esc(b.notes)}</p>` : ''}
    ${b.referral_source ? `<p><strong>Heard about us via:</strong> ${esc(b.referral_source)}</p>` : ''}
    <p><a href="${dashLink}">Open in your dashboard →</a></p>
  `;
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

  const html = `
    <div style="font-family:Inter,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#cc0000;font-weight:700;">Request received</p>
      <h2 style="margin:0 0 12px;font-size:22px;color:#1a1a1a;font-weight:800;">Thanks for your request, ${esc(b.customer_name)}!</h2>
      <p style="margin:0 0 18px;font-size:14px;color:#555;line-height:1.6;">${timeLine}</p>
      <div style="padding:16px 18px;border:1px solid #eee;border-radius:10px;">
        ${b.service_name ? `<p style="margin:0 0 4px;font-size:13px;color:#555;"><strong style="color:#999;font-weight:600;">Service:</strong> ${esc(b.service_name)}</p>` : ''}
        ${vehicleLine ? `<p style="margin:0 0 4px;font-size:13px;color:#555;"><strong style="color:#999;font-weight:600;">Vehicle:</strong> ${esc(vehicleLine)}${b.vehicle_size ? ' (' + esc(b.vehicle_size) + ')' : ''}</p>` : ''}
        ${b.service_address ? `<p style="margin:0 0 4px;font-size:13px;color:#555;"><strong style="color:#999;font-weight:600;">Service address:</strong> ${esc(b.service_address)}</p>` : ''}
        ${b.notes ? `<p style="margin:0 0 4px;font-size:13px;color:#555;"><strong style="color:#999;font-weight:600;">Notes:</strong> ${esc(b.notes).replace(/\n/g, '<br/>')}</p>` : ''}
      </div>
      ${bizBlockHtml}
      <p style="margin:20px 0 0;font-size:12px;color:#999;">If you need to change anything, just reply to this email.</p>
    </div>
  `;
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

  const html = `
    <div style="font-family:Inter,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 12px;font-size:22px;color:#1a1a1a;font-weight:800;">${m.heading}</h2>
      <p style="margin:0 0 12px;font-size:14px;color:#555;line-height:1.6;">${m.body}</p>
      ${bizBlockHtml}
    </div>
  `;
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
