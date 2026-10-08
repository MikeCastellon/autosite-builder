import { COPY_SCHEMA, DESIGN_EFFORT, DESIGN_MODEL, parseCopyJson } from '../../../src/lib/customSiteDesign.js';

// The user turn: the prompt's text, then any photos it attaches (the Detail
// Showcase's, for Claude to title), each after its label ("Showcase photo
// 1"), the way the text names them. Inline base64: the run fetched them
// itself, so a photo that wouldn't load was simply left out.
function userContent(prompt) {
  const photos = Array.isArray(prompt.images) ? prompt.images : [];
  if (!photos.length) return prompt.user;
  return [
    { type: 'text', text: prompt.user },
    ...photos.flatMap((p) => [
      { type: 'text', text: `Showcase photo ${p.number}:` },
      { type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.data } },
    ]),
  ];
}

// One copy-writing request for a custom website, on DESIGN_MODEL (one tier
// above the free builder). `client` is an Anthropic SDK client, injected so
// tests can stand in for it.
//
// Asks for JSON matching the prompt's schema (COPY_SCHEMA, plus the fields
// of any More sections: customSiteDesign.js designCopySchema) as structured
// output, with the server-side refusal fallback. If the API rejects that
// request shape (400), it retries once as a plain request: the prompt itself
// asks for JSON.
export async function requestDesignCopy(client, prompt) {
  const base = {
    model: DESIGN_MODEL,
    // More sections add a few thousand tokens of answer: room for them, still
    // well inside the client's 6-minute timeout per attempt.
    max_tokens: Array.isArray(prompt.fields) && prompt.fields.length ? 20000 : 16000,
    system: prompt.system,
    messages: [{ role: 'user', content: userContent(prompt) }],
  };
  let message;
  try {
    message = await client.messages.create({
      ...base,
      output_config: { effort: DESIGN_EFFORT, format: { type: 'json_schema', schema: prompt.schema || COPY_SCHEMA } },
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
