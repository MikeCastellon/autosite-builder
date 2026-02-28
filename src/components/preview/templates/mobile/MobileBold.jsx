// Template: Mobile Bold — Orange & dark, on-the-go energy

export default function MobileBold({ businessInfo, generatedCopy, templateMeta }) {
  const c = templateMeta.colors;
  const biz = businessInfo;
  const copy = generatedCopy;
  const services = copy.servicesSection?.items || [];

  return (
    <div style={{ fontFamily: templateMeta.bodyFont, background: c.bg, color: c.text, margin: 0, padding: 0 }}>

      {/* NAV */}
      <nav style={{ background: c.secondary, padding: '0 5%' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🚐</span>
            <div>
              <span style={{ fontSize: 17, fontWeight: 800, color: c.text }}>{biz.businessName}</span>
              <span style={{ display: 'block', fontSize: 10, color: c.accent, letterSpacing: 2, textTransform: 'uppercase' }}>Mobile Detailing · {biz.city}</span>
            </div>
          </div>
          <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#fff', padding: '10px 24px', borderRadius: 6, fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>
            📞 Call Us
          </a>
        </div>
      </nav>

      {/* HERO */}
      <header style={{ background: `linear-gradient(135deg, ${c.secondary} 0%, ${c.bg} 60%)`, padding: '88px 5% 72px', borderBottom: `4px solid ${c.accent}` }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <span style={{ background: c.accent, color: '#fff', fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 1, display: 'inline-block', marginBottom: 24 }}>
            We Come to You · {biz.city}, {biz.state}
          </span>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, lineHeight: 1.15, marginBottom: 20 }}>{copy.headline}</h1>
          <p style={{ color: c.muted, fontSize: 17, lineHeight: 1.7, maxWidth: 520, marginBottom: 36 }}>{copy.subheadline}</p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#fff', padding: '14px 32px', borderRadius: 8, fontWeight: 800, fontSize: 16, textDecoration: 'none' }}>
              {copy.ctaPrimary}
            </a>
            <a href="#services" style={{ color: c.muted, padding: '14px 20px', fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
              {copy.ctaSecondary} →
            </a>
          </div>
        </div>
      </header>

      {/* BADGE ROW */}
      <div style={{ background: c.accent, padding: '14px 5%' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap' }}>
          {['🏠 Home Service', '🏢 Office & Lots', '📅 Same-Day Available', '✅ Fully Insured'].map((b) => (
            <span key={b} style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{b}</span>
          ))}
        </div>
      </div>

      {/* SERVICES */}
      <section id="services" style={{ padding: '72px 5%' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, marginBottom: 12 }}>Mobile Services</h2>
          <p style={{ color: c.muted, fontSize: 16, lineHeight: 1.7, maxWidth: 520, marginBottom: 48 }}>{copy.servicesSection?.intro}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {services.map((svc) => (
              <div key={svc.name} style={{ background: c.secondary, borderRadius: 10, padding: '28px 24px', borderTop: `3px solid ${c.accent}` }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, color: c.text }}>{svc.name}</h3>
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
          {biz.serviceArea && (
            <div style={{ marginTop: 28, padding: '16px 20px', background: `${c.accent}18`, borderRadius: 8, border: `1px solid ${c.accent}44` }}>
              <span style={{ color: c.accent, fontWeight: 700 }}>📍 Service Area: </span>
              <span style={{ color: c.text }}>{biz.serviceArea}</span>
            </div>
          )}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: '72px 5%' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, marginBottom: 40 }}>Happy Customers</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {copy.testimonialPlaceholders?.map((t) => (
              <div key={t.name} style={{ background: c.secondary, borderRadius: 10, padding: 28 }}>
                <div style={{ color: c.accent, fontSize: 16, marginBottom: 12 }}>★★★★★</div>
                <p style={{ color: c.text, fontSize: 15, lineHeight: 1.7, fontStyle: 'italic', marginBottom: 16 }}>"{t.text}"</p>
                <p style={{ color: c.accent, fontWeight: 700, fontSize: 13 }}>— {t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ background: c.accent, padding: '64px 5%', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', fontWeight: 900, color: '#fff', marginBottom: 12 }}>Book Your Mobile Detail</h2>
        <p style={{ color: '#ffffff99', fontSize: 16, marginBottom: 32 }}>{biz.city}, {biz.state} · We come to you!</p>
        <a href={`tel:${biz.phone}`} style={{ background: '#fff', color: c.accent, padding: '16px 44px', borderRadius: 10, fontWeight: 900, fontSize: 20, textDecoration: 'none', display: 'inline-block' }}>
          📞 {biz.phone}
        </a>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#111', padding: '24px 5%', textAlign: 'center' }}>
        <p style={{ color: '#555', fontSize: 13 }}>© {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state}</p>
        <p style={{ color: c.accent, fontSize: 12, marginTop: 6, fontWeight: 600 }}>{copy.footerTagline}</p>
      </footer>
    </div>
  );
}
