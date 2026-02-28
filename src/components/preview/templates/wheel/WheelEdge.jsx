// Template: Wheel Edge — Dark chrome & electric blue

export default function WheelEdge({ businessInfo, generatedCopy, templateMeta }) {
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
            <span style={{ fontSize: 20, fontWeight: 900, color: c.text, textTransform: 'uppercase', letterSpacing: 2 }}>{biz.businessName}</span>
            <span style={{ display: 'block', fontSize: 10, color: c.accent, letterSpacing: 3, textTransform: 'uppercase' }}>Wheels · Tires · {biz.city}</span>
          </div>
          <a href={`tel:${biz.phone}`} style={{ border: `2px solid ${c.accent}`, color: c.accent, padding: '9px 22px', borderRadius: 4, fontWeight: 700, fontSize: 14, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: 1 }}>
            {biz.phone}
          </a>
        </div>
      </nav>

      {/* HERO */}
      <header style={{ background: `radial-gradient(ellipse at top, ${c.secondary} 0%, ${c.bg} 70%)`, padding: '96px 5% 80px', borderBottom: `1px solid ${c.accent}33` }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ color: c.accent, fontSize: 12, letterSpacing: 5, textTransform: 'uppercase', marginBottom: 20, fontWeight: 700 }}>Custom Wheels · {biz.city}, {biz.state}</p>
          <h1 style={{ fontSize: 'clamp(2.2rem, 5vw, 3.8rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: 22 }}>{copy.headline}</h1>
          <p style={{ color: c.muted, fontSize: 17, lineHeight: 1.7, maxWidth: 500, margin: '0 auto 40px' }}>{copy.subheadline}</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#000', padding: '14px 34px', borderRadius: 4, fontWeight: 800, fontSize: 16, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: 1 }}>{copy.ctaPrimary}</a>
            <a href="#services" style={{ border: `1px solid ${c.accent}`, color: c.accent, padding: '14px 34px', borderRadius: 4, fontWeight: 600, fontSize: 16, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: 1 }}>{copy.ctaSecondary}</a>
          </div>
        </div>
      </header>

      {/* SERVICES */}
      <section id="services" style={{ padding: '72px 5%' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 900, textTransform: 'uppercase', marginBottom: 12 }}>What We Do</h2>
          <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.7, maxWidth: 500, marginBottom: 44 }}>{copy.servicesSection?.intro}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2 }}>
            {services.map((svc, i) => (
              <div key={svc.name} style={{ background: i % 2 === 0 ? c.secondary : '#0f0f1e', padding: '28px 24px', borderTop: `2px solid ${i === 0 ? c.accent : 'transparent'}` }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, color: c.accent }}>{svc.name}</h3>
                <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.7 }}>{svc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" style={{ background: c.secondary, padding: '72px 5%', borderTop: `1px solid ${c.accent}33` }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 900, textTransform: 'uppercase', marginBottom: 24 }}>About {biz.businessName}</h2>
          {copy.aboutText?.split('\n').filter(Boolean).map((para, i) => (
            <p key={i} style={{ color: c.muted, fontSize: 16, lineHeight: 1.8, marginBottom: 14 }}>{para}</p>
          ))}
          {biz.brands && (
            <div style={{ marginTop: 24, padding: '14px 20px', background: `${c.accent}11`, border: `1px solid ${c.accent}33`, borderRadius: 6 }}>
              <span style={{ color: c.accent, fontWeight: 700 }}>Brands Carried: </span>
              <span style={{ color: c.text }}>{biz.brands}</span>
            </div>
          )}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: '72px 5%' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 900, textTransform: 'uppercase', marginBottom: 40 }}>Customer Reviews</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
            {copy.testimonialPlaceholders?.map((t) => (
              <div key={t.name} style={{ background: c.secondary, border: `1px solid ${c.accent}22`, borderRadius: 6, padding: 28 }}>
                <div style={{ color: c.accent, fontSize: 16, marginBottom: 12 }}>★★★★★</div>
                <p style={{ color: c.text, fontSize: 15, lineHeight: 1.7, fontStyle: 'italic', marginBottom: 14 }}>"{t.text}"</p>
                <p style={{ color: c.accent, fontWeight: 700, fontSize: 13 }}>— {t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ background: c.secondary, padding: '64px 5%', textAlign: 'center', borderTop: `1px solid ${c.accent}33` }}>
        <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 900, textTransform: 'uppercase', marginBottom: 12 }}>Visit Our Shop</h2>
        <p style={{ color: c.muted, fontSize: 16, marginBottom: 32 }}>{biz.city}, {biz.state} — Call or stop in today</p>
        <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#000', padding: '15px 40px', borderRadius: 4, fontWeight: 900, fontSize: 18, textDecoration: 'none', display: 'inline-block', textTransform: 'uppercase', letterSpacing: 1 }}>
          📞 {biz.phone}
        </a>
        {biz.address && <p style={{ color: c.muted, fontSize: 13, marginTop: 16 }}>📍 {biz.address}, {biz.city}, {biz.state}</p>}
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#06060d', padding: '24px 5%', textAlign: 'center' }}>
        <p style={{ color: '#333', fontSize: 13 }}>© {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state}</p>
        <p style={{ color: c.accent, fontSize: 12, marginTop: 6, fontWeight: 600 }}>{copy.footerTagline}</p>
      </footer>
    </div>
  );
}
