import { describe, it, expect, vi } from 'vitest';

// exportHtml imports the Supabase client, which throws without env; these
// renders never look up widget_configs.
vi.mock('./supabase.js', () => ({ supabase: {}, isImpersonationTab: false }));

const {
  SITE_UPGRADE_RELEASE_DATE, PRODUCTION_APP_ORIGIN, NEW_DESIGN_BADGE_DAYS, checkUpgradedContent, eligibility,
  isUpgradedSite, nextStep, showNewDesignBadge, slugProblem, visibleText, widgetMounts, widgetScripts,
  NEW_DESIGN_TEMPLATES, isEmailAddress, upgradeEmailOwnerSkip, upgradeEmailSiteSkip, upgradeEmailSiteUrl,
  upgradeEmailMarkerState, upgradeEmailPageSkip, backupReason, isNewDesignPage, UPGRADE_MANUAL_SKIP,
} = await import('./siteUpgrade.js');
const { TEMPLATE_COMPONENT_MAP } = await import('../data/templates.js');
const { isValidSlug, isReservedSlug } = await import('../../netlify/functions/_shared/slug.js');
const { exportHtmlString } = await import('./exportHtml.js');
const { buildTemplateMeta } = await import('./siteRender.js');

const SITE_ID = '11111111-2222-4333-8444-555555555555';
const ST = 'https://ktnouhjikmlxlbxcxyif.supabase.co/storage/v1/object/public/site-images/11111111';
const IMAGES = {
  hero: `${ST}/hero-k2j3.jpg`,
  logo: `${ST}/logo-a8f1.png`,
  about: `${ST}/about-77aa.jpg`,
  gallery0: `${ST}/gallery0-1b2c.jpg`,
};
const INFO = {
  businessName: 'Rivera Auto Care',
  phone: '(520) 555-0142',
  email: 'hello@riveraauto.test',
  address: '1420 W Grant Rd',
  city: 'Tucson',
  state: 'AZ',
  businessType: 'mobile_detailing',
  instagram: '@riveraauto',
  facebook: 'facebook.com/riveraauto',
  hours: 'Mon-Fri 8am-6pm',
  awards: [],
  services: [
    { name: 'Full Detail', price: '149', description: 'Inside and out.' },
    { name: 'Ceramic Coating', price: '$1,200', description: 'Years of gloss.' },
  ],
};
const COPY = {
  headline: 'Clean Cars, Done Right',
  subheadline: 'Mobile detailing across Tucson.',
  aboutText: 'Rivera Auto Care is a mobile detailing service in Tucson, AZ.',
  servicesSection: { items: [{ name: 'Full Detail', description: 'Inside and out.' }, { name: 'Ceramic Coating', description: 'Years of gloss.' }] },
  googleWidgetKey: 'gk_7f3a',
  reviewMode: 'google',
};

function siteRow(extra = {}) {
  return {
    id: SITE_ID,
    user_id: 'owner-1',
    slug: 'rivera-auto-care',
    published_url: 'https://rivera-auto-care.autocaregeniushub.com',
    site_type: 'website',
    template_id: 'mobile_chrome',
    custom_domain: null,
    custom_domain_status: null,
    widget_config_ids: [],
    business_info: INFO,
    generated_content: { ...COPY, _images: IMAGES },
    ...extra,
  };
}

