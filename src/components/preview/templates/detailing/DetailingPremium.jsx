import React, { useState, useEffect } from 'react';

export default function DetailingPremium({ businessInfo, generatedCopy, templateMeta }) {
  const c = templateMeta.colors;
  const font = templateMeta.font;
  const bodyFont = templateMeta.bodyFont;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const s = {
    nav: {
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? 'rgba(10,8,5,0.97)' : 'transparent',
      borderBottom: `1px solid ${scrolled ? c.accent : 'transparent'}`,
      transition: 'all 0.3s ease',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 clamp(1rem, 5vw, 3rem)', height: '70px',
    },
    navLogo: {
      fontFamily: font, fontSize: 'clamp(1rem, 2vw, 1.3rem)',
      color: c.accent, letterSpacing: '0.12em', fontWeight: 700,
    },
    navPhone: {
      background: 'transparent', border: `1px solid ${c.accent}`,
      color: c.accent, padding: '8px 20px', fontFamily: bodyFont,
      fontSize: '0.85rem', letterSpacing: '0.08em', cursor: 'pointer',
    },
    hero: {
      minHeight: '100vh', background: c.bg,
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: 'clamp(5rem, 10vw, 8rem) clamp(1.5rem, 7vw, 5rem) clamp(3rem, 6vw, 5rem)',
      position: 'relative', overflow: 'hidden',
    },
    heroDiag: {
      position: 'absolute', top: 0, right: '28%', height: '100%', width: '1px',
      background: `linear-gradient(to bottom, transparent, ${c.accent}55, transparent)`,
    },
    heroDiag2: {
      position: 'absolute', top: 0, right: '32%', height: '100%', width: '1px',
      background: `linear-gradient(to bottom, transparent, ${c.accent}22, transparent)`,
    },
    cityBadge: {
      display: 'inline-block', border: `1px solid ${c.accent}66`,
      color: c.accent, fontSize: '0.7rem', letterSpacing: '0.2em',
      padding: '5px 14px', marginBottom: '2rem', fontFamily: bodyFont,
      textTransform: 'uppercase',
    },
    heroH1: {
      fontFamily: font, fontSize: 'clamp(2.4rem, 6vw, 5rem)',
      color: c.text, lineHeight: 1.1, marginBottom: '1.5rem',
      fontWeight: 700, maxWidth: '700px',
    },
    heroSub: {
      fontFamily: bodyFont, fontSize: 'clamp(1rem, 2vw, 1.2rem)',
      color: c.muted, marginBottom: '2.5rem', maxWidth: '500px', lineHeight: 1.7,
    },
    awardsRibbon: {
      display: 'inline-block', background: c.accent, color: c.bg,
      fontFamily: bodyFont, fontSize: '0.72rem', letterSpacing: '0.15em',
      textTransform: 'uppercase', padding: '6px 16px', marginBottom: '1.5rem',
      fontWeight: 700,
    },
    ctaRow: { display: 'flex', gap: '1rem', flexWrap: 'wrap' },
    ctaPrimary: {
      background: c.accent, color: c.bg, padding: '14px 32px',
      fontFamily: bodyFont, fontSize: '0.9rem', letterSpacing: '0.1em',
      textTransform: 'uppercase', cursor: 'pointer', border: 'none', fontWeight: 700,
    },
    ctaSecondary: {
      background: 'transparent', color: c.accent, padding: '14px 32px',
      fontFamily: bodyFont, fontSize: '0.9rem', letterSpacing: '0.1em',
      textTransform: 'uppercase', cursor: 'pointer', border: `1px solid ${c.accent}`,
    },
    statsBar: {
      background: c.secondary, padding: 'clamp(2rem, 4vw, 3rem) clamp(1.5rem, 5vw, 4rem)',
      display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around', gap: '2rem',
    },
    statItem: { textAlign: 'center', minWidth: '120px' },
    statNum: {
      fontFamily: font, fontSize: 'clamp(2rem, 4vw, 3rem)',
      color: c.accent, display: 'block', fontWeight: 700,
    },
    statLabel: {
      fontFamily: bodyFont, fontSize: '0.75rem', color: c.muted,
      letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: '0.4rem',
    },
    section: { padding: 'clamp(3rem, 7vw, 6rem) clamp(1.5rem, 7vw, 5rem)', background: c.bg },
    sectionAlt: { padding: 'clamp(3rem, 7vw, 6rem) clamp(1.5rem, 7vw, 5rem)', background: c.secondary },
    sectionLabel: {
      fontFamily: bodyFont, fontSize: '0.7rem', letterSpacing: '0.25em',
      textTransform: 'uppercase', color: c.accent, marginBottom: '0.75rem',
    },
    sectionTitle: {
      fontFamily: font, fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)',
      color: c.text, marginBottom: '1rem', fontWeight: 700,
    },
    sectionSub: {
      fontFamily: bodyFont, color: c.muted, fontSize: '1.05rem',
      lineHeight: 1.7, maxWidth: '600px', marginBottom: '3rem',
    },
    servicesGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      gap: '1.5rem',
    },
    serviceCard: {
      background: c.secondary, padding: '2rem', borderTop: `3px solid ${c.accent}`,
    },
    serviceName: {
      fontFamily: font, fontSize: '1.2rem', color: c.text,
      marginBottom: '0.75rem', fontWeight: 700,
    },
    serviceDesc: { fontFamily: bodyFont, color: c.muted, fontSize: '0.95rem', lineHeight: 1.7 },
    priceCallout: {
      marginTop: '2.5rem', border: `1px solid ${c.accent}44`,
      padding: '1.25rem 1.75rem', display: 'inline-block',
    },
    priceLabel: {
      fontFamily: bodyFont, fontSize: '0.7rem', letterSpacing: '0.2em',
      textTransform: 'uppercase', color: c.accent,
    },
    priceVal: { fontFamily: font, fontSize: '1.4rem', color: c.text, marginTop: '0.3rem' },
    aboutGrid: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '3rem', alignItems: 'start',
    },
    quoteWrapper: { position: 'relative', paddingLeft: '2rem' },
    quoteMark: {
      fontFamily: font, fontSize: '8rem', color: c.accent, lineHeight: 0.6,
      opacity: 0.25, position: 'absolute', top: '1rem', left: '-1rem',
      userSelect: 'none',
    },
    aboutText: { fontFamily: bodyFont, color: c.muted, fontSize: '1.05rem', lineHeight: 1.85 },
    testimonialGrid: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      gap: '1.5rem',
    },
    testimonialCard: { background: c.secondary, padding: '2rem' },
    stars: { color: c.accent, fontSize: '1rem', marginBottom: '1rem', letterSpacing: '2px' },
    testimonialText: { fontFamily: bodyFont, color: c.muted, fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '1.2rem' },
    testimonialName: { fontFamily: font, color: c.text, fontSize: '0.95rem' },
    ctaSection: {
      background: c.secondary, padding: 'clamp(3rem, 7vw, 6rem) clamp(1.5rem, 7vw, 5rem)',
      textAlign: 'center',
    },
    ctaBig: {
      fontFamily: font, fontSize: 'clamp(1.8rem, 4vw, 3rem)',
      color: c.text, marginBottom: '0.75rem', fontWeight: 700,
    },
    ctaPhone: {
      fontFamily: font, fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
      color: c.accent, marginBottom: '1.75rem', letterSpacing: '0.05em',
    },
    footer: {
      background: '#050403', padding: 'clamp(2rem, 5vw, 3.5rem) clamp(1.5rem, 7vw, 5rem)',
      display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'space-between',
    },
    footerName: { fontFamily: font, fontSize: '1.1rem', color: c.accent, marginBottom: '0.5rem' },
    footerText: { fontFamily: bodyFont, fontSize: '0.85rem', color: c.muted, lineHeight: 1.7 },
    footerLink: { color: c.accent, textDecoration: 'none', fontFamily: bodyFont, fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' },
  };

  const stats = [
    { num: businessInfo.yearsInBusiness ? `${businessInfo.yearsInBusiness}+` : '10+', label: 'Years of Excellence' },
    { num: '5,000+', label: 'Vehicles Perfected' },
    { num: '5.0', label: 'Star Rating' },
    { num: businessInfo.warranty || 'Lifetime', label: 'Satisfaction Guarantee' },
  ];

  return (
    <div style={{ background: c.bg, color: c.text, fontFamily: bodyFont }}>
      {/* NAV */}
      <nav style={s.nav}>
        <span style={s.navLogo}>{businessInfo.businessName}</span>
        <button style={s.navPhone}>{businessInfo.phone}</button>
      </nav>

      {/* HERO */}
      <section style={s.hero}>
        <div style={s.heroDiag} />
        <div style={s.heroDiag2} />
        {businessInfo.awards && <div style={s.awardsRibbon}>{businessInfo.awards}</div>}
        <div style={s.cityBadge}>{businessInfo.city}, {businessInfo.state}</div>
        <h1 style={s.heroH1}>{generatedCopy.headline}</h1>
        <p style={s.heroSub}>{generatedCopy.subheadline}</p>
        <div style={s.ctaRow}>
          <button style={s.ctaPrimary}>{generatedCopy.ctaPrimary}</button>
          <button style={s.ctaSecondary}>{generatedCopy.ctaSecondary}</button>
        </div>
      </section>

      {/* STATS BAR */}
      <div style={s.statsBar}>
        {stats.map((st, i) => (
          <div key={i} style={s.statItem}>
            <span style={s.statNum}>{st.num}</span>
            <span style={s.statLabel}>{st.label}</span>
          </div>
        ))}
      </div>

      {/* SERVICES */}
      <section style={s.section}>
        <div style={s.sectionLabel}>Our Services</div>
        <h2 style={s.sectionTitle}>Precision. Perfection. Prestige.</h2>
        <p style={s.sectionSub}>{generatedCopy.servicesSection?.intro}</p>
        <div style={s.servicesGrid}>
          {(generatedCopy.servicesSection?.items || []).map((svc, i) => (
            <div key={i} style={s.serviceCard}>
              <div style={s.serviceName}>{svc.name}</div>
              <div style={s.serviceDesc}>{svc.description}</div>
            </div>
          ))}
        </div>
        {businessInfo.priceRange && (
          <div style={s.priceCallout}>
            <div style={s.priceLabel}>Investment Range</div>
            <div style={s.priceVal}>{businessInfo.priceRange}</div>
          </div>
        )}
      </section>

      {/* ABOUT */}
      <section style={s.sectionAlt}>
        <div style={s.aboutGrid}>
          <div>
            <div style={s.sectionLabel}>Our Story</div>
            <h2 style={s.sectionTitle}>The Art of the Detail</h2>
          </div>
          <div style={s.quoteWrapper}>
            <span style={s.quoteMark}>"</span>
            <p style={s.aboutText}>{generatedCopy.aboutText}</p>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={s.section}>
        <div style={s.sectionLabel}>Client Words</div>
        <h2 style={{ ...s.sectionTitle, marginBottom: '2rem' }}>What Our Clients Say</h2>
        <div style={s.testimonialGrid}>
          {(generatedCopy.testimonialPlaceholders || []).map((t, i) => (
            <div key={i} style={s.testimonialCard}>
              <div style={s.stars}>★ ★ ★ ★ ★</div>
              <p style={s.testimonialText}>"{t.text}"</p>
              <div style={s.testimonialName}>— {t.name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA SECTION */}
      <section style={s.ctaSection}>
        <div style={s.sectionLabel}>Ready to Begin?</div>
        <div style={s.ctaBig}>Reserve Your Detail Session</div>
        <div style={s.ctaPhone}>{businessInfo.phone}</div>
        {businessInfo.hours && (
          <p style={{ fontFamily: bodyFont, color: c.muted, fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            {businessInfo.hours}
          </p>
        )}
        {businessInfo.paymentMethods?.length > 0 && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '1rem' }}>
            {businessInfo.paymentMethods.map((pm, i) => (
              <span key={i} style={{ border: `1px solid ${c.accent}44`, color: c.muted, padding: '4px 14px', fontSize: '0.78rem', fontFamily: bodyFont, letterSpacing: '0.1em' }}>{pm}</span>
            ))}
          </div>
        )}
        <div style={{ marginTop: '2rem' }}>
          <button style={s.ctaPrimary}>{generatedCopy.ctaPrimary}</button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={s.footer}>
        <div>
          <div style={s.footerName}>{businessInfo.businessName}</div>
          <div style={s.footerText}>{generatedCopy.footerTagline}</div>
          {businessInfo.address && <div style={{ ...s.footerText, marginTop: '0.5rem' }}>{businessInfo.address}</div>}
        </div>
        {businessInfo.hours && (
          <div>
            <div style={{ ...s.footerText, color: c.accent, marginBottom: '0.5rem', letterSpacing: '0.12em', fontSize: '0.7rem', textTransform: 'uppercase' }}>Hours</div>
            <div style={s.footerText}>{businessInfo.hours}</div>
          </div>
        )}
        <div>
          {businessInfo.instagram && <a href={`https://instagram.com/${businessInfo.instagram}`} style={s.footerLink}>Instagram</a>}
          {businessInfo.facebook && <a href={`https://facebook.com/${businessInfo.facebook}`} style={s.footerLink}>Facebook</a>}
          {businessInfo.serviceArea && <div style={{ ...s.footerText, marginTop: '0.5rem' }}>Serving: {businessInfo.serviceArea}</div>}
        </div>
      </footer>
    </div>
  );
}
