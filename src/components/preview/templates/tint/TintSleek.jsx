// Template: Tint Sleek — Gray & teal, modern precision

export default function TintSleek({ businessInfo, generatedCopy, templateMeta }) {
  const c = templateMeta.colors;
  const biz = businessInfo;
  const copy = generatedCopy;
  const services = copy.servicesSection?.items || [];

  return (
    <div style={{ fontFamily: templateMeta.bodyFont, background: c.bg, color: c.text, margin: 0, padding: 0 }}>
      {/* NAV */}
      <nav style={{ background: c.secondary, padding: '0 5%', borderBottom: `1px solid ${c.accent}33` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 800, color: c.text }}>{biz.businessName}</span>
            <span style={{ display: 'block', fontSize: 11, color: c.accent, letterSpacing: 2, textTransform: 'uppercase' }}>Tint & PPF · {biz.city}, {biz.state}</span>
          </div>
          <a href={`tel:${biz.phone}`} style={{ border: `2px solid ${c.accent}`, color: c.accent, padding: '9px 20px', borderRadius: 6, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>{biz.phone}</a>
        </div>
      </nav>

      {/* HERO */}
      <header style={{ background: `linear-gradient(135deg, ${c.bg} 0%, #16213e 100%)`, padding: '88px 5% 72px', borderBottom: `2px solid ${c.accent}44` }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ color: c.accent, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 18, fontWeight: 600 }}>
            Serving {biz.city}, {biz.state}
          </p>
          <h1 style={{ fontSize: 'clamp(2rem, 4.5vw, 3.4rem)', fontWeight: 800, lineHeight: 1.2, marginBottom: 20 }}>{copy.headline}</h1>
          <p style={{ color: c.muted, fontSize: 17, lineHeight: 1.7, marginBottom: 36 }}>{copy.subheadline}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#fff', padding: '13px 30px', borderRadius: 8, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>{copy.ctaPrimary}</a>
            <a href="#services" style={{ border: `1.5px solid ${c.muted}`, color: c.text, padding: '13px 30px', borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>{copy.ctaSecondary}</a>
          </div>
        </div>
      </header>

      {/* SERVICES */}
      <section id="services" style={{ padding: '72px 5%' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, marginBottom: 12 }}>Our Services</h2>
          <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.7, maxWidth: 520, marginBottom: 44 }}>{copy.servicesSection?.intro}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
            {services.map((svc) => (
              <div key={svc.name} style={{ background: c.secondary, border: `1px solid ${c.accent}33`, borderRadius: 8, padding: '24px 20px' }}>
                <div style={{ color: c.accent, fontSize: 20, marginBottom: 12 }}>◈</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{svc.name}</h3>
                <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.7 }}>{svc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" style={{ background: c.secondary, padding: '72px 5%' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, marginBottom: 24 }}>About {biz.businessName}</h2>
          {copy.aboutText?.split('\n').filter(Boolean).map((para, i) => (
            <p key={i} style={{ color: c.muted, fontSize: 16, lineHeight: 1.8, marginBottom: 14 }}>{para}</p>
          ))}
          {biz.filmBrands && <p style={{ color: c.accent, fontWeight: 600, marginTop: 20 }}>🎯 Film Brands: {biz.filmBrands}</p>}
          {biz.warranty && <p style={{ color: c.muted, marginTop: 10, fontSize: 14 }}>🛡 Warranty: {biz.warranty}</p>}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: '72px 5%' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, marginBottom: 40 }}>Customer Reviews</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 18 }}>
            {copy.testimonialPlaceholders?.map((t) => (
              <div key={t.name} style={{ background: c.secondary, borderLeft: `3px solid ${c.accent}`, padding: '22px 22px 22px 24px', borderRadius: '0 8px 8px 0' }}>
                <div style={{ color: c.accent, marginBottom: 10 }}>★★★★★</div>
                <p style={{ color: c.text, fontSize: 15, lineHeight: 1.7, fontStyle: 'italic', marginBottom: 12 }}>"{t.text}"</p>
                <p style={{ color: c.accent, fontWeight: 600, fontSize: 13 }}>— {t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ background: c.accent, padding: '64px 5%', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, color: '#fff', marginBottom: 12 }}>Get a Free Quote</h2>
        <p style={{ color: '#ffffff99', fontSize: 16, marginBottom: 32 }}>{biz.city}, {biz.state} · Same-day quotes available</p>
        <a href={`tel:${biz.phone}`} style={{ background: '#fff', color: c.accent, padding: '14px 40px', borderRadius: 8, fontWeight: 800, fontSize: 18, textDecoration: 'none', display: 'inline-block' }}>
          📞 {biz.phone}
        </a>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#141b26', padding: '24px 5%', textAlign: 'center' }}>
        <p style={{ color: '#4b5563', fontSize: 13 }}>© {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state}</p>
        <p style={{ color: c.accent, fontSize: 12, marginTop: 6 }}>{copy.footerTagline}</p>
      </footer>
    </div>
  );
}