// A live page as the pre-upgrade templates published it: inline styles,
// the owner's facts, plus the invented stats / labels and an editor
// placeholder the new designs no longer render.
function legacyLivePage({ siteId = SITE_ID, origin = PRODUCTION_APP_ORIGIN, accent = '#94a3b8' } = {}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Rivera Auto Care | Auto Service in Tucson, AZ</title>
  <meta name="description" content="Call (520) 555-0199 today" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="${origin}/scheduler.js" data-site-id="${siteId}" defer></script>
  <script src="${origin}/contact-form.js" data-site-id="${siteId}" data-accent="#cc0000" defer></script>
  <script type="application/ld+json">{"telephone":"(520) 555-0177"}</script>
</head>
<body class="acg-has-bar">
<div style="background:#0a0a0a;color:#f8fafc">
  <nav style="position:sticky;top:0"><img src="${IMAGES.logo}" alt="Rivera Auto Care"/><a href="tel:(520) 555-0142" style="color:${accent}">(520) 555-0142</a></nav>
  <section style="background-image:url(&quot;${IMAGES.hero}?width=1600&quot;)">
    <span style="background:${accent}">Open Now</span>
    <h1>Clean Cars, <span style="color:${accent}">Done Right</span></h1>
    <p>Mobile detailing across Tucson.</p>
    <div><b>500+</b> Cars Detailed</div><div>100% Satisfaction Rate</div><div>5★ Avg Rating</div>
  </section>
  <section id="services">
    <div><h3>Full Detail</h3><span>$149</span><p>Inside and out.</p></div>
    <div><h3>Ceramic Coating</h3><span>From $1,200</span><p>Years of gloss.</p></div>
  </section>
  <section id="about"><img src="${IMAGES.about}" alt=""/><p>Rivera Auto Care is a mobile detailing service in Tucson, AZ.</p></section>
  <section id="gallery"><img srcset="${IMAGES.gallery0} 1x, ${IMAGES.gallery0} 2x" alt=""/><p>Upload a photo in the Images tab</p></section>
  <section id="testimonials">
    <div>★★★★★</div><p>&ldquo;Spotless.&rdquo; &mdash; Ana R., Verified Customer</p>
    <div data-widget="google-reviews" data-widget-key="gk_7f3a"></div>
  </section>
  <footer>
    <p>1420 W Grant Rd, Tucson, AZ</p>
    <a href="mailto:hello@riveraauto.test">hello@riveraauto.test</a>
    <a href="https://www.instagram.com/riveraauto/">Instagram</a>
    <a href="https://facebook.com/riveraauto">Facebook</a>
    <p>&copy; 2025 Rivera Auto Care</p>
  </footer>
</div>
<script src="https://social-feeds-app.netlify.app/widgets.js" defer></script>
</body>
</html>`;
}

// The new design, built the way the admin tab builds it (exportHtmlString).
// Outside a browser exportHtml points widgets at app.autocaregenius.com.
const NODE_APP = 'https://app.autocaregenius.com';
async function newDesignPage(templateId = 'mobile_chrome', info = INFO, copy = COPY, images = IMAGES) {
  return exportHtmlString(templateId, info, copy, buildTemplateMeta(templateId), images, [], SITE_ID, false);
}

// A minimal new page for focused checks: same widgets, given body.
function newPage(body, { siteId = SITE_ID, origin = PRODUCTION_APP_ORIGIN } = {}) {
  return `<!DOCTYPE html><html><head>
<script src="${origin}/scheduler.js" data-site-id="${siteId}" defer></script>
<script src="${origin}/contact-form.js" data-site-id="${siteId}" defer></script>
</head><body>${body}</body></html>`;
}

const kinds = (list) => list.map((x) => x.kind);

describe('checkUpgradedContent: real upgrade', () => {
  it('keeps every owner fact from the legacy live page and drops only invented claims', async () => {
    const html = await newDesignPage('mobile_chrome');
    const r = checkUpgradedContent(legacyLivePage({ origin: NODE_APP }), html, siteRow(), { appOrigin: NODE_APP });
    expect(r.regressions).toEqual([]);
    expect(r.ok).toBe(true);
    expect(kinds(r.intended).sort()).toEqual([
      'editor-placeholder', 'open-now', 'percent-claim', 'rating-claim', 'satisfaction-claim',
      'star-row', 'stat-claim', 'verified-label',
    ]);
    expect(r.live.siteIds).toEqual([SITE_ID]);
    expect(r.live.ownerImages.sort()).toEqual(Object.values(IMAGES).sort());
  });

  it('flags a new page built anywhere but the production app', async () => {
    const html = await newDesignPage('mobile_chrome');
    const r = checkUpgradedContent(legacyLivePage(), html, siteRow());
    expect(kinds(r.regressions)).toEqual(['widget-origin', 'widget-origin']);
    expect(r.regressions[0].label).toContain(NODE_APP);
  });

  it('reports what a template really drops (Redline hides a mobile business\'s street address)', async () => {
    const html = await newDesignPage('mobile_redline');
    const r = checkUpgradedContent(legacyLivePage({ origin: NODE_APP }), html, siteRow(), { appOrigin: NODE_APP });
    expect(r.regressions).toEqual([{ kind: 'address', label: 'Street address "1420 W Grant Rd" is missing', value: '1420 W Grant Rd' }]);
  });
});

describe('checkUpgradedContent: regressions', () => {
  const live = legacyLivePage();

  it('flags every kind of owner content the new page lost', () => {
    const r = checkUpgradedContent(live, newPage('<h1>Clean Cars, Done Right</h1><p>Tucson</p>'), siteRow());
    expect(new Set(kinds(r.regressions))).toEqual(new Set([
      'business-name', 'address', 'phone', 'email', 'service', 'price', 'image', 'social', 'widget', 'widgets-script',
    ]));
    expect(r.regressions.filter((x) => x.kind === 'image')).toHaveLength(4);
    expect(r.regressions.filter((x) => x.kind === 'social').map((x) => x.value)).toEqual([
      'https://www.instagram.com/riveraauto/', 'https://facebook.com/riveraauto',
    ]);
    expect(r.ok).toBe(false);
  });

  it('flags a lost tap-to-call or mailto link even when the text stays', () => {
    const r = checkUpgradedContent(live, newPage('<p>Rivera Auto Care</p><p>(520) 555-0142 · hello@riveraauto.test</p>'), siteRow());
    expect(kinds(r.regressions)).toContain('call-link');
    expect(kinds(r.regressions)).toContain('email-link');
    expect(kinds(r.regressions)).not.toContain('phone');
    expect(kinds(r.regressions)).not.toContain('email');
  });

  it('matches phone numbers in any format, and only from the visible page', () => {
    const body = '<a href="tel:+15205550142">Call 520.555.0142</a>';
    const r = checkUpgradedContent(live, newPage(body), siteRow());
    expect(kinds(r.regressions)).not.toContain('phone');
    expect(kinds(r.regressions)).not.toContain('call-link');
    // (520) 555-0199 / -0177 sit in <head> and JSON-LD only.
    expect(r.regressions.map((x) => x.value)).not.toContain('5205550199');
    expect(r.regressions.map((x) => x.value)).not.toContain('5205550177');
  });

  it('compares prices by amount and social links without www or a trailing slash', () => {
    const body = '<p>Full Detail $149</p><p>Ceramic Coating $1200</p>'
      + '<a href="https://instagram.com/riveraauto">ig</a><a href="http://www.facebook.com/riveraauto/">fb</a>';
    const r = checkUpgradedContent(live, newPage(body), siteRow());
    expect(kinds(r.regressions)).not.toContain('price');
    expect(kinds(r.regressions)).not.toContain('service');
    expect(kinds(r.regressions)).not.toContain('social');
  });

  it('finds photos in src, srcset and CSS backgrounds, ignoring query strings', () => {
    const body = `<div style="background-image:url('${IMAGES.hero}')"></div><img src="${IMAGES.logo}?v=2"/>`
      + `<style>.g{background:url(${IMAGES.gallery0})}</style><img srcset="${IMAGES.about} 2x"/>`;
    const r = checkUpgradedContent(live, newPage(body), siteRow());
    expect(kinds(r.regressions)).not.toContain('image');
  });

  it('requires both widget scripts for this site', () => {
    const noWidgets = '<!DOCTYPE html><html><body>Rivera Auto Care</body></html>';
    let r = checkUpgradedContent(live, noWidgets, siteRow());
    expect(kinds(r.regressions)).toEqual(expect.arrayContaining(['scheduler-script', 'contact-script']));
    r = checkUpgradedContent(live, newPage('x', { siteId: 'someone-else' }), siteRow());
    expect(kinds(r.regressions)).toEqual(expect.arrayContaining(['scheduler-script', 'contact-script', 'site-id']));
  });

  it('does not ask for owner facts the live page never showed', () => {
    const bare = newPage('<p>Rivera Auto Care</p>');
    const r = checkUpgradedContent(bare, bare, siteRow());
    expect(r.regressions).toEqual([]);
    expect(r.intended).toEqual([]);
  });

  // Older exports inlined the owner's photos as data: URIs, which no draft
  // URL can match (juanito-detailing's hero).
  it('flags photos stored inside the live page that the new page lacks', () => {
    const hero = `data:image/jpeg;base64,/9j/${'Q'.repeat(3000)}AB==`;
    const logo = `data:image/png;base64,iVBOR${'w'.repeat(2500)}==`;
    const icon = `data:image/png;base64,${'z'.repeat(200)}`;
    const liveInline = newPage(`<p>Rivera Auto Care</p><section style="background-image:url(${hero})"></section><img src="${logo}"/><img src="${icon}"/>`);
    let r = checkUpgradedContent(liveInline, newPage('<p>Rivera Auto Care</p>'), siteRow());
    expect(r.regressions).toEqual([{ kind: 'inline-image', label: '2 photo(s) stored inside the live page are missing', value: 2 }]);
    expect(r.live).toMatchObject({ inlineImages: 2, inlineImagesMissing: 2 });

    r = checkUpgradedContent(liveInline, newPage(`<p>Rivera Auto Care</p><img src="${hero}"/>`), siteRow());
    expect(r.regressions.map((x) => x.label)).toEqual(['1 photo(s) stored inside the live page is missing']);
    r = checkUpgradedContent(liveInline, newPage(`<p>Rivera Auto Care</p><img src="${hero}"/><div style="background:url('${logo}')"></div>`), siteRow());
    expect(r.regressions).toEqual([]);
  });

  // litty-mobile-detailing: WheelApex drops a specialties sentence.
  it('flags the owner\'s free text (specialties, tagline, warranty...) the new page drops', () => {
    const info = {
      ...INFO,
      specialties: 'come to you at your convenience fully mobile professional',
      tagline: 'Your Car My Passion',
      filmBrands: 'XPEL, LLumar, Ceramic Pro',
      serviceArea: 'All Central Florida',
      instagram: '@riveraauto_detailing',
      website: 'https://riveraauto.test',
    };
    const live = newPage('<p>Rivera Auto Care</p><p>come to you at your convenience fully mobile professional</p>'
      + '<p>Your Car My Passion</p><p>XPEL, LLumar, Ceramic Pro</p><p>@riveraauto_detailing https://riveraauto.test</p>');
    // The list survives as chips, the tagline as is; the sentence is gone.
    const next = newPage('<p>Rivera Auto Care</p><p>Your Car My Passion</p><span>XPEL</span><span>LLumar</span><span>Ceramic Pro</span>');
    const r = checkUpgradedContent(live, next, siteRow({ business_info: info }));
    expect(r.regressions).toEqual([{
      kind: 'owner-text',
      label: 'Owner text (specialties) "come to you at your convenience fully mobile professional" is missing',
      value: 'come to you at your convenience fully mobile professional',
    }]);
  });

  // vivid-detailing-customs: the old WheelApex ticker showed the owner's
  // specialties split at the commas, so the whole text was never on the
  // page in one piece; the new page drops it.
  it('flags owner text an old template showed piece by piece', () => {
    const specialties = 'We are a group of trained professionals with a passion for cars, from the soccer mom minivan to the weekend sports car, and marine restorations. For your convenience we come to you';
    const info = { ...INFO, specialties };
    const ticker = specialties.split(',').map((p) => `<span>${p.trim()}</span><span>•</span>`).join('');
    const live = newPage(`<p>Rivera Auto Care</p><div>${ticker}${ticker}</div>`);
    let r = checkUpgradedContent(live, newPage('<p>Rivera Auto Care</p>'), siteRow({ business_info: info }));
    expect(r.regressions).toEqual([expect.objectContaining({ kind: 'owner-text', value: specialties })]);
    // Kept (in one piece or piece by piece): nothing to report.
    r = checkUpgradedContent(live, newPage(`<p>Rivera Auto Care</p><p>${specialties}</p>`), siteRow({ business_info: info }));
    expect(r.regressions).toEqual([]);
    r = checkUpgradedContent(live, live, siteRow({ business_info: info }));
    expect(r.regressions).toEqual([]);
    // One short piece on the live page is not the text being shown.
    const onePiece = newPage('<p>Rivera Auto Care</p><p>from the soccer mom minivan</p>');
    r = checkUpgradedContent(onePiece, newPage('<p>Rivera Auto Care</p>'), siteRow({ business_info: info }));
    expect(r.regressions).toEqual([]);
  });

  // vivid-detailing-customs: a product photo lives in products[].image, not
  // in _images; it is the draft's photo all the same.
  it('counts image URLs anywhere in the draft as the draft\'s photos', () => {
    const product = `${ST}/product0-g2an19lp.jpg`;
    const row = siteRow({ generated_content: { ...COPY, _images: IMAGES, products: [{ name: 'Wax', image: `${product}?v=1` }], instagramUrl: 'https://instagram.com/riveraauto' } });
    const live = newPage(`<p>Rivera Auto Care</p><img src="${product}"/>`);
    const r = checkUpgradedContent(live, live, row);
    expect(r.live.ownerImages).toEqual([product]);
    const owner = { id: 'owner-1', subscription_status: 'active' };
    const codes = eligibility(row, live, r, owner, { renderCopy: COPY, manualSkip: [] }).reasons.map((x) => x.code);
    expect(codes).not.toContain('draft_missing_images');
  });

  // B2-3 (magician-detailing, proppa-llc, juanito-detailing): a mobile
  // detailer's street address is often their home.
  describe('a mobile business\'s street address the live page never showed', () => {
    const mobile = siteRow({ business_info: { ...INFO, businessType: 'mobile_detailing' } });
    const hidden = newPage('<p>Rivera Auto Care</p><p>Tucson, AZ</p>');
    const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('1420 W Grant Rd, Tucson, AZ')}`;

    it('is reported when the new page shows it as text or behind a map link', () => {
      let r = checkUpgradedContent(hidden, newPage('<p>Rivera Auto Care</p><p>1420 W Grant Rd, Tucson, AZ</p>'), mobile);
      expect(r.exposed).toEqual([{ kind: 'address', label: expect.stringMatching(/Street address "1420 W Grant Rd" shows on the new page/), value: '1420 W Grant Rd' }]);
      expect(r.regressions).toEqual([]);
      r = checkUpgradedContent(hidden, newPage(`<p>Rivera Auto Care</p><a href="${maps}">Directions</a>`), mobile);
      expect(r.exposed).toHaveLength(1);
      const owner = { id: 'owner-1', subscription_status: 'active' };
      const v = eligibility(mobile, hidden, r, owner, { renderCopy: COPY, manualSkip: [] });
      expect(v.reasons.map((x) => x.code)).toContain('address_newly_shown');
    });

    it('is not reported when the live page showed it, or for a shop', () => {
      const shown = newPage('<p>Rivera Auto Care</p><footer>1420 W Grant Rd, Tucson</footer>');
      const withAddress = newPage('<p>Rivera Auto Care</p><p>1420 W Grant Rd, Tucson, AZ</p>');
      expect(checkUpgradedContent(shown, withAddress, mobile).exposed).toEqual([]);
      const viaMap = newPage(`<p>Rivera Auto Care</p><a href="${maps}">Map</a>`);
      expect(checkUpgradedContent(viaMap, withAddress, mobile).exposed).toEqual([]);
      const shop = siteRow({ business_info: { ...INFO, businessType: 'detailing_shop' } });
      expect(checkUpgradedContent(hidden, withAddress, shop).exposed).toEqual([]);
      expect(checkUpgradedContent(hidden, hidden, mobile).exposed).toEqual([]);
    });
  });
});

