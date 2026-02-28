import React, { useState, useEffect } from 'react';

export default function DetailingSporty({ businessInfo, generatedCopy, templateMeta }) {
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
      fontFamily: font, fontSize: 'clamp(2.8rem, 8vw, 6.5rem)',
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
    servicesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' },
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
    aboutGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '3rem', alignItems: 'start' },
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

  const stats = [
    { num: businessInfo.yearsInBusiness ? `${businessInfo.yearsInBusiness}` : '10', label: 'Years Dominating', alt: false },
    { num: '5K+', label: 'Cars Transformed', alt: true },
    { num: '5.0', label: 'Google Rating', alt: false },
    { num: '100%', label: 'Satisfaction Rate', alt: true },
  ];

  return (
    <div style={{ background: c.bg, color: c.text, fontFamily: bodyFont }}>
      {/* NAV */}
      <nav style={s.nav}>
        <span style={s.navLogo}>
          {businessInfo.businessName.split(' ').map((w, i) =>
            i === 0 ? <span key={i}>{w} </span> : <span key={i} style={s.navAccent}>{w} </span>
          )}
        </span>
        <button style={s.navPhone}>{businessInfo.phone}</button>
      </nav>

      {/* HERO */}
      <section style={s.hero}>
        <div style={s.heroSlash} />
        <div style={s.heroSlash2} />
        {businessInfo.awards && <div style={s.awardsTag}>{businessInfo.awards}</div>}
        <h1 style={s.heroH1}>
          {generatedCopy.headline.split(' ').map((word, i) =>
            i % 3 === 2 ? <span key={i} style={s.heroH1Accent}>{word} </span> : <span key={i}>{word} </span>
          )}
        </h1>
        <p style={s.heroSub}>{generatedCopy.subheadline}</p>
        <div style={s.ctaRow}>
          <button style={s.ctaFilled}>{generatedCopy.ctaPrimary}</button>
          <button style={s.ctaGhost}>{generatedCopy.ctaSecondary}</button>
        </div>
      </section>

      {/* STATS BAR */}
      <div style={s.statsBar}>
        {stats.map((st, i) => (
          <div key={i} style={st.alt ? s.statBoxAlt : s.statBox}>
            <span style={st.alt ? s.statNumAlt : s.statNum}>{st.num}</span>
            <span style={st.alt ? s.statLabelAlt : s.statLabel}>{st.label}</span>
          </div>
        ))}
      </div>

      {/* SERVICES */}
      <section style={s.section}>
        <div style={s.sectionTag}>What We Do</div>
        <h2 style={s.sectionTitle}>Our Services</h2>
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
          <div style={s.priceTag}>
            <span style={s.priceTagText}>Starting From: {businessInfo.priceRange}</span>
          </div>
        )}
      </section>

      {/* ABOUT */}
      <section style={s.sectionAlt}>
        <div style={s.aboutGrid}>
          <div style={s.aboutSidebar}>
            <span style={s.sidebarNum}>{businessInfo.yearsInBusiness || '10'}+</span>
            <span style={s.sidebarLabel}>Years in the Game</span>
            <div style={s.sidebarDivider} />
            <span style={{ fontFamily: bodyFont, color: 'rgba(255,255,255,0.85)', fontSize: '1rem', lineHeight: 1.6 }}>
              {businessInfo.city}, {businessInfo.state}'s go-to shop for serious car care.
            </span>
            {businessInfo.certifications && (
              <>
                <div style={s.sidebarDivider} />
                <span style={{ fontFamily: bodyFont, color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{businessInfo.certifications}</span>
              </>
            )}
          </div>
          <div>
            <div style={s.sectionTag}>About Us</div>
            <h2 style={s.sectionTitle}>Built Different</h2>
            <p style={s.aboutText}>{generatedCopy.aboutText}</p>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={s.section}>
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

      {/* CTA SPLIT */}
      <div style={s.ctaBand}>
        <div style={s.ctaLeft}>
          <div style={s.ctaHeading}>Book Your Detail</div>
          <div style={s.ctaPhone}>{businessInfo.phone}</div>
          {businessInfo.hours && <div style={{ fontFamily: bodyFont, color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{businessInfo.hours}</div>}
          <button style={s.ctaBtn}>{generatedCopy.ctaPrimary}</button>
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

      {/* FOOTER */}
      <footer style={s.footer}>
        <div>
          <div style={s.footerName}>{businessInfo.businessName}</div>
          <div style={s.footerText}>{generatedCopy.footerTagline}</div>
          {businessInfo.address && <div style={{ ...s.footerText, marginTop: '0.4rem' }}>{businessInfo.address}</div>}
        </div>
        {businessInfo.hours && (
          <div>
            <div style={{ ...s.footerText, color: c.accent, marginBottom: '0.4rem', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Hours</div>
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
