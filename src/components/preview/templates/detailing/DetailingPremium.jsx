// Template: Detailing Premium — Dark gold luxury theme

export default function DetailingPremium({ businessInfo, generatedCopy, templateMeta }) {
  const c = templateMeta.colors;
  const biz = businessInfo;
  const copy = generatedCopy;

  const services = copy.servicesSection?.items || [];

  return (
    <div style={{ fontFamily: templateMeta.bodyFont, background: c.bg, color: c.text, margin: 0, padding: 0 }}>

      {/* NAV */}
      <nav style={{ background: c.secondary, borderBottom: `1px solid ${c.accent}22`, padding: '0 5%' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
          <span style={{ fontFamily: templateMeta.font, color: c.accent, fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>
            {biz.businessName}
          </span>
          <div style={{ display: 'flex', gap: 32 }}>
            {['Services', 'About', 'Contact'].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} style={{ color: c.muted, textDecoration: 'none', fontSize: 14, letterSpacing: 1, textTransform: 'uppercase' }}>
                {item}
              </a>
            ))}
          </div>
          <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#000', padding: '10px 22px', borderRadius: 4, fontWeight: 700, fontSize: 14, textDecoration: 'none', letterSpacing: 0.5 }}>
            {biz.phone}
          </a>
        </div>
      </nav>

      {/* HERO */}
      <header style={{ background: `linear-gradient(135deg, ${c.bg} 0%, ${c.secondary} 100%)`, padding: '100px 5% 80px', textAlign: 'center', borderBottom: `1px solid ${c.accent}33` }}>
        <p style={{ color: c.accent, fontSize: 13, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 20, fontWeight: 600 }}>
          {biz.city}, {biz.state}
        </p>
        <h1 style={{ fontFamily: templateMeta.font, fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, lineHeight: 1.2, marginBottom: 24, maxWidth: 750, margin: '0 auto 24px' }}>
          {copy.headline}
        </h1>
        <p style={{ color: c.muted, fontSize: 18, maxWidth: 560, margin: '0 auto 40px', lineHeight: 1.7 }}>
          {copy.subheadline}
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="#contact" style={{ background: c.accent, color: '#000', padding: '14px 36px', borderRadius: 4, fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
            {copy.ctaPrimary}
          </a>
          <a href="#services" style={{ border: `1px solid ${c.accent}`, color: c.accent, padding: '14px 36px', borderRadius: 4, fontWeight: 600, fontSize: 16, textDecoration: 'none' }}>
            {copy.ctaSecondary}
          </a>
        </div>
      </header>

      {/* SERVICES */}
      <section id="services" style={{ padding: '80px 5%' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ color: c.accent, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>What We Offer</p>
          <h2 style={{ fontFamily: templateMeta.font, fontSize: 'clamp(1.6rem, 3vw, 2.5rem)', marginBottom: 16 }}>Our Services</h2>
          <p style={{ color: c.muted, fontSize: 16, maxWidth: 580, lineHeight: 1.7, marginBottom: 56 }}>{copy.servicesSection?.intro}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {services.map((svc) => (
              <div key={svc.name} style={{ background: c.secondary, border: `1px solid ${c.accent}22`, borderRadius: 8, padding: 32 }}>
                <div style={{ width: 36, height: 3, background: c.accent, marginBottom: 20, borderRadius: 2 }} />
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{svc.name}</h3>
                <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.7 }}>{svc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" style={{ background: c.secondary, padding: '80px 5%', borderTop: `1px solid ${c.accent}22`, borderBottom: `1px solid ${c.accent}22` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
          <div>
            <p style={{ color: c.accent, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>Our Story</p>
            <h2 style={{ fontFamily: templateMeta.font, fontSize: 'clamp(1.6rem, 3vw, 2.5rem)', marginBottom: 28 }}>About {biz.businessName}</h2>
            {copy.aboutText?.split('\n').filter(Boolean).map((para, i) => (
              <p key={i} style={{ color: c.muted, fontSize: 16, lineHeight: 1.8, marginBottom: 16 }}>{para}</p>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { num: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '5+', label: 'Years in Business' },
              { num: '500+', label: 'Cars Detailed' },
              { num: '5★', label: 'Average Rating' },
              { num: '100%', label: 'Satisfaction Rate' },
            ].map(({ num, label }) => (
              <div key={label} style={{ background: c.bg, border: `1px solid ${c.accent}33`, borderRadius: 8, padding: 24, textAlign: 'center' }}>
                <div style={{ fontFamily: templateMeta.font, color: c.accent, fontSize: 32, fontWeight: 700 }}>{num}</div>
                <div style={{ color: c.muted, fontSize: 13, marginTop: 6 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: '80px 5%' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ color: c.accent, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>Happy Clients</p>
          <h2 style={{ fontFamily: templateMeta.font, fontSize: 'clamp(1.6rem, 3vw, 2.5rem)', marginBottom: 48 }}>What Our Customers Say</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            {copy.testimonialPlaceholders?.map((t) => (
              <div key={t.name} style={{ background: c.secondary, border: `1px solid ${c.accent}22`, borderRadius: 8, padding: 32 }}>
                <div style={{ color: c.accent, fontSize: 20, marginBottom: 16 }}>★★★★★</div>
                <p style={{ color: c.text, fontSize: 15, lineHeight: 1.7, fontStyle: 'italic', marginBottom: 20 }}>"{t.text}"</p>
                <p style={{ color: c.accent, fontWeight: 700, fontSize: 14 }}>— {t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT / CTA */}
      <section id="contact" style={{ background: c.secondary, padding: '80px 5%', borderTop: `1px solid ${c.accent}22`, textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontFamily: templateMeta.font, fontSize: 'clamp(1.6rem, 3vw, 2.5rem)', marginBottom: 16 }}>Ready to Get Started?</h2>
          <p style={{ color: c.muted, fontSize: 17, lineHeight: 1.7, marginBottom: 40 }}>
            Give us a call or stop by. We serve {biz.city}, {biz.state} and the surrounding area.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#000', padding: '16px 48px', borderRadius: 4, fontWeight: 700, fontSize: 18, textDecoration: 'none', display: 'inline-block' }}>
              📞 {biz.phone}
            </a>
            {biz.address && (
              <p style={{ color: c.muted, fontSize: 15, marginTop: 8 }}>
                📍 {biz.address}, {biz.city}, {biz.state}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#050505', borderTop: `1px solid ${c.accent}22`, padding: '32px 5%', textAlign: 'center' }}>
        <p style={{ color: c.accent, fontFamily: templateMeta.font, fontSize: 18, marginBottom: 8 }}>{biz.businessName}</p>
        <p style={{ color: c.muted, fontSize: 13 }}>{copy.footerTagline}</p>
        <p style={{ color: '#444', fontSize: 12, marginTop: 16 }}>© {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state} · {biz.phone}</p>
      </footer>
    </div>
  );
}
