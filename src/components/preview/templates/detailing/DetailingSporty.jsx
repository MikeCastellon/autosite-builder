import React, { useState, useEffect } from 'react';
import { SocialRow } from '../SocialIcons.jsx';
import { formatHours } from '../../../../lib/formatHours.js';
import { HeroImage, AboutImage, GallerySection } from '../ImageLayers.jsx';
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import GoogleReviewsWidget from '../GoogleReviewsWidget.jsx';
import { getFallbacks } from '../../../../lib/templateFallbacks.js';

export default function DetailingSporty({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const fb = getFallbacks(businessInfo.businessType);
  const c = templateMeta.colors;
  const font = templateMeta.font;
  const bodyFont = templateMeta.bodyFont;
  const [scrolled, setScrolled] = useState(false);
  const splitHero = generatedCopy?.heroLayout === 'split';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const hidden = (id) => generatedCopy?.hiddenSections?.includes(id);
  const getOrder = buildSectionOrder(generatedCopy, ['hero', 'statsBar', 'services', 'about', 'gallery', 'testimonials', 'cta']);

  const s = {
    nav: {
      position: 'sticky', top: 0, zIndex: 100,
      background: scrolled ? c.bg : 'rgba(10,5,5,0.85)',
      borderBottom: `3px solid ${c.accent}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 clamp(1rem, 5vw, 3rem)', height: '68px',
      backdropFilter: 'blur(8px)',
    },
    navLogo: {
      fontFamily: font, fontSize: 'clamp(1rem, 2vw, 1.25rem)',
      color: c.text, letterSpacing: '0.08em', fontWeight: 900,
      textTransform: 'uppercase',
    },
    navAccent: { color: c.accent },
    navPhone: {
      background: c.accent, color: '#fff', padding: '9px 22px',
      fontFamily: bodyFont, fontSize: '0.85rem', fontWeight: 700,
      letterSpacing: '0.06em', cursor: 'pointer', border: 'none',
      textTransform: 'uppercase',
    },
    hero: {
      minHeight: '100vh', background: c.bg,
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: 'clamp(6rem, 12vw, 9rem) clamp(1.5rem, 7vw, 5rem) clamp(3rem, 6vw, 5rem)',
      position: 'relative', overflow: 'hidden',
    },
    heroSlash: {
      position: 'absolute', top: '-10%', right: '15%',
      width: '180px', height: '130%',
      background: `linear-gradient(135deg, ${c.accent}22 0%, ${c.accent}08 100%)`,
      transform: 'skewX(-18deg)',
      pointerEvents: 'none',
    },
    heroSlash2: {
      position: 'absolute', top: '-10%', right: '22%',
      width: '60px', height: '130%',
      background: `linear-gradient(135deg, ${c.accent}15 0%, transparent 100%)`,
      transform: 'skewX(-18deg)',
      pointerEvents: 'none',
    },
    awardsTag: {
      display: 'inline-block', background: c.accent, color: '#fff',
      fontFamily: bodyFont, fontSize: '0.7rem', fontWeight: 700,
      letterSpacing: '0.18em', textTransform: 'uppercase',
      padding: '5px 14px', marginBottom: '1.5rem',
    },
    heroH1: {
      fontFamily: font, fontSize: 'clamp(1.8rem, 8vw, 6.5rem)',
      color: c.text, lineHeight: 0.95, marginBottom: '1.5rem',
      fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.01em',
      maxWidth: '800px',
    },
    heroH1Accent: { color: c.accent },
    heroSub: {
      fontFamily: bodyFont, fontSize: 'clamp(1rem, 1.8vw, 1.15rem)',
      color: c.muted, marginBottom: '2.5rem', maxWidth: '480px', lineHeight: 1.7,
    },
    ctaRow: { display: 'flex', gap: '1rem', flexWrap: 'wrap' },
    ctaFilled: {
      background: c.accent, color: '#fff', padding: '15px 36px',
      fontFamily: bodyFont, fontSize: '0.9rem', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', border: 'none',
    },
    ctaGhost: {
      background: 'transparent', color: c.text, padding: '15px 36px',
      fontFamily: bodyFont, fontSize: '0.9rem', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer',
      border: `2px solid ${c.text}44`,
    },
    statsBar: {
      display: 'flex', flexWrap: 'wrap', gap: 0,
      background: c.secondary,
    },
    statBox: {
      flex: '1 1 150px', background: c.accent, padding: '1.75rem 1.5rem',
      textAlign: 'center', margin: '2px',
    },
    statBoxAlt: {
      flex: '1 1 150px', background: c.secondary, padding: '1.75rem 1.5rem',
      textAlign: 'center', margin: '2px', border: `1px solid ${c.accent}33`,
    },
    statNum: { fontFamily: font, fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', color: '#fff', fontWeight: 900, display: 'block' },
    statNumAlt: { fontFamily: font, fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', color: c.accent, fontWeight: 900, display: 'block' },
    statLabel: { fontFamily: bodyFont, fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: '0.35rem' },
    statLabelAlt: { fontFamily: bodyFont, fontSize: '0.72rem', color: c.muted, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: '0.35rem' },
    section: { padding: 'clamp(3rem, 7vw, 6rem) clamp(1.5rem, 7vw, 5rem)', background: c.bg },
    sectionAlt: { padding: 'clamp(3rem, 7vw, 6rem) clamp(1.5rem, 7vw, 5rem)', background: c.secondary },
    sectionTag: {
      fontFamily: bodyFont, fontSize: '0.68rem', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.25em', color: c.accent,
      marginBottom: '0.6rem',
    },
    sectionTitle: {
      fontFamily: font, fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontWeight: 900,
      textTransform: 'uppercase', color: c.text, marginBottom: '1rem',
    },
    sectionSub: { fontFamily: bodyFont, color: c.muted, fontSize: '1rem', lineHeight: 1.75, maxWidth: '560px', marginBottom: '3rem' },
    servicesGrid: { display: 'grid', gap: '1rem' },
    serviceCard: {
      background: c.secondary, padding: '1.75rem',
      borderLeft: `4px solid ${c.accent}`,
    },
    serviceName: { fontFamily: font, fontSize: '1.1rem', color: c.text, fontWeight: 900, marginBottom: '0.6rem', textTransform: 'uppercase' },
    serviceDesc: { fontFamily: bodyFont, color: c.muted, fontSize: '0.92rem', lineHeight: 1.7 },
    priceTag: {
      marginTop: '2rem', background: c.accent, display: 'inline-block',
      padding: '0.6rem 1.4rem',
    },
    priceTagText: { fontFamily: bodyFont, fontSize: '0.9rem', fontWeight: 700, color: '#fff' },
    aboutGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '3rem', alignItems: 'center' },
    aboutSidebar: {
      background: c.accent, padding: '2.5rem 2rem',
    },
    sidebarNum: { fontFamily: font, fontSize: 'clamp(3rem, 5vw, 4rem)', color: '#fff', fontWeight: 900, display: 'block', lineHeight: 1 },
    sidebarLabel: { fontFamily: bodyFont, fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '1.5rem', display: 'block' },
    sidebarDivider: { borderTop: '1px solid rgba(255,255,255,0.25)', margin: '1.5rem 0' },
    aboutText: { fontFamily: bodyFont, color: c.muted, fontSize: '1.05rem', lineHeight: 1.85 },
    testimonialRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' },
    testimonialCard: { background: c.secondary, padding: '2rem', position: 'relative' },
    quoteIcon: { fontFamily: font, fontSize: '4rem', color: c.accent, lineHeight: 0.8, marginBottom: '1rem', display: 'block', fontWeight: 900 },
    testimonialText: { fontFamily: bodyFont, color: c.muted, fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '1.2rem' },
    testimonialName: { fontFamily: font, fontSize: '0.9rem', color: c.text, fontWeight: 700, textTransform: 'uppercase' },
    ctaBand: {
      display: 'flex', flexWrap: 'wrap', overflow: 'hidden',
    },
    ctaLeft: {
      flex: '1 1 300px', background: c.accent,
      padding: 'clamp(3rem, 6vw, 5rem) clamp(1.5rem, 5vw, 4rem)',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
    },
    ctaRight: {
      flex: '1 1 300px', background: c.secondary,
      padding: 'clamp(3rem, 6vw, 5rem) clamp(1.5rem, 5vw, 4rem)',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
    },
    ctaHeading: { fontFamily: font, fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', color: '#fff', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem' },
    ctaPhone: { fontFamily: font, fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', color: '#fff', marginBottom: '1.5rem' },
    ctaBtn: {
      background: '#fff', color: c.accent, padding: '14px 30px',
      fontFamily: bodyFont, fontSize: '0.9rem', fontWeight: 700,
      textTransform: 'uppercase', cursor: 'pointer', border: 'none',
      alignSelf: 'flex-start',
    },
    ctaRightTitle: { fontFamily: font, fontSize: '1.2rem', color: c.text, fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem' },
    ctaRightText: { fontFamily: bodyFont, color: c.muted, fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '1.5rem' },
    footer: {
      background: '#0a0505', padding: 'clamp(2rem, 4vw, 3rem) clamp(1.5rem, 7vw, 5rem)',
      display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'space-between',
      borderTop: `3px solid ${c.accent}`,
    },
    footerName: { fontFamily: font, fontSize: '1.1rem', color: c.text, fontWeight: 900, textTransform: 'uppercase', marginBottom: '0.5rem' },
    footerText: { fontFamily: bodyFont, fontSize: '0.85rem', color: c.muted, lineHeight: 1.65 },
    footerLink: { color: c.accent, textDecoration: 'none', fontFamily: bodyFont, fontSize: '0.85rem', display: 'block', marginBottom: '0.35rem', fontWeight: 700 },
  };

  const defaultStats = [
    { num: businessInfo.yearsInBusiness ? `${businessInfo.yearsInBusiness}` : '10', label: 'Years in Business', alt: false },
    { num: '5K+', label: fb.statLabel2, alt: true },
    { num: '5.0', label: 'Google Rating', alt: false },
    { num: '100%', label: 'Satisfaction Rate', alt: true },
  ];
  const stats = (generatedCopy?.aboutStats || []).map((s, i) => ({
    num: s.value || defaultStats[i]?.num || '',
    label: s.label || defaultStats[i]?.label || '',
    alt: defaultStats[i]?.alt || false,
  }));
  if (stats.length === 0) stats.push(...defaultStats);

  const _svcItems = generatedCopy.servicesSection?.items || [];
  const svcCols = _svcItems.length >= 6 ? Math.ceil(_svcItems.length / 2) : _svcItems.length || 1;

  return (
    <div style={{ background: c.bg, color: c.text, fontFamily: bodyFont, containerType: 'inline-size', display: 'flex', flexDirection: 'column' }}>
      <style>{`@container(max-width:600px){.tp-nav-links a[href^="#"]{display:none!important}.tp-nav-links{gap:12px!important}.tp-2col{grid-template-columns:1fr!important}.tp-3col{grid-template-columns:1fr!important}.tp-sporty-logo{font-size:0.9rem!important;letter-spacing:0.04em!important;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block}.tp-sporty-phone{font-size:0.72rem!important;padding:7px 12px!important;letter-spacing:0.03em!important;white-space:nowrap}}`}</style>
      {/* NAV */}
      <nav style={{ ...s.nav, order: -1, gap: 12 }}>
        {images.logo ? (
          <img src={images.logo} alt={businessInfo.businessName || 'Logo'} style={{ height: 36, objectFit: 'contain' }} />
        ) : (
          <span className="tp-sporty-logo" style={{ ...s.navLogo, minWidth: 0, flex: '0 1 auto' }}>
            {businessInfo.businessName.split(' ').map((w, i) =>
              i === 0 ? <span key={i}>{w} </span> : <span key={i} style={s.navAccent}>{w} </span>
            )}
          </span>
        )}
        <div className="tp-nav-links" style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexShrink: 0 }}>
          <a href="#services" style={{ color: c.text, textDecoration: 'none', fontFamily: bodyFont, fontSize: '0.85rem', letterSpacing: '0.05em', opacity: 0.8 }}>Services</a>
          <a href="#about" style={{ color: c.text, textDecoration: 'none', fontFamily: bodyFont, fontSize: '0.85rem', letterSpacing: '0.05em', opacity: 0.8 }}>About</a>
          <a href="#reviews" style={{ color: c.text, textDecoration: 'none', fontFamily: bodyFont, fontSize: '0.85rem', letterSpacing: '0.05em', opacity: 0.8 }}>Reviews</a>
          <a href={'tel:' + (businessInfo.phone || '')} className="tp-sporty-phone" style={{ ...s.navPhone, textDecoration: 'none' }}>{businessInfo.phone}</a>
        </div>
      </nav>

      {/* HERO */}
      {!hidden('hero') && (
      <section id="hero" style={splitHero ? { order: getOrder('hero'), display: 'flex', flexDirection: 'row', minHeight: '85vh' } : { ...s.hero, order: getOrder('hero') }}>
        {!splitHero && <HeroImage src={images.hero} />}
        {!splitHero && <div style={s.heroSlash} />}
        {!splitHero && <div style={s.heroSlash2} />}
        <div style={splitHero ? {
          flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: 'clamp(3rem,6vw,6rem)', background: c.bg,
        } : { position: 'relative', zIndex: 1 }}>
          {businessInfo.awards && <div style={s.awardsTag}>{businessInfo.awards}</div>}
          <h1 style={s.heroH1}>
            {generatedCopy.headline.split(' ').map((word, i) =>
              i % 3 === 2 ? <span key={i} style={s.heroH1Accent}>{word} </span> : <span key={i}>{word} </span>
            )}
          </h1>
          <p style={s.heroSub}>{generatedCopy.subheadline}</p>
          <div style={s.ctaRow}>
            <a href={generatedCopy?.ctaPrimaryUrl || '#services'} style={{ ...s.ctaFilled, textDecoration: 'none' }}>{generatedCopy.ctaPrimary}</a>
            <a href={generatedCopy?.ctaSecondaryUrl || ('tel:' + (businessInfo.phone || ''))} style={{ ...s.ctaGhost, textDecoration: 'none' }}>{generatedCopy.ctaSecondary}</a>
          </div>
        </div>
        {splitHero && (
          <div style={{ flex: 1, position: 'relative', minHeight: '85vh', overflow: 'hidden' }}>
            {images.hero
              ? <img src={images.hero} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: '100%', height: '100%', background: c.secondary }} />
            }
          </div>
        )}
      </section>
      )}

      {/* STATS BAR */}
      {!hidden('statsBar') && (
      <div style={{ ...s.statsBar, order: getOrder('statsBar') }}>
        {stats.map((st, i) => (
          <div key={i} style={st.alt ? s.statBoxAlt : s.statBox}>
            <span style={st.alt ? s.statNumAlt : s.statNum}>{st.num}</span>
            <span style={st.alt ? s.statLabelAlt : s.statLabel}>{st.label}</span>
          </div>
        ))}
      </div>
      )}

      {/* SERVICES */}
      {!hidden('services') && (
      <section id="services" style={{ ...s.section, order: getOrder('services') }}>
        <div style={s.sectionTag}>What We Do</div>
        <h2 style={s.sectionTitle}>Our Services</h2>
        <p style={s.sectionSub}>{generatedCopy.servicesSection?.intro}</p>
        {businessInfo.packages?.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1px', background: c.accent + '22' }}>
            {businessInfo.packages.map((pkg, i) => (
              <div key={i} style={{ ...s.serviceCard, borderTop: `3px solid ${i === 1 ? c.accent : 'transparent'}` }}>
                <div style={s.serviceName}>{pkg.name || pkg}</div>
                {pkg.price && <div style={{ fontFamily: font, fontSize: '1.8rem', fontWeight: 900, color: c.accent, margin: '0.4rem 0 0.75rem' }}>{pkg.price}</div>}
                <div style={s.serviceDesc}>{pkg.description}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="tp-3col" style={{ ...s.servicesGrid, gridTemplateColumns: `repeat(${svcCols}, minmax(0, 1fr))` }}>
            {(generatedCopy.servicesSection?.items || []).map((svc, i) => (
              <div key={i} style={s.serviceCard}>
                <div style={s.serviceName}>{svc.name}</div>
                <div style={s.serviceDesc}>{svc.description}</div>
              </div>
            ))}
          </div>
        )}
      </section>
      )}

      {/* ABOUT */}
      {!hidden('about') && (
      <section id="about" style={{ ...s.sectionAlt, order: getOrder('about') }}>
        <div style={s.aboutGrid}>
          {(generatedCopy?.aboutLayout || 'image') !== 'stats' ? (
            images.about
              ? <img src={images.about} alt="About" style={{ width: '100%', height: '360px', objectFit: 'cover', borderRadius: '8px', display: 'block' }} />
              : <div style={{ width: '100%', height: '360px', background: c.secondary, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.muted, fontSize: '0.85rem' }}>Upload a photo in Images tab</div>
          ) : (
            <div style={s.aboutSidebar}>
              <span style={s.sidebarNum}>{businessInfo.yearsInBusiness || '10'}+</span>
              <span style={s.sidebarLabel}>Years in the Game</span>
              <div style={s.sidebarDivider} />
              <span style={{ fontFamily: bodyFont, color: 'rgba(255,255,255,0.85)', fontSize: '1rem', lineHeight: 1.6 }}>
                {businessInfo.tagline || generatedCopy.subheadline || `${businessInfo.city}, ${businessInfo.state}`}
              </span>
            </div>
          )}
          <div>
            <div style={s.sectionTag}>About Us</div>
            <h2 style={s.sectionTitle}>Built Different</h2>
            <p style={s.aboutText}>{generatedCopy.aboutText}</p>
          </div>
        </div>
      </section>
      )}

      {/* GALLERY */}
      {!hidden('gallery') && (
      <div style={{ order: getOrder('gallery') }}>
      <GallerySection images={images} colors={c} font={font} bodyFont={bodyFont} />
      </div>
      )}

      {/* TESTIMONIALS */}
      {!hidden('testimonials') && (
        generatedCopy?.googleWidgetKey ? (
          <div style={{ order: getOrder('testimonials'), padding: '80px 5%' }}>
            {generatedCopy.googleReviewsTitle && <h2 style={{ fontFamily: font || 'inherit', fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, textAlign: 'center', marginBottom: 32, color: c.text }}>{generatedCopy.googleReviewsTitle}</h2>}
            <GoogleReviewsWidget widgetKey={generatedCopy.googleWidgetKey} theme={generatedCopy?.googleReviewsTheme} />
          </div>
        ) : (generatedCopy.testimonialPlaceholders || []).length > 0 ? (
      <section id="reviews" style={{ ...s.section, order: getOrder('testimonials') }}>
        <div style={s.sectionTag}>Real Reviews</div>
        <h2 style={{ ...s.sectionTitle, marginBottom: '2rem' }}>The People Know</h2>
        <div style={s.testimonialRow}>
          {(generatedCopy.testimonialPlaceholders || []).map((t, i) => (
            <div key={i} style={s.testimonialCard}>
              <span style={s.quoteIcon}>"</span>
              <p style={s.testimonialText}>{t.text}</p>
              <div style={s.testimonialName}>{t.name}</div>
            </div>
          ))}
        </div>
      </section>
        ) : null
      )}

      {/* CTA SPLIT */}
      {!hidden('cta') && (
      <div style={{ ...s.ctaBand, order: getOrder('cta') }}>
        <div style={s.ctaLeft}>
          <div style={s.ctaHeading}>{generatedCopy.ctaHeadline || fb.ctaHeadline}</div>
          <div style={s.ctaPhone}>{businessInfo.phone}</div>
          {businessInfo.hours && <div style={{ fontFamily: bodyFont, color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{formatHours(businessInfo.hours)}</div>}
          <a href={generatedCopy?.ctaUrl || ('tel:' + (businessInfo.phone || ''))} style={{ ...s.ctaBtn, textDecoration: 'none' }}>{generatedCopy.ctaButtonText || generatedCopy.ctaPrimary}</a>
        </div>
        <div style={s.ctaRight}>
          <div style={s.ctaRightTitle}>Why {businessInfo.businessName}?</div>
          <div style={s.ctaRightText}>{businessInfo.tagline || generatedCopy.subheadline}</div>
          {businessInfo.paymentMethods?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {businessInfo.paymentMethods.map((pm, i) => (
                <span key={i} style={{ background: c.bg, color: c.muted, padding: '4px 12px', fontSize: '0.78rem', fontFamily: bodyFont, border: `1px solid ${c.accent}33` }}>{pm}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* FOOTER */}
      <footer style={{ ...s.footer, order: 9999 }}>
        <div>
          {/* Footer logo */}
          {images.logo ? (
            <img src={images.logo} alt={businessInfo.businessName} style={{ height: 48, maxWidth: 180, objectFit: 'contain', marginBottom: '0.75rem', display: 'block' }} />
          ) : (
            <div style={s.footerName}>{businessInfo.businessName}</div>
          )}
          <div style={s.footerText}>{generatedCopy.footerTagline}</div>
          {businessInfo.address && <div style={{ ...s.footerText, marginTop: '0.4rem' }}>{businessInfo.address}</div>}
        </div>
        {businessInfo.hours && (
          <div>
            <div style={{ ...s.footerText, color: c.accent, marginBottom: '0.4rem', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Hours</div>
            <div style={s.footerText}>{formatHours(businessInfo.hours)}</div>
          </div>
        )}
        <div>
          <SocialRow biz={businessInfo} color={c.accent} size={20} images={images} />
          {businessInfo.serviceArea && <div style={{ ...s.footerText, marginTop: '0.5rem' }}>Serving: {businessInfo.serviceArea}</div>}
        </div>
      </footer>
    </div>
  );
}
