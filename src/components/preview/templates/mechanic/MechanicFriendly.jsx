import React, { useState, useEffect } from 'react';

export default function MechanicFriendly({ businessInfo, generatedCopy, templateMeta }) {
  const c = templateMeta.colors;
  const font = templateMeta.font;
  const bodyFont = templateMeta.bodyFont;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Simple geometric SVG-style icon shapes rendered as divs
  const IconWrench = () => (
    <div style={{ width: 28, height: 28, position: 'relative' }}>
      <div style={{ position: 'absolute', width: 8, height: 22, background: c.accent, borderRadius: 4, top: 3, left: 10, transform: 'rotate(45deg)' }} />
      <div style={{ position: 'absolute', width: 16, height: 8, background: c.accent, borderRadius: '8px 8px 0 0', top: 0, left: 6 }} />
    </div>
  );
  const IconShield = () => (
    <div style={{ width: 26, height: 28, background: c.accent, clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />
    </div>
  );
  const IconClock = () => (
    <div style={{ width: 26, height: 26, borderRadius: '50%', border: `3px solid ${c.accent}`, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', width: 2, height: 9, background: c.accent, bottom: '50%', left: '50%', transformOrigin: 'bottom center', transform: 'translateX(-50%)' }} />
      <div style={{ position: 'absolute', width: 7, height: 2, background: c.accent, left: '50%', top: '50%', transformOrigin: 'left center' }} />
    </div>
  );
  const IconStar = () => (
    <div style={{ width: 26, height: 26, background: c.accent, clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }} />
  );

  const whyItems = [
    { icon: <IconWrench />, title: 'Expert Technicians', desc: 'Trained and certified mechanics with years of hands-on experience.' },
    { icon: <IconShield />, title: 'Guaranteed Work', desc: businessInfo.warranty ? `We stand behind our work with a ${businessInfo.warranty} guarantee.` : 'Every job is backed by our satisfaction guarantee.' },
    { icon: <IconClock />, title: 'Fast Turnaround', desc: 'We respect your time and get you back on the road quickly.' },
    { icon: <IconStar />, title: 'Local & Trusted', desc: `Proudly serving ${businessInfo.city} and surrounding areas since ${new Date().getFullYear() - (parseInt(businessInfo.yearsInBusiness) || 10)}.` },
  ];

  const s = {
    nav: {
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: '#fff',
      boxShadow: scrolled ? '0 2px 16px rgba(0,0,0,0.1)' : '0 1px 0 #eee',
      transition: 'box-shadow 0.3s',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 clamp(1.25rem, 5vw, 3rem)', height: '68px',
      borderTop: `4px solid ${c.accent}`,
    },
    navLogo: {
      fontFamily: font, fontSize: 'clamp(0.95rem, 1.8vw, 1.15rem)',
      color: c.bg, letterSpacing: '0.02em', fontWeight: 700,
    },
    navRight: { display: 'flex', alignItems: 'center', gap: '1rem' },
    navPhoneText: { fontFamily: bodyFont, fontSize: '0.92rem', color: c.bg, fontWeight: 600 },
    navBtn: {
      background: c.accent, color: '#fff', padding: '9px 20px',
      fontFamily: bodyFont, fontSize: '0.85rem', fontWeight: 700,
      cursor: 'pointer', border: 'none', borderRadius: '4px',
    },
    hero: {
      minHeight: '90vh', background: c.secondary || '#edf2f7',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: 'clamp(6rem, 12vw, 9rem) clamp(1.5rem, 7vw, 5rem) clamp(4rem, 7vw, 6rem)',
      position: 'relative', overflow: 'hidden',
    },
    heroAccentBar: {
      position: 'absolute', top: 0, left: 0, bottom: 0, width: '6px',
      background: c.accent,
    },
    trustedBadge: {
      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
      background: c.accent, color: '#fff',
      fontFamily: bodyFont, fontSize: '0.78rem', fontWeight: 700,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      padding: '7px 16px', borderRadius: '4px', marginBottom: '1.75rem',
      alignSelf: 'flex-start',
    },
    badgeDot: { width: 8, height: 8, background: '#fff', borderRadius: '50%' },
    heroH1: {
      fontFamily: font, fontSize: 'clamp(2.2rem, 5.5vw, 4.2rem)',
      color: c.bg, lineHeight: 1.15, marginBottom: '1.25rem', fontWeight: 700,
      maxWidth: '680px',
    },
    heroSub: {
      fontFamily: bodyFont, fontSize: 'clamp(1rem, 1.8vw, 1.1rem)',
      color: c.text, marginBottom: '2.25rem', maxWidth: '520px', lineHeight: 1.8,
    },
    heroCertBadge: {
      display: 'inline-block', border: `2px solid ${c.accent}`,
      color: c.accent, fontFamily: bodyFont, fontSize: '0.78rem', fontWeight: 700,
      padding: '6px 14px', borderRadius: '4px', marginBottom: '1.5rem',
    },
    ctaRow: { display: 'flex', gap: '0.85rem', flexWrap: 'wrap' },
    ctaMain: {
      background: c.accent, color: '#fff', padding: '14px 32px',
      fontFamily: bodyFont, fontSize: '0.95rem', fontWeight: 700,
      cursor: 'pointer', border: 'none', borderRadius: '4px',
    },
    ctaOutline: {
      background: 'transparent', color: c.bg, padding: '14px 32px',
      fontFamily: bodyFont, fontSize: '0.95rem', fontWeight: 600,
      cursor: 'pointer', border: `2px solid ${c.bg}33`, borderRadius: '4px',
    },
    whySection: {
      background: '#fff', padding: 'clamp(3rem, 7vw, 5rem) clamp(1.5rem, 7vw, 5rem)',
    },
    whyGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginTop: '2.5rem' },
    whyCard: {
      padding: '2rem 1.5rem', background: '#f8fafc',
      borderRadius: '8px', border: '1px solid #e8edf2',
    },
    whyIconBox: {
      width: '52px', height: '52px', background: c.accent + '15',
      borderRadius: '10px', display: 'flex', alignItems: 'center',
      justifyContent: 'center', marginBottom: '1.1rem',
    },
    whyTitle: { fontFamily: font, fontSize: '1rem', color: c.bg, fontWeight: 700, marginBottom: '0.5rem' },
    whyDesc: { fontFamily: bodyFont, fontSize: '0.88rem', color: c.text, lineHeight: 1.7 },
    section: { padding: 'clamp(3rem, 7vw, 5.5rem) clamp(1.5rem, 7vw, 5rem)', background: '#f8fafc' },
    sectionWhite: { padding: 'clamp(3rem, 7vw, 5.5rem) clamp(1.5rem, 7vw, 5rem)', background: '#fff' },
    sectionEyebrow: {
      fontFamily: bodyFont, fontSize: '0.72rem', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.2em', color: c.accent,
      marginBottom: '0.5rem',
    },
    sectionTitle: {
      fontFamily: font, fontSize: 'clamp(1.7rem, 3.2vw, 2.5rem)', fontWeight: 700,
      color: c.bg, marginBottom: '0.75rem',
    },
    sectionSub: { fontFamily: bodyFont, color: c.text, fontSize: '1rem', lineHeight: 1.75, maxWidth: '560px', marginBottom: '2.75rem' },
    servicesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' },
    serviceCard: {
      background: '#fff', padding: '1.75rem', borderRadius: '8px',
      boxShadow: '0 1px 8px rgba(0,0,0,0.06)', border: '1px solid #e8edf2',
      borderTop: `3px solid ${c.accent}`,
    },
    serviceName: { fontFamily: font, fontSize: '1.05rem', color: c.bg, fontWeight: 700, marginBottom: '0.6rem' },
    serviceDesc: { fontFamily: bodyFont, color: c.text, fontSize: '0.9rem', lineHeight: 1.7 },
    priceNote: {
      marginTop: '2rem', background: c.accent + '10',
      padding: '1rem 1.5rem', borderRadius: '6px',
      display: 'inline-flex', alignItems: 'center', gap: '0.75rem',
      border: `1px solid ${c.accent}25`,
    },
    priceNoteLabel: { fontFamily: bodyFont, fontSize: '0.85rem', color: c.text },
    priceNoteVal: { fontFamily: font, fontSize: '1.1rem', color: c.accent, fontWeight: 700 },
    aboutGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '3rem', alignItems: 'center' },
    aboutText: { fontFamily: bodyFont, color: c.text, fontSize: '1.05rem', lineHeight: 1.85 },
    certBadge: {
      display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
      background: c.bg, color: '#fff', padding: '10px 18px',
      borderRadius: '6px', marginTop: '1.5rem',
    },
    certIcon: { width: 18, height: 18, background: c.accent, borderRadius: '50%' },
    certText: { fontFamily: bodyFont, fontSize: '0.85rem', fontWeight: 600 },
    aboutHighlights: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
    highlightBox: {
      background: '#fff', padding: '1.25rem', borderRadius: '8px',
      boxShadow: '0 1px 8px rgba(0,0,0,0.05)', border: '1px solid #e8edf2', textAlign: 'center',
    },
    highlightNum: { fontFamily: font, fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', color: c.accent, fontWeight: 700, display: 'block' },
    highlightLabel: { fontFamily: bodyFont, fontSize: '0.78rem', color: c.text, marginTop: '0.25rem' },
    testimonialGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' },
    testimonialCard: {
      background: '#fff', padding: '1.75rem', borderRadius: '8px',
      boxShadow: '0 1px 8px rgba(0,0,0,0.06)', border: '1px solid #e8edf2',
    },
    starsRow: { color: c.accent, fontSize: '1rem', letterSpacing: '2px', marginBottom: '0.85rem' },
    testimonialText: { fontFamily: bodyFont, color: c.text, fontSize: '0.93rem', lineHeight: 1.7, marginBottom: '1.1rem' },
    testimonialName: { fontFamily: font, fontSize: '0.9rem', color: c.bg, fontWeight: 700 },
    contactSection: {
      background: c.bg, padding: 'clamp(3rem, 7vw, 5.5rem) clamp(1.5rem, 7vw, 5rem)',
    },
    contactGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '2.5rem' },
    contactTitle: {
      fontFamily: font, fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', color: '#fff',
      fontWeight: 700, marginBottom: '1rem',
    },
    contactPhone: {
      fontFamily: font, fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', color: c.accent,
      marginBottom: '1.25rem', display: 'block',
    },
    contactBtn: {
      background: c.accent, color: '#fff', padding: '13px 30px',
      fontFamily: bodyFont, fontSize: '0.95rem', fontWeight: 700,
      cursor: 'pointer', border: 'none', borderRadius: '4px', display: 'inline-block',
    },
    contactInfoCard: {
      background: 'rgba(255,255,255,0.07)', padding: '1.75rem',
      borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)',
    },
    contactInfoLabel: {
      fontFamily: bodyFont, fontSize: '0.7rem', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.18em', color: c.accent,
      marginBottom: '0.5rem', display: 'block',
    },
    contactInfoText: { fontFamily: bodyFont, fontSize: '0.95rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.7 },
    payPills: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' },
    payPill: {
      background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)',
      padding: '4px 12px', borderRadius: '100px', fontSize: '0.78rem', fontFamily: bodyFont,
    },
    footer: {
      background: '#0d1117', padding: 'clamp(2rem, 4vw, 3rem) clamp(1.5rem, 7vw, 5rem)',
      display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'space-between',
      borderTop: `4px solid ${c.accent}`,
    },
    footerLogo: { fontFamily: font, fontSize: '1.1rem', color: '#fff', fontWeight: 700, marginBottom: '0.5rem' },
    footerText: { fontFamily: bodyFont, fontSize: '0.84rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 },
    footerLink: { color: c.accent, textDecoration: 'none', fontFamily: bodyFont, fontSize: '0.84rem', display: 'block', marginBottom: '0.3rem', fontWeight: 600 },
    footerSectionLabel: { fontFamily: bodyFont, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#fff', marginBottom: '0.6rem' },
  };

  return (
    <div style={{ background: '#f8fafc', color: c.bg, fontFamily: bodyFont }}>
      {/* NAV */}
      <nav style={s.nav}>
        <span style={s.navLogo}>{businessInfo.businessName}</span>
        <div style={s.navRight}>
          <span style={s.navPhoneText}>{businessInfo.phone}</span>
          <button style={s.navBtn}>Get a Quote</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={s.hero}>
        <div style={s.heroAccentBar} />
        {businessInfo.yearsInBusiness && (
          <div style={s.trustedBadge}>
            <div style={s.badgeDot} />
            Trusted Since {new Date().getFullYear() - parseInt(businessInfo.yearsInBusiness)}
          </div>
        )}
        {!businessInfo.yearsInBusiness && businessInfo.awards && (
          <div style={s.trustedBadge}><div style={s.badgeDot} />{businessInfo.awards}</div>
        )}
        <h1 style={s.heroH1}>{generatedCopy.headline}</h1>
        <p style={s.heroSub}>{generatedCopy.subheadline}</p>
        {businessInfo.certifications && (
          <div style={s.heroCertBadge}>◆ {businessInfo.certifications}</div>
        )}
        <div style={s.ctaRow}>
          <button style={s.ctaMain}>{generatedCopy.ctaPrimary}</button>
          <button style={s.ctaOutline}>{generatedCopy.ctaSecondary}</button>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section style={s.whySection}>
        <div style={s.sectionEyebrow}>Why Choose Us</div>
        <h2 style={s.sectionTitle}>Your Neighborhood's Most Trusted Shop</h2>
        <div style={s.whyGrid}>
          {whyItems.map((item, i) => (
            <div key={i} style={s.whyCard}>
              <div style={s.whyIconBox}>{item.icon}</div>
              <div style={s.whyTitle}>{item.title}</div>
              <div style={s.whyDesc}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section style={s.section}>
        <div style={s.sectionEyebrow}>Our Services</div>
        <h2 style={s.sectionTitle}>Everything Your Car Needs</h2>
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
          <div style={s.priceNote}>
            <span style={s.priceNoteLabel}>Competitive Pricing:</span>
            <span style={s.priceNoteVal}>{businessInfo.priceRange}</span>
          </div>
        )}
        {businessInfo.brands && (
          <p style={{ fontFamily: bodyFont, fontSize: '0.88rem', color: c.text, marginTop: '1.25rem' }}>
            Brands we service: <strong>{businessInfo.brands}</strong>
          </p>
        )}
      </section>

      {/* ABOUT */}
      <section style={s.sectionWhite}>
        <div style={s.aboutGrid}>
          <div>
            <div style={s.sectionEyebrow}>About Us</div>
            <h2 style={{ ...s.sectionTitle, marginBottom: '1.25rem' }}>Part of Your Community</h2>
            <p style={s.aboutText}>{generatedCopy.aboutText}</p>
            {businessInfo.certifications && (
              <div style={s.certBadge}>
                <div style={s.certIcon} />
                <span style={s.certText}>{businessInfo.certifications}</span>
              </div>
            )}
          </div>
          <div style={s.aboutHighlights}>
            {[
              { num: `${businessInfo.yearsInBusiness || '10'}+`, label: 'Years Serving the Area' },
              { num: '5,000+', label: 'Satisfied Customers' },
              { num: '5.0 ★', label: 'Average Review Score' },
              { num: businessInfo.warranty || '100%', label: 'Satisfaction Guaranteed' },
            ].map((item, i) => (
              <div key={i} style={s.highlightBox}>
                <span style={s.highlightNum}>{item.num}</span>
                <span style={s.highlightLabel}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={s.section}>
        <div style={s.sectionEyebrow}>Customer Reviews</div>
        <h2 style={{ ...s.sectionTitle, marginBottom: '2rem' }}>Don't Just Take Our Word For It</h2>
        <div style={s.testimonialGrid}>
          {(generatedCopy.testimonialPlaceholders || []).map((t, i) => (
            <div key={i} style={s.testimonialCard}>
              <div style={s.starsRow}>★ ★ ★ ★ ★</div>
              <p style={s.testimonialText}>"{t.text}"</p>
              <div style={s.testimonialName}>{t.name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CONTACT */}
      <section style={s.contactSection}>
        <div style={s.contactGrid}>
          <div>
            <div style={{ fontFamily: bodyFont, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: c.accent, marginBottom: '0.5rem' }}>Contact Us</div>
            <h2 style={s.contactTitle}>Let's Get Your Car Fixed</h2>
            <span style={s.contactPhone}>{businessInfo.phone}</span>
            <button style={s.contactBtn}>{generatedCopy.ctaPrimary}</button>
            {businessInfo.paymentMethods?.length > 0 && (
              <div>
                <span style={{ ...s.contactInfoLabel, marginTop: '1.75rem', display: 'block' }}>We Accept</span>
                <div style={s.payPills}>
                  {businessInfo.paymentMethods.map((pm, i) => (
                    <span key={i} style={s.payPill}>{pm}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {businessInfo.address && (
              <div style={s.contactInfoCard}>
                <span style={s.contactInfoLabel}>Address</span>
                <span style={s.contactInfoText}>{businessInfo.address}<br />{businessInfo.city}, {businessInfo.state}</span>
              </div>
            )}
            {businessInfo.hours && (
              <div style={s.contactInfoCard}>
                <span style={s.contactInfoLabel}>Hours</span>
                <span style={s.contactInfoText}>{businessInfo.hours}</span>
              </div>
            )}
            {businessInfo.serviceArea && (
              <div style={s.contactInfoCard}>
                <span style={s.contactInfoLabel}>Service Area</span>
                <span style={s.contactInfoText}>{businessInfo.serviceArea}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={s.footer}>
        <div>
          <div style={s.footerLogo}>{businessInfo.businessName}</div>
          <div style={s.footerText}>{generatedCopy.footerTagline}</div>
          {businessInfo.address && <div style={{ ...s.footerText, marginTop: '0.4rem' }}>{businessInfo.address}</div>}
        </div>
        {businessInfo.hours && (
          <div>
            <div style={s.footerSectionLabel}>Hours</div>
            <div style={s.footerText}>{businessInfo.hours}</div>
          </div>
        )}
        <div>
          {businessInfo.instagram && <a href={`https://instagram.com/${businessInfo.instagram}`} style={s.footerLink}>Instagram</a>}
          {businessInfo.facebook && <a href={`https://facebook.com/${businessInfo.facebook}`} style={s.footerLink}>Facebook</a>}
          {businessInfo.phone && <div style={{ ...s.footerText, marginTop: '0.5rem' }}>{businessInfo.phone}</div>}
        </div>
      </footer>
    </div>
  );
}
