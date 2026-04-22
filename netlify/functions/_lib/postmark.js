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

export async function statusUpdateToCustomer({ booking, site, status, reason }) {
  if (!client) { console.warn('Postmark not configured; skipping email'); return; }
  const b = booking;
  const name = site?.business_info?.businessName || 'the business';

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

  const html = `<h2>${m.heading}</h2><p>${m.body}</p>`;
  const text = `${m.heading}\n\n${m.body.replace(/<[^>]+>/g,'')}`;

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
