import { useState, useEffect } from 'react';

// Template: Mobile Modern — Blue & white (#ffffff bg, #2563eb accent, #eff6ff secondary)
// Split hero layout, info cards, clean card-based services, professional badge row, stats grid

export default function MobileModern({ businessInfo, generatedCopy, templateMeta }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const c = templateMeta?.colors || { bg: '#ffffff', accent: '#2563eb', text: '#1e293b', secondary: '#eff6ff', muted: '#64748b' };
  const font = templateMeta?.bodyFont || 'Inter, system-ui, sans-serif';
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const services = copy.servicesSection?.items || [];
  const testimonials = copy.testimonialPlaceholders || [];
  const payments = biz.paymentMethods || [];
  const packages = biz.packages || [];

  return (
    <div style={{ fontFamily: font, background: c.bg, color: c.text, minHeight: '100vh', overflowX: 'hidden', margin: 0, padding: 0 }}>

      {/* STICKY NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? 'rgba(255,255,255,0.97)' : c.bg,
        borderBottom: scrolled ? '1px solid #e0e9ff' : '1px solid transparent',
        transition: 'all 0.3s ease',
        padding: '0 5%',
        boxShadow: scrolled ? '0 2px 20px rgba(37,99,235,0.08)' : 'none',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 800, color: c.accent }}>{biz.businessName || 'Mobile Detail Co.'}</span>
            <span style={{ display: 'block', fontSize: 11, color: c.muted || '#64748b', letterSpacing: 1.5, textTransform: 'uppercase' }}>Mobile Detailing · {biz.city}</span>
          </div>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            <a href="#services" style={{ color: c.text, textDecoration: 'none', fontWeight: 600, fontSize: 14, opacity: 0.7 }}>Services</a>
            <a href="#about" style={{ color: c.text, textDecoration: 'none', fontWeight: 600, fontSize: 14, opacity: 0.7 }}>About</a>
            <a href="#contact" style={{ color: c.text, textDecoration: 'none', fontWeight: 600, fontSize: 14, opacity: 0.7 }}>Contact</a>
            <a href={`tel:${biz.phone}`} style={{
              background: c.accent, color: '#fff', padding: '10px 22px',
              borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none',
            }}>
              {biz.phone || 'Call Now'}
            </a>
          </div>
        </div>
      </nav>

      {/* HERO — split layout: left headline, right info cards */}
      <header style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        background: `linear-gradient(160deg, ${c.secondary || '#eff6ff'} 0%, #dbeafe 100%)`,
        padding: '96px 5% 72px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr 420px', gap: 64, alignItems: 'center' }}>
          {/* Left: headline */}
          <div>
            <span style={{
              display: 'inline-block', background: `${c.accent}18`, color: c.accent,
              fontSize: 12, fontWeight: 700, padding: '6px 16px', borderRadius: 20,
              textTransform: 'uppercase', letterSpacing: 2, marginBottom: 24,
            }}>
              Professional Mobile Detailing · {biz.city}, {biz.state}
            </span>
            <h1 style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.15, color: c.text, marginBottom: 20 }}>
              {copy.headline || 'Premium Detail. We Come To You.'}
            </h1>
            <p style={{ color: c.muted || '#475569', fontSize: 17, lineHeight: 1.75, maxWidth: 500, marginBottom: 40 }}>
              {copy.subheadline || biz.tagline || 'Professional mobile detailing services at your home or office.'}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={`tel:${biz.phone}`} style={{
                background: c.accent, color: '#fff', padding: '14px 32px',
                borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none',
                boxShadow: `0 4px 16px ${c.accent}44`,
              }}>
                {copy.ctaPrimary || 'Book Now'}
              </a>
              <a href="#services" style={{
                background: '#fff', color: c.accent, border: `2px solid ${c.accent}`,
                padding: '13px 28px', borderRadius: 10, fontWeight: 600, fontSize: 16, textDecoration: 'none',
              }}>
                {copy.ctaSecondary || 'View Services'}
              </a>
            </div>
          </div>
          {/* Right: info cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {biz.serviceArea && (
              <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: '0 2px 16px rgba(37,99,235,0.10)', borderLeft: `4px solid ${c.accent}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>SERVICE AREA</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: c.text }}>{biz.serviceArea}</div>
              </div>
            )}
            {biz.phone && (
              <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: '0 2px 16px rgba(37,99,235,0.10)', borderLeft: `4px solid ${c.accent}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>PHONE</div>
                <a href={`tel:${biz.phone}`} style={{ fontWeight: 700, fontSize: 18, color: c.text, textDecoration: 'none' }}>{biz.phone}</a>
              </div>
            )}
            {biz.hours && Object.keys(biz.hours).length > 0 && (
              <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: '0 2px 16px rgba(37,99,235,0.10)', borderLeft: `4px solid ${c.accent}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>HOURS</div>
                {Object.entries(biz.hours).slice(0, 4).map(([day, hrs], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                    <span style={{ color: c.muted, fontWeight: 600 }}>{day}</span>
                    <span style={{ color: c.text, fontWeight: 700 }}>{hrs}</span>
                  </div>
                ))}
                {Object.keys(biz.hours).length > 4 && (
                  <div style={{ color: c.accent, fontSize: 12, marginTop: 4, fontWeight: 600 }}>+ more hours</div>
                )}
              </div>
            )}
            {biz.priceRange && (
              <div style={{ background: c.accent, borderRadius: 12, padding: '18px 22px', color: '#fff' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.8, marginBottom: 4 }}>PRICE RANGE</div>
                <div style={{ fontWeight: 800, fontSize: 20 }}>{biz.priceRange}</div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* PROFESSIONAL BADGE ROW */}
      <div style={{ background: c.accent, padding: '16px 5%' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            '✓ Home & Office Visits',
            '✓ Any Vehicle Size',
            '✓ Same-Day Available',
            '✓ Fully Insured',
          ].map((b, i) => (
            <span key={i} style={{ color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>{b}</span>
          ))}
        </div>
      </div>

      {/* STATS GRID */}
      <section style={{ background: c.bg, padding: '56px 5%', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 24, textAlign: 'center' }}>
          {[
            { val: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '10+', label: 'Years Experience' },
            { val: '500+', label: 'Clients Served' },
            { val: '5.0', label: 'Star Rating' },
            { val: '100%', label: 'Mobile Service' },
          ].map((s, i) => (
            <div key={i} style={{ padding: '24px 16px', background: c.secondary || '#eff6ff', borderRadius: 12, border: '1px solid #dbeafe' }}>
              <div style={{ fontSize: '2.8rem', fontWeight: 800, color: c.accent, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 13, color: c.muted || '#64748b', marginTop: 6, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES — clean card grid */}
      <section id="services" style={{ padding: '80px 5%', background: c.bg }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 48 }}>
            <span style={{ display: 'inline-block', background: `${c.accent}12`, color: c.accent, fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>Services</span>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 800, color: c.text, margin: '0 0 14px' }}>Services We Bring to You</h2>
            {copy.servicesSection?.intro && (
              <p style={{ color: c.muted, fontSize: 16, lineHeight: 1.7, maxWidth: 540 }}>{copy.servicesSection.intro}</p>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {services.length > 0 ? services.map((svc, i) => (
              <div key={i} style={{
                background: c.secondary || '#eff6ff', border: '1px solid #dbeafe',
                borderRadius: 14, padding: '28px 24px',
                borderTop: `3px solid ${c.accent}`,
              }}>
                <div style={{
                  width: 36, height: 36, background: `${c.accent}18`, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: c.accent, fontWeight: 900, fontSize: 16, marginBottom: 14,
                }}>✓</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: c.text, marginBottom: 10 }}>{svc.name}</h3>
                <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{svc.description}</p>
              </div>
            )) : (biz.services || []).map((svc, i) => (
              <div key={i} style={{ background: c.secondary, border: '1px solid #dbeafe', borderRadius: 14, padding: '24px 20px', borderTop: `3px solid ${c.accent}` }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: c.text, margin: 0 }}>{svc}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PACKAGES */}
      {packages.length > 0 && (
        <section style={{ padding: '80px 5%', background: c.secondary || '#eff6ff', borderTop: '1px solid #dbeafe' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <span style={{ display: 'inline-block', background: `${c.accent}18`, color: c.accent, fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>Packages</span>
              <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)', fontWeight: 800, color: c.text, margin: 0 }}>Choose Your Package</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
              {packages.map((pkg, i) => {
                const isFeature = i === Math.floor(packages.length / 2);
                return (
                  <div key={i} style={{
                    background: isFeature ? c.accent : '#fff',
                    borderRadius: 16, padding: '36px 28px', textAlign: 'center',
                    border: `2px solid ${isFeature ? c.accent : '#e5e7eb'}`,
                    boxShadow: isFeature ? `0 8px 32px ${c.accent}33` : '0 2px 12px rgba(0,0,0,0.06)',
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8, color: isFeature ? '#fff' : c.text }}>
                      {typeof pkg === 'object' ? pkg.name : pkg}
                    </div>
                    {typeof pkg === 'object' && pkg.price && (
                      <div style={{ fontSize: 26, fontWeight: 800, color: isFeature ? '#fff' : c.accent, marginBottom: 12 }}>{pkg.price}</div>
                    )}
                    {typeof pkg === 'object' && pkg.description && (
                      <p style={{ color: isFeature ? 'rgba(255,255,255,0.85)' : c.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>{pkg.description}</p>
                    )}
                    <a href={`tel:${biz.phone}`} style={{
                      display: 'inline-block',
                      background: isFeature ? '#fff' : c.accent,
                      color: isFeature ? c.accent : '#fff',
                      padding: '10px 26px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none',
                    }}>Book Now</a>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ABOUT */}
      <section id="about" style={{ padding: '80px 5%', background: c.bg, borderTop: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'start' }}>
          <div>
            <span style={{ display: 'inline-block', background: `${c.accent}12`, color: c.accent, fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>About</span>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, color: c.text, marginBottom: 20 }}>About {biz.businessName}</h2>
            <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.8, marginBottom: 20 }}>
              {copy.aboutText || `Based in ${biz.city || 'your area'}, we bring professional detailing directly to you.`}
            </p>
            {biz.certifications && (
              <div style={{ background: c.secondary, borderRadius: 10, padding: '16px 20px', marginBottom: 12, borderLeft: `4px solid ${c.accent}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>CERTIFIED</div>
                <p style={{ color: c.text, fontSize: 14, margin: 0, fontWeight: 500 }}>{biz.certifications}</p>
              </div>
            )}
            {biz.awards && (
              <div style={{ background: '#fefce8', borderRadius: 10, padding: '16px 20px', marginBottom: 12, borderLeft: '4px solid #eab308' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>AWARDS</div>
                <p style={{ color: '#92400e', fontSize: 14, margin: 0, fontWeight: 500 }}>{biz.awards}</p>
              </div>
            )}
          </div>
          <div>
            {biz.hours && Object.keys(biz.hours).length > 0 && (
              <div style={{ background: c.secondary, borderRadius: 14, padding: '28px 24px', border: '1px solid #dbeafe', marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>Hours</div>
                {Object.entries(biz.hours).map(([day, hrs], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #dbeafe' }}>
                    <span style={{ color: c.muted, fontWeight: 600, fontSize: 14 }}>{day}</span>
                    <span style={{ color: c.text, fontWeight: 700, fontSize: 14 }}>{hrs}</span>
                  </div>
                ))}
              </div>
            )}
            {payments.length > 0 && (
              <div style={{ background: c.secondary, borderRadius: 14, padding: '20px 24px', border: '1px solid #dbeafe' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Payment Methods</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {payments.map((p, i) => (
                    <span key={i} style={{
                      background: '#fff', color: c.accent, border: `1px solid ${c.accent}33`,
                      padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                    }}>{p}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      {testimonials.length > 0 && (
        <section style={{ padding: '80px 5%', background: c.secondary || '#eff6ff', borderTop: '1px solid #dbeafe' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <span style={{ display: 'inline-block', background: `${c.accent}12`, color: c.accent, fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>Reviews</span>
              <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, color: c.text, margin: 0 }}>What Customers Say</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              {testimonials.map((t, i) => (
                <div key={i} style={{
                  background: '#fff', border: '1px solid #dbeafe', borderRadius: 14, padding: '28px 24px',
                  boxShadow: '0 2px 16px rgba(37,99,235,0.06)',
                }}>
                  <div style={{ color: '#f59e0b', fontSize: 16, marginBottom: 14 }}>★★★★★</div>
                  <p style={{ color: c.text, fontSize: 15, lineHeight: 1.7, fontStyle: 'italic', margin: '0 0 16px' }}>"{t.text}"</p>
                  <p style={{ color: c.muted, fontWeight: 600, fontSize: 13, margin: 0 }}>— {t.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section id="contact" style={{ background: c.accent, padding: '80px 5%', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 800, color: '#fff', marginBottom: 14 }}>Schedule a Mobile Detail</h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, marginBottom: 36 }}>
          {copy.ctaSecondary || `We come to you anywhere in ${biz.city || 'your area'}, ${biz.state || ''}`}
        </p>
        <a href={`tel:${biz.phone}`} style={{
          background: '#fff', color: c.accent, padding: '16px 44px',
          borderRadius: 12, fontWeight: 800, fontSize: 18, textDecoration: 'none', display: 'inline-block',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}>
          {biz.phone || 'Call Now'}
        </a>
        {biz.serviceArea && <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 16 }}>Service Area: {biz.serviceArea}</p>}
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#f1f5f9', borderTop: '1px solid #e5e7eb', padding: '48px 5% 28px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 32, marginBottom: 32 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: c.accent, marginBottom: 8 }}>{biz.businessName}</div>
            <p style={{ color: c.muted, fontSize: 13, lineHeight: 1.7 }}>{copy.footerTagline || biz.tagline}</p>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12 }}>Contact</div>
            <div style={{ color: c.muted, fontSize: 14, lineHeight: 2 }}>
              {biz.phone && <div>{biz.phone}</div>}
              {biz.address && <div>{biz.address}</div>}
              {biz.city && <div>{biz.city}, {biz.state}</div>}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12 }}>Follow Us</div>
            {biz.instagram && (
              <a href={`https://instagram.com/${biz.instagram.replace('@', '')}`} style={{ display: 'block', color: c.accent, textDecoration: 'none', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                Instagram: {biz.instagram}
              </a>
            )}
            {biz.facebook && (
              <a href={`https://facebook.com/${biz.facebook}`} style={{ display: 'block', color: c.accent, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
                Facebook: {biz.facebook}
              </a>
            )}
          </div>
        </div>
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 20, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
          &copy; {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state}
        </div>
      </footer>
    </div>
  );
}
