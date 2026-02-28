// Template: Wheel Clean — White & gunmetal, professional

export default function WheelClean({ businessInfo, generatedCopy, templateMeta }) {
  const c = templateMeta.colors;
  const biz = businessInfo;
  const copy = generatedCopy;
  const services = copy.servicesSection?.items || [];

  return (
    <div style={{ fontFamily: templateMeta.bodyFont, background: c.bg, color: c.text, margin: 0, padding: 0 }}>
      {/* NAV */}
      <nav style={{ background: c.bg, borderBottom: '1px solid #e5e7eb', padding: '0 5%' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 800, color: c.accent }}>{biz.businessName}</span>
            <span style={{ display: 'block', fontSize: 11, color: '#9ca3af', letterSpacing: 1.5, textTransform: 'uppercase' }}>Custom Wheels · {biz.city}, {biz.state}</span>
          </div>
          <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#fff', padding: '10px 22px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>{biz.phone}</a>
        </div>
      </nav>

      {/* HERO */}
      <header style={{ background: c.secondary, padding: '88px 5% 72px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <span style={{ background: `${c.accent}15`, color: c.accent, fontSize: 13, fontWeight: 600, padding: '6px 16px', borderRadius: 20, display: 'inline-block', marginBottom: 24 }}>
            {biz.city}, {biz.state}
          </span>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, lineHeight: 1.2, marginBottom: 18, color: c.text }}>{copy.headline}</h1>
          <p style={{ color: '#6b7280', fontSize: 17, lineHeight: 1.7, marginBottom: 36 }}>{copy.subheadline}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#fff', padding: '13px 30px', borderRadius: 8, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>{copy.ctaPrimary}</a>
            <a href="#services" style={{ background: '#fff', color: c.accent, border: `1.5px solid ${c.accent}`, padding: '13px 30px', borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>{copy.ctaSecondary}</a>
          </div>
        </div>
      </header>

      {/* SERVICES */}
      <section id="services" style={{ padding: '72px 5%', background: c.bg }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, color: c.text, marginBottom: 12 }}>Our Services</h2>
          <p style={{ color: '#6b7280', fontSize: 16, lineHeight: 1.7, maxWidth: 520, marginBottom: 44 }}>{copy.servicesSection?.intro}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
            {services.map((svc) => (
              <div key={svc.name} style={{ background: c.secondary, border: '1px solid #e5e7eb', borderRadius: 10, padding: '24px 20px' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: c.text, marginBottom: 8 }}>{svc.name}</h3>
                <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.7 }}>{svc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" style={{ background: c.secondary, padding: '72px 5%', borderTop: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, color: c.text, marginBottom: 24 }}>About {biz.businessName}</h2>
          {copy.aboutText?.split('\n').filter(Boolean).map((para, i) => (
            <p key={i} style={{ color: '#6b7280', fontSize: 16, lineHeight: 1.8, marginBottom: 14 }}>{para}</p>
          ))}
          {biz.brands && <p style={{ color: c.accent, fontWeight: 600, marginTop: 20 }}>Brands: {biz.brands}</p>}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: '72px 5%', background: c.bg }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, color: c.text, marginBottom: 40, textAlign: 'center' }}>Happy Customers</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 18 }}>
            {copy.testimonialPlaceholders?.map((t) => (
              <div key={t.name} style={{ background: c.secondary, border: '1px solid #e5e7eb', borderRadius: 10, padding: 24 }}>
                <div style={{ color: '#f59e0b', marginBottom: 10 }}>★★★★★</div>
                <p style={{ color: c.text, fontSize: 15, lineHeight: 1.7, fontStyle: 'italic', marginBottom: 12 }}>"{t.text}"</p>
                <p style={{ color: '#9ca3af', fontWeight: 600, fontSize: 13 }}>— {t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ background: c.accent, padding: '64px 5%', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, color: '#fff', marginBottom: 12 }}>Come See Us</h2>
        <p style={{ color: '#ffffff99', fontSize: 16, marginBottom: 32 }}>Serving {biz.city}, {biz.state} and surrounding areas</p>
        <a href={`tel:${biz.phone}`} style={{ background: '#fff', color: c.accent, padding: '14px 40px', borderRadius: 8, fontWeight: 800, fontSize: 18, textDecoration: 'none', display: 'inline-block' }}>
          📞 {biz.phone}
        </a>
        {biz.address && <p style={{ color: '#ffffff88', fontSize: 13, marginTop: 16 }}>📍 {biz.address}, {biz.city}, {biz.state}</p>}
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb', padding: '24px 5%', textAlign: 'center' }}>
        <p style={{ color: c.text, fontWeight: 700, marginBottom: 4 }}>{biz.businessName}</p>
        <p style={{ color: '#9ca3af', fontSize: 13 }}>{copy.footerTagline}</p>
        <p style={{ color: '#d1d5db', fontSize: 12, marginTop: 10 }}>© {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state}</p>
      </footer>
    </div>
  );
}
