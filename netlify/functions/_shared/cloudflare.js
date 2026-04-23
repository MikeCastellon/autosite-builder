const CF_BASE = 'https://api.cloudflare.com/client/v4';

function env() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN missing');
  if (!zone) throw new Error('CLOUDFLARE_ZONE_ID missing');
  return { token, zone };
}

async function cfFetch(path, options = {}) {
  const { token } = env();
  const res = await fetch(`${CF_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const codes = body.errors?.map((e) => e.code) || [];
    const msgs = body.errors?.map((e) => e.message).join('; ') || `CF ${res.status}`;
    let friendly = msgs;
    if (codes.includes(10000) || msgs.toLowerCase() === 'authentication error') {
      friendly = 'Cloudflare API token is missing the "SSL and Certificates → Edit" permission. Update it in Cloudflare → My Profile → API Tokens.';
    }
    console.error('[cloudflare] API error:', { status: res.status, codes, msgs, path });
    const err = new Error(friendly);
    err.status = res.status || 500;
    err.cfBody = body;
    err.cfCodes = codes;
    throw err;
  }
  return body.result;
}

export async function createCustomHostname(hostname) {
  const { zone } = env();
  return await cfFetch(`/zones/${zone}/custom_hostnames`, {
    method: 'POST',
    body: JSON.stringify({
      hostname,
      ssl: { method: 'http', type: 'dv' },
    }),
  });
}

export async function getCustomHostname(id) {
  const { zone } = env();
  return await cfFetch(`/zones/${zone}/custom_hostnames/${id}`);
}

export async function deleteCustomHostname(id) {
  const { zone } = env();
  try {
    await cfFetch(`/zones/${zone}/custom_hostnames/${id}`, { method: 'DELETE' });
    return true;
  } catch (err) {
    if (err.status === 404) return true; // already gone
    throw err;
  }
}

export async function listCustomHostnames({ hostname } = {}) {
  const { zone } = env();
  const qs = hostname ? `?hostname=${encodeURIComponent(hostname)}` : '';
  return await cfFetch(`/zones/${zone}/custom_hostnames${qs}`);
}
