import React, { useState, useEffect } from 'react';
import { SocialRow } from '../SocialIcons.jsx';
import { formatHours } from '../../../../lib/formatHours.js';
import { HeroImage, AboutImage, GallerySection } from '../ImageLayers.jsx';

export default function DetailingMinimal({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const c = templateMeta.colors;
  const font = templateMeta.font;
  const bodyFont = templateMeta.bodyFont;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const s = {
    nav: {
      position: 'sticky', top: 0, zIndex: 100,
      background: '#fff',
      boxShadow: scrolled ? '0 1px 20px rgba(0,0,0,0.08)' : 'none',
      transition: 'box-shadow 0.3s ease',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 clamp(1.25rem, 5vw, 3.5rem)', height: '66px',
    },
    navLogo: {
      fontFamily: font, fontSize: 'clamp(1rem, 1.8vw, 1.2rem)',
      color: c.bg, letterSpacing: '0.04em', fontWeight: 700,
    },
    navPhone: {
      background: c.accent, color: '#fff', padding: '9px 22px',
      fontFamily: bodyFont, fontSize: '0.85rem', fontWeight: 600,
      cursor: 'pointer', border: 'none', borderRadius: '4px',
    },
    hero: {
      minHeight: '92vh', background: c.secondary || '#f5f5f5',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: 'clamp(6rem, 12vw, 9rem) clamp(1.5rem, 7vw, 5rem) clamp(4rem, 7vw, 6rem)',
      position: 'relative', overflow: 'hidden',
    },
    heroPill: {
      display: 'inline-block',
      background: c.accent + '15',
      color: c.accent,
      fontFamily: bodyFont, fontSize: '0.78rem', fontWeight: 600,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      padding: '7px 18px', borderRadius: '100px', marginBottom: '2rem',
      border: `1px solid ${c.accent}30`,
    },
    heroH1: {
      fontFamily: font, fontSize: 'clamp(2.4rem, 5.5vw, 4.5rem)',
      color: c.bg, lineHeight: 1.1, marginBottom: '1.5rem', fontWeight: 700,
      maxWidth: '750px',
    },
    heroSub: {
      fontFamily: bodyFont, fontSize: 'clamp(1rem, 1.8vw, 1.15rem)',
      color: c.text, marginBottom: '2.5rem', maxWidth: '520px', lineHeight: 1.75,
    },
    awardsChip: {
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      background: c.bg, color: '#fff',
      fontFamily: bodyFont, fontSize: '0.72rem', fontWeight: 600,
      padding: '5px 14px', borderRadius: '4px', marginBottom: '1.5rem',
    },
    ctaRow: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' },
    ctaPrimary: {
      background: c.accent, color: '#fff', padding: '13px 30px',
      fontFamily: bodyFont, fontSize: '0.9rem', fontWeight: 600,
      cursor: 'pointer', border: 'none', borderRadius: '4px',
    },
    ctaSecondary: {
      background: 'transparent', color: c.bg, padding: '13px 30px',
      fontFamily: bodyFont, fontSize: '0.9rem', fontWeight: 600,
      cursor: 'pointer', border: `1.5px solid ${c.bg}44`, borderRadius: '4px',
    },
    statsBar: {
      background: '#fff', padding: 'clamp(2rem, 4vw, 2.5rem) clamp(1.5rem, 5vw, 4rem)',
      display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around', gap: '1.5rem',
      boxShadow: '0 1px 0 #eee, 0 -1px 0 #eee',
    },
    statItem: { textAlign: 'center', minWidth: '100px' },
    statNum: {
      fontFamily: font, fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
      color: c.accent, display: 'block', fontWeight: 700,
    },
    statLabel: { fontFamily: bodyFont, fontSize: '0.75rem', color: c.text, marginTop: '0.3rem' },
    section: { padding: 'clamp(3rem, 7vw, 6rem) clamp(1.5rem, 7vw, 5rem)', background: '#fff' },
    sectionGray: { padding: 'clamp(3rem, 7vw, 6rem) clamp(1.5rem, 7vw, 5rem)', background: '#f7f7f8' },
    sectionEyebrow: {
      fontFamily: bodyFont, fontSize: '0.72rem', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.2em', color: c.accent,
      marginBottom: '0.6rem',
    },
    sectionTitle: {
      fontFamily: font, fontSize: 'clamp(1.7rem, 3.2vw, 2.6rem)', fontWeight: 700,
      color: c.bg, marginBottom: '0.75rem',
    },
    sectionSub: { fontFamily: bodyFont, color: c.text, fontSize: '1.05rem', lineHeight: 1.75, maxWidth: '560px', marginBottom: '3rem' },
    servicesGrid: { display: 'grid', gap: '1.25rem' },
    serviceCard: {
      background: '#fff', padding: '1.75rem', borderRadius: '8px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #eee',
    },
    serviceIcon: {
      width: '36px', height: '36px', background: c.accent + '15',
      borderRadius: '8px', marginBottom: '1rem', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    },
    serviceIconDot: { width: '14px', height: '14px', background: c.accent, borderRadius: '3px' },
    serviceName: { fontFamily: font, fontSize: '1.05rem', color: c.bg, fontWeight: 700, marginBottom: '0.6rem' },
    serviceDesc: { fontFamily: bodyFont, color: c.text, fontSize: '0.9rem', lineHeight: 1.7 },
    priceNote: {
      marginTop: '2rem', background: c.accent + '12',
      borderLeft: `3px solid ${c.accent}`, padding: '1rem 1.25rem', borderRadius: '0 6px 6px 0',
      display: 'inline-block',
    },
    priceText: { fontFamily: bodyFont, fontSize: '0.95rem', color: c.bg },
    priceVal: { fontWeight: 700, color: c.accent },
    aboutGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '3rem', alignItems: 'start' },
    aboutStatBoxes: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
    aboutStatBox: {
      background: '#fff', padding: '1.5rem', borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: '1px solid #eee', textAlign: 'center',
    },
    aboutStatNum: { fontFamily: font, fontSize: '1.8rem', color: c.accent, fontWeight: 700, display: 'block' },
    aboutStatLabel: { fontFamily: bodyFont, fontSize: '0.78rem', color: c.text, marginTop: '0.3rem' },
    aboutText: { fontFamily: bodyFont, color: c.text, fontSize: '1.05rem', lineHeight: 1.85 },
    testimonialGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' },
    testimonialCard: {
      background: '#fff', padding: '2rem', borderRadius: '10px',
      boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #eee',
    },
    starRow: { display: 'flex', gap: '3px', marginBottom: '1rem' },
    star: { width: '14px', height: '14px', background: c.accent, borderRadius: '2px' },
    testimonialText: { fontFamily: bodyFont, color: c.text, fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '1.25rem' },
    testimonialName: { fontFamily: font, fontSize: '0.9rem', color: c.bg, fontWeight: 700 },
    ctaBand: {
      background: c.accent, padding: 'clamp(3rem, 6vw, 5rem) clamp(1.5rem, 7vw, 5rem)',
      textAlign: 'center',
    },
    ctaBandTitle: {
      fontFamily: font, fontSize: 'clamp(1.8rem, 3.5vw, 3rem)', color: '#fff',
      fontWeight: 700, marginBottom: '0.75rem',
    },
    ctaBandSub: { fontFamily: bodyFont, fontSize: '1.05rem', color: 'rgba(255,255,255,0.85)', marginBottom: '2rem' },
    ctaBandPhone: { fontFamily: font, fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', color: '#fff', marginBottom: '1.5rem', display: 'block' },
    ctaBandBtn: {
      background: '#fff', color: c.accent, padding: '13px 32px',
      fontFamily: bodyFont, fontSize: '0.9rem', fontWeight: 700,
      cursor: 'pointer', border: 'none', borderRadius: '4px',
    },
    paymentPills: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '1.5rem' },
    paymentPill: {
      background: 'rgba(255,255,255,0.2)', color: '#fff',
      padding: '4px 14px', borderRadius: '100px', fontSize: '0.78rem',
      fontFamily: bodyFont,
    },
    footer: {
      background: '#fff', padding: 'clamp(2rem, 4vw, 3rem) clamp(1.5rem, 7vw, 5rem)',
      display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'space-between',
      borderTop: '1px solid #eee',
    },
    footerLogo: { fontFamily: font, fontSize: '1.1rem', color: c.bg, fontWeight: 700, marginBottom: '0.5rem' },
    footerText: { fontFamily: bodyFont, fontSize: '0.85rem', color: c.text, lineHeight: 1.65 },
    footerLink: { color: c.accent, textDecoration: 'none', fontFamily: bodyFont, fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem', fontWeight: 600 },
    footerHoursLabel: { fontFamily: bodyFont, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: c.bg, marginBottom: '0.4rem' },
  };

  const defaultStats = [
    { num: businessInfo.yearsInBusiness ? `${businessInfo.yearsInBusiness}+` : '10+', label: 'Years Experience' },
    { num: '5,000+', label: 'Happy Clients' },
    { num: '5.0 ★', label: 'Average Rating' },
    { num: businessInfo.warranty || '100%', label: 'Satisfaction Guaranteed' },
  ];
  const stats = (generatedCopy?.aboutStats || []).map((s, i) => ({
    num: s.value || defaultStats[i]?.num || '',
    label: s.label || defaultStats[i]?.label || '',
  }));
  if (stats.length === 0) stats.push(...defaultStats);

  const _svcItems = generatedCopy.servicesSection?.items || [];
  const svcCols = _svcItems.length >= 6 ? Math.ceil(_svcItems.length / 2) : _svcItems.length || 1;

  return (
    <div style={{ background: '#f7f7f8', color: c.bg, fontFamily: bodyFont, containerType: 'inline-size' }}>
      <style>{`@container(max-width:600px){.tp-nav-links a[href^="#"]{display:none!important}.tp-nav-links{gap:12px!important}.tp-2col{grid-template-columns:1fr!important}}`}</style>
      {/* NAV */}
      <nav style={s.nav}>
        {images.logo ? (
          <img src={images.logo} alt={businessInfo.businessName || 'Logo'} style={{ height: 36, objectFit: 'contain' }} />
        ) : (
          <span style={s.navLogo}>{businessInfo.businessName}</span>
        )}
        <div className="tp-nav-links" style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <a href="#services" style={{ color: c.bg, textDecoration: 'none', fontFamily: bodyFont, fontSize: '0.85rem', letterSpacing: '0.05em', opacity: 0.8 }}>Services</a>
          <a href="#about" style={{ color: c.bg, textDecoration: 'none', fontFamily: bodyFont, fontSize: '0.85rem', letterSpacing: '0.05em', opacity: 0.8 }}>About</a>
          <a href="#reviews" style={{ color: c.bg, textDecoration: 'none', fontFamily: bodyFont, fontSize: '0.85rem', letterSpacing: '0.05em', opacity: 0.8 }}>Reviews</a>
          <a href={'tel:' + (businessInfo.phone || '')} style={{ ...s.navPhone, textDecoration: 'none' }}>{businessInfo.phone}</a>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero" style={s.hero}>
        <HeroImage src={images.hero} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          {businessInfo.awards && <div style={s.awardsChip}>◆ {businessInfo.awards}</div>}
          <div style={s.heroPill}>Serving {businessInfo.city}, {businessInfo.state}</div>
          <h1 style={s.heroH1}>{generatedCopy.headline}</h1>
          <p style={s.heroSub}>{generatedCopy.subheadline}</p>
          <div style={s.ctaRow}>
            <a href={generatedCopy?.ctaPrimaryUrl || '#services'} style={{ ...s.ctaPrimary, textDecoration: 'none' }}>{generatedCopy.ctaPrimary}</a>
            <a href={generatedCopy?.ctaSecondaryUrl || ('tel:' + (businessInfo.phone || ''))} style={{ ...s.ctaSecondary, textDecoration: 'none' }}>{generatedCopy.ctaSecondary}</a>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div style={s.statsBar}>
        {stats.map((st, i) => (
          <div key={i} style={s.statItem}>
            <span style={s.statNum}>{st.num}</span>
            <span style={s.statLabel}>{st.label}</span>
          </div>
        ))}
      </div>

      {/* SERVICES */}
      <section id="services" style={s.section}>
        <div style={s.sectionEyebrow}>Services</div>
        <h2 style={s.sectionTitle}>What We Offer</h2>
        <p style={s.sectionSub}>{generatedCopy.servicesSection?.intro}</p>
        {businessInfo.packages?.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            {businessInfo.packages.map((pkg, i) => (
              <div key={i} style={{ ...s.serviceCard, borderTop: `3px solid ${i === 1 ? c.accent : 'transparent'}` }}>
                <div style={s.serviceName}>{pkg.name || pkg}</div>
                {pkg.price && <div style={{ fontFamily: font, fontSize: '1.8rem', fontWeight: 700, color: c.accent, margin: '0.4rem 0 0.75rem' }}>{pkg.price}</div>}
                <div style={s.serviceDesc}>{pkg.description}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...s.servicesGrid, gridTemplateColumns: `repeat(${svcCols}, 1fr)` }}>
            {(generatedCopy.servicesSection?.items || []).map((svc, i) => (
              <div key={i} style={s.serviceCard}>
                <div style={s.serviceIcon}><div style={s.serviceIconDot} /></div>
                <div style={s.serviceName}>{svc.name}</div>
                <div style={s.serviceDesc}>{svc.description}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ABOUT */}
      <section id="about" style={s.sectionGray}>
        <div style={s.aboutGrid}>
          <div>
            <div style={s.sectionEyebrow}>About Us</div>
            <h2 style={{ ...s.sectionTitle, marginBottom: '1.5rem' }}>Our Commitment to Excellence</h2>
            <div className="tp-2col" style={s.aboutStatBoxes}>
              {[
                { num: `${businessInfo.yearsInBusiness || '10'}+`, label: 'Years in Business' },
                { num: '5K+', label: 'Cars Serviced' },
                { num: '5.0', label: 'Star Rating' },
                { num: '100%', label: 'Guaranteed' },
              ].map((item, i) => (
                <div key={i} style={s.aboutStatBox}>
                  <span style={s.aboutStatNum}>{item.num}</span>
                  <span style={s.aboutStatLabel}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p style={{ ...s.aboutText, marginBottom: '1.5rem' }}>{generatedCopy.aboutText}</p>
            <div style={{ marginTop: '2rem' }}><AboutImage src={images.about} accent={c.accent} /></div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="reviews" style={s.section}>
        <div style={s.sectionEyebrow}>Testimonials</div>
        <h2 style={{ ...s.sectionTitle, marginBottom: '2rem' }}>What Clients Are Saying</h2>
        <div style={s.testimonialGrid}>
          {(generatedCopy.testimonialPlaceholders || []).map((t, i) => (
            <div key={i} style={s.testimonialCard}>
              <div style={s.starRow}>
                {[1,2,3,4,5].map(n => <div key={n} style={s.star} />)}
              </div>
              <p style={s.testimonialText}>"{t.text}"</p>
              <div style={s.testimonialName}>{t.name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA BAND */}
      <section style={s.ctaBand}>
        <div style={s.ctaBandTitle}>Ready for a Perfect Detail?</div>
        <div style={s.ctaBandSub}>{businessInfo.tagline || generatedCopy.subheadline}</div>
        <span style={s.ctaBandPhone}>{businessInfo.phone}</span>
        {businessInfo.hours && (
          <p style={{ fontFamily: bodyFont, color: 'rgba(255,255,255,0.75)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>{formatHours(businessInfo.hours)}</p>
        )}
        <div><a href={generatedCopy?.ctaUrl || ('tel:' + (businessInfo.phone || ''))} style={{ ...s.ctaBandBtn, textDecoration: 'none' }}>{generatedCopy.ctaPrimary}</a></div>
        {businessInfo.paymentMethods?.length > 0 && (
          <div style={s.paymentPills}>
            {businessInfo.paymentMethods.map((pm, i) => (
              <span key={i} style={s.paymentPill}>{pm}</span>
            ))}
          </div>
        )}
      </section>

      {/* FOOTER */}

      {/* GALLERY */}
      <GallerySection images={images} colors={c} font={font} bodyFont={bodyFont} />
      <footer style={s.footer}>
        <div>
          <div style={s.footerLogo}>{businessInfo.businessName}</div>
          <div style={s.footerText}>{generatedCopy.footerTagline}</div>
          {businessInfo.address && <div style={{ ...s.footerText, marginTop: '0.4rem' }}>{businessInfo.address}</div>}
        </div>
        {businessInfo.hours && (
          <div>
            <div style={s.footerHoursLabel}>Hours</div>
            <div style={s.footerText}>{formatHours(businessInfo.hours)}</div>
          </div>
        )}
        <div>
          <SocialRow biz={businessInfo} color={c.accent} size={20} images={images} />
          {businessInfo.serviceArea && <div style={{ ...s.footerText, marginTop: '0.5rem' }}>Serving {businessInfo.serviceArea}</div>}
        </div>
      </footer>
    </div>
  );
}
