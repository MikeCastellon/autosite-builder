// Template: Mechanic Friendly — White & navy, welcoming neighborhood shop

export default function MechanicFriendly({ businessInfo, generatedCopy, templateMeta }) {
  const c = templateMeta.colors;
  const biz = businessInfo;
  const copy = generatedCopy;
  const services = copy.servicesSection?.items || [];

  return (
    <div style={{ fontFamily: templateMeta.bodyFont, background: c.bg, color: c.text, margin: 0, padding: 0 }}>
      {/* NAV */}
      <nav style={{ background: c.bg, borderBottom: '1px solid #dbeafe', padding: '0 5%', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 800, color: c.accent }}>{biz.businessName}</span>
            <span style={{ display: 'block', fontSize: 11, color: '#64748b', letterSpacing: 1.5, textTransform: 'uppercase' }}>Auto Repair · {biz.city}, {biz.state}</span>
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            {['Services', 'About', 'Contact'].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} style={{ color: '#64748b', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>{item}</a>
            ))}
            <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#fff', padding: '9px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>{biz.phone}</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header style={{ background: `linear-gradient(160deg, #dbeafe 0%, ${c.secondary} 100%)`, padding: '88px 5% 72px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <span style={{ background: `${c.accent}15`, color: c.accent, fontSize: 13, fontWeight: 600, padding: '6px 16px', borderRadius: 20, display: 'inline-block', marginBottom: 24 }}>
            Your Trusted Shop in {biz.city}, {biz.state}
          </span>
          <h1 style={{ fontSize: 'clamp(2rem, 4.5vw, 3.2rem)', fontWeight: 800, lineHeight: 1.2, color: c.text, marginBottom: 18 }}>{copy.headline}</h1>
          <p style={{ color: '#475569', fontSize: 18, lineHeight: 1.7, marginBottom: 36 }}>{copy.subheadline}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={`tel:${biz.phone}`} style={{ background: c.accent, color: '#fff', padding: '13px 30px', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>{copy.ctaPrimary}</a>
            <a href="#services" style={{ background: c.bg, color: c.accent, border: `1.5px solid ${c.accent}`, padding: '13px 30px', borderRadius: 10, fontWeight: 600, fontSize: 16, textDecoration: 'none' }}>{copy.ctaSecondary}</a>
          </div>
        </div>
      </header>

      {/* TRUST BADGES */}
      <div style={{ background: c.accent, padding: '16px 5%' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', gap: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            biz.certifications ? `✓ ${biz.certifications}` : '✓ Certified Technicians',
            '✓ Honest Estimates',
            '✓ Warranty on All Work',
            `✓ Serving ${biz.city} Since ${biz.yearsInBusiness ? new Date().getFullYear() - Number(biz.yearsInBusiness) : '2010'}`,
          ].map((b) => (
            <span key={b} style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{b}</span>
          ))}
        </div>
      </div>

      {/* SERVICES */}
      <section id="services" style={{ padding: '72px 5%', background: c.bg }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ color: c.accent, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>What We Do</p>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, color: c.text, marginBottom: 12 }}>Our Services</h2>
          <p style={{ color: '#64748b', fontSize: 16, lineHeight: 1.7, maxWidth: 520, marginBottom: 44 }}>{copy.servicesSection?.intro}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
            {services.map((svc) => (
              <div key={svc.name} style={{ background: c.secondary, border: '1px solid #dbeafe', borderRadius: 12, padding: '24px 20px' }}>
                <div style={{ width: 32, height: 32, background: `${c.accent}15`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 14 }}>🔧</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: c.text, marginBottom: 8 }}>{svc.name}</h3>
                <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.7 }}>{svc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" style={{ background: c.secondary, padding: '72px 5%', borderTop: '1px solid #dbeafe' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 60, alignItems: 'start' }}>
          <div>
            <p style={{ color: c.accent, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Our Story</p>
            <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, color: c.text, marginBottom: 24 }}>About {biz.businessName}</h2>
            {copy.aboutText?.split('\n').filter(Boolean).map((para, i) => (
              <p key={i} style={{ color: '#475569', fontSize: 16, lineHeight: 1.8, marginBottom: 14 }}>{para}</p>
            ))}
            {biz.specialties && <p style={{ color: c.accent, fontWeight: 600, marginTop: 16 }}>Specialty: {biz.specialties}</p>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { num: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '10+', label: 'Years Serving ' + biz.city },
              { num: '100%', label: 'Satisfaction Guaranteed' },
              { num: '5★', label: 'Community Rating' },
            ].map(({ num, label }) => (
              <div key={label} style={{ background: c.bg, border: '1px solid #dbeafe', borderRadius: 10, padding: '18px 22px', display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: c.accent, minWidth: 56 }}>{num}</div>
                <div style={{ color: '#64748b', fontSize: 13, fontWeight: 500 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: '72px 5%', background: c.bg }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, color: c.text, marginBottom: 40, textAlign: 'center' }}>What Our Community Says</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 18 }}>
            {copy.testimonialPlaceholders?.map((t) => (
              <div key={t.name} style={{ background: c.secondary, border: '1px solid #dbeafe', borderRadius: 12, padding: 24 }}>
                <div style={{ color: '#f59e0b', marginBottom: 10 }}>★★★★★</div>
                <p style={{ color: c.text, fontSize: 15, lineHeight: 1.7, fontStyle: 'italic', marginBottom: 12 }}>"{t.text}"</p>
                <p style={{ color: '#64748b', fontWeight: 600, fontSize: 13 }}>— {t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ background: c.accent, padding: '64px 5%', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, color: '#fff', marginBottom: 12 }}>Schedule Service Today</h2>
        <p style={{ color: '#ffffff99', fontSize: 16, marginBottom: 32 }}>Proudly serving {biz.city}, {biz.state} and surrounding communities</p>
        <a href={`tel:${biz.phone}`} style={{ background: '#fff', color: c.accent, padding: '15px 40px', borderRadius: 10, fontWeight: 800, fontSize: 18, textDecoration: 'none', display: 'inline-block' }}>
          📞 {biz.phone}
        </a>
        {biz.address && <p style={{ color: '#ffffff88', fontSize: 14, marginTop: 16 }}>📍 {biz.address}, {biz.city}, {biz.state}</p>}
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#f1f5f9', borderTop: '1px solid #dbeafe', padding: '24px 5%', textAlign: 'center' }}>
        <p style={{ color: c.text, fontWeight: 700, marginBottom: 4 }}>{biz.businessName}</p>
        <p style={{ color: '#64748b', fontSize: 13 }}>{copy.footerTagline}</p>
        <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 10 }}>© {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state} · {biz.phone}</p>
      </footer>
    </div>
  );
}
