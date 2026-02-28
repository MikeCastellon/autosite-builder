import { useState, useEffect } from 'react';

export default function MechanicGarage({ businessInfo, generatedCopy, templateMeta }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const c = templateMeta.colors;
  const font = templateMeta.font;
  const bodyFont = templateMeta.bodyFont;

  // Concrete texture via diagonal repeating gradient
  const concreteTexture = `
    repeating-linear-gradient(
      135deg,
      rgba(255,255,255,0.012) 0px,
      rgba(255,255,255,0.012) 1px,
      transparent 1px,
      transparent 18px
    ),
    repeating-linear-gradient(
      45deg,
      rgba(255,255,255,0.008) 0px,
      rgba(255,255,255,0.008) 1px,
      transparent 1px,
      transparent 24px
    )
  `;

  const stats = [
    { value: businessInfo.yearsInBusiness ? `${businessInfo.yearsInBusiness}+` : '15+', label: 'Years In Business' },
    { value: '2,000+', label: 'Vehicles Serviced' },
    { value: businessInfo.warranty || '12mo', label: 'Warranty' },
    { value: '★★★★★', label: 'Customer Rated' },
  ];

  const navStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    background: scrolled ? '#111111' : 'rgba(26,26,26,0.97)',
    borderBottom: `3px solid ${c.accent}`,
    boxShadow: scrolled ? `0 4px 30px rgba(249,115,22,0.2)` : 'none',
    transition: 'all 0.3s ease',
    fontFamily: bodyFont,
    backgroundImage: scrolled ? concreteTexture : 'none',
  };

  const heroStyle = {
    minHeight: '100vh',
    background: c.bg,
    backgroundImage: concreteTexture,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  };

  const heroAccentLine = (top, opacity = 0.06) => ({
    position: 'absolute',
    left: '-10%',
    right: '-10%',
    top,
    height: '1px',
    background: `linear-gradient(90deg, transparent, rgba(249,115,22,${opacity}), transparent)`,
  });

  const sectionStyle = (bg) => ({
    padding: '80px 24px',
    background: bg || c.bg,
    backgroundImage: bg ? 'none' : concreteTexture,
    fontFamily: bodyFont,
  });

  const cardStyle = {
    background: c.secondary,
    backgroundImage: concreteTexture,
    borderLeft: `4px solid ${c.accent}`,
    borderRadius: '4px',
    padding: '28px 24px',
    flex: '1 1 260px',
    maxWidth: '340px',
    transition: 'transform 0.2s ease',
  };

  const pillBadge = (text, i) => (
    <span key={i} style={{
      display: 'inline-block',
      background: '#f59e0b',
      color: '#000000',
      borderRadius: '4px',
      padding: '5px 12px',
      fontSize: '0.78rem',
      fontWeight: 700,
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      marginRight: '8px',
      marginBottom: '8px',
    }}>{text}</span>
  );

  const accentBtnStyle = {
    display: 'inline-block',
    background: c.accent,
    color: '#000000',
    padding: '14px 32px',
    borderRadius: '4px',
    fontWeight: 800,
    fontSize: '1rem',
    textDecoration: 'none',
    fontFamily: font,
    cursor: 'pointer',
    border: 'none',
    letterSpacing: '1px',
    textTransform: 'uppercase',
  };

  const outlineBtnStyle = {
    display: 'inline-block',
    background: 'transparent',
    color: c.accent,
    padding: '14px 32px',
    borderRadius: '4px',
    fontWeight: 800,
    fontSize: '1rem',
    textDecoration: 'none',
    fontFamily: font,
    cursor: 'pointer',
    border: `2px solid ${c.accent}`,
    letterSpacing: '1px',
    textTransform: 'uppercase',
  };

  const hoursDays = [
    { day: 'Monday', time: '8am – 6pm' },
    { day: 'Tuesday', time: '8am – 6pm' },
    { day: 'Wednesday', time: '8am – 6pm' },
    { day: 'Thursday', time: '8am – 6pm' },
    { day: 'Friday', time: '8am – 5pm' },
    { day: 'Saturday', time: '9am – 3pm' },
    { day: 'Sunday', time: 'Closed' },
  ];

  return (
    <div style={{ background: c.bg, color: c.text, fontFamily: bodyFont }}>
      {/* NAV */}
      <nav style={navStyle}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '68px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '10px', height: '36px', background: c.accent, borderRadius: '2px' }} />
            <div style={{ fontFamily: font, fontWeight: 900, fontSize: '1.35rem', color: '#ffffff', letterSpacing: '1px', textTransform: 'uppercase' }}>
              {businessInfo.businessName}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
            {['Services', 'Hours', 'About', 'Contact'].map(link => (
              <a key={link} href={`#${link.toLowerCase()}`} style={{ color: c.muted, textDecoration: 'none', fontWeight: 600, fontSize: '0.88rem', letterSpacing: '1px', textTransform: 'uppercase' }}>{link}</a>
            ))}
            <a href={`tel:${businessInfo.phone}`} style={accentBtnStyle}>{businessInfo.phone}</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={heroStyle}>
        {[...Array(8)].map((_, i) => (
          <div key={i} style={heroAccentLine(`${10 + i * 12}%`, i % 3 === 0 ? 0.08 : 0.04)} />
        ))}
        <div style={{ textAlign: 'center', maxWidth: '820px', padding: '140px 24px 100px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-block', background: 'rgba(249,115,22,0.12)', border: `1px solid rgba(249,115,22,0.4)`, color: c.accent, borderRadius: '4px', padding: '8px 20px', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '3px', marginBottom: '28px', textTransform: 'uppercase' }}>
            RAW. REAL. RELIABLE.
          </div>
          <h1 style={{ fontFamily: font, fontSize: 'clamp(2.5rem, 5.5vw, 4.2rem)', fontWeight: 900, color: c.text, lineHeight: 1.1, marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '-0.5px' }}>
            {generatedCopy.headline}
          </h1>
          <p style={{ fontSize: '1.1rem', color: c.muted, marginBottom: '44px', lineHeight: 1.75, maxWidth: '600px', margin: '0 auto 44px' }}>
            {generatedCopy.subheadline}
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button style={accentBtnStyle}>{generatedCopy.ctaPrimary}</button>
            <button style={outlineBtnStyle}>{generatedCopy.ctaSecondary}</button>
          </div>
          {businessInfo.certifications && businessInfo.certifications.length > 0 && (
            <div style={{ marginTop: '40px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
              {businessInfo.certifications.map((cert, i) => pillBadge(cert, i))}
            </div>
          )}
        </div>
      </section>

      {/* STATS BAR */}
      <section style={{ background: c.accent, padding: '36px 24px', fontFamily: bodyFont }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '24px' }}>
          {stats.map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: font, fontSize: '2rem', fontWeight: 900, color: '#000000', letterSpacing: '-0.5px' }}>{s.value}</div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(0,0,0,0.6)', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: '4px', fontWeight: 700 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" style={sectionStyle()}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ marginBottom: '56px' }}>
            <div style={{ color: c.accent, fontWeight: 800, fontSize: '0.78rem', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '10px' }}>What We Do</div>
            <h2 style={{ fontFamily: font, fontSize: '2.4rem', fontWeight: 900, color: c.text, marginBottom: '12px', textTransform: 'uppercase' }}>Our Services</h2>
            <p style={{ color: c.muted, maxWidth: '540px', fontSize: '1rem', lineHeight: 1.7 }}>{generatedCopy.servicesSection.intro}</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            {generatedCopy.servicesSection.items.map((svc, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ color: c.accent, fontSize: '0.75rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>0{i + 1}</div>
                <h3 style={{ fontFamily: font, fontSize: '1.1rem', fontWeight: 800, color: c.text, marginBottom: '10px', textTransform: 'uppercase' }}>{svc.name}</h3>
                <p style={{ color: c.muted, fontSize: '0.9rem', lineHeight: 1.65 }}>{svc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WARRANTY GUARANTEE BOX */}
      <section style={{ background: c.secondary, backgroundImage: concreteTexture, padding: '48px 24px', fontFamily: bodyFont }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', border: `2px solid ${c.accent}`, borderRadius: '4px', padding: '36px 40px', display: 'flex', gap: '28px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '3rem' }}>🔧</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: font, fontSize: '1.4rem', fontWeight: 900, color: c.text, textTransform: 'uppercase', marginBottom: '8px' }}>
              {businessInfo.warrantyOffered || 'Our Guarantee'}
            </div>
            <p style={{ color: c.muted, fontSize: '0.95rem', lineHeight: 1.65 }}>
              {businessInfo.warranty
                ? businessInfo.warranty
                : 'Every repair is backed by our satisfaction guarantee. We stand behind our work — period.'}
            </p>
          </div>
          <div style={{ ...accentBtnStyle }}>Get a Quote</div>
        </div>
      </section>

      {/* PACKAGES */}
      {businessInfo.packages && businessInfo.packages.length > 0 && (
        <section id="packages" style={sectionStyle()}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <h2 style={{ fontFamily: font, fontSize: '2.2rem', fontWeight: 900, color: c.text, textTransform: 'uppercase', marginBottom: '48px' }}>Service Packages</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
              {businessInfo.packages.map((pkg, i) => (
                <div key={i} style={{ ...cardStyle, border: i === 1 ? `2px solid ${c.accent}` : `none`, borderLeft: `4px solid ${c.accent}`, flex: '1 1 240px' }}>
                  <div style={{ fontFamily: font, fontSize: '1.15rem', fontWeight: 900, color: c.text, textTransform: 'uppercase', marginBottom: '8px' }}>{pkg.name || pkg}</div>
                  {pkg.price && <div style={{ fontSize: '1.6rem', fontWeight: 900, color: c.accent, marginBottom: '10px', fontFamily: font }}>{pkg.price}</div>}
                  {pkg.description && <p style={{ color: c.muted, fontSize: '0.88rem', lineHeight: 1.6 }}>{pkg.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ABOUT */}
      <section id="about" style={{ ...sectionStyle(c.secondary), backgroundImage: concreteTexture }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', gap: '64px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 340px' }}>
            <div style={{ color: c.accent, fontWeight: 800, fontSize: '0.78rem', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '10px' }}>Our Story</div>
            <h2 style={{ fontFamily: font, fontSize: '2rem', fontWeight: 900, color: c.text, textTransform: 'uppercase', marginBottom: '20px' }}>
              {businessInfo.yearsInBusiness ? `${businessInfo.yearsInBusiness} Years` : 'Built'} In The Trenches
            </h2>
            <p style={{ color: c.muted, lineHeight: 1.8, fontSize: '0.98rem', marginBottom: '28px' }}>{generatedCopy.aboutText}</p>
            {businessInfo.awards && businessInfo.awards.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                {businessInfo.awards.map((award, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', color: c.text, fontSize: '0.9rem' }}>
                    <span style={{ color: c.accent }}>▶</span> {award}
                  </div>
                ))}
              </div>
            )}
            {businessInfo.brands && businessInfo.brands.length > 0 && (
              <div>
                <div style={{ color: c.muted, fontSize: '0.78rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>Brands We Service</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {businessInfo.brands.map((b, i) => (
                    <span key={i} style={{ background: 'rgba(255,255,255,0.07)', color: c.muted, borderRadius: '4px', padding: '5px 12px', fontSize: '0.82rem' }}>{b}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* HOURS */}
          <div id="hours" style={{ flex: '1 1 280px' }}>
            <div style={{ color: c.accent, fontWeight: 800, fontSize: '0.78rem', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '10px' }}>Shop Hours</div>
            <h3 style={{ fontFamily: font, fontSize: '1.4rem', fontWeight: 900, color: c.text, textTransform: 'uppercase', marginBottom: '20px' }}>When We're Open</h3>
            <div style={{ background: c.bg, backgroundImage: concreteTexture, borderRadius: '4px', overflow: 'hidden', border: `1px solid rgba(255,255,255,0.06)` }}>
              {hoursDays.map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < hoursDays.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <span style={{ color: c.muted, fontSize: '0.88rem', fontWeight: 600 }}>{row.day}</span>
                  <span style={{ color: row.time === 'Closed' ? '#ef4444' : c.accent, fontSize: '0.88rem', fontWeight: 700 }}>{row.time}</span>
                </div>
              ))}
            </div>
            {businessInfo.hours && (
              <p style={{ color: c.muted, fontSize: '0.82rem', marginTop: '12px' }}>* {businessInfo.hours}</p>
            )}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={sectionStyle()}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: font, fontSize: '2.2rem', fontWeight: 900, color: c.text, textTransform: 'uppercase', marginBottom: '48px' }}>Straight From Our Customers</h2>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {generatedCopy.testimonialPlaceholders.map((t, i) => (
              <div key={i} style={{ background: c.secondary, backgroundImage: concreteTexture, borderLeft: `4px solid ${c.accent}`, borderRadius: '4px', padding: '28px', maxWidth: '360px', flex: '1 1 260px' }}>
                <div style={{ color: c.accent, fontSize: '1.2rem', marginBottom: '12px', letterSpacing: '2px' }}>★★★★★</div>
                <p style={{ color: c.muted, fontSize: '0.93rem', lineHeight: 1.7, fontStyle: 'italic', marginBottom: '16px' }}>"{t.text}"</p>
                <div style={{ fontWeight: 800, color: c.text, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>— {t.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT CTA - orange background */}
      <section id="contact" style={{ background: c.accent, padding: '72px 24px', fontFamily: bodyFont }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', gap: '48px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontFamily: font, fontSize: '2rem', fontWeight: 900, color: '#000000', textTransform: 'uppercase', marginBottom: '8px' }}>
              Get Your Vehicle Fixed Right.
            </h2>
            <p style={{ color: 'rgba(0,0,0,0.65)', fontSize: '1rem' }}>
              {businessInfo.address}, {businessInfo.city}, {businessInfo.state}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' }}>
            <a href={`tel:${businessInfo.phone}`} style={{ background: '#000000', color: c.accent, padding: '14px 32px', borderRadius: '4px', fontWeight: 900, textDecoration: 'none', fontSize: '1.05rem', fontFamily: font, letterSpacing: '1px', textTransform: 'uppercase' }}>
              Call {businessInfo.phone}
            </a>
            {businessInfo.paymentMethods && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {businessInfo.paymentMethods.map((pm, i) => (
                  <span key={i} style={{ background: 'rgba(0,0,0,0.15)', color: '#000000', borderRadius: '4px', padding: '4px 10px', fontSize: '0.78rem', fontWeight: 700 }}>{pm}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#0a0a0a', backgroundImage: concreteTexture, padding: '48px 24px', fontFamily: bodyFont }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '32px', marginBottom: '36px' }}>
            <div>
              <div style={{ fontFamily: font, fontSize: '1.4rem', fontWeight: 900, color: '#ffffff', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>{businessInfo.businessName}</div>
              <p style={{ color: c.muted, fontSize: '0.88rem' }}>{generatedCopy.footerTagline}</p>
            </div>
            <div style={{ display: 'flex', gap: '20px' }}>
              {businessInfo.instagram && (
                <a href={businessInfo.instagram} target="_blank" rel="noreferrer" style={{ color: c.muted, textDecoration: 'none', fontSize: '0.88rem', fontWeight: 600 }}>Instagram</a>
              )}
              {businessInfo.facebook && (
                <a href={businessInfo.facebook} target="_blank" rel="noreferrer" style={{ color: c.muted, textDecoration: 'none', fontSize: '0.88rem', fontWeight: 600 }}>Facebook</a>
              )}
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>© {new Date().getFullYear()} {businessInfo.businessName}. All rights reserved.</p>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>{businessInfo.city}, {businessInfo.state}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
