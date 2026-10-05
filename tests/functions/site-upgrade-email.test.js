// tests/functions/site-upgrade-email.test.js
//
// The "your website just got an upgrade" email (_lib/siteUpgradeEmail.js):
// both formats, escaping, the greeting, and the send itself against an
// in-memory Postmark (fetch is stubbed in every test, so nothing can reach
// the real one).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fakePostmark, POSTMARK_EMAIL_URL } from './r2Fakes.js';

const {
  siteUpgradeEmail, sendSiteUpgradeEmail, ownerFirstName, greetingName, upgradeEmailConfig, upgradeEmailConfigProblem,
  upgradeEmailStreamInfo, UPGRADE_EMAIL_SUBJECT, UPGRADE_EMAIL_SUBJECT_PLURAL, UPGRADE_CHANGES, UPGRADE_BOOKING_CHANGE,
  UPGRADE_CARRIED_OVER, TEST_EMAIL_STREAM,
} = await import('../../netlify/functions/_lib/siteUpgradeEmail.js');

const SITE = 'https://top-choice.autocaregeniushub.com';
const EDITOR = 'https://sitebuilder.autocaregenius.com';
const ENV_KEYS = ['POSTMARK_API_KEY', 'POSTMARK_SERVER_TOKEN', 'POSTMARK_FROM_EMAIL', 'POSTMARK_UPGRADE_STREAM', 'UPGRADE_EMAIL_REPLY_TO'];

