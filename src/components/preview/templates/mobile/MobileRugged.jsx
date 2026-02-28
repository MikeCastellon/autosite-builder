// Template: Mobile Rugged — Dark green & tan, tough outdoor feel

export default function MobileRugged({ businessInfo, generatedCopy, templateMeta }) {
  const c = templateMeta.colors;
  const biz = businessInfo;
  const copy = generatedCopy;
  const services = copy.servicesSection?.items || [];

  return (
    <div style={{ fontFamily: templateMeta.bodyFont, background: c.bg, color: c.text, margin: 0, padding: 0 }}>
      {/* NAV */}
      <nav style={{ background: c.secondary, borderBottom: `2px solid ${c.accent}`, padding: '0 5%' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 66 }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 800, color: c.text, textTransform: 'uppercase', letterSpacing: 1 }}>{biz.businessName}</span>
            <span style={{ display: 'block', fontSize: 11, color: c.accent, letterSpacing: 2, textTransform: 'uppercase' }}>Mobile Detail · {biz.city}, {biz.state}</span>
          </div>
          <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#1a2318', padding: '10px 22px', borderRadius: 4, fontWeight: 800, fontSize: 14, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: 1 }}>
            Call Now
          </a>
        </div>
      </nav>

      {/* HERO */}
      <header style={{ background: `linear-gradient(180deg, ${c.secondary} 0%, ${c.bg} 100%)`, padding: '88px 5% 72px', borderBottom: `3px solid ${c.accent}44` }}>
        <div style={{ maxWidth: 750, margin: '0 auto' }}>
          <p style={{ color: c.accent, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 16, fontWeight: 700 }}>
            🌿 {biz.city}, {biz.state} · We Come to You
          </p>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, lineHeight: 1.15, marginBottom: 20, textTransform: 'uppercase' }}>{copy.headline}</h1>
          <p style={{ color: c.muted, fontSize: 17, lineHeight: 1.7, maxWidth: 500, marginBottom: 36 }}>{copy.subheadline}</p>
          <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#1a2318', padding: '14px 34px', borderRadius: 4, fontWeight: 800, fontSize: 16, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: 1, display: 'inline-block' }}>
            {copy.ctaPrimary}
          </a>
        </div>
      </header>

      {/* SERVICES */}
      <section id="services" style={{ padding: '72px 5%' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ width: 48, height: 3, background: c.accent, marginBottom: 16, borderRadius: 2 }} />
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 900, textTransform: 'uppercase', marginBottom: 12, letterSpacing: -0.5 }}>Services</h2>
          <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.7, maxWidth: 500, marginBottom: 44 }}>{copy.servicesSection?.intro}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 18 }}>
            {services.map((svc) => (
              <div key={svc.name} style={{ background: c.secondary, border: `1px solid ${c.accent}33`, borderRadius: 6, padding: '26px 22px' }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, color: c.accent }}>{svc.name}</h3>
                <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.7 }}>{svc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" style={{ background: c.secondary, padding: '72px 5%', borderTop: `1px solid ${c.accent}33` }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ width: 48, height: 3, background: c.accent, marginBottom: 16, borderRadius: 2 }} />
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 900, textTransform: 'uppercase', marginBottom: 24, letterSpacing: -0.5 }}>About Us</h2>
          {copy.aboutText?.split('\n').filter(Boolean).map((para, i) => (
            <p key={i} style={{ color: c.muted, fontSize: 16, lineHeight: 1.8, marginBottom: 14 }}>{para}</p>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: '72px 5%' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ width: 48, height: 3, background: c.accent, marginBottom: 16, borderRadius: 2 }} />
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 900, textTransform: 'uppercase', marginBottom: 40 }}>What They Say</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {copy.testimonialPlaceholders?.map((t) => (
              <div key={t.name} style={{ background: c.secondary, border: `1px solid ${c.accent}33`, borderRadius: 6, padding: 28 }}>
                <div style={{ color: c.accent, fontSize: 16, marginBottom: 12 }}>★★★★★</div>
                <p style={{ color: c.text, fontSize: 15, lineHeight: 1.7, fontStyle: 'italic', marginBottom: 14 }}>"{t.text}"</p>
                <p style={{ color: c.accent, fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>— {t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ background: c.accent, padding: '64px 5%', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', fontWeight: 900, color: '#1a2318', textTransform: 'uppercase', marginBottom: 12 }}>Book a Mobile Detail</h2>
        <p style={{ color: '#1a231888', fontSize: 16, marginBottom: 32 }}>We roll out to {biz.city}, {biz.state} and surrounding areas</p>
        <a href={`tel:${biz.phone}`} style={{ background: '#1a2318', color: c.accent, padding: '15px 40px', borderRadius: 4, fontWeight: 900, fontSize: 18, textDecoration: 'none', display: 'inline-block', textTransform: 'uppercase', letterSpacing: 1 }}>
          📞 {biz.phone}
        </a>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#111a0f', padding: '24px 5%', textAlign: 'center' }}>
        <p style={{ color: c.muted, fontSize: 13 }}>© {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state}</p>
        <p style={{ color: c.accent, fontSize: 12, marginTop: 6, fontWeight: 600 }}>{copy.footerTagline}</p>
      </footer>
    </div>
  );
}
