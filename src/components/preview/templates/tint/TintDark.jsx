import { useState, useEffect } from 'react';

// Template: Tint Dark — Black & purple (#080808 bg, #7c3aed accent, #111111 secondary)
// Radial gradient glow hero, film brands section, shield warranty callout, packages, fade/gradient elements

export default function TintDark({ businessInfo, generatedCopy, templateMeta }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const c = templateMeta?.colors || { bg: '#080808', accent: '#7c3aed', text: '#e8e8e8', secondary: '#111111', muted: '#888888' };
  const font = templateMeta?.bodyFont || 'Inter, system-ui, sans-serif';
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const services = copy.servicesSection?.items || [];
  const testimonials = copy.testimonialPlaceholders || [];
  const payments = biz.paymentMethods || [];
  const packages = biz.packages || [];

  const filmBrandsList = biz.filmBrands
    ? (typeof biz.filmBrands === 'string' ? biz.filmBrands.split(/,|·/).map(b => b.trim()) : biz.filmBrands)
    : [];

  return (
    <div style={{ fontFamily: font, background: c.bg, color: c.text, minHeight: '100vh', overflowX: 'hidden', margin: 0, padding: 0 }}>

      {/* STICKY NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? 'rgba(8,8,8,0.96)' : 'transparent',
        borderBottom: scrolled ? `1px solid ${c.accent}44` : '1px solid transparent',
        transition: 'all 0.3s ease',
        padding: '0 5%',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <div>
            <span style={{ fontSize: 17, fontWeight: 800, color: c.text, letterSpacing: -0.5 }}>{biz.businessName || 'Premium Tint'}</span>
            <span style={{ display: 'block', fontSize: 10, color: c.accent, letterSpacing: 3, textTransform: 'uppercase' }}>Tint & Protection · {biz.city}</span>
          </div>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            <a href="#services" style={{ color: c.text, textDecoration: 'none', fontWeight: 500, fontSize: 14, opacity: 0.65 }}>Services</a>
            <a href="#films" style={{ color: c.text, textDecoration: 'none', fontWeight: 500, fontSize: 14, opacity: 0.65 }}>Film Brands</a>
            <a href="#warranty" style={{ color: c.text, textDecoration: 'none', fontWeight: 500, fontSize: 14, opacity: 0.65 }}>Warranty</a>
            <a href={`tel:${biz.phone}`} style={{
              background: c.accent, color: '#fff', padding: '10px 22px',
              borderRadius: 6, fontWeight: 700, fontSize: 14, textDecoration: 'none',
              boxShadow: `0 0 20px ${c.accent}55`,
            }}>
              {biz.phone || 'Get a Quote'}
            </a>
          </div>
        </div>
      </nav>

      {/* HERO — full height with radial gradient glow effect */}
      <header style={{
        minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center',
        background: c.bg,
        overflow: 'hidden',
      }}>
        {/* Radial glow — top right */}
        <div style={{
          position: 'absolute', top: '-20%', right: '-10%',
          width: 700, height: 700,
          background: `radial-gradient(circle, ${c.accent}30 0%, transparent 65%)`,
          pointerEvents: 'none',
        }} />
        {/* Secondary glow — bottom left */}
        <div style={{
          position: 'absolute', bottom: '-15%', left: '-5%',
          width: 500, height: 500,
          background: `radial-gradient(circle, ${c.accent}18 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        {/* Horizontal fade line */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 200,
          background: `linear-gradient(to top, ${c.bg}, transparent)`,
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, padding: '7rem 5% 4rem', maxWidth: 900, margin: '0 auto', textAlign: 'center', width: '100%' }}>
          <div style={{
            display: 'inline-block', border: `1px solid ${c.accent}55`, borderRadius: 30,
            padding: '6px 20px', marginBottom: 28, fontSize: 11, color: c.accent, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase',
          }}>
            Premium Tint & Film Protection · {biz.city}, {biz.state}
          </div>
          <h1 style={{
            fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 800, lineHeight: 1.1,
            margin: '0 0 20px',
          }}>
            {copy.headline || 'Precision Tinting. Premium Results.'}
          </h1>
          {/* Gradient fade on subheadline */}
          <p style={{
            fontSize: 17, lineHeight: 1.75, maxWidth: 560, margin: '0 auto 40px',
            background: `linear-gradient(180deg, ${c.text} 0%, rgba(232,232,232,0.6) 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            {copy.subheadline || biz.tagline || 'Professional window tinting and paint protection film.'}
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
            <a href={`tel:${biz.phone}`} style={{
              background: c.accent, color: '#fff', padding: '15px 36px',
              borderRadius: 8, fontWeight: 700, fontSize: 16, textDecoration: 'none',
              boxShadow: `0 4px 30px ${c.accent}55`,
            }}>
              {copy.ctaPrimary || 'Get a Free Quote'}
            </a>
            <a href="#services" style={{
              border: `1px solid ${c.accent}55`, color: c.accent, padding: '14px 28px',
              borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: 'none',
            }}>
              {copy.ctaSecondary || 'View Services'}
            </a>
          </div>
        </div>
      </header>

      {/* STATS */}
      <section style={{ background: c.secondary || '#111', padding: '48px 5%', borderTop: `1px solid ${c.accent}22`, borderBottom: `1px solid ${c.accent}22` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 24, textAlign: 'center' }}>
          {[
            { val: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '10+', label: 'Years in Business' },
            { val: '2K+', label: 'Cars Tinted' },
            { val: '99%', label: 'Customer Satisfaction' },
            { val: biz.priceRange || '$$', label: 'Competitive Pricing' },
          ].map((s, i) => (
            <div key={i} style={{ padding: '16px 8px' }}>
              <div style={{
                fontSize: '2.8rem', fontWeight: 800, lineHeight: 1,
                background: `linear-gradient(135deg, ${c.accent}, #a855f7)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>{s.val}</div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 8, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" style={{ padding: '80px 5%' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ color: c.accent, fontWeight: 700, letterSpacing: 3, fontSize: 11, textTransform: 'uppercase', marginBottom: 10 }}>WHAT WE DO</div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, margin: '0 0 14px' }}>Our Services</h2>
            {copy.servicesSection?.intro && (
              <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.7, maxWidth: 520 }}>{copy.servicesSection.intro}</p>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
            {services.length > 0 ? services.map((svc, i) => (
              <div key={i} style={{
                background: c.secondary || '#111',
                border: `1px solid ${c.accent}22`,
                borderRadius: 10, padding: '28px 24px',
                position: 'relative', overflow: 'hidden',
              }}>
                {/* Subtle glow top-right corner */}
                <div style={{
                  position: 'absolute', top: -20, right: -20, width: 80, height: 80,
                  background: `radial-gradient(circle, ${c.accent}20, transparent 70%)`,
                }} />
                <div style={{ width: 3, height: 32, background: `linear-gradient(180deg, ${c.accent}, transparent)`, marginBottom: 16, borderRadius: 2 }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: c.text }}>{svc.name}</h3>
                <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{svc.description}</p>
              </div>
            )) : (biz.services || []).map((svc, i) => (
              <div key={i} style={{ background: c.secondary, border: `1px solid ${c.accent}22`, borderRadius: 10, padding: '24px 20px' }}>
                <div style={{ width: 3, height: 28, background: c.accent, marginBottom: 12, borderRadius: 2 }} />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: c.text, margin: 0 }}>{svc}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FILM BRANDS */}
      {(filmBrandsList.length > 0 || biz.filmBrands) && (
        <section id="films" style={{ padding: '72px 5%', background: c.secondary, borderTop: `1px solid ${c.accent}22` }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ color: c.accent, fontWeight: 700, letterSpacing: 3, fontSize: 11, textTransform: 'uppercase', marginBottom: 10 }}>PREMIUM FILMS</div>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, marginBottom: 32 }}>Film Brands We Use</h2>
            {filmBrandsList.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                {filmBrandsList.map((brand, i) => (
                  <div key={i} style={{
                    padding: '14px 24px', borderRadius: 8,
                    background: `linear-gradient(135deg, ${c.accent}22, ${c.accent}08)`,
                    border: `1px solid ${c.accent}44`,
                    fontSize: 14, fontWeight: 700, color: c.text, letterSpacing: 0.5,
                    boxShadow: `0 2px 12px ${c.accent}18`,
                  }}>{brand}</div>
                ))}
              </div>
            ) : (
              <p style={{ color: c.text, fontSize: 15 }}>{biz.filmBrands}</p>
            )}
          </div>
        </section>
      )}

      {/* WARRANTY — SHIELD-STYLE CALLOUT */}
      {(biz.warranty || biz.warrantyOffered) && (
        <section id="warranty" style={{ padding: '72px 5%', borderTop: `1px solid ${c.accent}22` }}>
          <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
            {/* Shield graphic */}
            <div style={{
              width: 80, height: 80, margin: '0 auto 24px',
              background: `linear-gradient(135deg, ${c.accent}33, ${c.accent}11)`,
              border: `2px solid ${c.accent}66`,
              borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32,
              boxShadow: `0 0 40px ${c.accent}33`,
            }}>
              🛡
            </div>
            <div style={{ color: c.accent, fontWeight: 700, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>BACKED BY A GUARANTEE</div>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)', fontWeight: 800, marginBottom: 16 }}>Our Warranty Promise</h2>
            <p style={{
              color: c.text, fontSize: 16, lineHeight: 1.75, maxWidth: 580, margin: '0 auto 24px',
              padding: '24px 28px',
              background: `linear-gradient(135deg, ${c.accent}12, ${c.accent}06)`,
              border: `1px solid ${c.accent}33`,
              borderRadius: 12,
            }}>
              {biz.warranty || biz.warrantyOffered}
            </p>
          </div>
        </section>
      )}

      {/* PACKAGES */}
      {packages.length > 0 && (
        <section style={{ padding: '80px 5%', background: c.secondary, borderTop: `1px solid ${c.accent}22` }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <div style={{ color: c.accent, fontWeight: 700, letterSpacing: 3, fontSize: 11, textTransform: 'uppercase', marginBottom: 10 }}>PACKAGES</div>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 800, margin: 0 }}>Choose Your Package</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
              {packages.map((pkg, i) => {
                const isFeature = i === Math.floor(packages.length / 2);
                return (
                  <div key={i} style={{
                    background: isFeature ? `linear-gradient(135deg, ${c.accent}, #a855f7)` : c.bg,
                    border: `1px solid ${isFeature ? 'transparent' : `${c.accent}33`}`,
                    borderRadius: 12, padding: '36px 28px', textAlign: 'center',
                    boxShadow: isFeature ? `0 8px 40px ${c.accent}44` : 'none',
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8, color: '#fff' }}>
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
                      background: isFeature ? 'rgba(255,255,255,0.2)' : c.accent,
                      color: '#fff', padding: '10px 26px', borderRadius: 8,
                      fontWeight: 700, fontSize: 14, textDecoration: 'none',
                      border: isFeature ? '1px solid rgba(255,255,255,0.4)' : 'none',
                    }}>Book Now</a>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ABOUT */}
      <section id="about" style={{ padding: '80px 5%', borderTop: `1px solid ${c.accent}22` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'start' }}>
          <div>
            <div style={{ color: c.accent, fontWeight: 700, letterSpacing: 3, fontSize: 11, textTransform: 'uppercase', marginBottom: 10 }}>ABOUT US</div>
            <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.8rem)', fontWeight: 800, margin: '0 0 20px' }}>About {biz.businessName}</h2>
            <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.85, marginBottom: 20 }}>
              {copy.aboutText || `Serving ${biz.city || 'your area'} with premium window tinting and film protection.`}
            </p>
            {biz.certifications && (
              <div style={{ background: c.secondary, borderRadius: 8, padding: '16px 20px', marginBottom: 12, borderLeft: `3px solid ${c.accent}` }}>
                <div style={{ color: c.accent, fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>CERTIFICATIONS</div>
                <p style={{ color: c.text, fontSize: 14, margin: 0 }}>{biz.certifications}</p>
              </div>
            )}
            {biz.awards && (
              <div style={{ background: c.secondary, borderRadius: 8, padding: '16px 20px', marginBottom: 12, borderLeft: '3px solid #ffd700' }}>
                <div style={{ color: '#ffd700', fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>AWARDS</div>
                <p style={{ color: c.text, fontSize: 14, margin: 0 }}>{biz.awards}</p>
              </div>
            )}
          </div>
          <div>
            {biz.hours && Object.keys(biz.hours).length > 0 && (
              <div style={{ background: c.secondary, padding: '28px 24px', borderRadius: 10, border: `1px solid ${c.accent}22`, marginBottom: 20 }}>
                <div style={{ color: c.accent, fontWeight: 700, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 18 }}>SHOP HOURS</div>
                {Object.entries(biz.hours).map(([day, hrs], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${c.accent}15`, paddingBottom: 10, marginBottom: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: c.text }}>{day}</span>
                    <span style={{ color: c.accent, fontWeight: 700, fontSize: 13 }}>{hrs}</span>
                  </div>
                ))}
              </div>
            )}
            {payments.length > 0 && (
              <div style={{ background: c.secondary, padding: '20px 24px', borderRadius: 10, border: `1px solid ${c.accent}22` }}>
                <div style={{ color: c.accent, fontWeight: 700, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>PAYMENT</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {payments.map((p, i) => (
                    <span key={i} style={{
                      border: `1px solid ${c.accent}44`, color: c.muted, padding: '5px 14px',
                      borderRadius: 20, fontSize: 13, fontWeight: 600,
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
        <section style={{ padding: '80px 5%', background: c.secondary, borderTop: `1px solid ${c.accent}22` }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <div style={{ color: c.accent, fontWeight: 700, letterSpacing: 3, fontSize: 11, textTransform: 'uppercase', marginBottom: 10 }}>TESTIMONIALS</div>
              <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.5rem)', fontWeight: 800, margin: 0 }}>What Clients Say</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
              {testimonials.map((t, i) => (
                <div key={i} style={{
                  background: c.bg, border: `1px solid ${c.accent}22`,
                  borderRadius: 10, padding: '28px 24px',
                  boxShadow: `0 4px 20px ${c.accent}0f`,
                }}>
                  <div style={{ color: c.accent, marginBottom: 12 }}>★★★★★</div>
                  <p style={{ color: c.text, fontSize: 15, lineHeight: 1.7, fontStyle: 'italic', margin: '0 0 14px' }}>"{t.text}"</p>
                  <div style={{ color: c.accent, fontWeight: 700, fontSize: 13 }}>— {t.name}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section style={{ padding: '80px 5%', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 600, height: 400,
          background: `radial-gradient(ellipse, ${c.accent}18 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, margin: '0 0 16px' }}>Get a Free Quote</h2>
          <p style={{ color: c.muted, fontSize: 16, marginBottom: 36 }}>
            {copy.ctaSecondary || `Serving ${biz.city || 'your area'}, ${biz.state || ''} and surrounding areas`}
          </p>
          <a href={`tel:${biz.phone}`} style={{
            background: c.accent, color: '#fff', padding: '16px 44px',
            borderRadius: 10, fontWeight: 700, fontSize: 17, textDecoration: 'none', display: 'inline-block',
            boxShadow: `0 4px 30px ${c.accent}66`,
          }}>
            {biz.phone || 'Call Now'}
          </a>
          {biz.address && <p style={{ color: '#444', fontSize: 13, marginTop: 20 }}>{biz.address}, {biz.city}, {biz.state}</p>}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#040408', padding: '48px 5% 24px', borderTop: `1px solid ${c.accent}22` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 36, marginBottom: 32 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: c.accent, marginBottom: 10 }}>{biz.businessName}</div>
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
        <div style={{ borderTop: '1px solid #111', paddingTop: 20, textAlign: 'center', color: '#333', fontSize: 12 }}>
          &copy; {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state}
        </div>
      </footer>
    </div>
  );
}