// The HTML's visible text, for "the plain text says the same".
const htmlText = (html) => html
  .replace(/<head[\s\S]*?<\/head>/i, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#39;/g, '\'').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ');

let pm;
let saved;
beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  pm = fakePostmark();
  vi.stubGlobal('fetch', vi.fn((url, init) => pm.handle(String(url), init)));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('siteUpgradeEmail', () => {
  it('builds the subject, the HTML and a plain text that says the same', () => {
    const m = siteUpgradeEmail({ firstName: 'Mike', businessName: 'Top Choice', siteUrl: SITE, editorUrl: EDITOR });
    expect(m.subject).toBe(UPGRADE_EMAIL_SUBJECT);
    expect(m.subject).toBe('Your website just got an upgrade');

    expect(m.text).toBe([
      'Hi Mike, your website just got an upgrade',
      '',
      `The Top Choice website at ${SITE} is now on our new design. Your photos, services, prices and contact details carried over. It's already live, so there's nothing you need to do.`,
      '',
      'What\'s new:',
      '- It looks great on phones, with an easy menu and Call and Book buttons.',
      '- Your colors and fonts carry through the whole page.',
      '- Cleaner layouts and sharper type.',
      '',
      'Want to change something?',
      `To change your photos, colors or text, sign in at ${EDITOR}, click Edit on your site, then Publish.`,
      '',
      'Questions? Just reply to this email.',
    ].join('\n'));
    expect(m.text).not.toContain(UPGRADE_BOOKING_CHANGE);
    // No speed claim: nothing measured it.
    expect(m.text).not.toMatch(/fast|quick|speed/i);

    // Every sentence of the plain text is in the HTML too.
    const visible = htmlText(m.html);
    for (const line of [
      'Hi Mike, your website just got an upgrade',
      'The Top Choice website at top-choice.autocaregeniushub.com is now on our new design.',
      UPGRADE_CARRIED_OVER,
      'It\'s already live, so there\'s nothing you need to do.',
      'What\'s new', ...UPGRADE_CHANGES,
      'Want to change something?', 'To change your photos, colors or text, sign in , click Edit on your site, then Publish.',
      'Questions? Just reply to this email.',
    ]) expect(visible).toContain(line);
    expect(m.html).toContain(`href="${SITE}"`);
    expect(m.html).toContain(`href="${EDITOR}"`);
    expect(m.html).toContain('See my website');
    // The shared shell.
    expect(m.html).toMatch(/^<!DOCTYPE html>/);
    expect(m.html).toContain('Auto Care Genius');
  });

  it('is true however the site got the new design (no "we refreshed")', () => {
    const m = siteUpgradeEmail({ businessName: 'Top Choice', siteUrl: SITE });
    expect(m.text).not.toMatch(/refresh/i);
    expect(m.html).not.toMatch(/refresh/i);
  });

  it('never writes "the The"', () => {
    const m = siteUpgradeEmail({ businessName: 'The Garage Shop', siteUrl: SITE });
    expect(m.text).toContain(`The Garage Shop website at ${SITE} is now on our new design.`);
    expect(m.text).not.toMatch(/the the/i);
    expect(htmlText(m.html)).toContain('The Garage Shop website at top-choice.autocaregeniushub.com');
    expect(htmlText(m.html)).not.toMatch(/the the/i);
  });

  it('adds the booking line only for a site that takes bookings', () => {
    const m = siteUpgradeEmail({ businessName: 'Top Choice', siteUrl: SITE, booking: true });
    expect(m.text).toContain(`- ${UPGRADE_BOOKING_CHANGE}`);
    expect(htmlText(m.html)).toContain(UPGRADE_BOOKING_CHANGE);
  });

  it('reads well without a name or a business name', () => {
    const m = siteUpgradeEmail({ siteUrl: SITE });
    expect(m.text.split('\n')[0]).toBe('Your website just got an upgrade');
    expect(m.text).toContain(`Your website at ${SITE} is now on our new design.`);
    expect(htmlText(m.html)).toContain('Your website at top-choice.autocaregeniushub.com is now on our new design.');
    // The editor link defaults to the production app.
    expect(m.text).toContain(`sign in at ${EDITOR},`);
  });

  it('names all of an owner\'s upgraded sites up front, in the plural', () => {
    const m = siteUpgradeEmail({
      firstName: 'Mike', businessName: 'Top Choice', siteUrl: SITE,
      otherSites: [
        { businessName: 'Top Choice Tint', siteUrl: 'https://www.topchoicetint.com' },
        { businessName: 'Dropped', siteUrl: 'javascript:alert(1)' },
      ],
    });
    expect(m.subject).toBe(UPGRADE_EMAIL_SUBJECT_PLURAL);
    const lines = m.text.split('\n');
    expect(lines[0]).toBe('Hi Mike, your websites just got an upgrade');
    expect(lines[2]).toBe(`Your websites are now on our new design. ${UPGRADE_CARRIED_OVER} They're already live, so there's nothing you need to do.`);
    // The list comes before What's new.
    expect(m.text).toContain(`Your websites:\n- Top Choice: ${SITE}\n- Top Choice Tint: https://www.topchoicetint.com\n\nWhat's new:`);
    expect(m.text).not.toContain('Dropped');
    const visible = htmlText(m.html);
    expect(visible.indexOf('Your websites Top Choice')).toBeGreaterThan(-1);
    expect(visible.indexOf('Your websites Top Choice')).toBeLessThan(visible.indexOf('What\'s new'));
    expect(m.html).toContain('href="https://www.topchoicetint.com"');
    expect(m.html).not.toContain('javascript:');
  });

  it('escapes every value it puts in the HTML', () => {
    const m = siteUpgradeEmail({
      firstName: 'Mike',
      businessName: '<script>alert(1)</script> & "Sons" O\'Neil',
      siteUrl: 'https://x.autocaregeniushub.com/?a=1&b=2',
      otherSites: [
        { businessName: '<img src=x onerror=alert(2)>', siteUrl: 'https://y.autocaregeniushub.com/?q=1&r=2' },
        { businessName: 'Markup in the address', siteUrl: 'https://z.autocaregeniushub.com/?b=<2>' },
      ],
    });
    expect(m.html).not.toContain('<script>alert(1)');
    expect(m.html).not.toContain('<img src=x');
    expect(m.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Sons&quot; O&#39;Neil');
    expect(m.html).toContain('&lt;img src=x onerror=alert(2)&gt;');
    expect(m.html).toContain('href="https://x.autocaregeniushub.com/?a=1&amp;b=2"');
    expect(m.html).toContain('href="https://y.autocaregeniushub.com/?q=1&amp;r=2"');
    // An address with markup in it is never linked.
    expect(m.html).not.toContain('Markup in the address');
    expect(m.html).not.toContain('b=<2>');
  });

  it('refuses a missing or non-http site address', () => {
    expect(() => siteUpgradeEmail({ businessName: 'X' })).toThrow(/address/);
    expect(() => siteUpgradeEmail({ siteUrl: 'javascript:alert(1)' })).toThrow(/address/);
    expect(() => siteUpgradeEmail({ siteUrl: 'https://x.com/" onmouseover="alert(1)' })).toThrow(/address/);
  });

  it('keeps owner text on one line in the plain text', () => {
    const m = siteUpgradeEmail({ businessName: 'Top\nChoice\r\nBcc: x@y.com', siteUrl: SITE });
    expect(m.text).toContain('The Top Choice Bcc: x@y.com website');
    expect(m.text.split('\n').filter((l) => l.startsWith('Bcc'))).toEqual([]);
  });

  it.each([
    ['a business name saved as the first name', 'Vivid Detailing', 'Vivid Detailing & Customs'],
    ['a business name saved as the full name', 'Malpica Detailing', 'Malpica Detailing'],
    ['the same word in another case', 'flow', 'Flow Auto Detail'],
  ])('does not greet the owner with %s', (_, firstName, businessName) => {
    const m = siteUpgradeEmail({ firstName, businessName, siteUrl: SITE });
    expect(m.text.split('\n')[0]).toBe('Your website just got an upgrade');
  });

  it('still greets an owner whose business carries their name', () => {
    expect(siteUpgradeEmail({ firstName: 'Eddie', businessName: 'Eddie\'s Detailing', siteUrl: SITE }).text.split('\n')[0])
      .toBe('Hi Eddie, your website just got an upgrade');
    expect(siteUpgradeEmail({ firstName: 'Eddie', businessName: 'Fast Eddie\'s', siteUrl: SITE }).text.split('\n')[0])
      .toBe('Hi Eddie, your website just got an upgrade');
    expect(siteUpgradeEmail({ firstName: 'walter', businessName: 'Walts Mobile Detailing', siteUrl: SITE }).text.split('\n')[0])
      .toBe('Hi Walter, your website just got an upgrade');
  });
});

describe('ownerFirstName', () => {
  it.each([
    [['Mike'], 'Mike'],
    [['mike'], 'Mike'],
    [['MIKE'], 'Mike'],
    [['McKenzie'], 'McKenzie'],
    [['Mike Castellon'], 'Mike'],
    [['  José  '], 'José'],
    [[null, '', 'jane'], 'Jane'],
    [['mike@shop.com', 'Jane'], 'Jane'],
    [['<b>Mike</b>'], ''],
    [['1234'], ''],
    [['x'.repeat(40)], ''],
    [[undefined], ''],
  ])('%j → %j', (candidates, want) => {
    expect(ownerFirstName(...candidates)).toBe(want);
  });

  it('never greets with markup', () => {
    const m = siteUpgradeEmail({ firstName: '<script>x</script>', siteUrl: SITE });
    expect(m.html).not.toContain('<script>x');
    expect(m.text.split('\n')[0]).toBe('Your website just got an upgrade');
  });
});

describe('greetingName', () => {
  it('passes over a candidate that is the first word of one of the owner\'s business names', () => {
    expect(greetingName(['Vivid Detailing', 'Maria Lopez'], ['Vivid Detailing & Customs'])).toBe('Maria');
    expect(greetingName([null, '', 'Malpica Detailing'], ['Malpica Detailing'])).toBe('');
    expect(greetingName(['Mike'], ['Top Choice', 'Mike Tint'])).toBe('');
    expect(greetingName(['Mike'], ['Mike\'s Mobile Detailing'])).toBe('Mike');
    expect(greetingName(['Mike'], [])).toBe('Mike');
    expect(greetingName([], ['Top Choice'])).toBe('');
  });
});

describe('upgradeEmailConfig', () => {
  beforeEach(() => {
    process.env.POSTMARK_API_KEY = 'pm-test-token';
    process.env.POSTMARK_FROM_EMAIL = 'hello@autocaregeniushub.com';
  });

  it('can send a test without POSTMARK_UPGRADE_STREAM, but not owner emails', () => {
    const cfg = upgradeEmailConfig();
    expect(cfg).toMatchObject({ ready: true, ownerReady: false, stream: TEST_EMAIL_STREAM, streamSet: false, ownerMissing: ['POSTMARK_UPGRADE_STREAM'] });
    expect(upgradeEmailConfigProblem(cfg)).toBeNull();
    expect(upgradeEmailConfigProblem(cfg, { toOwner: true })).toMatch(/POSTMARK_UPGRADE_STREAM/);
    process.env.POSTMARK_UPGRADE_STREAM = 'broadcast';
    expect(upgradeEmailConfig()).toMatchObject({ ready: true, ownerReady: true, stream: 'broadcast', streamSet: true, ownerMissing: [] });
  });

  it('refuses a ReplyTo or stream Postmark would reject for every owner', () => {
    process.env.UPGRADE_EMAIL_REPLY_TO = 'help at autocaregenius';
    process.env.POSTMARK_UPGRADE_STREAM = 'broad cast';
    const cfg = upgradeEmailConfig();
    expect(cfg).toMatchObject({ ready: false, ownerReady: false, invalid: ['UPGRADE_EMAIL_REPLY_TO', 'POSTMARK_UPGRADE_STREAM'] });
    expect(upgradeEmailConfigProblem(cfg)).toMatch(/not valid.*UPGRADE_EMAIL_REPLY_TO/);
    process.env.UPGRADE_EMAIL_REPLY_TO = 'help@autocaregenius.com';
    process.env.POSTMARK_UPGRADE_STREAM = 'broadcast';
    expect(upgradeEmailConfig()).toMatchObject({ ready: true, replyTo: 'help@autocaregenius.com', invalid: [] });
  });
});

describe('sendSiteUpgradeEmail', () => {
  const message = () => ({ to: 'mike@topchoice.com', replyTo: 'admin@acg.com', siteId: 'site-1', ...siteUpgradeEmail({ siteUrl: SITE }) });

  beforeEach(() => {
    process.env.POSTMARK_API_KEY = 'pm-test-token';
    process.env.POSTMARK_FROM_EMAIL = 'hello@autocaregeniushub.com';
  });

  it('sends a test with the same token and sender as postmark.js, tagged', async () => {
    const out = await sendSiteUpgradeEmail(message());
    expect(out).toEqual({ messageId: 'pm-msg-1', submittedAt: '2026-10-03T12:00:00Z', stream: TEST_EMAIL_STREAM });
    expect(fetch).toHaveBeenCalledWith(POSTMARK_EMAIL_URL, expect.objectContaining({ method: 'POST' }));
    expect(pm.sent).toHaveLength(1);
    expect(pm.sent[0]).toMatchObject({
      token: 'pm-test-token',
      From: 'hello@autocaregeniushub.com',
      To: 'mike@topchoice.com',
      ReplyTo: 'admin@acg.com',
      Subject: UPGRADE_EMAIL_SUBJECT,
      MessageStream: 'outbound',
      Tag: 'site-upgrade',
      Metadata: { siteId: 'site-1' },
    });
    expect(pm.sent[0].HtmlBody).toMatch(/^<!DOCTYPE html>/);
    expect(pm.sent[0].TextBody).toContain(SITE);
  });

  it('sends an owner email only on POSTMARK_UPGRADE_STREAM', async () => {
    await expect(sendSiteUpgradeEmail({ ...message(), toOwner: true })).rejects.toMatchObject({ config: true, message: expect.stringMatching(/POSTMARK_UPGRADE_STREAM/) });
    expect(fetch).not.toHaveBeenCalled();
    process.env.POSTMARK_UPGRADE_STREAM = 'broadcast';
    const out = await sendSiteUpgradeEmail({ ...message(), toOwner: true });
    expect(out.stream).toBe('broadcast');
    expect(pm.sent[0].MessageStream).toBe('broadcast');
  });

  it('uses POSTMARK_SERVER_TOKEN when POSTMARK_API_KEY is unset', async () => {
    delete process.env.POSTMARK_API_KEY;
    process.env.POSTMARK_SERVER_TOKEN = 'pm-other-token';
    await sendSiteUpgradeEmail(message());
    expect(pm.sent[0]).toMatchObject({ token: 'pm-other-token' });
  });

  it('sends nothing without a token or a sender', async () => {
    delete process.env.POSTMARK_FROM_EMAIL;
    expect(upgradeEmailConfig()).toMatchObject({ ready: false, missing: ['POSTMARK_FROM_EMAIL'] });
    await expect(sendSiteUpgradeEmail(message())).rejects.toMatchObject({ config: true });
    delete process.env.POSTMARK_API_KEY;
    expect(upgradeEmailConfig().missing).toEqual(['POSTMARK_API_KEY', 'POSTMARK_FROM_EMAIL']);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['an inactive recipient', 422, 406, 'You tried to send to recipient(s) that have been marked as inactive.', true],
    ['an invalid To address', 422, 300, 'Invalid \'To\' address: \'mike at topchoice\'.', true],
    ['an invalid ReplyTo address', 422, 300, 'Invalid \'ReplyTo\' address: \'help at acg\'.', false],
    ['an invalid From address', 422, 300, 'Invalid \'From\' address: \'x\'.', false],
    ['a bad token', 401, 10, 'Bad or missing API token', false],
    ['an unknown stream', 422, 1235, 'The message stream \'broadcast\' was not found.', false],
  ])('tells a refusal about %s apart', async (_, status, code, msg, recipient) => {
    pm = fakePostmark({ reject: () => ({ status, ErrorCode: code, Message: msg }) });
    await expect(sendSiteUpgradeEmail(message())).rejects.toMatchObject({ recipient, code, status });
    await expect(sendSiteUpgradeEmail(message())).rejects.not.toMatchObject({ uncertain: true });
    expect(pm.sent).toEqual([]);
  });

  it('reports no answer, and a Postmark server error, as "may have been sent"', async () => {
    pm = fakePostmark({ noAnswer: () => true });
    await expect(sendSiteUpgradeEmail(message())).rejects.toMatchObject({ uncertain: true, message: expect.stringMatching(/Activity/) });
    pm = fakePostmark({ reject: () => ({ status: 500, ErrorCode: 0, Message: 'Internal Server Error' }) });
    await expect(sendSiteUpgradeEmail(message())).rejects.toMatchObject({ uncertain: true, status: 500 });
  });
});

describe('upgradeEmailStreamInfo', () => {
  beforeEach(() => {
    process.env.POSTMARK_API_KEY = 'pm-test-token';
    process.env.POSTMARK_FROM_EMAIL = 'hello@autocaregeniushub.com';
  });

  it('asks Postmark what kind of stream the email would go on', async () => {
    expect(await upgradeEmailStreamInfo()).toEqual({ found: true, type: 'Transactional' });
    process.env.POSTMARK_UPGRADE_STREAM = 'broadcast';
    expect(await upgradeEmailStreamInfo()).toEqual({ found: true, type: 'Broadcasts' });
    process.env.POSTMARK_UPGRADE_STREAM = 'nope';
    expect(await upgradeEmailStreamInfo()).toEqual({ found: false });
    expect(pm.lookups).toEqual([
      { id: 'outbound', token: 'pm-test-token' }, { id: 'broadcast', token: 'pm-test-token' }, { id: 'nope', token: 'pm-test-token' },
    ]);
    expect(pm.attempts).toEqual([]);
  });

  it('says when it could not ask', async () => {
    pm = fakePostmark();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    expect(await upgradeEmailStreamInfo()).toMatchObject({ found: null, error: expect.stringMatching(/did not answer/) });
    delete process.env.POSTMARK_API_KEY;
    expect(await upgradeEmailStreamInfo()).toMatchObject({ found: null });
  });
});
