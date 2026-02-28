// Template: Detailing Sporty — Bold red & black performance theme

export default function DetailingSporty({ businessInfo, generatedCopy, templateMeta }) {
  const c = templateMeta.colors;
  const biz = businessInfo;
  const copy = generatedCopy;
  const services = copy.servicesSection?.items || [];

  return (
    <div style={{ fontFamily: templateMeta.bodyFont, background: c.bg, color: c.text, margin: 0, padding: 0 }}>

      {/* NAV */}
      <nav style={{ background: c.secondary, padding: '0 5%', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 66 }}>
          <div>
            <span style={{ color: c.accent, fontSize: 24, fontWeight: 900, letterSpacing: -1, textTransform: 'uppercase' }}>
              {biz.businessName}
            </span>
            <span style={{ color: '#555', fontSize: 11, display: 'block', letterSpacing: 3, textTransform: 'uppercase' }}>
              {biz.city}, {biz.state}
            </span>
          </div>
          <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: c.text, padding: '10px 24px', borderRadius: 2, fontWeight: 800, fontSize: 15, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: 1 }}>
            Call Now
          </a>
        </div>
      </nav>

      {/* HERO */}
      <header style={{ background: `linear-gradient(180deg, ${c.secondary} 0%, ${c.bg} 100%)`, padding: '90px 5% 70px', borderLeft: `6px solid ${c.accent}` }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <p style={{ color: c.accent, fontSize: 12, letterSpacing: 5, textTransform: 'uppercase', marginBottom: 16, fontWeight: 700 }}>
            ⚡ {biz.city}&apos;s #1 Detail Shop
          </p>
          <h1 style={{ fontSize: 'clamp(2.2rem, 5.5vw, 4rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: 20, textTransform: 'uppercase', letterSpacing: -1 }}>
            {copy.headline}
          </h1>
          <p style={{ color: c.muted, fontSize: 17, lineHeight: 1.7, maxWidth: 520, marginBottom: 40 }}>
            {copy.subheadline}
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: c.text, padding: '15px 36px', fontWeight: 800, fontSize: 16, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: 1.5, borderRadius: 2 }}>
              {copy.ctaPrimary}
            </a>
            <a href="#services" style={{ color: c.muted, padding: '15px 20px', fontWeight: 600, fontSize: 15, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              {copy.ctaSecondary} →
            </a>
          </div>
        </div>
      </header>

      {/* SERVICES */}
      <section id="services" style={{ padding: '72px 5%', background: c.bg }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <div style={{ width: 40, height: 4, background: c.accent, borderRadius: 2 }} />
            <p style={{ color: c.accent, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', fontWeight: 700 }}>Services</p>
          </div>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', fontWeight: 900, textTransform: 'uppercase', marginBottom: 12 }}>What We Do</h2>
          <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.7, maxWidth: 540, marginBottom: 48 }}>{copy.servicesSection?.intro}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 2 }}>
            {services.map((svc, i) => (
              <div key={svc.name} style={{ background: i % 2 === 0 ? c.secondary : '#181818', padding: '32px 28px', borderTop: `3px solid ${i === 0 ? c.accent : 'transparent'}` }}>
                <h3 style={{ fontSize: 17, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, color: i === 0 ? c.accent : c.text }}>
                  {svc.name}
                </h3>
                <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.7 }}>{svc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" style={{ background: c.accent, padding: '72px 5%' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 12, fontWeight: 700, color: '#00000088' }}>About Us</p>
            <h2 style={{ color: '#000', fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', fontWeight: 900, textTransform: 'uppercase', marginBottom: 24 }}>
              {biz.businessName}
            </h2>
            {copy.aboutText?.split('\n').filter(Boolean).map((para, i) => (
              <p key={i} style={{ color: '#000000cc', fontSize: 15, lineHeight: 1.8, marginBottom: 14 }}>{para}</p>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { num: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '5+', label: 'Years' },
              { num: '1000+', label: 'Cars' },
              { num: '5★', label: 'Rating' },
              { num: '100%', label: 'Guaranteed' },
            ].map(({ num, label }) => (
              <div key={label} style={{ background: '#00000022', padding: '28px 20px', textAlign: 'center', borderRadius: 4 }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#000' }}>{num}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#00000088', textTransform: 'uppercase', letterSpacing: 2, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: '72px 5%', background: c.bg }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <div style={{ width: 40, height: 4, background: c.accent, borderRadius: 2 }} />
            <p style={{ color: c.accent, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', fontWeight: 700 }}>Reviews</p>
          </div>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', fontWeight: 900, textTransform: 'uppercase', marginBottom: 40 }}>Real Results</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {copy.testimonialPlaceholders?.map((t) => (
              <div key={t.name} style={{ borderLeft: `4px solid ${c.accent}`, paddingLeft: 24, paddingTop: 8, paddingBottom: 8 }}>
                <div style={{ color: c.accent, fontSize: 16, marginBottom: 12 }}>★★★★★</div>
                <p style={{ color: c.text, fontSize: 15, lineHeight: 1.7, fontStyle: 'italic', marginBottom: 16 }}>"{t.text}"</p>
                <p style={{ color: c.accent, fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>— {t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ background: c.secondary, padding: '72px 5%', borderTop: `4px solid ${c.accent}` }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', fontWeight: 900, textTransform: 'uppercase', marginBottom: 12 }}>Book Your Detail</h2>
          <p style={{ color: c.muted, fontSize: 16, lineHeight: 1.7, marginBottom: 36 }}>
            Serving {biz.city}, {biz.state} and surrounding areas. Call us today!
          </p>
          <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: c.text, padding: '18px 52px', fontWeight: 900, fontSize: 20, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: 2, display: 'inline-block', borderRadius: 2 }}>
            {biz.phone}
          </a>
          {biz.address && (
            <p style={{ color: c.muted, fontSize: 14, marginTop: 20 }}>📍 {biz.address}, {biz.city}, {biz.state}</p>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#080808', padding: '24px 5%', textAlign: 'center' }}>
        <p style={{ color: '#444', fontSize: 13 }}>
          © {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state} · All Rights Reserved
        </p>
        <p style={{ color: c.accent, fontSize: 12, marginTop: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>{copy.footerTagline}</p>
      </footer>
    </div>
  );
}
