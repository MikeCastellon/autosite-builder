import { useState, useEffect } from 'react';

export default function TintElite({ businessInfo, generatedCopy, templateMeta }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 70);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const c = templateMeta.colors;
  // templateMeta.font = Playfair Display / serif for headings
  // templateMeta.bodyFont = body font
  const font = templateMeta.font;
  const bodyFont = templateMeta.bodyFont;

  // Gold gradient
  const goldGradient = `linear-gradient(135deg, #ca8a04 0%, #eab308 35%, #fde047 55%, #eab308 75%, #ca8a04 100%)`;
  const goldGradientText = { background: goldGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' };

  const stats = [
    { value: businessInfo.yearsInBusiness ? `${businessInfo.yearsInBusiness}+` : '10+', label: 'Years of Excellence' },
    { value: '5,000+', label: 'Windows Tinted' },
    { value: businessInfo.priceRange || '$$$', label: 'Price Range' },
    { value: '★★★★★', label: 'Customer Reviews' },
  ];

  const navStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    background: scrolled ? 'rgba(3,3,3,0.98)' : 'transparent',
    backdropFilter: scrolled ? 'blur(16px)' : 'none',
    borderBottom: scrolled ? '1px solid rgba(202,138,4,0.25)' : '1px solid transparent',
    transition: 'all 0.4s ease',
    fontFamily: bodyFont,
  };

  // Diagonal gold accent lines for hero (like DetailingPremium approach)
  const diagonalLines = {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      repeating-linear-gradient(
        -45deg,
        transparent 0,
        transparent 80px,
        rgba(202,138,4,0.03) 80px,
        rgba(202,138,4,0.03) 81px
      ),
      repeating-linear-gradient(
        45deg,
        transparent 0,
        transparent 120px,
        rgba(202,138,4,0.02) 120px,
        rgba(202,138,4,0.02) 121px
      )
    `,
    pointerEvents: 'none',
  };

  const heroStyle = {
    minHeight: '100vh',
    background: c.bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  };

  const sectionStyle = (bg) => ({
    padding: '88px 24px',
    background: bg || c.bg,
    fontFamily: bodyFont,
    position: 'relative',
  });

  const cardStyle = {
    background: c.secondary,
    border: '1px solid rgba(202,138,4,0.15)',
    borderRadius: '2px',
    padding: '36px 28px',
    flex: '1 1 260px',
    maxWidth: '360px',
    position: 'relative',
    overflow: 'hidden',
  };

  const cardTopAccent = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '2px',
    background: goldGradient,
  };

  const accentBtnStyle = {
    display: 'inline-block',
    background: goldGradient,
    color: '#000000',
    padding: '14px 40px',
    borderRadius: '1px',
    fontWeight: 700,
    fontSize: '0.88rem',
    textDecoration: 'none',
    fontFamily: bodyFont,
    cursor: 'pointer',
    border: 'none',
    letterSpacing: '2px',
    textTransform: 'uppercase',
  };

  const outlineBtnStyle = {
    display: 'inline-block',
    background: 'transparent',
    color: '#ca8a04',
    padding: '14px 40px',
    borderRadius: '1px',
    fontWeight: 600,
    fontSize: '0.88rem',
    textDecoration: 'none',
    fontFamily: bodyFont,
    cursor: 'pointer',
    border: '1px solid rgba(202,138,4,0.5)',
    letterSpacing: '2px',
    textTransform: 'uppercase',
  };

  const goldPill = (text, i) => (
    <span key={i} style={{
      display: 'inline-block',
      background: 'transparent',
      border: `1px solid rgba(202,138,4,0.5)`,
      color: '#ca8a04',
      borderRadius: '1px',
      padding: '6px 16px',
      fontSize: '0.78rem',
      fontWeight: 600,
      letterSpacing: '1px',
      textTransform: 'uppercase',
      marginRight: '8px',
      marginBottom: '8px',
      fontFamily: bodyFont,
    }}>{text}</span>
  );

  const pricingStyle = (featured) => ({
    background: featured ? c.secondary : 'transparent',
    border: featured ? `1px solid rgba(202,138,4,0.4)` : `1px solid rgba(202,138,4,0.1)`,
    padding: '44px 32px',
    flex: '1 1 240px',
    maxWidth: '320px',
    position: 'relative',
    overflow: 'hidden',
    textAlign: 'center',
    fontFamily: bodyFont,
  });

  return (
    <div style={{ background: c.bg, color: c.text, fontFamily: bodyFont }}>
      {/* NAV */}
      <nav style={navStyle}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '72px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '2px', height: '32px', background: goldGradient }} />
            <div style={{ fontFamily: font, fontWeight: 700, fontSize: '1.25rem', color: '#ffffff', letterSpacing: '1px' }}>
              {businessInfo.businessName}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '36px', alignItems: 'center' }}>
            {['Services', 'Films', 'Packages', 'Contact'].map(link => (
              <a key={link} href={`#${link.toLowerCase()}`} style={{ color: c.muted, textDecoration: 'none', fontWeight: 400, fontSize: '0.82rem', letterSpacing: '2px', textTransform: 'uppercase' }}>{link}</a>
            ))}
            <a href={`tel:${businessInfo.phone}`} style={accentBtnStyle}>{businessInfo.phone}</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={heroStyle}>
        {/* Diagonal accent lines */}
        <div style={diagonalLines} />
        {/* Corner gold accents */}
        <div style={{ position: 'absolute', top: '12%', left: '6%', width: '80px', height: '1px', background: goldGradient, opacity: 0.5 }} />
        <div style={{ position: 'absolute', top: 'calc(12% + 8px)', left: '6%', width: '40px', height: '1px', background: goldGradient, opacity: 0.25 }} />
        <div style={{ position: 'absolute', bottom: '12%', right: '6%', width: '80px', height: '1px', background: goldGradient, opacity: 0.5 }} />
        <div style={{ position: 'absolute', bottom: 'calc(12% + 8px)', right: '6%', width: '40px', height: '1px', background: goldGradient, opacity: 0.25 }} />
        {/* Radial gold glow */}
        <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: '700px', height: '500px', background: 'radial-gradient(ellipse, rgba(202,138,4,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ textAlign: 'center', maxWidth: '820px', padding: '140px 24px 100px', position: 'relative', zIndex: 1 }}>
          {/* Awards ribbon */}
          {businessInfo.awards && businessInfo.awards.length > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', border: '1px solid rgba(202,138,4,0.3)', padding: '8px 20px', marginBottom: '28px' }}>
              <span style={{ fontSize: '0.72rem', letterSpacing: '3px', textTransform: 'uppercase', ...goldGradientText, fontFamily: bodyFont, fontWeight: 600 }}>
                🏆 {businessInfo.awards[0]}
              </span>
            </div>
          )}

          {/* Heading uses templateMeta.font (Playfair Display) */}
          <h1 style={{ fontFamily: font, fontSize: 'clamp(2.6rem, 5.5vw, 4.5rem)', fontWeight: 700, color: c.text, lineHeight: 1.1, marginBottom: '8px', letterSpacing: '-0.5px', fontStyle: 'italic' }}>
            {generatedCopy.headline}
          </h1>
          <div style={{ width: '100px', height: '1px', background: goldGradient, margin: '24px auto' }} />
          <p style={{ fontSize: '1.05rem', color: c.muted, marginBottom: '48px', lineHeight: 1.85, maxWidth: '580px', margin: '0 auto 48px', fontWeight: 300, letterSpacing: '0.3px' }}>
            {generatedCopy.subheadline}
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '40px' }}>
            <button style={accentBtnStyle}>{generatedCopy.ctaPrimary}</button>
            <button style={outlineBtnStyle}>{generatedCopy.ctaSecondary}</button>
          </div>
          {businessInfo.tagline && (
            <p style={{ color: 'rgba(202,138,4,0.45)', fontSize: '0.85rem', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: bodyFont }}>{businessInfo.tagline}</p>
          )}
        </div>
      </section>

      {/* STATS BAR */}
      <section style={{ background: c.secondary, borderTop: '1px solid rgba(202,138,4,0.2)', borderBottom: '1px solid rgba(202,138,4,0.2)', padding: '48px 24px', fontFamily: bodyFont }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '24px' }}>
          {stats.map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: font, fontSize: '2.2rem', fontWeight: 700, ...goldGradientText, letterSpacing: '-0.5px', fontStyle: 'italic' }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', color: c.muted, letterSpacing: '2.5px', textTransform: 'uppercase', marginTop: '8px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FILM BRANDS */}
      {businessInfo.filmBrands && businessInfo.filmBrands.length > 0 && (
        <section id="films" style={{ ...sectionStyle(c.bg), borderBottom: '1px solid rgba(202,138,4,0.08)' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center', marginBottom: '20px' }}>
              <div style={{ height: '1px', flex: 1, maxWidth: '80px', background: goldGradient, opacity: 0.4 }} />
              <span style={{ fontSize: '0.72rem', letterSpacing: '4px', textTransform: 'uppercase', color: c.muted, fontFamily: bodyFont }}>Authorized Film Brands</span>
              <div style={{ height: '1px', flex: 1, maxWidth: '80px', background: goldGradient, opacity: 0.4 }} />
            </div>
            <h2 style={{ fontFamily: font, fontSize: '2rem', fontWeight: 700, color: c.text, marginBottom: '32px', fontStyle: 'italic' }}>Premium Film Selection</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
              {businessInfo.filmBrands.map((brand, i) => goldPill(brand, i))}
            </div>
          </div>
        </section>
      )}

      {/* SERVICES */}
      <section id="services" style={sectionStyle()}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 style={{ fontFamily: font, fontSize: '2.4rem', fontWeight: 700, color: c.text, marginBottom: '16px', fontStyle: 'italic' }}>Our Services</h2>
            <div style={{ width: '80px', height: '1px', background: goldGradient, margin: '0 auto 20px' }} />
            <p style={{ color: c.muted, maxWidth: '520px', margin: '0 auto', fontSize: '0.95rem', lineHeight: 1.85, fontWeight: 300 }}>{generatedCopy.servicesSection.intro}</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
            {generatedCopy.servicesSection.items.map((svc, i) => (
              <div key={i} style={cardStyle}>
                <div style={cardTopAccent} />
                <div style={{ fontFamily: bodyFont, fontSize: '0.65rem', letterSpacing: '3.5px', textTransform: 'uppercase', ...goldGradientText, marginBottom: '14px' }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 style={{ fontFamily: font, fontSize: '1.15rem', fontWeight: 700, color: c.text, marginBottom: '12px', fontStyle: 'italic' }}>{svc.name}</h3>
                <p style={{ color: c.muted, fontSize: '0.88rem', lineHeight: 1.75, fontWeight: 300 }}>{svc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WARRANTY CALLOUT */}
      {(businessInfo.warranty || businessInfo.warrantyOffered) && (
        <section style={{ background: c.secondary, borderTop: '1px solid rgba(202,138,4,0.1)', borderBottom: '1px solid rgba(202,138,4,0.1)', padding: '56px 24px', fontFamily: bodyFont }}>
          <div style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-28px', left: '50%', transform: 'translateX(-50%)', width: '1px', height: '28px', background: goldGradient }} />
            <div style={{ display: 'inline-block', border: `1px solid rgba(202,138,4,0.4)`, padding: '36px 48px', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: goldGradient }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', background: goldGradient, opacity: 0.3 }} />
              <div style={{ ...goldGradientText, fontSize: '0.72rem', fontWeight: 600, letterSpacing: '4px', textTransform: 'uppercase', fontFamily: bodyFont, marginBottom: '12px' }}>Our Guarantee</div>
              <h3 style={{ fontFamily: font, fontSize: '1.6rem', fontWeight: 700, color: c.text, marginBottom: '12px', fontStyle: 'italic' }}>
                {businessInfo.warrantyOffered || 'Lifetime Warranty Available'}
              </h3>
              <p style={{ color: c.muted, fontSize: '0.92rem', lineHeight: 1.75, fontWeight: 300, maxWidth: '480px', margin: '0 auto' }}>
                {businessInfo.warranty || 'Every installation is backed by our comprehensive warranty. We stand behind our work with the confidence of true craftsmen.'}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* PACKAGES - Pricing */}
      {businessInfo.packages && businessInfo.packages.length > 0 && (
        <section id="packages" style={sectionStyle()}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '64px' }}>
              <h2 style={{ fontFamily: font, fontSize: '2.4rem', fontWeight: 700, color: c.text, marginBottom: '16px', fontStyle: 'italic' }}>Tint Packages</h2>
              <div style={{ width: '80px', height: '1px', background: goldGradient, margin: '0 auto' }} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
              {businessInfo.packages.map((pkg, i) => (
                <div key={i} style={pricingStyle(i === 1)}>
                  {i === 1 && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: goldGradient }} />}
                  {i === 1 && (
                    <div style={{ position: 'absolute', top: '16px', right: '16px', border: `1px solid rgba(202,138,4,0.5)`, ...goldGradientText, fontSize: '0.6rem', fontWeight: 700, padding: '3px 8px', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: bodyFont }}>FEATURED</div>
                  )}
                  <div style={{ fontSize: '0.65rem', letterSpacing: '3.5px', textTransform: 'uppercase', color: c.muted, marginBottom: '12px', fontFamily: bodyFont }}>Package {String(i + 1).padStart(2, '0')}</div>
                  <div style={{ fontFamily: font, fontSize: '1.35rem', fontWeight: 700, color: c.text, marginBottom: '10px', fontStyle: 'italic' }}>{pkg.name || pkg}</div>
                  {pkg.price && (
                    <div style={{ fontFamily: font, fontSize: '2.4rem', fontWeight: 300, ...goldGradientText, marginBottom: '16px' }}>{pkg.price}</div>
                  )}
                  {pkg.description && <p style={{ color: c.muted, fontSize: '0.85rem', lineHeight: 1.75, fontWeight: 300, marginBottom: '24px' }}>{pkg.description}</p>}
                  <button style={{ ...accentBtnStyle, padding: '10px 28px', fontSize: '0.75rem' }}>Select Package</button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ABOUT */}
      <section id="about" style={{ ...sectionStyle(c.secondary), borderTop: '1px solid rgba(202,138,4,0.08)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', gap: '80px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', minWidth: '260px' }}>
            {/* Decorative box */}
            <div style={{ width: '100%', maxWidth: '440px', height: '360px', border: '1px solid rgba(202,138,4,0.2)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: goldGradient }} />
              <div style={diagonalLines} />
              {/* Corner ornaments */}
              <div style={{ position: 'absolute', top: '16px', left: '16px', width: '20px', height: '20px', borderTop: `1px solid rgba(202,138,4,0.5)`, borderLeft: `1px solid rgba(202,138,4,0.5)` }} />
              <div style={{ position: 'absolute', bottom: '16px', right: '16px', width: '20px', height: '20px', borderBottom: `1px solid rgba(202,138,4,0.5)`, borderRight: `1px solid rgba(202,138,4,0.5)` }} />
              <span style={{ fontFamily: font, fontSize: '5rem', ...goldGradientText, opacity: 0.2, fontStyle: 'italic' }}>✦</span>
            </div>
          </div>
          <div style={{ flex: '1 1 380px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
              <div style={{ width: '32px', height: '1px', background: goldGradient }} />
              <span style={{ fontSize: '0.72rem', letterSpacing: '4px', textTransform: 'uppercase', color: c.muted, fontFamily: bodyFont }}>Our Story</span>
            </div>
            <h2 style={{ fontFamily: font, fontSize: '2.2rem', fontWeight: 700, color: c.text, marginBottom: '24px', lineHeight: 1.25, fontStyle: 'italic' }}>
              {businessInfo.yearsInBusiness ? `${businessInfo.yearsInBusiness} Years of Precision` : 'The Art of Window Tinting'}
            </h2>
            <p style={{ color: c.muted, lineHeight: 1.9, fontSize: '0.95rem', marginBottom: '32px', fontWeight: 300 }}>{generatedCopy.aboutText}</p>
            {businessInfo.specialties && businessInfo.specialties.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '0.65rem', letterSpacing: '3px', textTransform: 'uppercase', color: c.muted, marginBottom: '10px', fontFamily: bodyFont }}>Specialties</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {businessInfo.specialties.map((s, i) => goldPill(s, i))}
                </div>
              </div>
            )}
            {businessInfo.certifications && businessInfo.certifications.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '0.65rem', letterSpacing: '3px', textTransform: 'uppercase', color: c.muted, marginBottom: '10px', fontFamily: bodyFont }}>Certifications</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {businessInfo.certifications.map((cert, i) => (
                    <span key={i} style={{ border: '1px solid rgba(202,138,4,0.2)', color: c.muted, padding: '5px 14px', fontSize: '0.78rem', letterSpacing: '0.5px', fontFamily: bodyFont }}>{cert}</span>
                  ))}
                </div>
              </div>
            )}
            {businessInfo.awards && businessInfo.awards.length > 0 && (
              <div>
                <div style={{ fontSize: '0.65rem', letterSpacing: '3px', textTransform: 'uppercase', color: c.muted, marginBottom: '10px', fontFamily: bodyFont }}>Awards & Recognition</div>
                {businessInfo.awards.map((award, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 0', borderBottom: '1px solid rgba(202,138,4,0.07)', color: c.muted, fontSize: '0.88rem', fontWeight: 300 }}>
                    <div style={{ width: '5px', height: '5px', background: goldGradient, transform: 'rotate(45deg)', flexShrink: 0 }} />
                    {award}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ ...sectionStyle(c.bg), borderTop: '1px solid rgba(202,138,4,0.08)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 style={{ fontFamily: font, fontSize: '2.4rem', fontWeight: 700, color: c.text, fontStyle: 'italic', marginBottom: '16px' }}>What Our Clients Say</h2>
            <div style={{ width: '80px', height: '1px', background: goldGradient, margin: '0 auto' }} />
          </div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {generatedCopy.testimonialPlaceholders.map((t, i) => (
              <div key={i} style={{ background: c.secondary, border: '1px solid rgba(202,138,4,0.12)', padding: '36px', maxWidth: '380px', flex: '1 1 280px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: goldGradient }} />
                {/* Corner ornament */}
                <div style={{ position: 'absolute', top: '16px', right: '16px', color: 'rgba(202,138,4,0.15)', fontSize: '1.8rem', fontFamily: font, fontStyle: 'italic', lineHeight: 1 }}>"</div>
                <div style={{ fontSize: '0.85rem', ...goldGradientText, marginBottom: '16px', letterSpacing: '3px' }}>★★★★★</div>
                <p style={{ color: c.muted, fontSize: '0.93rem', lineHeight: 1.8, fontStyle: 'italic', marginBottom: '24px', fontWeight: 300 }}>"{t.text}"</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '20px', height: '1px', background: goldGradient }} />
                  <span style={{ color: c.text, fontSize: '0.82rem', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: bodyFont, fontWeight: 500 }}>{t.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA / CONTACT */}
      <section id="contact" style={{ background: c.secondary, borderTop: '1px solid rgba(202,138,4,0.15)', borderBottom: '1px solid rgba(202,138,4,0.15)', padding: '88px 24px', fontFamily: bodyFont, textAlign: 'center' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center', marginBottom: '28px' }}>
            <div style={{ width: '60px', height: '1px', background: goldGradient, opacity: 0.5 }} />
            <div style={{ width: '6px', height: '6px', background: goldGradient, transform: 'rotate(45deg)' }} />
            <div style={{ width: '60px', height: '1px', background: goldGradient, opacity: 0.5 }} />
          </div>
          <h2 style={{ fontFamily: font, fontSize: '2.6rem', fontWeight: 700, color: c.text, marginBottom: '16px', fontStyle: 'italic', lineHeight: 1.15 }}>
            Ready for Elite Window Tinting?
          </h2>
          <p style={{ color: c.muted, fontSize: '1rem', marginBottom: '44px', lineHeight: 1.8, fontWeight: 300 }}>
            {businessInfo.serviceArea ? `Serving ${businessInfo.serviceArea}.` : `Serving ${businessInfo.city}, ${businessInfo.state} and surrounding areas.`}
            {businessInfo.hours && ` ${businessInfo.hours}.`}
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '36px' }}>
            <a href={`tel:${businessInfo.phone}`} style={accentBtnStyle}>Call {businessInfo.phone}</a>
            <button style={outlineBtnStyle}>Get a Free Quote</button>
          </div>
          {businessInfo.address && (
            <p style={{ color: c.muted, fontSize: '0.85rem', letterSpacing: '1px' }}>
              {businessInfo.address}, {businessInfo.city}, {businessInfo.state}
            </p>
          )}
          {businessInfo.paymentMethods && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '24px' }}>
              <span style={{ color: 'rgba(202,138,4,0.35)', fontSize: '0.68rem', letterSpacing: '2px', textTransform: 'uppercase', alignSelf: 'center', marginRight: '6px' }}>We Accept:</span>
              {businessInfo.paymentMethods.map((pm, i) => (
                <span key={i} style={{ border: '1px solid rgba(202,138,4,0.2)', color: c.muted, padding: '4px 12px', fontSize: '0.75rem', letterSpacing: '0.5px' }}>{pm}</span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#000000', padding: '56px 24px', fontFamily: bodyFont }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '36px', marginBottom: '48px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <div style={{ width: '2px', height: '28px', background: goldGradient }} />
                <div style={{ fontFamily: font, fontSize: '1.35rem', fontWeight: 700, color: '#ffffff', letterSpacing: '0.5px', fontStyle: 'italic' }}>{businessInfo.businessName}</div>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', maxWidth: '300px', lineHeight: 1.65, fontWeight: 300 }}>{generatedCopy.footerTagline}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', gap: '24px' }}>
                {businessInfo.instagram && (
                  <a href={businessInfo.instagram} target="_blank" rel="noreferrer" style={{ color: 'rgba(202,138,4,0.5)', textDecoration: 'none', fontSize: '0.78rem', letterSpacing: '2px', textTransform: 'uppercase' }}>Instagram</a>
                )}
                {businessInfo.facebook && (
                  <a href={businessInfo.facebook} target="_blank" rel="noreferrer" style={{ color: 'rgba(202,138,4,0.5)', textDecoration: 'none', fontSize: '0.78rem', letterSpacing: '2px', textTransform: 'uppercase' }}>Facebook</a>
                )}
              </div>
              {businessInfo.serviceArea && (
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem', letterSpacing: '1px', textAlign: 'right' }}>Serving {businessInfo.serviceArea}</p>
              )}
            </div>
          </div>
          {/* Gold divider */}
          <div style={{ height: '1px', background: goldGradient, opacity: 0.15, marginBottom: '24px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem', letterSpacing: '0.5px' }}>© {new Date().getFullYear()} {businessInfo.businessName}. All rights reserved.</p>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>{businessInfo.city}, {businessInfo.state}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