describe('HTML readers', () => {
  it('reads scripts and widget mounts with any quoting', () => {
    const html = `<script src='${PRODUCTION_APP_ORIGIN}/scheduler.js?v=2' data-site-id='${SITE_ID}' data-full-page="true"></script>`
      + '<div data-widget="instagram-feed" data-widget-key="ig&amp;1"></div>';
    expect(widgetScripts(html)).toEqual([{
      kind: 'scheduler', src: `${PRODUCTION_APP_ORIGIN}/scheduler.js?v=2`, origin: PRODUCTION_APP_ORIGIN, siteId: SITE_ID, fullPage: true,
    }]);
    expect(widgetMounts(html)).toEqual([{ type: 'instagram-feed', key: 'ig&1' }]);
  });

  it('visibleText skips head, scripts, styles and icons and decodes entities', () => {
    const html = '<html><head><title>T</title></head><body><style>.a{}</style><p>A&amp;B&#x27;s &ldquo;x&rdquo;</p><svg><text>icon</text></svg><script>var z=1</script></body></html>';
    expect(visibleText(html)).toBe('A&B\'s “x”');
  });
});

describe('eligibility', () => {
  const ctx = (extra = {}) => ({
    sharedSlug: false,
    renderCopy: COPY,
    draftColors: buildTemplateMeta('mobile_chrome').colors,
    manualSkip: [],
    ...extra,
  });
  const owner = { id: 'owner-1', subscription_status: 'active' };
  // A live page that matches the draft: its headline and the draft's accent.
  const live = legacyLivePage({ accent: buildTemplateMeta('mobile_chrome').colors.accent });
  const clean = { regressions: [], intended: [], live: { siteIds: [SITE_ID], ownerImages: Object.values(IMAGES) }, ok: true };
  const codes = (r) => r.reasons.map((x) => x.code);

  it('marks a clean site ready', () => {
    expect(eligibility(siteRow(), live, clean, owner, ctx())).toEqual({ status: 'ready', reasons: [] });
  });

  it('marks a real upgrade ready end to end', async () => {
    const html = await newDesignPage('mobile_chrome');
    const liveNode = legacyLivePage({ origin: NODE_APP, accent: buildTemplateMeta('mobile_chrome').colors.accent });
    const check = checkUpgradedContent(liveNode, html, siteRow(), { appOrigin: NODE_APP });
    expect(eligibility(siteRow(), liveNode, check, owner, ctx())).toEqual({ status: 'ready', reasons: [] });
  });

  it.each([
    ['a booking-only page', siteRow({ site_type: 'booking_only' }), {}, 'booking_only'],
    ['a site that is not live', siteRow({ published_url: null }), {}, 'not_live'],
    ['a site without a slug', siteRow({ slug: null }), {}, 'no_slug'],
    ['an invalid slug', siteRow({ slug: 'Rivera Auto/book' }), {}, 'invalid_slug'],
    ['a reserved slug', siteRow({ slug: 'admin' }), {}, 'reserved_slug'],
    ['a shared slug', siteRow(), { sharedSlug: true }, 'shared_slug'],
    ['a custom domain that is not active', siteRow({ custom_domain: 'riveraauto.com', custom_domain_status: 'pending_dns' }), {}, 'custom_domain_pending'],
    ['an unknown template', siteRow(), { templateKnown: false }, 'no_template'],
    ['an empty draft', siteRow({ generated_content: { _images: IMAGES } }), { renderCopy: {} }, 'draft_empty'],
    ['inline base64 images', siteRow({ generated_content: { ...COPY, _images: { ...IMAGES, logo: 'data:image/png;base64,AAAA' } } }), {}, 'draft_inline_images'],
    ['old widget_config_ids without keys', siteRow({ widget_config_ids: ['w1'] }), { renderCopy: { ...COPY, googleWidgetKey: undefined } }, 'legacy_widgets'],
    ['a site on the manual list', siteRow(), { manualSkip: [{ siteId: SITE_ID, reason: 'owner asked to wait' }] }, 'manual_skip'],
  ])('flags %s', (_, site, extra, code) => {
    const r = eligibility(site, live, clean, owner, ctx(extra));
    expect(r.status).toBe('flagged');
    expect(codes(r)).toContain(code);
  });

  it('flags an unreadable owner profile (their plan decides the "Powered by" bar)', () => {
    expect(codes(eligibility(siteRow(), live, clean, null, ctx()))).toEqual(['owner_unknown']);
  });

  it('flags a missing or oversized live page', () => {
    expect(codes(eligibility(siteRow(), null, clean, owner, ctx()))).toEqual(['live_missing']);
    expect(codes(eligibility(siteRow(), null, clean, owner, ctx({ liveTooLarge: true })))).toEqual(['live_too_large']);
  });

  it('flags a draft that changed since the last publish', () => {
    // Live shows a photo the draft no longer has.
    const extra = { ...clean, live: { ...clean.live, ownerImages: [...clean.live.ownerImages, `${ST}/old-hero.jpg`] } };
    expect(codes(eligibility(siteRow(), live, extra, owner, ctx()))).toEqual(['draft_missing_images']);
    // Headline edited in the draft only.
    const edited = siteRow({ generated_content: { ...COPY, headline: 'Brand New Headline', _images: IMAGES } });
    expect(codes(eligibility(edited, live, clean, owner, ctx()))).toEqual(['draft_copy_differs']);
    // Template or colors switched in the draft only.
    expect(codes(eligibility(siteRow(), live, clean, owner, ctx({ draftColors: { bg: '#123456', accent: '#abcdef' } })))).toEqual(['draft_colors_differ']);
  });

  // the-spot-orlando: the dark background is on the live page, the saved
  // accent (orange) is not: the live teal was never saved.
  it('flags a draft accent the live page does not use, even when the background matches', () => {
    const { bg, accent } = buildTemplateMeta('mobile_chrome').colors;
    expect(live.toLowerCase()).toContain(accent.toLowerCase());
    const r = eligibility(siteRow(), live, clean, owner, ctx({ draftColors: { bg, accent: '#f97316' } }));
    expect(r.reasons).toEqual([{ code: 'draft_colors_differ', text: expect.stringMatching(/accent color #f97316/) }]);
    // Background off, accent on: as before, ready.
    expect(eligibility(siteRow(), live, clean, owner, ctx({ draftColors: { bg: '#123456', accent } })).status).toBe('ready');
  });

  it('skips the colors heuristic for templates whose old version ignored the palette', () => {
    const r = eligibility(siteRow({ template_id: 'wheel_apex' }), live, clean, owner, ctx({ draftColors: { bg: '#123456', accent: '#abcdef' } }));
    expect(r.status).toBe('ready');
  });

  // nxt-premium-detailing: same headline and colors, but the live page
  // shows real customer reviews and copy the draft doesn't have.
  it('flags live text the draft doesn\'t have (testimonials, subheadline, about text)', () => {
    const quotes = [{ name: 'Marcus T.', text: 'They made my truck look brand new.' }, { name: 'Dana K.', text: 'On time and spotless.' }];
    const noGoogle = { ...COPY, googleWidgetKey: undefined, testimonialPlaceholders: quotes };
    const row = siteRow({ generated_content: { ...noGoogle, _images: IMAGES } });
    // The live page shows other reviews (entered by hand on an old version).
    let r = eligibility(row, live, clean, owner, ctx({ renderCopy: noGoogle }));
    expect(codes(r)).toEqual(['draft_text_differs']);
    expect(r.reasons[0].text).toMatch(/draft's testimonials/);
    // Once the live page shows the draft's quotes, it is ready.
    const liveWithQuotes = live.replace('</footer>', `<p>“${quotes[0].text}”</p><p>${quotes[1].text}</p></footer>`);
    expect(eligibility(row, liveWithQuotes, clean, owner, ctx({ renderCopy: noGoogle })).status).toBe('ready');
    // With a Google reviews widget the quotes never render, so they don't count.
    expect(eligibility(row, live, clean, owner, ctx({ renderCopy: { ...noGoogle, googleWidgetKey: 'gk_7f3a' } })).status).toBe('ready');

    const edited = { ...COPY, subheadline: 'No stress, no mess.', aboutText: 'A 25-mile radius.' };
    r = eligibility(siteRow({ generated_content: { ...edited, _images: IMAGES } }), live, clean, owner, ctx({ renderCopy: edited }));
    expect(r.reasons).toEqual([{ code: 'draft_text_differs', text: expect.stringMatching(/subheadline, about text:/) }]);
  });

  it('counts photos stored inside the live page as photos the draft lacks', () => {
    const check = { ...clean, live: { ...clean.live, inlineImages: 1, inlineImagesMissing: 1 }, regressions: [{ kind: 'inline-image', label: '1 photo(s) stored inside the live page is missing' }] };
    expect(codes(eligibility(siteRow(), live, check, owner, ctx()))).toEqual(['draft_missing_images', 'regression']);
  });

  it('flags a site on hold (a restore, or by hand) and not a released one', () => {
    let r = eligibility(siteRow(), live, clean, owner, ctx({ hold: { held: true, reason: 'restored', at: '2026-10-05T10:00:00.000Z', backupId: 'b1' } }));
    expect(r).toEqual({ status: 'flagged', reasons: [{ code: 'on_hold', text: 'On hold since 2026-10-05: an admin put the previous page back (backup b1)' }] });
    r = eligibility(siteRow(), live, clean, owner, ctx({ hold: { held: true, reason: 'manual', note: 'owner on vacation', at: '2026-10-05T10:00:00.000Z' } }));
    expect(r.reasons[0].text).toBe('On hold since 2026-10-05: owner on vacation');
    expect(eligibility(siteRow(), live, clean, owner, ctx({ hold: { held: false, reason: 'released' } })).status).toBe('ready');
  });

  it('has a next step for every reason it can give', () => {
    const all = new Set();
    const add = (r) => r.reasons.forEach((x) => all.add(x.code));
    const everything = siteRow({
      site_type: 'booking_only', published_url: null, slug: 'admin', custom_domain: 'x.com', custom_domain_status: 'pending_dns',
      template_id: null, widget_config_ids: ['w1'], generated_content: { _images: { logo: 'data:image/png;base64,AAAA' } },
    });
    add(eligibility(everything, null, null, null, { manualSkip: [{ siteId: SITE_ID }], hold: { held: true }, sharedSlug: true, liveTooLarge: true, renderCopy: {} }));
    add(eligibility(siteRow({ slug: null }), null, null, owner, ctx()));
    add(eligibility(siteRow({ slug: 'A b' }), null, null, owner, ctx()));
    const differs = { ...COPY, headline: 'Other', subheadline: 'Other sub', googleWidgetKey: undefined };
    add(eligibility(siteRow({ generated_content: { ...differs, _images: {} } }), live, {
      regressions: [{ kind: 'phone', label: 'x' }], exposed: [{ kind: 'address', label: 'y' }], live: { siteIds: ['other'], ownerImages: [`${ST}/gone.jpg`] },
    }, owner, ctx({ renderCopy: differs, draftColors: { bg: '#123456', accent: '#abcdef' } })));
    expect([...all].sort()).toEqual([
      'address_newly_shown', 'booking_only', 'custom_domain_pending', 'draft_colors_differ', 'draft_copy_differs', 'draft_empty', 'draft_inline_images',
      'draft_missing_images', 'draft_text_differs', 'invalid_slug', 'legacy_widgets', 'live_missing', 'live_other_site', 'live_too_large',
      'manual_skip', 'no_slug', 'no_template', 'not_live', 'on_hold', 'owner_unknown', 'regression', 'reserved_slug', 'shared_slug',
    ]);
    for (const code of [...all, 'no_page']) expect(nextStep(code), code).toEqual(expect.any(String));
    expect(nextStep('nope')).toBeNull();
  });

  it('flags a live page that belongs to another site', () => {
    const other = { ...clean, live: { ...clean.live, siteIds: ['22222222-2222-4333-8444-555555555555'] } };
    expect(codes(eligibility(siteRow(), live, other, owner, ctx()))).toEqual(['live_other_site']);
  });

  it('turns every regression into a reason, and never intended removals', () => {
    const check = { ...clean, regressions: [{ kind: 'phone', label: 'Phone number (520) 555-0142 is missing' }], intended: [{ kind: 'star-row', label: 'Star rating row' }] };
    const r = eligibility(siteRow(), live, check, owner, ctx());
    expect(r).toEqual({ status: 'flagged', reasons: [{ code: 'regression', text: 'Phone number (520) 555-0142 is missing' }] });
  });
});

// The manual check list keeps the impact report's RISK, OWNER-SHOULD-REVIEW
// and paying sites out of "Republish all"; a typo'd id would silently let
// one through, so every entry must be a real-looking sites.id.
describe('UPGRADE_MANUAL_SKIP', () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  // Entries are removed as their fixes land, so every check here also holds
  // for an empty list.
  it('is a frozen list of frozen { siteId, reason } entries', () => {
    expect(Object.isFrozen(UPGRADE_MANUAL_SKIP)).toBe(true);
    for (const s of UPGRADE_MANUAL_SKIP) {
      expect(Object.isFrozen(s), s.siteId).toBe(true);
      expect(Object.keys(s).sort(), s.siteId).toEqual(['reason', 'siteId']);
    }
  });

  it('gives every entry a uuid siteId and a one-line reason', () => {
    for (const s of UPGRADE_MANUAL_SKIP) {
      expect(s.siteId, JSON.stringify(s)).toMatch(UUID);
      expect(typeof s.reason, s.siteId).toBe('string');
      expect(s.reason.trim().length, s.siteId).toBeGreaterThan(0);
      expect(s.reason, s.siteId).not.toMatch(/[\r\n]/);
    }
  });

  // The reasons ship in the public app bundle next to ids every live page
  // carries: no billing / payment status or remarks about the owner's data.
  it('keeps every reason free of billing and owner remarks', () => {
    for (const s of UPGRADE_MANUAL_SKIP) {
      expect(s.reason, s.siteId).not.toMatch(/paying|paid|billing|past.?due|subscri|refund|residential|test data/i);
    }
  });

  it('lists each site once', () => {
    const ids = UPGRADE_MANUAL_SKIP.map((s) => s.siteId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is what eligibility checks when no manualSkip is passed', () => {
    for (const s of UPGRADE_MANUAL_SKIP) {
      const r = eligibility(siteRow({ id: s.siteId }), null, null, null, {});
      expect(r.status, s.siteId).toBe('flagged');
      expect(r.reasons, s.siteId).toContainEqual({ code: 'manual_skip', text: `On the manual check list: ${s.reason}` });
    }
    expect(UPGRADE_MANUAL_SKIP.map((s) => s.siteId)).not.toContain(siteRow().id);
    expect(eligibility(siteRow(), null, null, null, {}).reasons.map((x) => x.code)).not.toContain('manual_skip');
  });
});

describe('slugProblem', () => {
  it('agrees with netlify/functions/_shared/slug.js', () => {
    const samples = [
      'rivera-auto-care', 'a', 'x'.repeat(63), 'x'.repeat(64), 'Rivera', 'a_b', 'a/b', '', '-', '_backups',
      'www', 'app', 'api', 'admin', 'mail', 'book', 'booking', 'dashboard', 'sitebuilder', 'support', 'help',
      'status', 'cdn', 'assets', 'static', 'apps', 'books',
    ];
    for (const s of samples) {
      expect(slugProblem(s) === null, s).toBe(isValidSlug(s) && !isReservedSlug(s));
    }
    expect(slugProblem(null)).toBe('missing');
    expect(slugProblem('admin')).toBe('reserved');
    expect(slugProblem('A b')).toBe('invalid');
  });
});

describe('showNewDesignBadge', () => {
  const release = Date.parse(`${SITE_UPGRADE_RELEASE_DATE}T00:00:00Z`);
  const day = 24 * 60 * 60 * 1000;
  const site = (extra = {}) => ({
    published_url: 'https://x.autocaregeniushub.com', site_type: 'website',
    created_at: '2025-06-01T00:00:00Z', published_at: new Date(release + day).toISOString(), ...extra,
  });

  it('shows on an older live website republished since the release, for a while', () => {
    expect(showNewDesignBadge(site(), release + 2 * day)).toBe(true);
    expect(showNewDesignBadge(site(), release + (NEW_DESIGN_BADGE_DAYS - 1) * day)).toBe(true);
    expect(showNewDesignBadge(site(), release + (NEW_DESIGN_BADGE_DAYS + 1) * day)).toBe(false);
  });

  it('never shows on a site created after the release, one not republished, or a booking page', () => {
    const now = release + 2 * day;
    expect(showNewDesignBadge(site({ created_at: new Date(release + 1000).toISOString() }), now)).toBe(false);
    expect(showNewDesignBadge(site({ published_at: null }), now)).toBe(false);
    expect(showNewDesignBadge(site({ published_at: '2026-01-01T00:00:00Z' }), now)).toBe(false);
    expect(showNewDesignBadge(site({ site_type: 'booking_only' }), now)).toBe(false);
    expect(showNewDesignBadge(site({ published_url: null }), now)).toBe(false);
    expect(showNewDesignBadge(null, now)).toBe(false);
  });
});

describe('isUpgradedSite', () => {
  it('is true from the release day on', () => {
    expect(isUpgradedSite({ published_at: `${SITE_UPGRADE_RELEASE_DATE}T00:00:00Z` })).toBe(true);
    expect(isUpgradedSite({ published_at: '2099-01-01T00:00:00Z' })).toBe(true);
    expect(isUpgradedSite({ published_at: '2020-01-01T00:00:00Z' })).toBe(false);
    expect(isUpgradedSite({ published_at: null })).toBe(false);
    expect(isUpgradedSite({})).toBe(false);
    expect(isUpgradedSite(null)).toBe(false);
  });
});

describe('owner emails', () => {
  const release = Date.parse(`${SITE_UPGRADE_RELEASE_DATE}T00:00:00Z`);
  const day = 24 * 60 * 60 * 1000;
  const site = (extra = {}) => ({
    id: SITE_ID, published_url: 'https://rivera-auto-care.autocaregeniushub.com', site_type: 'website',
    template_id: 'mobile_chrome', created_at: '2025-06-01T00:00:00Z', published_at: new Date(release + day).toISOString(),
    custom_domain: null, custom_domain_status: null, ...extra,
  });

  it('NEW_DESIGN_TEMPLATES lists exactly the theme-ready templates (what the email describes)', async () => {
    const ready = [];
    for (const [id, load] of Object.entries(TEMPLATE_COMPONENT_MAP)) {
      if ((await load()).themeReady === true) ready.push(id);
    }
    expect([...NEW_DESIGN_TEMPLATES].sort()).toEqual(ready.sort());
  });

  it('emails a live website on the new design that was there before the release', () => {
    expect(upgradeEmailSiteSkip(site())).toBeNull();
  });

  it.each([
    ['not live', { published_url: null }, 'not_live'],
    ['a booking-only page', { site_type: 'booking_only' }, 'not_website'],
    ['published before the release', { published_at: new Date(release - 1000).toISOString() }, 'not_upgraded'],
    ['never republished', { published_at: null }, 'not_upgraded'],
    ['created after the release (never had the old design)', { created_at: new Date(release + 1000).toISOString() }, 'new_site'],
    ['on a template without the new design', { template_id: 'detailing_premium' }, 'old_template'],
    ['without an https address', { published_url: 'http://x.autocaregeniushub.com' }, 'no_address'],
  ])('skips a site %s', (_, extra, code) => {
    expect(upgradeEmailSiteSkip(site(extra))?.code).toBe(code);
  });

  it('skips a site on hold or already emailed', () => {
    expect(upgradeEmailSiteSkip(site(), { hold: { held: true } })?.code).toBe('on_hold');
    expect(upgradeEmailSiteSkip(site(), { hold: { held: false } })).toBeNull();
    const skip = upgradeEmailSiteSkip(site(), { marker: { state: 'sent', at: '2026-10-03T10:00:00Z', to: 'a@b.com' } });
    expect(skip).toMatchObject({ code: 'already_emailed' });
    expect(skip.text).toContain('2026-10-03');
    // A marker from before the claim (no state) was written after the send.
    expect(upgradeEmailSiteSkip(site(), { marker: { at: '2026-10-03T10:00:00Z', messageId: 'x' } })?.code).toBe('already_emailed');
  });

  it('blocks a site whose email may have gone out, and frees one that surely did not', () => {
    for (const marker of [{ state: 'sending' }, { unreadable: true }, { state: 'something-new' }]) {
      expect(upgradeEmailSiteSkip(site(), { marker })).toMatchObject({ code: 'unconfirmed', text: expect.stringMatching(/Postmark/) });
    }
    for (const marker of [{ state: 'refused' }, { state: 'cleared' }, null]) {
      expect(upgradeEmailSiteSkip(site(), { marker })).toBeNull();
    }
    expect([null, {}, { unreadable: true }, { state: 'sending' }, { state: 'refused' }].map(upgradeEmailMarkerState))
      .toEqual([null, 'sent', 'unreadable', 'sending', 'refused']);
  });

  describe('upgradeEmailPageSkip', () => {
    const freshPage = (id = SITE_ID) => `<!DOCTYPE html><html><head><script>(function(){h.setAttribute('data-acg-scrolled','')})()</script>
      <script src="https://sitebuilder.autocaregenius.com/scheduler.js" data-site-id="${id}" defer></script>
      <script src="https://sitebuilder.autocaregenius.com/contact-form.js" data-site-id="${id}" defer></script></head><body></body></html>`;
    const oldPage = `<!DOCTYPE html><html><head><script src="https://sitebuilder.autocaregenius.com/scheduler.js" data-site-id="${SITE_ID}" defer></script></head></html>`;
    const UPGRADE = '2026-10-02T15-30-12-345Z-publish-1a2b3c4d';
    const OWNER = '2026-10-03T08-00-00-000Z-owner-0a0b0c0d';
    const MANUAL = '2026-10-01T08-00-00-000Z-manual-0a0b0c0d';
    const RESTORE = '2026-10-01T09-00-00-000Z-restore-0a0b0c0d';

    it('passes a site whose old page was replaced by its new-design page', () => {
      expect(upgradeEmailPageSkip({ backupIds: [UPGRADE], liveHtml: freshPage(), siteId: SITE_ID })).toBeNull();
      expect(upgradeEmailPageSkip({ backupIds: [MANUAL, OWNER], liveHtml: freshPage(), siteId: SITE_ID })).toBeNull();
    });

    it.each([
      ['never replaced an old page (no upgrade backup)', [], 'never_replaced'],
      ['only has backups made by hand or before a restore', [MANUAL, RESTORE], 'never_replaced'],
    ])('skips a site that %s', (_, backupIds, code) => {
      expect(upgradeEmailPageSkip({ backupIds, liveHtml: freshPage(), siteId: SITE_ID })?.code).toBe(code);
    });

    it('skips a site whose live page is missing, old, or another site\'s', () => {
      expect(upgradeEmailPageSkip({ backupIds: [OWNER], liveHtml: null, siteId: SITE_ID })?.code).toBe('live_missing');
      expect(upgradeEmailPageSkip({ backupIds: [OWNER], liveHtml: oldPage, siteId: SITE_ID })?.code).toBe('live_not_new');
      expect(upgradeEmailPageSkip({ backupIds: [OWNER], liveHtml: freshPage('other-site'), siteId: SITE_ID })?.code).toBe('live_other_site');
    });

    it('reads the reason out of a backup id', () => {
      expect([UPGRADE, OWNER, MANUAL, RESTORE, 'junk', null].map(backupReason)).toEqual(['publish', 'owner', 'manual', 'restore', null, null]);
      expect(isNewDesignPage(freshPage())).toBe(true);
      expect(isNewDesignPage(oldPage)).toBe(false);
    });

    it('knows a real new-design export from a legacy live page', async () => {
      const html = await newDesignPage('mobile_chrome');
      expect(isNewDesignPage(html)).toBe(true);
      expect(upgradeEmailPageSkip({ backupIds: [UPGRADE], liveHtml: html, siteId: SITE_ID })).toBeNull();
      expect(isNewDesignPage(legacyLivePage({ origin: NODE_APP }))).toBe(false);
    });
  });

  it.each([
    ['an unknown owner', null, 'owner_unknown'],
    ['a super admin', { email: 'boss@gmail.com', isSuperAdmin: true }, 'admin_owner'],
    ['an owner without an address', { email: '' }, 'no_email'],
    ['an owner with a broken address', { email: 'mike at gmail' }, 'no_email'],
    ['a team account', { email: 'staff@autocaregenius.com' }, 'test_owner'],
    ['a team subdomain account', { email: 'x@mail.autocaregeniushub.com' }, 'test_owner'],
    ['a dev account', { email: 'dev@639hz.com' }, 'test_owner'],
    ['a reserved test domain', { email: 'owner@shop.test' }, 'test_owner'],
    ['example.com', { email: 'owner@example.com' }, 'test_owner'],
  ])('never emails %s', (_, owner, code) => {
    expect(upgradeEmailOwnerSkip(owner)?.code).toBe(code);
  });

  it('emails a real owner (case and spaces in the address do not matter)', () => {
    expect(upgradeEmailOwnerSkip({ email: ' Mike.Rivera+shop@Gmail.com ', isSuperAdmin: false })).toBeNull();
    expect(upgradeEmailOwnerSkip({ email: 'owner@notautocaregenius.com' })).toBeNull();
    expect(isEmailAddress('a@b.co')).toBe(true);
    expect(isEmailAddress('a@b')).toBe(false);
    expect(isEmailAddress('a b@c.com')).toBe(false);
    expect(isEmailAddress('"x"<a@b.com>')).toBe(false);
  });

  it('links the owner\'s own domain once it serves the site over HTTPS', () => {
    expect(upgradeEmailSiteUrl(site())).toBe('https://rivera-auto-care.autocaregeniushub.com');
    expect(upgradeEmailSiteUrl(site({ custom_domain: 'riveraauto.com', custom_domain_status: 'active_ssl' }))).toBe('https://www.riveraauto.com');
    expect(upgradeEmailSiteUrl(site({ custom_domain: 'riveraauto.com', custom_domain_status: 'pending_dns' }))).toBe('https://rivera-auto-care.autocaregeniushub.com');
    expect(upgradeEmailSiteUrl(site({ custom_domain: 'bad domain"/>', custom_domain_status: 'active_ssl' }))).toBe('https://rivera-auto-care.autocaregeniushub.com');
    expect(upgradeEmailSiteUrl(site({ published_url: 'javascript:alert(1)' }))).toBeNull();
  });
});
