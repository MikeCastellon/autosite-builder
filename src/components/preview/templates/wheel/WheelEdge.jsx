import { useState, useEffect } from 'react';

// Template: Wheel Edge — Dark chrome & electric blue (#0d0d0d bg, #00b4d8 accent, #1a1a2e secondary)
// Circular ring decorative element in hero, product-catalog service grid, brands section, no emoji in nav

export default function WheelEdge({ businessInfo, generatedCopy, templateMeta }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const c = templateMeta?.colors || { bg: '#0d0d0d', accent: '#00b4d8', text: '#e0e0e0', secondary: '#1a1a2e', muted: '#666688' };
  const font = templateMeta?.bodyFont || 'Rajdhani, system-ui, sans-serif';
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const services = copy.servicesSection?.items || [];
  const testimonials = copy.testimonialPlaceholders || [];
  const payments = biz.paymentMethods || [];

  const brands = biz.brands ? (typeof biz.brands === 'string' ? biz.brands.split(/,|·/).map(b => b.trim()) : biz.brands) : [];
  const tireBrands = biz.tireBrands ? (typeof biz.tireBrands === 'string' ? biz.tireBrands.split(/,|·/).map(b => b.trim()) : biz.tireBrands) : [];

  return (
    <div style={{ fontFamily: font, background: c.bg, color: c.text, minHeight: '100vh', overflowX: 'hidden', margin: 0, padding: 0 }}>

      {/* STICKY NAV — no emoji */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? 'rgba(13,13,13,0.97)' : 'transparent',
        borderBottom: scrolled ? `1px solid ${c.accent}44` : '1px solid transparent',
        transition: 'all 0.3s ease',
        padding: '0 5%',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 900, color: c.text, textTransform: 'uppercase', letterSpacing: 3 }}>{biz.businessName || 'WHEEL SHOP'}</span>
            <span style={{ display: 'block', fontSize: 10, color: c.accent, letterSpacing: 4, textTransform: 'uppercase' }}>Wheels · Tires · {biz.city}</span>
          </div>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            <a href="#services" style={{ color: c.text, textDecoration: 'none', fontWeight: 600, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.7 }}>Services</a>
            <a href="#brands" style={{ color: c.text, textDecoration: 'none', fontWeight: 600, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.7 }}>Brands</a>
            <a href="#about" style={{ color: c.text, textDecoration: 'none', fontWeight: 600, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.7 }}>About</a>
            <a href={`tel:${biz.phone}`} style={{
              border: `2px solid ${c.accent}`, color: c.accent, padding: '9px 24px',
              fontWeight: 700, fontSize: 13, textDecoration: 'none',
              textTransform: 'uppercase', letterSpacing: 1.5, borderRadius: 2,
              transition: 'all 0.2s',
            }}>
              {biz.phone || 'CALL NOW'}
            </a>
          </div>
        </div>
      </nav>

      {/* HERO — full height with circular ring decoration */}
      <header style={{
        minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center',
        background: `radial-gradient(ellipse at 70% 50%, ${c.secondary || '#1a1a2e'} 0%, ${c.bg} 65%)`,
        overflow: 'hidden',
      }}>
        {/* Large decorative circular ring — wheel silhouette */}
        <div style={{
          position: 'absolute', right: '-8%', top: '50%', transform: 'translateY(-50%)',
          width: 600, height: 600,
          border: `3px solid ${c.accent}22`,
          borderRadius: '50%',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', right: '-8%', top: '50%', transform: 'translateY(-50%)',
          width: 460, height: 460,
          border: `2px solid ${c.accent}44`,
          borderRadius: '50%',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', right: '-8%', top: '50%', transform: 'translateY(-50%)',
          width: 320, height: 320,
          border: `1px solid ${c.accent}66`,
          borderRadius: '50%',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', right: '-8%', top: '50%', transform: 'translateY(-50%)',
          width: 160, height: 160,
          background: `${c.accent}12`,
          border: `2px solid ${c.accent}`,
          borderRadius: '50%',
          pointerEvents: 'none',
        }} />
        {/* Subtle grid background */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(rgba(0,180,216,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,180,216,0.04) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />

        <div style={{ position: 'relative', zIndex: 1, padding: '7rem 5% 4rem', maxWidth: 780 }}>
          <p style={{ color: c.accent, fontSize: 11, letterSpacing: 5, textTransform: 'uppercase', marginBottom: 20, fontWeight: 700 }}>
            Custom Wheels & Tires · {biz.city}, {biz.state}
          </p>
          <h1 style={{
            fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 900, lineHeight: 1.05,
            textTransform: 'uppercase', letterSpacing: '-0.02em', margin: '0 0 20px',
          }}>
            {copy.headline || 'UPGRADE YOUR RIDE'}
          </h1>
          <p style={{ color: c.muted, fontSize: 16, lineHeight: 1.75, maxWidth: 480, marginBottom: 44 }}>
            {copy.subheadline || biz.tagline || 'Custom wheel fitment, tire mounting, and precision balancing.'}
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <a href={`tel:${biz.phone}`} style={{
              background: c.accent, color: '#000', padding: '15px 36px',
              fontWeight: 800, fontSize: 15, letterSpacing: 1.5, textTransform: 'uppercase',
              textDecoration: 'none', display: 'inline-block', borderRadius: 2,
            }}>
              {copy.ctaPrimary || 'GET A QUOTE'}
            </a>
            <a href="#services" style={{
              border: `1px solid ${c.accent}66`, color: c.accent, padding: '14px 28px',
              fontWeight: 700, fontSize: 14, letterSpacing: 1.5, textTransform: 'uppercase',
              textDecoration: 'none', display: 'inline-block', borderRadius: 2,
            }}>
              {copy.ctaSecondary || 'OUR SERVICES'}
            </a>
          </div>
        </div>
      </header>

      {/* STATS */}
      <section style={{ background: c.secondary || '#1a1a2e', padding: '3rem 5%', borderBottom: `1px solid ${c.accent}33` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 24, textAlign: 'center' }}>
          {[
            { val: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '10+', label: 'YEARS IN BUSINESS' },
            { val: '50+', label: 'BRANDS AVAILABLE' },
            { val: '5K+', label: 'WHEELS INSTALLED' },
            { val: biz.priceRange || '$$', label: 'COMPETITIVE PRICING' },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: c.accent, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, color: c.muted, marginTop: 8, textTransform: 'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES — product-catalog grid */}
      <section id="services" style={{ padding: '80px 5%' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{ width: 40, height: 2, background: c.accent }} />
              <span style={{ color: c.accent, fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', fontWeight: 700 }}>Catalog</span>
            </div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 14px', letterSpacing: '-0.01em' }}>WHAT WE OFFER</h2>
            {copy.servicesSection?.intro && (
              <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.7, maxWidth: 520 }}>{copy.servicesSection.intro}</p>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
            {services.length > 0 ? services.map((svc, i) => (
              <div key={i} style={{
                background: i % 2 === 0 ? c.secondary : '#0f0f1e',
                padding: '32px 26px',
                borderTop: `2px solid ${i < 2 ? c.accent : 'transparent'}`,
                borderBottom: `1px solid ${c.accent}11`,
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', top: 0, right: 0,
                  width: 60, height: 60,
                  background: `${c.accent}08`,
                  borderRadius: '0 0 0 60px',
                }} />
                <div style={{ fontSize: 11, color: c.accent, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, color: c.text }}>{svc.name}</h3>
                <p style={{ color: c.muted, fontSize: 13, lineHeight: 1.7, margin: 0 }}>{svc.description}</p>
              </div>
            )) : (biz.services || []).map((svc, i) => (
              <div key={i} style={{ background: i % 2 === 0 ? c.secondary : '#0f0f1e', padding: '28px 24px', borderTop: `2px solid ${i < 2 ? c.accent : 'transparent'}` }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, textTransform: 'uppercase', color: c.text, margin: 0 }}>{svc}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BRANDS CARRIED */}
      {(brands.length > 0 || tireBrands.length > 0) && (
        <section id="brands" style={{ padding: '72px 5%', background: c.secondary, borderTop: `1px solid ${c.accent}33` }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 }}>
              <div style={{ width: 40, height: 2, background: c.accent }} />
              <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>BRANDS WE CARRY</h2>
            </div>
            {brands.length > 0 && (
              <div style={{ marginBottom: 36 }}>
                <div style={{ fontSize: 11, color: c.accent, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 20 }}>WHEELS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {brands.map((brand, i) => (
                    <div key={i} style={{
                      border: `1px solid ${c.accent}44`, color: c.text, padding: '10px 20px',
                      fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
                      background: `${c.accent}08`, borderRadius: 2,
                    }}>{brand}</div>
                  ))}
                </div>
              </div>
            )}
            {tireBrands.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: c.accent, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 20 }}>TIRES</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {tireBrands.map((brand, i) => (
                    <div key={i} style={{
                      border: `1px solid ${c.accent}33`, color: c.muted, padding: '10px 20px',
                      fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
                      background: `${c.accent}05`, borderRadius: 2,
                    }}>{brand}</div>
                  ))}
                </div>
              </div>
            )}
            {!brands.length && !tireBrands.length && biz.brands && (
              <p style={{ color: c.text, fontSize: 15 }}>{biz.brands}</p>
            )}
          </div>
        </section>
      )}

      {/* ABOUT */}
      <section id="about" style={{ padding: '80px 5%', borderTop: `1px solid ${c.accent}33` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{ width: 40, height: 2, background: c.accent }} />
              <span style={{ color: c.accent, fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', fontWeight: 700 }}>About</span>
            </div>
            <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.8rem)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 20px', letterSpacing: '-0.01em' }}>ABOUT {biz.businessName || 'US'}</h2>
            <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.85, marginBottom: 20 }}>
              {copy.aboutText || `Located in ${biz.city || 'your area'}, we specialize in custom wheel fitment and tire services.`}
            </p>
            {biz.certifications && (
              <div style={{ background: c.secondary, borderRadius: 3, padding: '16px 20px', marginBottom: 12, borderLeft: `3px solid ${c.accent}` }}>
                <div style={{ color: c.accent, fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>CERTIFICATIONS</div>
                <p style={{ color: c.text, fontSize: 14, margin: 0 }}>{biz.certifications}</p>
              </div>
            )}
            {biz.awards && (
              <div style={{ background: c.secondary, borderRadius: 3, padding: '16px 20px', marginBottom: 12, borderLeft: '3px solid #ffd700' }}>
                <div style={{ color: '#ffd700', fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>AWARDS</div>
                <p style={{ color: c.text, fontSize: 14, margin: 0 }}>{biz.awards}</p>
              </div>
            )}
          </div>
          <div>
            {biz.hours && Object.keys(biz.hours).length > 0 && (
              <div style={{ background: c.secondary, padding: '28px 24px', borderRadius: 3, border: `1px solid ${c.accent}33`, marginBottom: 20 }}>
                <div style={{ color: c.accent, fontWeight: 700, fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 18 }}>SHOP HOURS</div>
                {Object.entries(biz.hours).map(([day, hrs], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${c.accent}15`, paddingBottom: 10, marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1.5, color: c.text }}>{day}</span>
                    <span style={{ color: c.accent, fontWeight: 700, fontSize: 13 }}>{hrs}</span>
                  </div>
                ))}
              </div>
            )}
            {biz.address && (
              <div style={{ background: c.secondary, padding: '20px 24px', borderRadius: 3, border: `1px solid ${c.accent}33`, marginBottom: 16 }}>
                <div style={{ color: c.accent, fontWeight: 700, fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 8 }}>LOCATION</div>
                <p style={{ color: c.text, fontSize: 14, margin: 0, lineHeight: 1.6 }}>{biz.address}<br />{biz.city}, {biz.state}</p>
              </div>
            )}
            {payments.length > 0 && (
              <div style={{ background: c.secondary, padding: '20px 24px', borderRadius: 3, border: `1px solid ${c.accent}33` }}>
                <div style={{ color: c.accent, fontWeight: 700, fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 12 }}>PAYMENT</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {payments.map((p, i) => (
                    <span key={i} style={{
                      border: `1px solid ${c.accent}33`, color: c.muted, padding: '4px 14px',
                      fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', borderRadius: 2,
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
        <section style={{ padding: '80px 5%', background: c.secondary, borderTop: `1px solid ${c.accent}33` }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 }}>
              <div style={{ width: 40, height: 2, background: c.accent }} />
              <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.5rem)', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>CUSTOMER REVIEWS</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              {testimonials.map((t, i) => (
                <div key={i} style={{
                  background: c.bg, border: `1px solid ${c.accent}22`,
                  borderRadius: 3, padding: '28px 24px', borderTop: `2px solid ${c.accent}`,
                }}>
                  <div style={{ color: c.accent, fontSize: 15, marginBottom: 14 }}>★★★★★</div>
                  <p style={{ color: c.text, fontSize: 15, lineHeight: 1.7, fontStyle: 'italic', margin: '0 0 14px' }}>"{t.text}"</p>
                  <div style={{ color: c.accent, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5 }}>— {t.name}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section style={{ background: c.secondary, padding: '80px 5%', textAlign: 'center', borderTop: `1px solid ${c.accent}33` }}>
        <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 16px', letterSpacing: '-0.01em' }}>READY TO UPGRADE?</h2>
        <p style={{ color: c.muted, fontSize: 16, marginBottom: 36 }}>
          {copy.ctaSecondary || `${biz.city || 'Your city'}, ${biz.state || ''} — Call or stop by today`}
        </p>
        <a href={`tel:${biz.phone}`} style={{
          background: c.accent, color: '#000', padding: '16px 44px',
          fontWeight: 900, fontSize: 17, textDecoration: 'none',
          display: 'inline-block', textTransform: 'uppercase', letterSpacing: 2, borderRadius: 2,
        }}>
          {biz.phone || 'CALL NOW'}
        </a>
        {biz.address && <p style={{ color: c.muted, fontSize: 13, marginTop: 18 }}>
          {biz.address}, {biz.city}, {biz.state}
        </p>}
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#06060d', padding: '48px 5% 24px', borderTop: `1px solid ${c.accent}22` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 36, marginBottom: 32 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 13, color: c.accent, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 10 }}>{biz.businessName}</div>
            <p style={{ color: '#333', fontSize: 13, lineHeight: 1.7 }}>{copy.footerTagline || biz.tagline}</p>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#333', marginBottom: 12 }}>CONTACT</div>
            <div style={{ color: '#555', fontSize: 14, lineHeight: 2 }}>
              {biz.phone && <div>{biz.phone}</div>}
              {biz.address && <div>{biz.address}</div>}
              {biz.city && <div>{biz.city}, {biz.state}</div>}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#333', marginBottom: 12 }}>FOLLOW</div>
            {biz.instagram && (
              <a href={`https://instagram.com/${biz.instagram.replace('@', '')}`} style={{ display: 'block', color: c.accent, textDecoration: 'none', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                Instagram: {biz.instagram}
              </a>
            )}
            {biz.facebook && (
              <a href={`https://facebook.com/${biz.facebook}`} style={{ display: 'block', color: c.accent, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
                Facebook: {biz.facebook}
              </a>
            )}
          </div>
        </div>
        <div style={{ borderTop: `1px solid #111`, paddingTop: 20, textAlign: 'center', color: '#333', fontSize: 12 }}>
          &copy; {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state}
        </div>
      </footer>
    </div>
  );
}
