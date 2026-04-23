import { SignJWT, jwtVerify } from 'jose';

function getSecret() {
  const s = process.env.DOMAIN_CONNECT_STATE_SECRET;
  if (!s || s.length < 32) {
    throw new Error('DOMAIN_CONNECT_STATE_SECRET missing or too short');
  }
  return new TextEncoder().encode(s);
}

export async function signState(payload, expiresInSeconds = 600) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
    .sign(getSecret());
}

export async function verifyState(token) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch (err) {
    if (err.message && err.message.includes('exp')) {
      throw new Error('Token expired');
    }
    throw err;
  }
}
