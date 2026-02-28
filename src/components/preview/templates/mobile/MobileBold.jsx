import { useState, useEffect } from 'react';

// Template: Mobile Bold — Orange & dark (#1a1a1a bg, #f97316 accent)
// Aggressive diagonal slashes, "WE COME TO YOU" badge, truck emoji nav, service area banner, packages pricing

export default function MobileBold({ businessInfo, generatedCopy, templateMeta }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const c = templateMeta?.colors || { bg: '#1a1a1a', accent: '#f97316', text: '#ffffff', secondary: '#2a2a2a', muted: '#888888' };
  const font = templateMeta?.bodyFont || 'Impact, Arial Black, sans-serif';
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const services = copy.servicesSection?.items || [];
  const testimonials = copy.testimonialPlaceholders || [];
  const payments = biz.paymentMethods || [];
  const packages = biz.packages || [];

  const slashBg = `repeating-linear-gradient(
    -55deg,
    transparent,
    transparent 38px,
    rgba(249,115,22,0.07) 38px,
    rgba(249,115,22,0.07) 40px
  )`;

  return (
    <div style={{ fontFamily: font, background: c.bg, color: c.text, minHeight: '100vh', overflowX: 'hidden', margin: 0, padding: 0 }}>

      {/* STICKY NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? 'rgba(26,26,26,0.96)' : 'transparent',
        borderBottom: scrolled ? `3px solid ${c.accent}` : '3px solid transparent',
        transition: 'all 0.3s ease',
        padding: '0 5%',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🚛</span>
            <div>
              <span style={{ fontSize: 17, fontWeight: 900, color: c.text, textTransform: 'uppercase', letterSpacing: 1 }}>{biz.businessName || 'MOBILE DETAIL'}</span>
              <span style={{ display: 'block', fontSize: 10, color: c.accent, letterSpacing: 2, textTransform: 'uppercase' }}>Mobile Detailing · {biz.city}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <a href="#services" style={{ color: c.text, textDecoration: 'none', fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.85 }}>Services</a>
            <a href="#pricing" style={{ color: c.text, textDecoration: 'none', fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.85 }}>Pricing</a>
            <a href="#about" style={{ color: c.text, textDecoration: 'none', fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.85 }}>About</a>
            <a href={`tel:${biz.phone}`} style={{
              background: c.accent, color: '#fff', padding: '9px 22px',
              fontWeight: 900, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase',
              textDecoration: 'none',
              clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
            }}>
              {biz.phone || 'CALL NOW'}
            </a>
          </div>
        </div>
      </nav>

      {/* HERO — full height with diagonal slash overlay */}
      <header style={{
        minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center',
        background: `linear-gradient(135deg, #1a1a1a 0%, #2d1800 55%, #1a1a1a 100%)`,
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: slashBg }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: '40%', height: '100%', background: `linear-gradient(to left, rgba(249,115,22,0.12), transparent)` }} />

        {/* WE COME TO YOU badge — top right */}
        <div style={{
          position: 'absolute', top: 88, right: '5%',
          background: c.accent, color: '#fff',
          fontWeight: 900, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase',
          padding: '8px 20px',
          clipPath: 'polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%)',
        }}>
          WE COME TO YOU
        </div>

        <div style={{ position: 'relative', zIndex: 1, padding: '7rem 5% 4rem', maxWidth: 960 }}>
          <div style={{
            display: 'inline-block', background: c.accent, color: '#fff',
            fontWeight: 900, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase',
            padding: '5px 16px', marginBottom: 24,
            clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)',
          }}>
            MOBILE DETAILING — {biz.city || 'YOUR CITY'}, {biz.state || ''}
          </div>
          <h1 style={{
            fontSize: 'clamp(3rem, 8vw, 6rem)', fontWeight: 900, lineHeight: 0.95,
            textTransform: 'uppercase', letterSpacing: '-0.02em', margin: '0 0 1.2rem',
          }}>
            {copy.headline || `DETAIL\nCOMES\nTO YOU`}
          </h1>
          <p style={{ fontSize: 18, color: '#bbb', maxWidth: 500, marginBottom: 40, lineHeight: 1.6 }}>
            {copy.subheadline || biz.tagline || 'Professional mobile detailing at your door.'}
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <a href="#pricing" style={{
              background: c.accent, color: '#fff', padding: '15px 36px',
              fontWeight: 900, fontSize: 16, letterSpacing: 1, textTransform: 'uppercase',
              textDecoration: 'none', display: 'inline-block',
              clipPath: 'polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%)',
            }}>
              {copy.ctaPrimary || 'VIEW PACKAGES'}
            </a>
            <a href={`tel:${biz.phone}`} style={{
              border: `3px solid ${c.accent}`, color: c.accent, padding: '12px 28px',
              fontWeight: 900, fontSize: 16, letterSpacing: 1, textTransform: 'uppercase',
              textDecoration: 'none', display: 'inline-block',
            }}>
              CALL {biz.phone || 'NOW'}
            </a>
          </div>
        </div>
      </header>

      {/* SERVICE AREA BANNER */}
      {biz.serviceArea && (
        <div style={{
          background: c.accent, color: '#fff', padding: '14px 5%', textAlign: 'center',
          fontWeight: 900, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase',
        }}>
          SERVING: {biz.serviceArea}
        </div>
      )}

      {/* STATS BAR */}
      <section style={{ background: c.secondary || '#2a2a2a', padding: '3.5rem 5%', borderBottom: '1px solid #333' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 32, textAlign: 'center' }}>
          {[
            { val: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '10+', label: 'YEARS IN BUSINESS' },
            { val: '500+', label: 'RIDES DETAILED' },
            { val: '100%', label: 'MOBILE SERVICE' },
            { val: biz.priceRange || '$$', label: 'FAIR PRICING' },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: c.accent, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#777', marginTop: 6, textTransform: 'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" style={{ padding: '80px 5%' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ color: c.accent, fontWeight: 900, letterSpacing: 3, fontSize: 11, textTransform: 'uppercase', marginBottom: 8 }}>WHAT WE DO</div>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, textTransform: 'uppercase', margin: 0, lineHeight: 1 }}>OUR SERVICES</h2>
            {copy.servicesSection?.intro && (
              <p style={{ color: '#888', fontSize: 15, lineHeight: 1.7, maxWidth: 520, marginTop: 16 }}>{copy.servicesSection.intro}</p>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {services.length > 0 ? services.map((s, i) => (
              <div key={i} style={{
                background: c.secondary || '#2a2a2a',
                borderLeft: `5px solid ${c.accent}`,
                padding: '28px 24px',
                clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%)',
              }}>
                <h3 style={{ fontWeight: 900, textTransform: 'uppercase', fontSize: 15, letterSpacing: 1, color: c.accent, margin: '0 0 10px' }}>{s.name}</h3>
                <p style={{ color: '#aaa', lineHeight: 1.7, margin: 0, fontSize: 14 }}>{s.description}</p>
              </div>
            )) : (biz.services || []).map((s, i) => (
              <div key={i} style={{ background: c.secondary || '#2a2a2a', borderLeft: `5px solid ${c.accent}`, padding: '24px 22px' }}>
                <h3 style={{ fontWeight: 900, textTransform: 'uppercase', fontSize: 15, color: c.accent, margin: 0 }}>{s}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PACKAGES / PRICING */}
      {packages.length > 0 && (
        <section id="pricing" style={{ padding: '80px 5%', background: c.secondary || '#2a2a2a', borderTop: '1px solid #333' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ marginBottom: 48, textAlign: 'center' }}>
              <div style={{ color: c.accent, fontWeight: 900, letterSpacing: 3, fontSize: 11, textTransform: 'uppercase', marginBottom: 8 }}>PACKAGES</div>
              <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>CHOOSE YOUR PACKAGE</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {packages.map((pkg, i) => {
                const isFeature = i === Math.floor(packages.length / 2);
                return (
                  <div key={i} style={{
                    background: isFeature ? c.accent : c.bg,
                    border: `3px solid ${isFeature ? c.accent : '#444'}`,
                    padding: '36px 28px', textAlign: 'center',
                    clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%)',
                    position: 'relative',
                  }}>
                    {isFeature && (
                      <div style={{
                        position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                        background: '#fff', color: c.accent, fontSize: 10, fontWeight: 900, letterSpacing: 2,
                        padding: '3px 14px', textTransform: 'uppercase',
                      }}>MOST POPULAR</div>
                    )}
                    <div style={{ fontWeight: 900, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, color: isFeature ? '#fff' : c.text }}>
                      {typeof pkg === 'object' ? pkg.name : pkg}
                    </div>
                    {typeof pkg === 'object' && pkg.price && (
                      <div style={{ fontSize: 28, fontWeight: 900, color: isFeature ? '#fff' : c.accent, marginBottom: 12 }}>{pkg.price}</div>
                    )}
                    {typeof pkg === 'object' && pkg.description && (
                      <p style={{ color: isFeature ? 'rgba(255,255,255,0.85)' : '#aaa', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>{pkg.description}</p>
                    )}
                    <a href={`tel:${biz.phone}`} style={{
                      display: 'inline-block', marginTop: 8,
                      background: isFeature ? '#fff' : c.accent,
                      color: isFeature ? c.accent : '#fff',
                      padding: '10px 28px', fontWeight: 900, fontSize: 13,
                      letterSpacing: 1, textTransform: 'uppercase', textDecoration: 'none',
                    }}>BOOK NOW</a>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ABOUT + HOURS */}
      <section id="about" style={{ padding: '80px 5%' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'start' }}>
          <div>
            <div style={{ color: c.accent, fontWeight: 900, letterSpacing: 3, fontSize: 11, textTransform: 'uppercase', marginBottom: 8 }}>ABOUT US</div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 24px', lineHeight: 1 }}>
              {biz.businessName || 'WE DETAIL'}
            </h2>
            <p style={{ color: '#bbb', lineHeight: 1.8, fontSize: 15, marginBottom: 20 }}>
              {copy.aboutText || `Based in ${biz.city || 'your area'}, we bring professional detailing directly to you.`}
            </p>
            {biz.certifications && (
              <div style={{ marginTop: 16, padding: '14px 18px', background: '#2a2a2a', borderLeft: `4px solid ${c.accent}` }}>
                <div style={{ color: c.accent, fontWeight: 700, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>CERTIFIED</div>
                <p style={{ color: '#bbb', fontSize: 14, margin: 0 }}>{biz.certifications}</p>
              </div>
            )}
            {biz.awards && (
              <div style={{ marginTop: 12, padding: '14px 18px', background: '#2a2a2a', borderLeft: `4px solid #ffd700` }}>
                <div style={{ color: '#ffd700', fontWeight: 700, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>AWARDS</div>
                <p style={{ color: '#bbb', fontSize: 14, margin: 0 }}>{biz.awards}</p>
              </div>
            )}
            {payments.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ color: '#777', fontWeight: 700, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>PAYMENT ACCEPTED</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {payments.map((p, i) => (
                    <span key={i} style={{
                      background: '#333', color: '#ccc', padding: '4px 14px',
                      fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                      clipPath: 'polygon(5px 0%, 100% 0%, calc(100% - 5px) 100%, 0% 100%)',
                    }}>{p}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            {biz.hours && Object.keys(biz.hours).length > 0 && (
              <div style={{ background: '#2a2a2a', padding: '28px 24px', borderTop: `4px solid ${c.accent}` }}>
                <div style={{ color: c.accent, fontWeight: 900, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 20 }}>HOURS OF OPERATION</div>
                {Object.entries(biz.hours).map(([day, hrs], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: 10, marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 13, letterSpacing: 1 }}>{day}</span>
                    <span style={{ color: c.accent, fontWeight: 700, fontSize: 13 }}>{hrs}</span>
                  </div>
                ))}
              </div>
            )}
            {biz.specialties && (
              <div style={{ marginTop: 16, background: '#2a2a2a', padding: '20px 24px', borderLeft: `5px solid ${c.accent}` }}>
                <div style={{ color: c.accent, fontWeight: 700, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>SPECIALTIES</div>
                <p style={{ color: '#bbb', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{biz.specialties}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      {testimonials.length > 0 && (
        <section style={{ padding: '80px 5%', background: c.secondary || '#2a2a2a', borderTop: '1px solid #333' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <div style={{ color: c.accent, fontWeight: 900, letterSpacing: 3, fontSize: 11, textTransform: 'uppercase', marginBottom: 8 }}>WHAT CLIENTS SAY</div>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.5rem)', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>CUSTOMER REVIEWS</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {testimonials.map((t, i) => (
                <div key={i} style={{ background: c.bg, borderLeft: `5px solid ${c.accent}`, padding: '28px 24px' }}>
                  <div style={{ color: c.accent, fontSize: 16, marginBottom: 12 }}>★★★★★</div>
                  <p style={{ color: '#ccc', lineHeight: 1.7, fontStyle: 'italic', margin: '0 0 14px', fontSize: 15 }}>"{t.text}"</p>
                  <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: c.accent }}>— {t.name}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA SECTION */}
      <section style={{ padding: '80px 5%', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 16px', lineHeight: 1 }}>READY TO BOOK?</h2>
        <p style={{ color: '#888', fontSize: 16, marginBottom: 40 }}>{copy.ctaSecondary || `Serving ${biz.city || 'your area'}. We come to you.`}</p>
        <a href={`tel:${biz.phone}`} style={{
          display: 'inline-block', background: c.accent, color: '#fff',
          padding: '18px 48px', fontWeight: 900, fontSize: 18,
          letterSpacing: 2, textTransform: 'uppercase', textDecoration: 'none',
          clipPath: 'polygon(16px 0%, 100% 0%, calc(100% - 16px) 100%, 0% 100%)',
        }}>
          CALL {biz.phone || 'NOW'}
        </a>
        {biz.address && <p style={{ color: '#555', fontSize: 13, marginTop: 20 }}>📍 {biz.address}, {biz.city}, {biz.state}</p>}
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#111', padding: '48px 5% 28px', borderTop: `3px solid ${c.accent}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 36, marginBottom: 32 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: c.accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              🚛 {biz.businessName}
            </div>
            <p style={{ color: '#555', fontSize: 13, lineHeight: 1.7 }}>{copy.footerTagline || biz.tagline}</p>
          </div>
          <div>
            <div style={{ fontWeight: 700, letterSpacing: 2, fontSize: 11, textTransform: 'uppercase', color: '#555', marginBottom: 12 }}>CONTACT</div>
            <div style={{ color: '#777', fontSize: 14, lineHeight: 2 }}>
              {biz.phone && <div>{biz.phone}</div>}
              {biz.address && <div>{biz.address}</div>}
              {biz.city && <div>{biz.city}, {biz.state}</div>}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, letterSpacing: 2, fontSize: 11, textTransform: 'uppercase', color: '#555', marginBottom: 12 }}>FOLLOW</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {biz.instagram && (
                <a href={`https://instagram.com/${biz.instagram.replace('@', '')}`} style={{ color: c.accent, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
                  Instagram: {biz.instagram}
                </a>
              )}
              {biz.facebook && (
                <a href={`https://facebook.com/${biz.facebook}`} style={{ color: c.accent, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
                  Facebook: {biz.facebook}
                </a>
              )}
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid #222', paddingTop: 20, textAlign: 'center', color: '#444', fontSize: 12 }}>
          &copy; {new Date().getFullYear()} {biz.businessName}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
