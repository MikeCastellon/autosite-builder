import { useState, useEffect } from 'react';

// Template: Mobile Rugged — Dark green (#1a2318 bg, #8a9a4a accent, #f0ede0 text)
// Repeating diagonal line texture in hero, "ANYWHERE · ANYTIME" subtext, service area, heavy uppercase

export default function MobileRugged({ businessInfo, generatedCopy, templateMeta }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const c = templateMeta?.colors || { bg: '#1a2318', accent: '#8a9a4a', text: '#f0ede0', secondary: '#232e20', muted: '#a09880' };
  const font = templateMeta?.bodyFont || 'Georgia, serif';
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const services = copy.servicesSection?.items || [];
  const testimonials = copy.testimonialPlaceholders || [];
  const payments = biz.paymentMethods || [];
  const packages = biz.packages || [];

  // Diagonal line texture for hero
  const textureBg = `repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 6px,
    rgba(138,154,74,0.08) 6px,
    rgba(138,154,74,0.08) 7px
  )`;

  return (
    <div style={{ fontFamily: font, background: c.bg, color: c.text, minHeight: '100vh', overflowX: 'hidden', margin: 0, padding: 0 }}>

      {/* STICKY NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? 'rgba(26,35,24,0.97)' : 'transparent',
        borderBottom: scrolled ? `2px solid ${c.accent}` : '2px solid transparent',
        transition: 'all 0.3s ease',
        padding: '0 5%',
        backdropFilter: scrolled ? 'blur(10px)' : 'none',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <div>
            <span style={{ fontSize: 17, fontWeight: 800, color: c.text, textTransform: 'uppercase', letterSpacing: 2 }}>{biz.businessName || 'MOBILE DETAIL'}</span>
            <span style={{ display: 'block', fontSize: 10, color: c.accent, letterSpacing: 3, textTransform: 'uppercase' }}>Mobile Detail · {biz.city}, {biz.state}</span>
          </div>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            <a href="#services" style={{ color: c.text, textDecoration: 'none', fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.75 }}>Services</a>
            <a href="#about" style={{ color: c.text, textDecoration: 'none', fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.75 }}>About</a>
            <a href={`tel:${biz.phone}`} style={{
              background: c.accent, color: '#1a2318', padding: '9px 22px',
              borderRadius: 3, fontWeight: 800, fontSize: 13, textDecoration: 'none',
              textTransform: 'uppercase', letterSpacing: 1,
            }}>
              {biz.phone || 'CALL NOW'}
            </a>
          </div>
        </div>
      </nav>

      {/* HERO — full height with diagonal texture */}
      <header style={{
        minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center',
        background: `linear-gradient(160deg, ${c.secondary || '#232e20'} 0%, ${c.bg} 70%)`,
        overflow: 'hidden',
      }}>
        {/* Diagonal line texture overlay */}
        <div style={{ position: 'absolute', inset: 0, background: textureBg }} />
        {/* Vignette right side */}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to right, rgba(26,35,24,0.4) 0%, transparent 60%, rgba(138,154,74,0.08) 100%)` }} />

        <div style={{ position: 'relative', zIndex: 1, padding: '7rem 5% 4rem', maxWidth: 900 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: `${c.accent}20`, borderRadius: 3, border: `1px solid ${c.accent}44`,
            padding: '7px 18px', marginBottom: 28,
          }}>
            <div style={{ width: 6, height: 6, background: c.accent, borderRadius: '50%' }} />
            <span style={{ color: c.accent, fontWeight: 700, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' }}>
              {biz.city || 'YOUR CITY'}, {biz.state || ''} — MOBILE DETAILING
            </span>
          </div>
          <h1 style={{
            fontSize: 'clamp(3rem, 7vw, 5.5rem)', fontWeight: 900, lineHeight: 1,
            textTransform: 'uppercase', letterSpacing: '-0.01em', margin: '0 0 16px',
          }}>
            {copy.headline || `BUILT TOUGH.\nWE ROLL TO YOU.`}
          </h1>
          {/* ANYWHERE · ANYTIME subtext */}
          <div style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.5rem)', fontWeight: 700, letterSpacing: '0.3em',
            color: c.accent, textTransform: 'uppercase', margin: '0 0 24px',
          }}>
            ANYWHERE · ANYTIME
          </div>
          <p style={{ fontSize: 16, color: c.muted || '#a09880', maxWidth: 480, marginBottom: 40, lineHeight: 1.75 }}>
            {copy.subheadline || biz.tagline || 'Rugged, reliable mobile detailing — on your schedule, at your location.'}
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <a href={`tel:${biz.phone}`} style={{
              background: c.accent, color: '#1a2318', padding: '14px 34px',
              borderRadius: 3, fontWeight: 900, fontSize: 15, letterSpacing: 1, textTransform: 'uppercase',
              textDecoration: 'none', display: 'inline-block',
            }}>
              {copy.ctaPrimary || 'BOOK NOW'}
            </a>
            <a href="#services" style={{
              border: `2px solid ${c.accent}`, color: c.accent, padding: '12px 26px',
              borderRadius: 3, fontWeight: 800, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase',
              textDecoration: 'none', display: 'inline-block',
            }}>
              VIEW SERVICES
            </a>
          </div>
        </div>
      </header>

      {/* SERVICE AREA BANNER */}
      {biz.serviceArea && (
        <div style={{
          background: c.accent, color: '#1a2318', padding: '14px 5%', textAlign: 'center',
          fontWeight: 900, fontSize: 12, letterSpacing: 3, textTransform: 'uppercase',
        }}>
          SERVICE AREA: {biz.serviceArea}
        </div>
      )}

      {/* STATS BAR */}
      <section style={{ background: c.secondary || '#232e20', padding: '3.5rem 5%', borderBottom: `1px solid ${c.accent}33` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 32, textAlign: 'center' }}>
          {[
            { val: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '10+', label: 'YEARS EXPERIENCE' },
            { val: '100%', label: 'MOBILE SERVICE' },
            { val: '500+', label: 'HAPPY CLIENTS' },
            { val: '5★', label: 'RATED' },
          ].map((s, i) => (
            <div key={i} style={{ borderRight: i < 3 ? `1px solid ${c.accent}22` : 'none', paddingRight: i < 3 ? 16 : 0 }}>
              <div style={{ fontSize: '2.8rem', fontWeight: 900, color: c.accent, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, color: c.muted, marginTop: 8, textTransform: 'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" style={{ padding: '80px 5%' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <div style={{ width: 42, height: 3, background: c.accent, borderRadius: 2 }} />
            <span style={{ color: c.accent, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700 }}>What We Do</span>
          </div>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 16px', letterSpacing: '-0.01em' }}>OUR SERVICES</h2>
          {copy.servicesSection?.intro && (
            <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.7, maxWidth: 520, marginBottom: 48 }}>{copy.servicesSection.intro}</p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 18 }}>
            {services.length > 0 ? services.map((svc, i) => (
              <div key={i} style={{
                background: c.secondary || '#232e20', border: `1px solid ${c.accent}33`,
                borderRadius: 4, padding: '28px 24px',
                borderTop: `3px solid ${c.accent}`,
              }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, color: c.accent }}>{svc.name}</h3>
                <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{svc.description}</p>
              </div>
            )) : (biz.services || []).map((svc, i) => (
              <div key={i} style={{ background: c.secondary, border: `1px solid ${c.accent}33`, borderRadius: 4, padding: '24px 20px', borderTop: `3px solid ${c.accent}` }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', color: c.accent, margin: 0 }}>{svc}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT + HOURS */}
      <section id="about" style={{ background: c.secondary || '#232e20', padding: '80px 5%', borderTop: `1px solid ${c.accent}33` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{ width: 42, height: 3, background: c.accent, borderRadius: 2 }} />
              <span style={{ color: c.accent, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700 }}>Our Story</span>
            </div>
            <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.8rem)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 20px', letterSpacing: '-0.01em' }}>ABOUT US</h2>
            <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.85, marginBottom: 20 }}>
              {copy.aboutText || `Serving ${biz.city || 'your area'} and surrounding regions. We bring the shop to you.`}
            </p>
            {biz.certifications && (
              <div style={{ background: `${c.accent}15`, border: `1px solid ${c.accent}44`, borderRadius: 4, padding: '14px 18px', marginBottom: 12 }}>
                <div style={{ color: c.accent, fontWeight: 700, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>CERTIFIED</div>
                <p style={{ color: c.text, fontSize: 13, margin: 0 }}>{biz.certifications}</p>
              </div>
            )}
            {biz.awards && (
              <div style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 4, padding: '14px 18px', marginBottom: 12 }}>
                <div style={{ color: '#c0a020', fontWeight: 700, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>AWARDS</div>
                <p style={{ color: c.text, fontSize: 13, margin: 0 }}>{biz.awards}</p>
              </div>
            )}
            {biz.specialties && (
              <div style={{ background: `${c.accent}15`, border: `1px solid ${c.accent}44`, borderRadius: 4, padding: '14px 18px' }}>
                <div style={{ color: c.accent, fontWeight: 700, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>SPECIALTIES</div>
                <p style={{ color: c.text, fontSize: 13, margin: 0 }}>{biz.specialties}</p>
              </div>
            )}
          </div>
          <div>
            {biz.hours && Object.keys(biz.hours).length > 0 && (
              <div style={{ background: c.bg, borderRadius: 4, padding: '28px 24px', border: `1px solid ${c.accent}44`, marginBottom: 20 }}>
                <div style={{ color: c.accent, fontWeight: 800, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 18 }}>HOURS</div>
                {Object.entries(biz.hours).map(([day, hrs], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${c.accent}22`, paddingBottom: 10, marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1.5, color: c.text }}>{day}</span>
                    <span style={{ color: c.accent, fontWeight: 700, fontSize: 13 }}>{hrs}</span>
                  </div>
                ))}
              </div>
            )}
            {payments.length > 0 && (
              <div style={{ background: c.bg, borderRadius: 4, padding: '20px 24px', border: `1px solid ${c.accent}44` }}>
                <div style={{ color: c.accent, fontWeight: 800, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>PAYMENT ACCEPTED</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {payments.map((p, i) => (
                    <span key={i} style={{
                      background: `${c.accent}22`, color: c.text, border: `1px solid ${c.accent}44`,
                      padding: '4px 14px', borderRadius: 3, fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
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
        <section style={{ padding: '80px 5%', borderTop: `1px solid ${c.accent}33` }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 }}>
              <div style={{ width: 42, height: 3, background: c.accent, borderRadius: 2 }} />
              <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.8rem)', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>WHAT THEY SAY</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 20 }}>
              {testimonials.map((t, i) => (
                <div key={i} style={{
                  background: c.secondary, border: `1px solid ${c.accent}33`,
                  borderRadius: 4, padding: '28px 24px', borderLeft: `4px solid ${c.accent}`,
                }}>
                  <div style={{ color: c.accent, fontSize: 15, marginBottom: 14 }}>★★★★★</div>
                  <p style={{ color: c.text, fontSize: 15, lineHeight: 1.75, fontStyle: 'italic', margin: '0 0 14px' }}>"{t.text}"</p>
                  <div style={{ color: c.accent, fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5 }}>— {t.name}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section style={{ background: c.accent, padding: '72px 5%', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, color: '#1a2318', textTransform: 'uppercase', margin: '0 0 16px', letterSpacing: '-0.01em' }}>
          BOOK YOUR DETAIL
        </h2>
        <p style={{ color: 'rgba(26,35,24,0.65)', fontSize: 16, marginBottom: 36 }}>
          {copy.ctaSecondary || `We roll out to ${biz.city || 'your area'} and surrounding areas.`}
        </p>
        <a href={`tel:${biz.phone}`} style={{
          background: '#1a2318', color: c.accent, padding: '16px 44px',
          borderRadius: 3, fontWeight: 900, fontSize: 18, textDecoration: 'none',
          display: 'inline-block', textTransform: 'uppercase', letterSpacing: 1,
        }}>
          {biz.phone || 'CALL NOW'}
        </a>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#111a0f', padding: '48px 5% 24px', borderTop: `1px solid ${c.accent}33` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 36, marginBottom: 32 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: c.accent, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>{biz.businessName}</div>
            <p style={{ color: c.muted, fontSize: 13, lineHeight: 1.7 }}>{copy.footerTagline || biz.tagline}</p>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#4a5a48', marginBottom: 12 }}>CONTACT</div>
            <div style={{ color: c.muted, fontSize: 14, lineHeight: 2 }}>
              {biz.phone && <div>{biz.phone}</div>}
              {biz.address && <div>{biz.address}</div>}
              {biz.city && <div>{biz.city}, {biz.state}</div>}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#4a5a48', marginBottom: 12 }}>FOLLOW</div>
            {biz.instagram && (
              <a href={`https://instagram.com/${biz.instagram.replace('@', '')}`} style={{ display: 'block', color: c.accent, textDecoration: 'none', fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
                Instagram: {biz.instagram}
              </a>
            )}
            {biz.facebook && (
              <a href={`https://facebook.com/${biz.facebook}`} style={{ display: 'block', color: c.accent, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
                Facebook: {biz.facebook}
              </a>
            )}
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${c.accent}22`, paddingTop: 18, textAlign: 'center', color: c.muted, fontSize: 12 }}>
          &copy; {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state}
        </div>
      </footer>
    </div>
  );
}
