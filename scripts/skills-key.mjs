// The owner's ANTHROPIC_API_KEY for skills:release / skills:smoke, as pasted
// into a terminal. A paste can carry invisible extras: terminals that keep
// "bracketed paste" on wrap it in ESC[200~ ... ESC[201~ even inside `read -s`,
// and a copy from a web page can add spaces or zero-width characters. Any of
// them makes the key an invalid HTTP header, which fetch reports only as
// "Connection error." (every 2026-10-06 kit upload failed that way). So the
// scripts clean the key first and refuse one that still isn't plain text,
// without ever printing it.

// ESC[200~ / ESC[201~ (bracketed paste), and any other CSI escape sequence.
const ESCAPES = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
// Invisible characters a web copy can add: zero-width spaces and joiners,
// the BOM, non-breaking spaces.
const INVISIBLE = /[\u00a0\u200b-\u200d\u2060\ufeff]/g;
// A whole `ANTHROPIC_API_KEY=...` line pasted instead of the value.
const ASSIGNMENT = /^(?:export\s+)?ANTHROPIC_API_KEY\s*=\s*/;

// { key, problem }: key is the cleaned key ('' when missing or unusable),
// problem says what is wrong in words that never include the key.
export function apiKeyFrom(env) {
  const raw = typeof env?.ANTHROPIC_API_KEY === 'string' ? env.ANTHROPIC_API_KEY : '';
  let key = raw.replace(ESCAPES, '').replace(INVISIBLE, '').trim();
  key = key.replace(ASSIGNMENT, '').replace(/^(['"])(.*)\1$/, '$2').trim();
  if (!key) return { key: '', problem: 'ANTHROPIC_API_KEY is not set in the environment.' };
  // Printable ASCII with no spaces is all a key can be; anything else would
  // fail as an invalid header and look like a network problem.
  if (/[^\x21-\x7e]/.test(key)) {
    return { key: '', problem: 'ANTHROPIC_API_KEY has spaces or hidden characters in it (often from the paste). Copy the key again as plain text and paste it once.' };
  }
  return { key, problem: '' };
}

// An error message with the key taken out, in case a library quoted it
// (fetch's "invalid header value" errors do).
export function redactKey(text, env) {
  let s = String(text ?? '');
  const raw = typeof env?.ANTHROPIC_API_KEY === 'string' ? env.ANTHROPIC_API_KEY : '';
  const { key } = apiKeyFrom(env);
  for (const secret of [raw, raw.trim(), key]) {
    if (secret && secret.length >= 8) s = s.split(secret).join('[key]');
  }
  // Anything still shaped like an Anthropic key.
  return s.replace(/sk-ant-[A-Za-z0-9_-]{8,}/g, '[key]');
}

// The low-level reason under an SDK "Connection error." (ENOTFOUND,
// ECONNREFUSED, a proxy, a certificate), as codes only: messages deeper in
// the chain can quote the request headers.
export function connectionCause(err) {
  const codes = [];
  let c = err?.cause;
  for (let depth = 0; c && depth < 4; depth += 1, c = c.cause) {
    if (typeof c.code === 'string' && c.code && !codes.includes(c.code)) codes.push(c.code);
  }
  return codes.join(' / ');
}
