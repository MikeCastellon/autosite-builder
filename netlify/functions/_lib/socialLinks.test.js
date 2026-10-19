import { describe, it, expect } from 'vitest';
import { extractSocials, fetchSocials, socialFromUrl, socialsFromWebsite } from './socialLinks.js';

describe('socialFromUrl', () => {
  it('keeps a business page on each network, in one canonical form', () => {
    expect(socialFromUrl('http://m.facebook.com/ShinyCarWash/?ref=bookmarks')).toEqual({ network: 'facebook', url: 'https://www.facebook.com/ShinyCarWash' });
    expect(socialFromUrl('https://www.facebook.com/profile.php?id=100063&sk=about')).toEqual({ network: 'facebook', url: 'https://www.facebook.com/profile.php?id=100063' });
    expect(socialFromUrl('https://facebook.com/pages/Shiny-Wash/12345')?.url).toBe('https://www.facebook.com/pages/Shiny-Wash/12345');
    expect(socialFromUrl('https://instagram.com/shiny.wash/')?.url).toBe('https://www.instagram.com/shiny.wash');
    expect(socialFromUrl('https://www.tiktok.com/@shinywash?lang=en')?.url).toBe('https://www.tiktok.com/@shinywash');
    expect(socialFromUrl('https://youtube.com/@ShinyWash/videos')?.url).toBe('https://www.youtube.com/@ShinyWash');
    expect(socialFromUrl('https://www.youtube.com/channel/UC123abc')?.url).toBe('https://www.youtube.com/channel/UC123abc');
    expect(socialFromUrl('https://twitter.com/shinywash')).toEqual({ network: 'x', url: 'https://x.com/shinywash' });
    expect(socialFromUrl('https://www.linkedin.com/company/shiny-wash/about')?.url).toBe('https://www.linkedin.com/company/shiny-wash');
    expect(socialFromUrl('https://m.yelp.com/biz/shiny-wash-kissimmee?osq=car')?.url).toBe('https://www.yelp.com/biz/shiny-wash-kissimmee');
  });

  it('drops share buttons, pixels, single posts and builder placeholders', () => {
    for (const u of [
      'https://www.facebook.com/sharer/sharer.php?u=x', 'https://www.facebook.com/tr?id=1&ev=PageView',
      'https://www.facebook.com/', 'https://www.facebook.com/wix', 'https://instagram.com/p/Cabc123/',
      'https://twitter.com/intent/tweet?text=x', 'https://twitter.com/share', 'https://www.youtube.com/watch?v=abc',
      'https://youtu.be/abc', 'https://www.youtube.com/embed/abc', 'https://www.tiktok.com/embed.js',
      'https://www.linkedin.com/shareArticle?url=x', 'https://www.yelp.com/writeareview/biz/x',
      'https://example.com/facebook', 'mailto:hi@shiny.com', 'javascript:void(0)', '',
    ]) expect(socialFromUrl(u), u).toBeNull();
  });
});

describe('socialsFromWebsite', () => {
  it('takes a website that is itself a social page', () => {
    expect(socialsFromWebsite('https://www.facebook.com/ShinyCarWash')).toEqual({ facebook: 'https://www.facebook.com/ShinyCarWash' });
    expect(socialsFromWebsite('https://shinywash.com')).toEqual({});
  });
});

describe('extractSocials', () => {
  it('reads anchors and JSON-LD sameAs, first link per network wins', () => {
    const html = `
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"AutoWash",
        "sameAs":["https:\\/\\/www.instagram.com\\/shinywash","https://www.yelp.com/biz/shiny-wash"]}</script>
      <a href="https://www.facebook.com/sharer.php?u=x">Share</a>
      <a href='https://facebook.com/ShinyCarWash'>FB</a>
      <a href=https://twitter.com/shinywash>X</a>
      <a href="https://www.facebook.com/SomeoneElse">later</a>
      <a href="https://www.instagram.com/other">later</a>
      <script type="application/ld+json">{ broken</script>`;
    expect(extractSocials(html)).toEqual({
      facebook: 'https://www.facebook.com/ShinyCarWash',
      instagram: 'https://www.instagram.com/shinywash',
      yelp: 'https://www.yelp.com/biz/shiny-wash',
      x: 'https://x.com/shinywash',
    });
  });
});

describe('fetchSocials', () => {
  const page = (html, type = 'text/html') => async () => ({
    ok: true, headers: { get: () => type }, text: async () => html,
  });

  it('reads the homepage', async () => {
    const r = await fetchSocials({ fetchImpl: page('<a href="https://www.tiktok.com/@shiny">t</a>'), website: 'https://shiny.com' });
    expect(r).toEqual({ socials: { tiktok: 'https://www.tiktok.com/@shiny' }, ok: true });
  });

  it('does not fetch a website that is a social page', async () => {
    let called = false;
    const r = await fetchSocials({ fetchImpl: async () => { called = true; }, website: 'https://instagram.com/shiny' });
    expect(called).toBe(false);
    expect(r.socials).toEqual({ instagram: 'https://www.instagram.com/shiny' });
  });

  it('never throws: down, not HTML, or too slow is just not read', async () => {
    expect(await fetchSocials({ fetchImpl: async () => { throw new Error('ECONNRESET'); }, website: 'https://x.test' })).toEqual({ socials: {}, ok: false });
    expect(await fetchSocials({ fetchImpl: async () => ({ ok: false, status: 404 }), website: 'https://x.test' })).toEqual({ socials: {}, ok: false });
    expect((await fetchSocials({ fetchImpl: page('%PDF', 'application/pdf'), website: 'https://x.test' })).ok).toBe(false);
    expect((await fetchSocials({ fetchImpl: page(''), website: 'not a url' })).ok).toBe(false);
    const hang = (_u, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted'))));
    expect(await fetchSocials({ fetchImpl: hang, website: 'https://slow.test', timeoutMs: 20 })).toEqual({ socials: {}, ok: false });
  });
});
