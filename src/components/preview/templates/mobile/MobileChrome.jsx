import { useState, useEffect } from 'react';

export default function MobileChrome({ businessInfo, generatedCopy, templateMeta }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const c = templateMeta.colors;
  const font = templateMeta.font;
  const bodyFont = templateMeta.bodyFont;

  // Chrome shimmer gradient
  const chromeGradient = `linear-gradient(135deg, #94a3b8 0%, #cbd5e1 30%, #94a3b8 50%, #64748b 70%, #94a3b8 100%)`;

  const stats = [
    { value: businessInfo.yearsInBusiness ? `${businessInfo.yearsInBusiness}+` : '10+', label: 'Years Experience' },
    { value: '1,000+', label: 'Vehicles Detailed' },
    { value: businessInfo.priceRange || '$$$', label: 'Price Range' },
    { value: '100%', label: 'Satisfaction Rate' },
  ];

  const navStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    background: scrolled ? 'rgba(10,10,10,0.97)' : 'transparent',
    backdropFilter: scrolled ? 'blur(20px)' : 'none',
    borderBottom: scrolled ? '1px solid rgba(148,163,184,0.2)' : '1px solid transparent',
    transition: 'all 0.4s ease',
    fontFamily: bodyFont,
  };

  // Chrome line dividers for hero (thin 1px horizontal lines)
  const chromeLine = (top, opacity = 0.12) => ({
    position: 'absolute',
    left: 0,
    right: 0,
    top,
    height: '1px',
    background: `linear-gradient(90deg, transparent 0%, rgba(148,163,184,${opacity}) 20%, rgba(203,213,225,${opacity * 1.5}) 50%, rgba(148,163,184,${opacity}) 80%, transparent 100%)`,
    pointerEvents: 'none',
  });

  const heroStyle = {
    minHeight: '100vh',
    background: c.bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  };

  const heroGlowStyle = {
    position: 'absolute',
    top: '30%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '600px',
    height: '600px',
    background: 'radial-gradient(ellipse, rgba(148,163,184,0.04) 0%, transparent 70%)',
    pointerEvents: 'none',
  };

  const sectionStyle = (bg) => ({
    padding: '88px 24px',
    background: bg || c.bg,
    fontFamily: bodyFont,
    position: 'relative',
  });

  const cardStyle = {
    background: c.secondary,
    border: '1px solid rgba(148,163,184,0.12)',
    borderRadius: '2px',
    padding: '36px 28px',
    flex: '1 1 260px',
    maxWidth: '360px',
    position: 'relative',
    overflow: 'hidden',
    transition: 'border-color 0.2s ease',
  };

  const cardAccentTop = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '1px',
    background: chromeGradient,
  };

  const accentBtnStyle = {
    display: 'inline-block',
    background: chromeGradient,
    color: '#000000',
    padding: '14px 36px',
    borderRadius: '1px',
    fontWeight: 700,
    fontSize: '0.9rem',
    textDecoration: 'none',
    fontFamily: font,
    cursor: 'pointer',
    border: 'none',
    letterSpacing: '2px',
    textTransform: 'uppercase',
  };

  const outlineBtnStyle = {
    display: 'inline-block',
    background: 'transparent',
    color: c.accent,
    padding: '14px 36px',
    borderRadius: '1px',
    fontWeight: 700,
    fontSize: '0.9rem',
    textDecoration: 'none',
    fontFamily: font,
    cursor: 'pointer',
    border: `1px solid rgba(148,163,184,0.5)`,
    letterSpacing: '2px',
    textTransform: 'uppercase',
  };

  const pricingTierStyle = (featured) => ({
    background: featured ? c.secondary : 'transparent',
    border: featured ? `1px solid rgba(148,163,184,0.35)` : `1px solid rgba(148,163,184,0.1)`,
    borderRadius: '2px',
    padding: '40px 32px',
    flex: '1 1 240px',
    maxWidth: '320px',
    position: 'relative',
    overflow: 'hidden',
    textAlign: 'center',
  });

  return (
    <div style={{ background: c.bg, color: c.text, fontFamily: bodyFont }}>
      {/* NAV */}
      <nav style={navStyle}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '72px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '28px', height: '28px', background: chromeGradient, borderRadius: '50%' }} />
            <div style={{ fontFamily: font, fontWeight: 700, fontSize: '1.1rem', color: '#ffffff', letterSpacing: '3px', textTransform: 'uppercase' }}>
              {businessInfo.businessName}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '36px', alignItems: 'center' }}>
            {['Services', 'Packages', 'About', 'Contact'].map(link => (
              <a key={link} href={`#${link.toLowerCase()}`} style={{ color: c.muted, textDecoration: 'none', fontWeight: 400, fontSize: '0.82rem', letterSpacing: '2px', textTransform: 'uppercase', transition: 'color 0.2s' }}>{link}</a>
            ))}
            <a href={`tel:${businessInfo.phone}`} style={accentBtnStyle}>{businessInfo.phone}</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={heroStyle}>
        <div style={heroGlowStyle} />
        {/* Chrome horizontal lines */}
        {[15, 25, 75, 85].map((top, i) => (
          <div key={i} style={chromeLine(`${top}%`, i % 2 === 0 ? 0.1 : 0.06)} />
        ))}
        {/* Vertical chrome accent lines */}
        <div style={{ position: 'absolute', left: '8%', top: 0, bottom: 0, width: '1px', background: 'linear-gradient(180deg, transparent 0%, rgba(148,163,184,0.08) 30%, rgba(148,163,184,0.08) 70%, transparent 100%)' }} />
        <div style={{ position: 'absolute', right: '8%', top: 0, bottom: 0, width: '1px', background: 'linear-gradient(180deg, transparent 0%, rgba(148,163,184,0.08) 30%, rgba(148,163,184,0.08) 70%, transparent 100%)' }} />

        <div style={{ textAlign: 'center', maxWidth: '800px', padding: '140px 24px 100px', position: 'relative', zIndex: 1 }}>
          {/* Elite badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', border: '1px solid rgba(148,163,184,0.25)', borderRadius: '1px', padding: '10px 24px', marginBottom: '36px' }}>
            <div style={{ width: '6px', height: '6px', background: chromeGradient, borderRadius: '50%' }} />
            <span style={{ fontFamily: font, fontSize: '0.72rem', fontWeight: 600, letterSpacing: '4px', textTransform: 'uppercase', background: chromeGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Elite Mobile Detailing
            </span>
            <div style={{ width: '6px', height: '6px', background: chromeGradient, borderRadius: '50%' }} />
          </div>
          <h1 style={{ fontFamily: font, fontSize: 'clamp(2.4rem, 5vw, 4rem)', fontWeight: 300, color: c.text, lineHeight: 1.15, marginBottom: '24px', letterSpacing: '-1px' }}>
            {generatedCopy.headline}
          </h1>
          <div style={{ width: '80px', height: '1px', background: chromeGradient, margin: '0 auto 28px' }} />
          <p style={{ fontSize: '1.05rem', color: c.muted, marginBottom: '48px', lineHeight: 1.8, maxWidth: '560px', margin: '0 auto 48px', fontWeight: 300, letterSpacing: '0.3px' }}>
            {generatedCopy.subheadline}
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button style={accentBtnStyle}>{generatedCopy.ctaPrimary}</button>
            <button style={outlineBtnStyle}>{generatedCopy.ctaSecondary}</button>
          </div>
          {businessInfo.tagline && (
            <p style={{ marginTop: '36px', color: 'rgba(148,163,184,0.5)', fontSize: '0.82rem', letterSpacing: '2px', textTransform: 'uppercase' }}>{businessInfo.tagline}</p>
          )}
        </div>
      </section>

      {/* STATS BAR */}
      <section style={{ background: c.secondary, borderTop: '1px solid rgba(148,163,184,0.1)', borderBottom: '1px solid rgba(148,163,184,0.1)', padding: '44px 24px', fontFamily: bodyFont }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '24px' }}>
          {stats.map((s, i) => (
            <div key={i} style={{ textAlign: 'center', position: 'relative' }}>
              {i < stats.length - 1 && <div style={{ position: 'absolute', right: '-40px', top: '20%', bottom: '20%', width: '1px', background: 'rgba(148,163,184,0.15)' }} />}
              <div style={{ fontFamily: font, fontSize: '2rem', fontWeight: 300, background: chromeGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', color: c.muted, letterSpacing: '2.5px', textTransform: 'uppercase', marginTop: '6px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" style={sectionStyle()}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(148,163,184,0.08), transparent)' }} />
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div style={{ display: 'inline-block', width: '40px', height: '1px', background: chromeGradient, marginBottom: '20px' }} />
            <h2 style={{ fontFamily: font, fontSize: '2.2rem', fontWeight: 300, color: c.text, marginBottom: '16px', letterSpacing: '-0.5px' }}>Our Services</h2>
            <p style={{ color: c.muted, maxWidth: '520px', margin: '0 auto', fontSize: '0.95rem', lineHeight: 1.8, fontWeight: 300 }}>{generatedCopy.servicesSection.intro}</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
            {generatedCopy.servicesSection.items.map((svc, i) => (
              <div key={i} style={cardStyle}>
                <div style={cardAccentTop} />
                <div style={{ fontFamily: font, fontSize: '0.68rem', letterSpacing: '3px', textTransform: 'uppercase', background: chromeGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '14px' }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 style={{ fontFamily: font, fontSize: '1.05rem', fontWeight: 500, color: c.text, marginBottom: '12px', letterSpacing: '0.5px' }}>{svc.name}</h3>
                <p style={{ color: c.muted, fontSize: '0.88rem', lineHeight: 1.7, fontWeight: 300 }}>{svc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PACKAGES - Premium pricing table */}
      {businessInfo.packages && businessInfo.packages.length > 0 && (
        <section id="packages" style={{ ...sectionStyle(c.secondary), borderTop: '1px solid rgba(148,163,184,0.08)', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
              <h2 style={{ fontFamily: font, fontSize: '2.2rem', fontWeight: 300, color: c.text, marginBottom: '12px', letterSpacing: '-0.5px' }}>Premium Packages</h2>
              <div style={{ width: '60px', height: '1px', background: chromeGradient, margin: '0 auto' }} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
              {businessInfo.packages.map((pkg, i) => (
                <div key={i} style={pricingTierStyle(i === 1)}>
                  {i === 1 && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: chromeGradient }} />}
                  {i === 1 && (
                    <div style={{ position: 'absolute', top: '16px', right: '16px', border: `1px solid rgba(148,163,184,0.4)`, color: c.muted, fontSize: '0.62rem', fontWeight: 600, padding: '3px 8px', letterSpacing: '2px', textTransform: 'uppercase' }}>FEATURED</div>
                  )}
                  <div style={{ fontFamily: font, fontSize: '0.72rem', letterSpacing: '3px', textTransform: 'uppercase', color: c.muted, marginBottom: '12px' }}>Package {String(i + 1).padStart(2, '0')}</div>
                  <div style={{ fontFamily: font, fontSize: '1.3rem', fontWeight: 500, color: c.text, marginBottom: '8px' }}>{pkg.name || pkg}</div>
                  {pkg.price && (
                    <div style={{ fontSize: '2.2rem', fontWeight: 300, background: chromeGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '16px', fontFamily: font }}>{pkg.price}</div>
                  )}
                  {pkg.description && <p style={{ color: c.muted, fontSize: '0.85rem', lineHeight: 1.7, fontWeight: 300 }}>{pkg.description}</p>}
                  <div style={{ marginTop: '24px' }}>
                    <button style={{ ...accentBtnStyle, padding: '10px 24px', fontSize: '0.78rem' }}>Select</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ABOUT */}
      <section id="about" style={sectionStyle()}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', gap: '80px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', minWidth: '260px' }}>
            <div style={{ width: '100%', maxWidth: '440px', height: '360px', background: c.secondary, border: '1px solid rgba(148,163,184,0.1)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: chromeGradient }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', background: chromeGradient }} />
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${15 + i * 15}%`, height: '1px', background: `rgba(148,163,184,${0.04 - i * 0.004})` }} />
              ))}
              <span style={{ fontSize: '4rem', opacity: 0.4 }}>◈</span>
            </div>
          </div>
          <div style={{ flex: '1 1 380px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ width: '24px', height: '1px', background: chromeGradient }} />
              <span style={{ fontSize: '0.72rem', letterSpacing: '3px', textTransform: 'uppercase', color: c.muted }}>About Us</span>
            </div>
            <h2 style={{ fontFamily: font, fontSize: '2rem', fontWeight: 300, color: c.text, marginBottom: '24px', lineHeight: 1.3, letterSpacing: '-0.5px' }}>
              Precision Detailing, Delivered to You
            </h2>
            <p style={{ color: c.muted, lineHeight: 1.85, fontSize: '0.95rem', marginBottom: '32px', fontWeight: 300 }}>{generatedCopy.aboutText}</p>
            {businessInfo.certifications && businessInfo.certifications.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '0.68rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'rgba(148,163,184,0.4)', marginBottom: '10px' }}>Certifications</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {businessInfo.certifications.map((cert, i) => (
                    <span key={i} style={{ border: '1px solid rgba(148,163,184,0.2)', color: c.muted, padding: '5px 14px', fontSize: '0.78rem', letterSpacing: '0.5px' }}>{cert}</span>
                  ))}
                </div>
              </div>
            )}
            {businessInfo.awards && businessInfo.awards.length > 0 && (
              <div>
                <div style={{ fontSize: '0.68rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'rgba(148,163,184,0.4)', marginBottom: '10px' }}>Recognition</div>
                {businessInfo.awards.map((award, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(148,163,184,0.06)', color: c.muted, fontSize: '0.88rem', fontWeight: 300 }}>
                    <div style={{ width: '4px', height: '4px', background: chromeGradient, borderRadius: '50%', flexShrink: 0 }} />
                    {award}
                  </div>
                ))}
              </div>
            )}
            {businessInfo.serviceArea && (
              <p style={{ marginTop: '20px', color: 'rgba(148,163,184,0.5)', fontSize: '0.82rem', letterSpacing: '1px' }}>
                Service Area: {businessInfo.serviceArea}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ ...sectionStyle(c.secondary), borderTop: '1px solid rgba(148,163,184,0.08)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 style={{ fontFamily: font, fontSize: '2.2rem', fontWeight: 300, color: c.text, letterSpacing: '-0.5px' }}>Client Testimonials</h2>
            <div style={{ width: '60px', height: '1px', background: chromeGradient, margin: '16px auto 0' }} />
          </div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {generatedCopy.testimonialPlaceholders.map((t, i) => (
              <div key={i} style={{ background: c.bg, border: '1px solid rgba(148,163,184,0.1)', padding: '32px', maxWidth: '360px', flex: '1 1 260px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: chromeGradient }} />
                <div style={{ fontSize: '0.75rem', letterSpacing: '3px', background: chromeGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '16px' }}>★ ★ ★ ★ ★</div>
                <p style={{ color: c.muted, fontSize: '0.92rem', lineHeight: 1.75, fontStyle: 'italic', marginBottom: '20px', fontWeight: 300 }}>"{t.text}"</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '24px', height: '1px', background: chromeGradient }} />
                  <span style={{ color: c.text, fontSize: '0.82rem', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 500 }}>{t.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT / CTA */}
      <section id="contact" style={{ ...sectionStyle(), borderTop: '1px solid rgba(148,163,184,0.08)', textAlign: 'center' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ width: '1px', height: '60px', background: chromeGradient, margin: '0 auto 40px' }} />
          <h2 style={{ fontFamily: font, fontSize: '2.4rem', fontWeight: 300, color: c.text, marginBottom: '16px', letterSpacing: '-1px' }}>
            Book Your Detail Today
          </h2>
          <p style={{ color: c.muted, fontSize: '1rem', marginBottom: '48px', lineHeight: 1.8, fontWeight: 300 }}>
            {businessInfo.phone && `Call us at ${businessInfo.phone}.`} {businessInfo.address && `We come to you in ${businessInfo.city}, ${businessInfo.state}.`}
            {businessInfo.hours && ` Available ${businessInfo.hours}.`}
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '32px' }}>
            <a href={`tel:${businessInfo.phone}`} style={accentBtnStyle}>Call Now</a>
            <button style={outlineBtnStyle}>Get a Quote</button>
          </div>
          {businessInfo.paymentMethods && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '24px' }}>
              <span style={{ color: 'rgba(148,163,184,0.35)', fontSize: '0.72rem', letterSpacing: '2px', textTransform: 'uppercase', marginRight: '8px', alignSelf: 'center' }}>We Accept:</span>
              {businessInfo.paymentMethods.map((pm, i) => (
                <span key={i} style={{ border: '1px solid rgba(148,163,184,0.15)', color: c.muted, padding: '5px 12px', fontSize: '0.75rem', letterSpacing: '0.5px' }}>{pm}</span>
              ))}
            </div>
          )}
          {businessInfo.warranty && (
            <p style={{ marginTop: '28px', color: 'rgba(148,163,184,0.4)', fontSize: '0.82rem', letterSpacing: '0.5px' }}>
              🛡️ {businessInfo.warranty}
            </p>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#050505', borderTop: '1px solid rgba(148,163,184,0.08)', padding: '52px 24px', fontFamily: bodyFont }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '32px', marginBottom: '48px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ width: '20px', height: '20px', background: chromeGradient, borderRadius: '50%' }} />
                <div style={{ fontFamily: font, fontSize: '1rem', fontWeight: 600, color: '#ffffff', letterSpacing: '3px', textTransform: 'uppercase' }}>{businessInfo.businessName}</div>
              </div>
              <p style={{ color: 'rgba(148,163,184,0.35)', fontSize: '0.85rem', maxWidth: '300px', lineHeight: 1.6, fontWeight: 300 }}>{generatedCopy.footerTagline}</p>
            </div>
            <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
              {businessInfo.instagram && (
                <a href={businessInfo.instagram} target="_blank" rel="noreferrer" style={{ color: 'rgba(148,163,184,0.4)', textDecoration: 'none', fontSize: '0.78rem', letterSpacing: '2px', textTransform: 'uppercase' }}>Instagram</a>
              )}
              {businessInfo.facebook && (
                <a href={businessInfo.facebook} target="_blank" rel="noreferrer" style={{ color: 'rgba(148,163,184,0.4)', textDecoration: 'none', fontSize: '0.78rem', letterSpacing: '2px', textTransform: 'uppercase' }}>Facebook</a>
              )}
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(148,163,184,0.06)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <p style={{ color: 'rgba(148,163,184,0.2)', fontSize: '0.75rem', letterSpacing: '0.5px' }}>© {new Date().getFullYear()} {businessInfo.businessName}. All rights reserved.</p>
            <p style={{ color: 'rgba(148,163,184,0.2)', fontSize: '0.75rem' }}>{businessInfo.city}, {businessInfo.state}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
