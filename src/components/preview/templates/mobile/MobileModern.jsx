// Template: Mobile Modern — Blue & white, professional

export default function MobileModern({ businessInfo, generatedCopy, templateMeta }) {
  const c = templateMeta.colors;
  const biz = businessInfo;
  const copy = generatedCopy;
  const services = copy.servicesSection?.items || [];

  return (
    <div style={{ fontFamily: templateMeta.bodyFont, background: c.bg, color: c.text, margin: 0, padding: 0 }}>
      {/* NAV */}
      <nav style={{ background: c.bg, borderBottom: '1px solid #e0e9ff', padding: '0 5%' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 800, color: c.accent }}>{biz.businessName}</span>
            <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', letterSpacing: 1.5, textTransform: 'uppercase' }}>Mobile Detailing · {biz.city}</span>
          </div>
          <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#fff', padding: '10px 22px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            {biz.phone}
          </a>
        </div>
      </nav>

      {/* HERO */}
      <header style={{ background: `linear-gradient(160deg, #dbeafe 0%, ${c.secondary} 100%)`, padding: '88px 5% 72px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <span style={{ color: c.accent, fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 2 }}>
            Serving {biz.city}, {biz.state}
          </span>
          <h1 style={{ fontSize: 'clamp(2rem, 4.5vw, 3.2rem)', fontWeight: 800, lineHeight: 1.2, color: c.text, marginBottom: 18 }}>{copy.headline}</h1>
          <p style={{ color: '#475569', fontSize: 18, lineHeight: 1.7, marginBottom: 36 }}>{copy.subheadline}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#fff', padding: '13px 30px', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>{copy.ctaPrimary}</a>
            <a href="#services" style={{ background: c.bg, color: c.accent, border: `1.5px solid ${c.accent}`, padding: '13px 30px', borderRadius: 10, fontWeight: 600, fontSize: 16, textDecoration: 'none' }}>{copy.ctaSecondary}</a>
          </div>
        </div>
      </header>

      {/* SERVICE BADGES */}
      <div style={{ background: c.accent, padding: '16px 5%' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', gap: 28, justifyContent: 'center', flexWrap: 'wrap' }}>
          {['🏠 Home Visits', '🏢 Office Calls', '🚗 Any Vehicle', '📱 Easy Booking'].map((b) => (
            <span key={b} style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{b}</span>
          ))}
        </div>
      </div>

      {/* SERVICES */}
      <section id="services" style={{ padding: '72px 5%', background: c.bg }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, color: c.text, marginBottom: 12 }}>Services We Bring to You</h2>
          <p style={{ color: '#64748b', fontSize: 16, lineHeight: 1.7, maxWidth: 520, marginBottom: 48 }}>{copy.servicesSection?.intro}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
            {services.map((svc) => (
              <div key={svc.name} style={{ background: c.secondary, borderRadius: 12, padding: '26px 22px', border: '1px solid #dbeafe' }}>
                <div style={{ width: 36, height: 36, background: `${c.accent}20`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 14 }}>✓</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: c.text, marginBottom: 8 }}>{svc.name}</h3>
                <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.7 }}>{svc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" style={{ background: c.secondary, padding: '72px 5%', borderTop: '1px solid #e0e9ff' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, color: c.text, marginBottom: 24 }}>About {biz.businessName}</h2>
          {copy.aboutText?.split('\n').filter(Boolean).map((para, i) => (
            <p key={i} style={{ color: '#475569', fontSize: 16, lineHeight: 1.8, marginBottom: 14 }}>{para}</p>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: '72px 5%', background: c.bg }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, color: c.text, marginBottom: 40, textAlign: 'center' }}>What Customers Say</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
            {copy.testimonialPlaceholders?.map((t) => (
              <div key={t.name} style={{ background: c.secondary, border: '1px solid #dbeafe', borderRadius: 12, padding: 26 }}>
                <div style={{ color: '#f59e0b', fontSize: 16, marginBottom: 12 }}>★★★★★</div>
                <p style={{ color: c.text, fontSize: 15, lineHeight: 1.7, fontStyle: 'italic', marginBottom: 14 }}>"{t.text}"</p>
                <p style={{ color: '#64748b', fontWeight: 600, fontSize: 13 }}>— {t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ background: c.accent, padding: '64px 5%', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, color: '#fff', marginBottom: 12 }}>Schedule a Mobile Detail</h2>
        <p style={{ color: '#ffffffbb', fontSize: 16, marginBottom: 32 }}>We come to you anywhere in {biz.city}, {biz.state}</p>
        <a href={`tel:${biz.phone}`} style={{ background: '#fff', color: c.accent, padding: '15px 40px', borderRadius: 10, fontWeight: 800, fontSize: 18, textDecoration: 'none', display: 'inline-block' }}>
          📞 {biz.phone}
        </a>
        {biz.serviceArea && <p style={{ color: '#ffffff88', fontSize: 13, marginTop: 16 }}>Service Area: {biz.serviceArea}</p>}
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#f1f5f9', borderTop: '1px solid #e0e9ff', padding: '24px 5%', textAlign: 'center' }}>
        <p style={{ color: c.text, fontWeight: 700, marginBottom: 4 }}>{biz.businessName}</p>
        <p style={{ color: '#64748b', fontSize: 13 }}>{copy.footerTagline}</p>
        <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 10 }}>© {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state}</p>
      </footer>
    </div>
  );
}
