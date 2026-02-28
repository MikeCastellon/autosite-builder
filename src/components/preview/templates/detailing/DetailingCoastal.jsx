import { useState, useEffect } from 'react';

export default function DetailingCoastal({ businessInfo, generatedCopy, templateMeta }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const c = templateMeta.colors;
  const font = templateMeta.font;
  const bodyFont = templateMeta.bodyFont;

  const stats = [
    { value: businessInfo.yearsInBusiness ? `${businessInfo.yearsInBusiness}+` : '10+', label: 'Years Experience' },
    { value: '500+', label: 'Cars Detailed' },
    { value: businessInfo.priceRange || '$$', label: 'Price Range' },
    { value: '5★', label: 'Avg Rating' },
  ];

  const navStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    background: scrolled ? '#ffffff' : 'rgba(255,255,255,0.95)',
    borderTop: `4px solid ${c.accent}`,
    boxShadow: scrolled ? '0 2px 20px rgba(8,145,178,0.12)' : 'none',
    transition: 'box-shadow 0.3s ease',
    fontFamily: bodyFont,
  };

  const heroStyle = {
    minHeight: '100vh',
    background: c.secondary,
    backgroundImage: `
      radial-gradient(ellipse at 20% 50%, rgba(8,145,178,0.08) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 20%, rgba(8,145,178,0.06) 0%, transparent 50%),
      repeating-radial-gradient(circle at 50% 120%, transparent 0, transparent 40px, rgba(8,145,178,0.03) 40px, rgba(8,145,178,0.03) 41px)
    `,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  };

  const waveBarStyle = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '80px',
    background: c.bg,
    clipPath: 'ellipse(55% 100% at 50% 100%)',
  };

  const sectionStyle = (bg) => ({
    padding: '80px 24px',
    background: bg || c.bg,
    fontFamily: bodyFont,
  });

  const cardStyle = {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '32px 28px',
    borderTop: `4px solid ${c.accent}`,
    boxShadow: '0 4px 24px rgba(8,145,178,0.08)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    flex: '1 1 280px',
    maxWidth: '340px',
  };

  const accentBtnStyle = {
    display: 'inline-block',
    background: c.accent,
    color: '#ffffff',
    padding: '14px 32px',
    borderRadius: '50px',
    fontWeight: 700,
    fontSize: '1rem',
    textDecoration: 'none',
    fontFamily: font,
    cursor: 'pointer',
    border: 'none',
    letterSpacing: '0.5px',
  };

  const outlineBtnStyle = {
    display: 'inline-block',
    background: 'transparent',
    color: c.accent,
    padding: '14px 32px',
    borderRadius: '50px',
    fontWeight: 700,
    fontSize: '1rem',
    textDecoration: 'none',
    fontFamily: font,
    cursor: 'pointer',
    border: `2px solid ${c.accent}`,
    letterSpacing: '0.5px',
  };

  return (
    <div style={{ background: c.bg, color: c.text, fontFamily: bodyFont }}>
      {/* NAV */}
      <nav style={navStyle}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '68px' }}>
          <div style={{ fontFamily: font, fontWeight: 800, fontSize: '1.4rem', color: c.accent }}>
            {businessInfo.businessName}
          </div>
          <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
            {['Services', 'Packages', 'About', 'Contact'].map(link => (
              <a key={link} href={`#${link.toLowerCase()}`} style={{ color: c.text, textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem' }}>{link}</a>
            ))}
            <a href={`tel:${businessInfo.phone}`} style={accentBtnStyle}>{businessInfo.phone}</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={heroStyle}>
        <div style={{ textAlign: 'center', maxWidth: '760px', padding: '120px 24px 100px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-block', background: 'rgba(8,145,178,0.1)', color: c.accent, borderRadius: '50px', padding: '8px 20px', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '2px', marginBottom: '24px', textTransform: 'uppercase' }}>
            {businessInfo.city}, {businessInfo.state}
          </div>
          <h1 style={{ fontFamily: font, fontSize: 'clamp(2.4rem, 5vw, 4rem)', fontWeight: 800, color: c.text, lineHeight: 1.15, marginBottom: '20px' }}>
            {generatedCopy.headline}
          </h1>
          <p style={{ fontSize: '1.2rem', color: c.muted, marginBottom: '40px', lineHeight: 1.7 }}>
            {generatedCopy.subheadline}
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button style={accentBtnStyle}>{generatedCopy.ctaPrimary}</button>
            <button style={outlineBtnStyle}>{generatedCopy.ctaSecondary}</button>
          </div>
          {businessInfo.tagline && (
            <p style={{ marginTop: '32px', color: c.muted, fontSize: '0.95rem', fontStyle: 'italic' }}>"{businessInfo.tagline}"</p>
          )}
        </div>
        <div style={waveBarStyle} />
      </section>

      {/* STATS BAR */}
      <section style={{ background: c.accent, padding: '40px 24px', fontFamily: bodyFont }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '24px' }}>
          {stats.map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: font, fontSize: '2.2rem', fontWeight: 800, color: '#ffffff' }}>{s.value}</div>
              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" style={sectionStyle(c.bg)}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2 style={{ fontFamily: font, fontSize: '2.4rem', fontWeight: 800, color: c.text, marginBottom: '12px' }}>Our Services</h2>
            <p style={{ color: c.muted, maxWidth: '560px', margin: '0 auto', fontSize: '1.05rem', lineHeight: 1.7 }}>{generatedCopy.servicesSection.intro}</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'center' }}>
            {generatedCopy.servicesSection.items.map((svc, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ width: '44px', height: '44px', background: `rgba(8,145,178,0.1)`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', fontSize: '1.4rem' }}>
                  {['🌊', '✨', '🚗', '🔵', '🛡️', '💎'][i % 6]}
                </div>
                <h3 style={{ fontFamily: font, fontSize: '1.15rem', fontWeight: 700, color: c.text, marginBottom: '10px' }}>{svc.name}</h3>
                <p style={{ color: c.muted, fontSize: '0.92rem', lineHeight: 1.65 }}>{svc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PACKAGES */}
      {businessInfo.packages && businessInfo.packages.length > 0 && (
        <section id="packages" style={sectionStyle(c.secondary)}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <h2 style={{ fontFamily: font, fontSize: '2.2rem', fontWeight: 800, color: c.text, textAlign: 'center', marginBottom: '48px' }}>Detailing Packages</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'center' }}>
              {businessInfo.packages.map((pkg, i) => (
                <div key={i} style={{ ...cardStyle, border: i === 1 ? `2px solid ${c.accent}` : '2px solid transparent', position: 'relative', overflow: 'hidden' }}>
                  {i === 1 && <div style={{ position: 'absolute', top: '16px', right: '16px', background: c.accent, color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: '50px', letterSpacing: '1px' }}>POPULAR</div>}
                  <h3 style={{ fontFamily: font, fontSize: '1.25rem', fontWeight: 700, color: c.text, marginBottom: '8px' }}>{pkg.name || pkg}</h3>
                  {pkg.price && <div style={{ fontSize: '1.8rem', fontWeight: 800, color: c.accent, marginBottom: '12px', fontFamily: font }}>{pkg.price}</div>}
                  {pkg.description && <p style={{ color: c.muted, fontSize: '0.9rem', lineHeight: 1.6 }}>{pkg.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ABOUT */}
      <section id="about" style={sectionStyle(c.bg)}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', gap: '64px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px', minWidth: '280px' }}>
            <div style={{ width: '100%', maxWidth: '460px', height: '340px', background: c.secondary, borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: `repeating-radial-gradient(circle at 30% 70%, rgba(8,145,178,0.07) 0, rgba(8,145,178,0.07) 2px, transparent 2px, transparent 40px)` }} />
              <span style={{ fontSize: '5rem' }}>🌊</span>
            </div>
          </div>
          <div style={{ flex: '1 1 360px' }}>
            <div style={{ color: c.accent, fontWeight: 700, fontSize: '0.85rem', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>About Us</div>
            <h2 style={{ fontFamily: font, fontSize: '2rem', fontWeight: 800, color: c.text, marginBottom: '20px', lineHeight: 1.25 }}>
              Serving {businessInfo.city} With Pride
            </h2>
            <p style={{ color: c.muted, lineHeight: 1.8, fontSize: '1rem', marginBottom: '24px' }}>{generatedCopy.aboutText}</p>
            {businessInfo.certifications && businessInfo.certifications.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                {businessInfo.certifications.map((cert, i) => (
                  <span key={i} style={{ background: `rgba(8,145,178,0.1)`, color: c.accent, borderRadius: '50px', padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600 }}>{cert}</span>
                ))}
              </div>
            )}
            {businessInfo.awards && businessInfo.awards.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <div style={{ fontSize: '0.85rem', color: c.muted, fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Awards & Recognition</div>
                {businessInfo.awards.map((award, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: c.text, fontSize: '0.92rem' }}>
                    <span style={{ color: '#f59e0b' }}>🏆</span> {award}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={sectionStyle(c.secondary)}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: font, fontSize: '2.2rem', fontWeight: 800, color: c.text, textAlign: 'center', marginBottom: '48px' }}>What Our Clients Say</h2>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {generatedCopy.testimonialPlaceholders.map((t, i) => (
              <div key={i} style={{ background: '#ffffff', borderRadius: '16px', padding: '28px', maxWidth: '340px', flex: '1 1 280px', boxShadow: '0 4px 20px rgba(8,145,178,0.07)' }}>
                <div style={{ color: c.accent, fontSize: '1.4rem', marginBottom: '12px' }}>★★★★★</div>
                <p style={{ color: c.text, fontSize: '0.95rem', lineHeight: 1.7, fontStyle: 'italic', marginBottom: '16px' }}>"{t.text}"</p>
                <div style={{ fontWeight: 700, color: c.accent, fontSize: '0.9rem' }}>{t.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section style={{ background: c.accent, padding: '72px 24px', textAlign: 'center', fontFamily: bodyFont }}>
        <h2 style={{ fontFamily: font, fontSize: '2.2rem', fontWeight: 800, color: '#ffffff', marginBottom: '16px' }}>
          Ready for a Fresh, Clean Ride?
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.1rem', marginBottom: '36px' }}>
          {businessInfo.serviceArea ? `Serving ${businessInfo.serviceArea}` : `Serving ${businessInfo.city} and surrounding areas`}
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={`tel:${businessInfo.phone}`} style={{ background: '#ffffff', color: c.accent, padding: '14px 36px', borderRadius: '50px', fontWeight: 800, textDecoration: 'none', fontSize: '1rem', fontFamily: font }}>
            Call {businessInfo.phone}
          </a>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={sectionStyle(c.bg)}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', gap: '48px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px' }}>
            <h3 style={{ fontFamily: font, fontSize: '1.4rem', fontWeight: 700, color: c.text, marginBottom: '20px' }}>Contact & Hours</h3>
            {businessInfo.phone && <p style={{ color: c.muted, marginBottom: '8px' }}>📞 {businessInfo.phone}</p>}
            {businessInfo.address && <p style={{ color: c.muted, marginBottom: '8px' }}>📍 {businessInfo.address}, {businessInfo.city}, {businessInfo.state}</p>}
            {businessInfo.hours && <p style={{ color: c.muted, marginBottom: '8px' }}>🕐 {businessInfo.hours}</p>}
          </div>
          <div style={{ flex: '1 1 260px' }}>
            <h3 style={{ fontFamily: font, fontSize: '1.4rem', fontWeight: 700, color: c.text, marginBottom: '20px' }}>Payment Methods</h3>
            {businessInfo.paymentMethods && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {businessInfo.paymentMethods.map((pm, i) => (
                  <span key={i} style={{ background: c.secondary, color: c.text, borderRadius: '8px', padding: '6px 14px', fontSize: '0.85rem', fontWeight: 500 }}>{pm}</span>
                ))}
              </div>
            )}
            {businessInfo.warranty && <p style={{ color: c.muted, marginTop: '16px', fontSize: '0.9rem' }}>🛡️ {businessInfo.warranty}</p>}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#0c4a6e', padding: '48px 24px', fontFamily: bodyFont }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '32px', marginBottom: '40px' }}>
            <div>
              <div style={{ fontFamily: font, fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>{businessInfo.businessName}</div>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', maxWidth: '300px' }}>{generatedCopy.footerTagline}</p>
            </div>
            <div style={{ display: 'flex', gap: '20px' }}>
              {businessInfo.instagram && (
                <a href={businessInfo.instagram} target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.9rem' }}>Instagram</a>
              )}
              {businessInfo.facebook && (
                <a href={businessInfo.facebook} target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.9rem' }}>Facebook</a>
              )}
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>© {new Date().getFullYear()} {businessInfo.businessName}. All rights reserved.</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>{businessInfo.city}, {businessInfo.state}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
