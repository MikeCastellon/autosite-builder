import { useState, useEffect } from 'react';

// Template: Tint Sleek — Gray & teal (#1f2937 bg, #14b8a6 accent, #374151 secondary)
// Modern precision, two-column hero, film brands as styled pills, warranty badge, teal left-border cards, social footer

export default function TintSleek({ businessInfo, generatedCopy, templateMeta }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const c = templateMeta?.colors || { bg: '#1f2937', accent: '#14b8a6', text: '#f9fafb', secondary: '#374151', muted: '#9ca3af' };
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
        background: scrolled ? 'rgba(31,41,55,0.97)' : 'transparent',
        borderBottom: scrolled ? `1px solid ${c.accent}44` : '1px solid transparent',
        transition: 'all 0.3s ease',
        padding: '0 5%',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <div>
            <span style={{ fontSize: 17, fontWeight: 800, color: c.text }}>{biz.businessName || 'Precision Tint'}</span>
            <span style={{ display: 'block', fontSize: 10, color: c.accent, letterSpacing: 3, textTransform: 'uppercase' }}>Tint & PPF · {biz.city}, {biz.state}</span>
          </div>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            <a href="#services" style={{ color: c.muted, textDecoration: 'none', fontWeight: 500, fontSize: 14 }}>Services</a>
            <a href="#films" style={{ color: c.muted, textDecoration: 'none', fontWeight: 500, fontSize: 14 }}>Films</a>
            <a href="#warranty" style={{ color: c.muted, textDecoration: 'none', fontWeight: 500, fontSize: 14 }}>Warranty</a>
            <a href={`tel:${biz.phone}`} style={{
              border: `2px solid ${c.accent}`, color: c.accent, padding: '9px 22px',
              borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none',
            }}>
              {biz.phone || 'Get a Quote'}
            </a>
          </div>
        </div>
      </nav>

      {/* HERO — two-column layout */}
      <header style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        background: `linear-gradient(135deg, ${c.bg} 0%, #111827 100%)`,
        padding: '96px 5% 72px',
        borderBottom: `2px solid ${c.accent}44`,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          {/* Left column */}
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: `${c.accent}18`, border: `1px solid ${c.accent}44`,
              borderRadius: 30, padding: '6px 16px', marginBottom: 28,
            }}>
              <div style={{ width: 6, height: 6, background: c.accent, borderRadius: '50%' }} />
              <span style={{ color: c.accent, fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase' }}>
                {biz.city}, {biz.state}
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.15, marginBottom: 20 }}>
              {copy.headline || 'Precision Tinting.\nPerfect Finish.'}
            </h1>
            <p style={{ color: c.muted, fontSize: 16, lineHeight: 1.75, marginBottom: 36, maxWidth: 440 }}>
              {copy.subheadline || biz.tagline || 'Professional window film installation with precision and care.'}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={`tel:${biz.phone}`} style={{
                background: c.accent, color: '#fff', padding: '14px 32px',
                borderRadius: 8, fontWeight: 700, fontSize: 15, textDecoration: 'none',
                boxShadow: `0 4px 20px ${c.accent}44`,
              }}>
                {copy.ctaPrimary || 'Book Now'}
              </a>
              <a href="#services" style={{
                border: `1.5px solid ${c.muted}`, color: c.text, padding: '13px 28px',
                borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: 'none',
              }}>
                {copy.ctaSecondary || 'View Services'}
              </a>
            </div>
          </div>
          {/* Right column: info stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {biz.phone && (
              <div style={{ background: c.secondary, borderRadius: 12, padding: '22px 26px', borderLeft: `4px solid ${c.accent}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 6 }}>PHONE</div>
                <a href={`tel:${biz.phone}`} style={{ fontSize: 20, fontWeight: 800, color: c.text, textDecoration: 'none' }}>{biz.phone}</a>
              </div>
            )}
            {biz.hours && Object.keys(biz.hours).length > 0 && (
              <div style={{ background: c.secondary, borderRadius: 12, padding: '22px 26px', borderLeft: `4px solid ${c.accent}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 12 }}>HOURS</div>
                {Object.entries(biz.hours).slice(0, 5).map(([day, hrs], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: c.muted, fontSize: 13, fontWeight: 500 }}>{day}</span>
                    <span style={{ color: c.text, fontSize: 13, fontWeight: 700 }}>{hrs}</span>
                  </div>
                ))}
              </div>
            )}
            {biz.priceRange && (
              <div style={{ background: c.accent, borderRadius: 12, padding: '20px 26px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>STARTING AT</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{biz.priceRange}</div>
              </div>
            )}
            {biz.yearsInBusiness && (
              <div style={{ background: c.secondary, borderRadius: 12, padding: '18px 26px', borderLeft: `4px solid ${c.accent}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 4 }}>EXPERIENCE</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>{biz.yearsInBusiness}+ Years</div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* STATS */}
      <section style={{ background: c.secondary, padding: '48px 5%', borderBottom: `1px solid ${c.accent}22` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 24, textAlign: 'center' }}>
          {[
            { val: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '10+', label: 'Years of Service' },
            { val: '1K+', label: 'Cars Tinted' },
            { val: '5.0 ★', label: 'Average Rating' },
            { val: '100%', label: 'Satisfaction' },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: '2.6rem', fontWeight: 800, color: c.accent, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 12, color: c.muted, marginTop: 8, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES — cards with teal left border */}
      <section id="services" style={{ padding: '80px 5%' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ color: c.accent, fontWeight: 700, letterSpacing: 3, fontSize: 11, textTransform: 'uppercase', marginBottom: 10 }}>SERVICES</div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 800, margin: '0 0 14px' }}>What We Offer</h2>
            {copy.servicesSection?.intro && (
              <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.7, maxWidth: 520 }}>{copy.servicesSection.intro}</p>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
            {services.length > 0 ? services.map((svc, i) => (
              <div key={i} style={{
                background: c.secondary, border: `1px solid ${c.accent}33`,
                borderRadius: '0 10px 10px 0', padding: '26px 22px 26px 24px',
                borderLeft: `4px solid ${c.accent}`,
              }}>
                <div style={{ color: c.accent, fontSize: 20, marginBottom: 14 }}>◈</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: c.text }}>{svc.name}</h3>
                <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{svc.description}</p>
              </div>
            )) : (biz.services || []).map((svc, i) => (
              <div key={i} style={{ background: c.secondary, border: `1px solid ${c.accent}33`, borderRadius: '0 10px 10px 0', padding: '22px 20px 22px 22px', borderLeft: `4px solid ${c.accent}` }}>
                <div style={{ color: c.accent, fontSize: 18, marginBottom: 10 }}>◈</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: c.text, margin: 0 }}>{svc}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FILM BRANDS — styled pills */}
      {(filmBrandsList.length > 0 || biz.filmBrands) && (
        <section id="films" style={{ padding: '72px 5%', background: c.secondary, borderTop: `1px solid ${c.accent}22` }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ color: c.accent, fontWeight: 700, letterSpacing: 3, fontSize: 11, textTransform: 'uppercase', marginBottom: 10 }}>FILM PRODUCTS</div>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, marginBottom: 32 }}>Film Brands We Use</h2>
            {filmBrandsList.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {filmBrandsList.map((brand, i) => (
                  <span key={i} style={{
                    background: `${c.accent}18`, border: `1px solid ${c.accent}55`,
                    color: c.text, padding: '10px 22px', borderRadius: 30,
                    fontSize: 14, fontWeight: 700, letterSpacing: 0.5,
                  }}>{brand}</span>
                ))}
              </div>
            ) : (
              <p style={{ color: c.text, fontSize: 15 }}>{biz.filmBrands}</p>
            )}
          </div>
        </section>
      )}

      {/* WARRANTY BADGE */}
      {(biz.warranty || biz.warrantyOffered) && (
        <section id="warranty" style={{ padding: '64px 5%', borderTop: `1px solid ${c.accent}22` }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{
              background: c.secondary, borderRadius: 16, padding: '36px 40px',
              border: `1px solid ${c.accent}44`, display: 'grid',
              gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'center',
            }}>
              <div style={{
                width: 64, height: 64,
                background: `${c.accent}22`, border: `2px solid ${c.accent}66`,
                borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, flexShrink: 0,
              }}>🛡</div>
              <div>
                <div style={{ color: c.accent, fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>WARRANTY</div>
                <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10, color: c.text }}>Our Guarantee to You</h3>
                <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{biz.warranty || biz.warrantyOffered}</p>
              </div>
            </div>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
              {packages.map((pkg, i) => {
                const isFeature = i === Math.floor(packages.length / 2);
                return (
                  <div key={i} style={{
                    background: isFeature ? c.accent : c.bg,
                    borderRadius: 12, padding: '36px 28px', textAlign: 'center',
                    border: `1px solid ${isFeature ? 'transparent' : `${c.accent}33`}`,
                    boxShadow: isFeature ? `0 8px 32px ${c.accent}44` : 'none',
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8, color: isFeature ? '#fff' : c.text }}>
                      {typeof pkg === 'object' ? pkg.name : pkg}
                    </div>
                    {typeof pkg === 'object' && pkg.price && (
                      <div style={{ fontSize: 24, fontWeight: 800, color: isFeature ? '#fff' : c.accent, marginBottom: 12 }}>{pkg.price}</div>
                    )}
                    {typeof pkg === 'object' && pkg.description && (
                      <p style={{ color: isFeature ? 'rgba(255,255,255,0.85)' : c.muted, fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>{pkg.description}</p>
                    )}
                    <a href={`tel:${biz.phone}`} style={{
                      display: 'inline-block',
                      background: isFeature ? 'rgba(255,255,255,0.2)' : c.accent,
                      color: '#fff', padding: '10px 24px', borderRadius: 8,
                      fontWeight: 700, fontSize: 13, textDecoration: 'none',
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
              {copy.aboutText || `Serving ${biz.city || 'your area'} with precision tint and film installation.`}
            </p>
            {biz.certifications && (
              <div style={{ background: c.secondary, borderRadius: 8, padding: '14px 18px', marginBottom: 12, borderLeft: `3px solid ${c.accent}` }}>
                <div style={{ color: c.accent, fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>CERTIFIED</div>
                <p style={{ color: c.text, fontSize: 14, margin: 0 }}>{biz.certifications}</p>
              </div>
            )}
            {biz.awards && (
              <div style={{ background: c.secondary, borderRadius: 8, padding: '14px 18px', marginBottom: 12, borderLeft: '3px solid #fbbf24' }}>
                <div style={{ color: '#fbbf24', fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>AWARDS</div>
                <p style={{ color: c.text, fontSize: 14, margin: 0 }}>{biz.awards}</p>
              </div>
            )}
            {biz.specialties && (
              <div style={{ background: c.secondary, borderRadius: 8, padding: '14px 18px', borderLeft: `3px solid ${c.accent}` }}>
                <div style={{ color: c.accent, fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>SPECIALTIES</div>
                <p style={{ color: c.text, fontSize: 14, margin: 0 }}>{biz.specialties}</p>
              </div>
            )}
          </div>
          <div>
            {biz.hours && Object.keys(biz.hours).length > 0 && (
              <div style={{ background: c.secondary, padding: '28px 24px', borderRadius: 10, border: `1px solid ${c.accent}22`, marginBottom: 20 }}>
                <div style={{ color: c.accent, fontWeight: 700, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 18 }}>HOURS</div>
                {Object.entries(biz.hours).map(([day, hrs], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${c.accent}15`, paddingBottom: 10, marginBottom: 10 }}>
                    <span style={{ fontWeight: 500, fontSize: 14, color: c.muted }}>{day}</span>
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
                      background: `${c.accent}18`, border: `1px solid ${c.accent}44`,
                      color: c.text, padding: '5px 14px', borderRadius: 30, fontSize: 13, fontWeight: 600,
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
              <div style={{ color: c.accent, fontWeight: 700, letterSpacing: 3, fontSize: 11, textTransform: 'uppercase', marginBottom: 10 }}>REVIEWS</div>
              <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.5rem)', fontWeight: 800, margin: 0 }}>Customer Reviews</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
              {testimonials.map((t, i) => (
                <div key={i} style={{
                  background: c.bg, borderLeft: `3px solid ${c.accent}`,
                  padding: '24px 22px 24px 26px', borderRadius: '0 10px 10px 0',
                }}>
                  <div style={{ color: c.accent, marginBottom: 12 }}>★★★★★</div>
                  <p style={{ color: c.text, fontSize: 15, lineHeight: 1.7, fontStyle: 'italic', margin: '0 0 14px' }}>"{t.text}"</p>
                  <p style={{ color: c.accent, fontWeight: 600, fontSize: 13, margin: 0 }}>— {t.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section style={{ background: c.accent, padding: '80px 5%', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, color: '#fff', margin: '0 0 16px' }}>Get a Free Quote</h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, marginBottom: 36 }}>
          {copy.ctaSecondary || `${biz.city || 'Your city'}, ${biz.state || ''} · Same-day quotes available`}
        </p>
        <a href={`tel:${biz.phone}`} style={{
          background: '#fff', color: c.accent, padding: '16px 44px',
          borderRadius: 10, fontWeight: 800, fontSize: 17, textDecoration: 'none', display: 'inline-block',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}>
          {biz.phone || 'Call Now'}
        </a>
        {biz.address && <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 18 }}>{biz.address}, {biz.city}, {biz.state}</p>}
      </section>

      {/* FOOTER with social links */}
      <footer style={{ background: '#141b26', padding: '48px 5% 24px', borderTop: `1px solid ${c.accent}22` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 36, marginBottom: 32 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: c.accent, marginBottom: 10 }}>{biz.businessName}</div>
            <p style={{ color: '#4b5563', fontSize: 13, lineHeight: 1.7 }}>{copy.footerTagline || biz.tagline}</p>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#4b5563', marginBottom: 12 }}>CONTACT</div>
            <div style={{ color: '#6b7280', fontSize: 14, lineHeight: 2 }}>
              {biz.phone && <div>{biz.phone}</div>}
              {biz.address && <div>{biz.address}</div>}
              {biz.city && <div>{biz.city}, {biz.state}</div>}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#4b5563', marginBottom: 14 }}>FOLLOW US</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {biz.instagram && (
                <a href={`https://instagram.com/${biz.instagram.replace('@', '')}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  color: c.accent, textDecoration: 'none', fontWeight: 600, fontSize: 14,
                }}>
                  <span style={{
                    width: 28, height: 28, background: `${c.accent}18`, borderRadius: 6,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                  }}>📸</span>
                  Instagram: {biz.instagram}
                </a>
              )}
              {biz.facebook && (
                <a href={`https://facebook.com/${biz.facebook}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  color: c.accent, textDecoration: 'none', fontWeight: 600, fontSize: 14,
                }}>
                  <span style={{
                    width: 28, height: 28, background: `${c.accent}18`, borderRadius: 6,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                  }}>💻</span>
                  Facebook: {biz.facebook}
                </a>
              )}
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid #1f2937', paddingTop: 20, textAlign: 'center', color: '#4b5563', fontSize: 12 }}>
          &copy; {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state}
        </div>
      </footer>
    </div>
  );
}
