const POSTMARK_URL = 'https://api.postmarkapp.com/email';

export async function sendPostmarkEmail({ to, subject, htmlBody, textBody }) {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  const from = process.env.POSTMARK_FROM_EMAIL;
  if (!token || !from) throw new Error('Postmark env not configured');

  const res = await fetch(POSTMARK_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': token,
    },
    body: JSON.stringify({
      From: from,
      To: to,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: textBody,
      MessageStream: 'outbound',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Postmark ${res.status}: ${err.Message || 'unknown'}`);
  }
  return res.json();
}
