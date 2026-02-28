// Template: Mechanic Industrial — Dark steel & yellow, hardworking

export default function MechanicIndustrial({ businessInfo, generatedCopy, templateMeta }) {
  const c = templateMeta.colors;
  const biz = businessInfo;
  const copy = generatedCopy;
  const services = copy.servicesSection?.items || [];

  return (
    <div style={{ fontFamily: templateMeta.bodyFont, background: c.bg, color: c.text, margin: 0, padding: 0 }}>
      {/* NAV */}
      <nav style={{ background: c.secondary, borderBottom: `3px solid ${c.accent}`, padding: '0 5%' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 900, color: c.text, textTransform: 'uppercase', letterSpacing: 1 }}>{biz.businessName}</span>
            <span style={{ display: 'block', fontSize: 11, color: c.accent, letterSpacing: 2, textTransform: 'uppercase' }}>Auto Repair · {biz.city}, {biz.state}</span>
          </div>
          <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#000', padding: '10px 22px', borderRadius: 4, fontWeight: 900, fontSize: 14, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: 1 }}>
            Call Now
          </a>
        </div>
      </nav>

      {/* HERO */}
      <header style={{ background: `linear-gradient(180deg, ${c.secondary} 0%, ${c.bg} 100%)`, padding: '88px 5% 72px', borderBottom: `1px solid #333` }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <p style={{ color: c.accent, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 16, fontWeight: 700 }}>
            ⚙️ Trusted Auto Repair · {biz.city}, {biz.state}
          </p>
          <h1 style={{ fontSize: 'clamp(2.2rem, 5vw, 3.6rem)', fontWeight: 900, lineHeight: 1.15, marginBottom: 20, textTransform: 'uppercase' }}>{copy.headline}</h1>
          <p style={{ color: c.muted, fontSize: 17, lineHeight: 1.7, maxWidth: 540, marginBottom: 36 }}>{copy.subheadline}</p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#000', padding: '14px 32px', borderRadius: 4, fontWeight: 900, fontSize: 16, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: 1 }}>{copy.ctaPrimary}</a>
            <a href="#services" style={{ color: c.muted, padding: '14px 20px', fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>{copy.ctaSecondary} →</a>
          </div>
        </div>
      </header>

      {/* BADGE ROW */}
      <div style={{ background: c.accent, padding: '14px 5%' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            biz.certifications ? `✓ ${biz.certifications}` : '✓ Certified Technicians',
            '✓ Free Diagnostics',
            '✓ Honest Pricing',
            '✓ All Makes & Models',
          ].map((b) => (
            <span key={b} style={{ color: '#000', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>{b}</span>
          ))}
        </div>
      </div>

      {/* SERVICES */}
      <section id="services" style={{ padding: '72px 5%' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <div style={{ width: 36, height: 4, background: c.accent, borderRadius: 2 }} />
            <p style={{ color: c.accent, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', fontWeight: 700 }}>Services</p>
          </div>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.6rem)', fontWeight: 900, textTransform: 'uppercase', marginBottom: 12 }}>What We Fix</h2>
          <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.7, maxWidth: 520, marginBottom: 44 }}>{copy.servicesSection?.intro}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2 }}>
            {services.map((svc, i) => (
              <div key={svc.name} style={{ background: i % 2 === 0 ? c.secondary : '#232323', padding: '28px 22px', borderTop: `2px solid ${i === 0 ? c.accent : 'transparent'}` }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, color: i < 2 ? c.accent : c.text }}>{svc.name}</h3>
                <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.7 }}>{svc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" style={{ background: c.secondary, padding: '72px 5%', borderTop: '1px solid #333' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{ width: 36, height: 4, background: c.accent, borderRadius: 2 }} />
              <p style={{ color: c.accent, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', fontWeight: 700 }}>Our Shop</p>
            </div>
            <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 900, textTransform: 'uppercase', marginBottom: 24 }}>About Us</h2>
            {copy.aboutText?.split('\n').filter(Boolean).map((para, i) => (
              <p key={i} style={{ color: c.muted, fontSize: 15, lineHeight: 1.8, marginBottom: 14 }}>{para}</p>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { num: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '10+', label: 'Years' },
              { num: '5,000+', label: 'Vehicles' },
              { num: '5★', label: 'Rating' },
              { num: '100%', label: 'Guaranteed' },
            ].map(({ num, label }) => (
              <div key={label} style={{ background: c.bg, border: '1px solid #333', borderRadius: 6, padding: '22px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 30, fontWeight: 900, color: c.accent }}>{num}</div>
                <div style={{ color: c.muted, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: '72px 5%' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 40 }}>
            <div style={{ width: 36, height: 4, background: c.accent, borderRadius: 2 }} />
            <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 900, textTransform: 'uppercase' }}>Reviews</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
            {copy.testimonialPlaceholders?.map((t) => (
              <div key={t.name} style={{ background: c.secondary, borderLeft: `4px solid ${c.accent}`, padding: '22px 22px 22px 24px' }}>
                <div style={{ color: c.accent, marginBottom: 10 }}>★★★★★</div>
                <p style={{ color: c.text, fontSize: 15, lineHeight: 1.7, fontStyle: 'italic', marginBottom: 12 }}>"{t.text}"</p>
                <p style={{ color: c.accent, fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>— {t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ background: c.accent, padding: '64px 5%', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', fontWeight: 900, color: '#000', textTransform: 'uppercase', marginBottom: 12 }}>Schedule Service</h2>
        <p style={{ color: '#00000066', fontSize: 16, marginBottom: 32 }}>Serving {biz.city}, {biz.state} and surrounding areas</p>
        <a href={`tel:${biz.phone}`} style={{ background: '#000', color: c.accent, padding: '16px 44px', borderRadius: 4, fontWeight: 900, fontSize: 20, textDecoration: 'none', display: 'inline-block', textTransform: 'uppercase', letterSpacing: 1 }}>
          📞 {biz.phone}
        </a>
        {biz.address && <p style={{ color: '#00000066', fontSize: 13, marginTop: 16 }}>📍 {biz.address}, {biz.city}, {biz.state}</p>}
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#111', padding: '24px 5%', textAlign: 'center' }}>
        <p style={{ color: '#444', fontSize: 13 }}>© {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state}</p>
        <p style={{ color: c.accent, fontSize: 12, marginTop: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{copy.footerTagline}</p>
      </footer>
    </div>
  );
}
