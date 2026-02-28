// Template: Tint Dark — Black & purple, high-tech premium

export default function TintDark({ businessInfo, generatedCopy, templateMeta }) {
  const c = templateMeta.colors;
  const biz = businessInfo;
  const copy = generatedCopy;
  const services = copy.servicesSection?.items || [];

  return (
    <div style={{ fontFamily: templateMeta.bodyFont, background: c.bg, color: c.text, margin: 0, padding: 0 }}>
      {/* NAV */}
      <nav style={{ background: c.secondary, borderBottom: `1px solid ${c.accent}44`, padding: '0 5%' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 800, color: c.text, letterSpacing: -0.5 }}>{biz.businessName}</span>
            <span style={{ display: 'block', fontSize: 10, color: c.accent, letterSpacing: 3, textTransform: 'uppercase' }}>Tint & Protection · {biz.city}</span>
          </div>
          <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#fff', padding: '10px 22px', borderRadius: 6, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>{biz.phone}</a>
        </div>
      </nav>

      {/* HERO */}
      <header style={{ background: `radial-gradient(ellipse at top right, ${c.accent}22 0%, ${c.bg} 60%)`, padding: '96px 5% 80px', borderBottom: `1px solid ${c.accent}22` }}>
        <div style={{ maxWidth: 750, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ color: c.accent, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 20, fontWeight: 600 }}>
            Premium Tint · {biz.city}, {biz.state}
          </p>
          <h1 style={{ fontSize: 'clamp(2.2rem, 5vw, 3.8rem)', fontWeight: 800, lineHeight: 1.15, marginBottom: 22 }}>{copy.headline}</h1>
          <p style={{ color: c.muted, fontSize: 17, lineHeight: 1.7, maxWidth: 520, margin: '0 auto 40px' }}>{copy.subheadline}</p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#fff', padding: '14px 32px', borderRadius: 8, fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>{copy.ctaPrimary}</a>
            <a href="#services" style={{ border: `1px solid ${c.accent}`, color: c.accent, padding: '14px 32px', borderRadius: 8, fontWeight: 600, fontSize: 16, textDecoration: 'none' }}>{copy.ctaSecondary}</a>
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
              <div key={svc.name} style={{ background: c.secondary, border: `1px solid ${c.accent}22`, borderRadius: 8, padding: '26px 22px' }}>
                <div style={{ width: 3, height: 32, background: c.accent, marginBottom: 16, borderRadius: 2 }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{svc.name}</h3>
                <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.7 }}>{svc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" style={{ background: c.secondary, padding: '72px 5%', borderTop: `1px solid ${c.accent}22` }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, marginBottom: 24 }}>About {biz.businessName}</h2>
          {copy.aboutText?.split('\n').filter(Boolean).map((para, i) => (
            <p key={i} style={{ color: c.muted, fontSize: 16, lineHeight: 1.8, marginBottom: 14 }}>{para}</p>
          ))}
          {biz.filmBrands && <p style={{ color: c.accent, fontWeight: 600, marginTop: 20 }}>Film Brands: {biz.filmBrands}</p>}
          {biz.warranty && <p style={{ color: c.muted, marginTop: 10, fontSize: 14 }}>🛡 {biz.warranty}</p>}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: '72px 5%' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, marginBottom: 40 }}>What Clients Say</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 18 }}>
            {copy.testimonialPlaceholders?.map((t) => (
              <div key={t.name} style={{ background: c.secondary, border: `1px solid ${c.accent}22`, borderRadius: 8, padding: 26 }}>
                <div style={{ color: c.accent, marginBottom: 10 }}>★★★★★</div>
                <p style={{ color: c.text, fontSize: 15, lineHeight: 1.7, fontStyle: 'italic', marginBottom: 12 }}>"{t.text}"</p>
                <p style={{ color: c.accent, fontWeight: 700, fontSize: 13 }}>— {t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ background: c.secondary, padding: '64px 5%', textAlign: 'center', borderTop: `1px solid ${c.accent}22` }}>
        <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, marginBottom: 12 }}>Get a Free Quote</h2>
        <p style={{ color: c.muted, fontSize: 16, marginBottom: 32 }}>Serving {biz.city}, {biz.state} and surrounding areas</p>
        <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#fff', padding: '15px 40px', borderRadius: 8, fontWeight: 800, fontSize: 18, textDecoration: 'none', display: 'inline-block' }}>
          📞 {biz.phone}
        </a>
        {biz.address && <p style={{ color: c.muted, fontSize: 13, marginTop: 16 }}>📍 {biz.address}, {biz.city}, {biz.state}</p>}
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#040408', padding: '24px 5%', textAlign: 'center' }}>
        <p style={{ color: '#333', fontSize: 13 }}>© {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state}</p>
        <p style={{ color: c.accent, fontSize: 12, marginTop: 6 }}>{copy.footerTagline}</p>
      </footer>
    </div>
  );
}
