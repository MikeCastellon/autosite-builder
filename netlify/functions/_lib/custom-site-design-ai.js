import { COPY_SCHEMA, DESIGN_EFFORT, DESIGN_MODEL, parseCopyJson } from '../../../src/lib/customSiteDesign.js';

// One copy-writing request for a custom website, on DESIGN_MODEL (one tier
// above the free builder). `client` is an Anthropic SDK client, injected so
// tests can stand in for it.
//
// Asks for JSON matching COPY_SCHEMA (structured output) with the
// server-side refusal fallback. If the API rejects that request shape (400),
// it retries once as a plain request: the prompt itself asks for JSON.
export async function requestDesignCopy(client, prompt) {
  const base = {
    model: DESIGN_MODEL,
    max_tokens: 16000,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  };
  let message;
  try {
    message = await client.messages.create({
      ...base,
      output_config: { effort: DESIGN_EFFORT, format: { type: 'json_schema', schema: COPY_SCHEMA } },
      fallbacks: 'default',
    }, { headers: { 'anthropic-beta': 'server-side-fallback-2026-07-01' } });
  } catch (err) {
    if (err?.status !== 400) throw err;
    console.warn('[custom-site-design] structured request rejected, retrying plain:', err?.message);
    message = await client.messages.create({ ...base, output_config: { effort: DESIGN_EFFORT } });
  }
  if (message?.stop_reason === 'refusal') {
    throw Object.assign(new Error('Claude declined to write this site. Check the brief for anything unusual and try again.'), { code: 'refusal' });
  }
  if (message?.stop_reason === 'max_tokens') {
    throw Object.assign(new Error('The copy came out too long. Try again, or trim the services list.'), { code: 'max_tokens' });
  }
  return { raw: parseCopyJson(message?.content), model: message?.model || DESIGN_MODEL };
}
