import { describe, it, expect } from 'vitest';
import {
  contactPageUrl, extractEmail, extractOwnerName, extractSocials, fetchSocials, isPersonName, socialFromUrl, socialsFromWebsite,
} from './socialLinks.js';

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
    expect(r).toEqual({ socials: { tiktok: 'https://www.tiktok.com/@shiny' }, email: null, ownerName: null, ok: true });
  });

  it('does not fetch a website that is a social page', async () => {
    let called = false;
    const r = await fetchSocials({ fetchImpl: async () => { called = true; }, website: 'https://instagram.com/shiny' });
    expect(called).toBe(false);
    expect(r.socials).toEqual({ instagram: 'https://www.instagram.com/shiny' });
  });

  it('never throws: down, not HTML, or too slow is just not read', async () => {
    const nothing = { socials: {}, email: null, ownerName: null, ok: false };
    expect(await fetchSocials({ fetchImpl: async () => { throw new Error('ECONNRESET'); }, website: 'https://x.test' })).toEqual(nothing);
    expect(await fetchSocials({ fetchImpl: async () => ({ ok: false, status: 404 }), website: 'https://x.test' })).toEqual(nothing);
    expect((await fetchSocials({ fetchImpl: page('%PDF', 'application/pdf'), website: 'https://x.test' })).ok).toBe(false);
    expect((await fetchSocials({ fetchImpl: page(''), website: 'not a url' })).ok).toBe(false);
    const hang = (_u, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted'))));
    expect(await fetchSocials({ fetchImpl: hang, website: 'https://slow.test', timeoutMs: 20 })).toEqual({ socials: {}, email: null, ownerName: null, ok: false });
  });
});

describe('extractEmail', () => {
  it('prefers the site\'s own domain, then free mail, from mailto, JSON-LD and text', () => {
    const html = `<p>Write to shinywash@gmail.com</p><a href="mailto:Info@ShinyWash.com?subject=Quote">mail</a>
      <script type="application/ld+json">{"@type":"AutoWash","email":"sales@other.com"}</script>`;
    expect(extractEmail(html, 'www.shinywash.com')).toBe('info@shinywash.com');
    expect(extractEmail('<p>shinywash@gmail.com · sales@other.com</p>', 'shinywash.com')).toBe('shinywash@gmail.com');
    expect(extractEmail('<p>Reach us at info&#64;shiny.com</p>', 'shiny.com')).toBe('info@shiny.com');
  });

  it('skips robots, placeholders, builders and image names', () => {
    for (const e of ['noreply@shiny.com', 'no-reply@shiny.com', 'you@example.com', 'name@domain.com',
      '605a7baede844d278b89dc95ae0a9123@sentry-next.wixpress.com', 'user@wix.com']) {
      expect(extractEmail(`<p>${e}</p>`, 'shiny.com'), e).toBeNull();
    }
    expect(extractEmail('<img src="logo@2x.png">', 'shiny.com')).toBeNull();
    expect(extractEmail('', 'shiny.com')).toBeNull();
  });
});

describe('extractOwnerName', () => {
  it('reads JSON-LD people and "Owner:" / "Dueño:" in the text', () => {
    expect(extractOwnerName('<script type="application/ld+json">{"founder":{"@type":"Person","name":"Rick Alvarez"}}</script>')).toBe('Rick Alvarez');
    expect(extractOwnerName('<p>Owner: John Smith Call Today!</p>')).toBe('John Smith');
    expect(extractOwnerName('<p>owned by John Smith since 1990</p>')).toBe('John Smith');
    expect(extractOwnerName('<p>Dueño: José Rivera</p>')).toBe('José Rivera');
    expect(extractOwnerName('<p>Propietaria: María Del Carmen Rivera</p>')).toBe('María Del Carmen Rivera');
  });

  it('only stores a person', () => {
    expect(extractOwnerName('<p>Owned by Shiny Auto LLC</p>')).toBeNull();
    expect(extractOwnerName('<p>Family owned business since 1990</p>')).toBeNull();
    expect(extractOwnerName('<p>Meet the owner. Hi, I am Carlos</p>')).toBeNull();
    expect(isPersonName('Shiny Wash Team')).toBe(false);
    expect(isPersonName('Carlos')).toBe(false);
  });
});

describe('contact page', () => {
  it('finds a same-site contact or about link', () => {
    expect(contactPageUrl('<a href="/contact-us">Contact</a>', 'https://shiny.com/')).toBe('https://shiny.com/contact-us');
    expect(contactPageUrl('<a href="https://facebook.com/contact">x</a>', 'https://shiny.com/')).toBeNull();
    expect(contactPageUrl('<a href="/services">x</a>', 'https://shiny.com/')).toBeNull();
  });

  it('is read when the homepage leaves the email or owner unknown, and only then', async () => {
    const pages = {
      'https://shiny.com/': '<a href="/contacto">Contacto</a><a href="https://instagram.com/shiny">ig</a>',
      'https://shiny.com/contacto': '<p>Dueño: José Rivera · shiny@gmail.com</p>',
    };
    const asked = [];
    const fetchImpl = async (url) => {
      asked.push(url);
      return { ok: true, headers: { get: () => 'text/html' }, text: async () => pages[url] ?? '' };
    };
    const r = await fetchSocials({ fetchImpl, website: 'https://shiny.com/' });
    expect(r).toEqual({ socials: { instagram: 'https://www.instagram.com/shiny' }, email: 'shiny@gmail.com', ownerName: 'José Rivera', ok: true });
    expect(asked).toEqual(['https://shiny.com/', 'https://shiny.com/contacto']);

    asked.length = 0;
    pages['https://shiny.com/'] += '<p>Owner: Ana Diaz, ana@shiny.com</p>';
    await fetchSocials({ fetchImpl, website: 'https://shiny.com/' });
    expect(asked).toEqual(['https://shiny.com/']);
  });
});
