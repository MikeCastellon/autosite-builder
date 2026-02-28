// Template: Detailing Minimal — Clean white/gray professional theme

export default function DetailingMinimal({ businessInfo, generatedCopy, templateMeta }) {
  const c = templateMeta.colors;
  const biz = businessInfo;
  const copy = generatedCopy;
  const services = copy.servicesSection?.items || [];

  return (
    <div style={{ fontFamily: templateMeta.bodyFont, background: c.bg, color: c.text, margin: 0, padding: 0 }}>

      {/* NAV */}
      <nav style={{ background: c.bg, borderBottom: `1px solid #e2e8f0`, padding: '0 5%', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 800, color: c.accent, letterSpacing: -0.5 }}>{biz.businessName}</span>
            <span style={{ display: 'block', fontSize: 11, color: c.muted, letterSpacing: 2, textTransform: 'uppercase', marginTop: 1 }}>{biz.city}, {biz.state}</span>
          </div>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            {['Services', 'About', 'Contact'].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} style={{ color: c.muted, textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>{item}</a>
            ))}
            <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#fff', padding: '9px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
              {biz.phone}
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header style={{ padding: '96px 5% 80px', background: c.secondary }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <span style={{ background: `${c.accent}12`, color: c.accent, fontSize: 13, fontWeight: 600, padding: '6px 16px', borderRadius: 20, display: 'inline-block', marginBottom: 28, letterSpacing: 0.3 }}>
            Serving {biz.city}, {biz.state}
          </span>
          <h1 style={{ fontSize: 'clamp(2rem, 4.5vw, 3.2rem)', fontWeight: 800, lineHeight: 1.2, marginBottom: 20, color: c.text, letterSpacing: -1 }}>
            {copy.headline}
          </h1>
          <p style={{ color: c.muted, fontSize: 18, lineHeight: 1.7, marginBottom: 40 }}>{copy.subheadline}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="#contact" style={{ background: c.accent, color: '#fff', padding: '13px 32px', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
              {copy.ctaPrimary}
            </a>
            <a href="#services" style={{ background: c.bg, color: c.accent, border: `1.5px solid ${c.accent}`, padding: '13px 32px', borderRadius: 10, fontWeight: 600, fontSize: 16, textDecoration: 'none' }}>
              {copy.ctaSecondary}
            </a>
          </div>
        </div>
      </header>

      {/* SERVICES */}
      <section id="services" style={{ padding: '80px 5%', background: c.bg }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ color: c.accent, fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 2 }}>Our Services</p>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, marginBottom: 16, color: c.text }}>What We Offer</h2>
          <p style={{ color: c.muted, fontSize: 16, lineHeight: 1.7, maxWidth: 520, marginBottom: 48 }}>{copy.servicesSection?.intro}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {services.map((svc) => (
              <div key={svc.name} style={{ background: c.secondary, borderRadius: 12, padding: '28px 24px', border: '1px solid #e2e8f0' }}>
                <div style={{ width: 32, height: 32, background: `${c.accent}15`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: 16 }}>✦</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: c.text, marginBottom: 10 }}>{svc.name}</h3>
                <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.7 }}>{svc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" style={{ background: c.secondary, padding: '80px 5%', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 64, alignItems: 'start' }}>
          <div>
            <p style={{ color: c.accent, fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 2 }}>About Us</p>
            <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, marginBottom: 24, color: c.text }}>About {biz.businessName}</h2>
            {copy.aboutText?.split('\n').filter(Boolean).map((para, i) => (
              <p key={i} style={{ color: c.muted, fontSize: 16, lineHeight: 1.8, marginBottom: 16 }}>{para}</p>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { num: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '5+', label: 'Years in Business' },
              { num: '100%', label: 'Satisfaction Guarantee' },
              { num: '5★', label: 'Google Rating' },
            ].map(({ num, label }) => (
              <div key={label} style={{ background: c.bg, border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: c.accent, minWidth: 60 }}>{num}</div>
                <div style={{ color: c.muted, fontSize: 14, fontWeight: 500 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: '80px 5%', background: c.bg }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ color: c.accent, fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center' }}>Reviews</p>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, marginBottom: 48, textAlign: 'center', color: c.text }}>What Our Customers Say</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {copy.testimonialPlaceholders?.map((t) => (
              <div key={t.name} style={{ background: c.secondary, border: '1px solid #e2e8f0', borderRadius: 12, padding: 28 }}>
                <div style={{ color: '#f59e0b', fontSize: 16, marginBottom: 12 }}>★★★★★</div>
                <p style={{ color: c.text, fontSize: 15, lineHeight: 1.7, fontStyle: 'italic', marginBottom: 16 }}>"{t.text}"</p>
                <p style={{ color: c.muted, fontWeight: 600, fontSize: 13 }}>— {t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ background: c.accent, padding: '72px 5%' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, color: '#fff', marginBottom: 14 }}>Ready to Book?</h2>
          <p style={{ color: '#ffffff99', fontSize: 17, lineHeight: 1.7, marginBottom: 36 }}>
            Serving {biz.city}, {biz.state} and surrounding communities. Call us today.
          </p>
          <a href={`tel:${biz.phone}`} style={{ background: '#fff', color: c.accent, padding: '15px 40px', borderRadius: 10, fontWeight: 800, fontSize: 18, textDecoration: 'none', display: 'inline-block' }}>
            📞 {biz.phone}
          </a>
          {biz.address && (
            <p style={{ color: '#ffffff88', fontSize: 14, marginTop: 20 }}>
              {biz.address}, {biz.city}, {biz.state}
            </p>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: c.secondary, borderTop: '1px solid #e2e8f0', padding: '28px 5%', textAlign: 'center' }}>
        <p style={{ color: c.text, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{biz.businessName}</p>
        <p style={{ color: c.muted, fontSize: 13 }}>{copy.footerTagline}</p>
        <p style={{ color: '#cbd5e0', fontSize: 12, marginTop: 12 }}>© {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state} · {biz.phone}</p>
      </footer>
    </div>
  );
}
