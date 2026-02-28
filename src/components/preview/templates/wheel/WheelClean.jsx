import { useState, useEffect } from 'react';

// Template: Wheel Clean — White & gunmetal (#f8f9fa bg, #374151 accent)
// Professional clean, services list with left border accent, brands as styled text, tire brands, awards, split contact

export default function WheelClean({ businessInfo, generatedCopy, templateMeta }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const c = templateMeta?.colors || { bg: '#f8f9fa', accent: '#374151', text: '#111827', secondary: '#e9ecef', muted: '#6b7280' };
  const font = templateMeta?.bodyFont || 'Inter, system-ui, sans-serif';
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const services = copy.servicesSection?.items || [];
  const testimonials = copy.testimonialPlaceholders || [];
  const payments = biz.paymentMethods || [];
  const packages = biz.packages || [];

  const brandsList = biz.brands ? (typeof biz.brands === 'string' ? biz.brands.split(/,|·/).map(b => b.trim()) : biz.brands) : [];
  const tireBrandsList = biz.tireBrands ? (typeof biz.tireBrands === 'string' ? biz.tireBrands.split(/,|·/).map(b => b.trim()) : biz.tireBrands) : [];

  return (
    <div style={{ fontFamily: font, background: c.bg, color: c.text, minHeight: '100vh', overflowX: 'hidden', margin: 0, padding: 0 }}>

      {/* STICKY NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? 'rgba(248,249,250,0.97)' : c.bg,
        borderBottom: scrolled ? '1px solid #e5e7eb' : '1px solid transparent',
        transition: 'all 0.3s ease',
        padding: '0 5%',
        boxShadow: scrolled ? '0 1px 12px rgba(0,0,0,0.06)' : 'none',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 800, color: c.accent }}>{biz.businessName || 'Wheel Shop'}</span>
            <span style={{ display: 'block', fontSize: 11, color: c.muted, letterSpacing: 1.5, textTransform: 'uppercase' }}>Custom Wheels · {biz.city}, {biz.state}</span>
          </div>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            <a href="#services" style={{ color: c.text, textDecoration: 'none', fontWeight: 600, fontSize: 14, opacity: 0.7 }}>Services</a>
            <a href="#brands" style={{ color: c.text, textDecoration: 'none', fontWeight: 600, fontSize: 14, opacity: 0.7 }}>Brands</a>
            <a href="#about" style={{ color: c.text, textDecoration: 'none', fontWeight: 600, fontSize: 14, opacity: 0.7 }}>About</a>
            <a href={`tel:${biz.phone}`} style={{
              background: c.accent, color: '#fff', padding: '10px 22px',
              borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none',
            }}>
              {biz.phone || 'Call Now'}
            </a>
          </div>
        </div>
      </nav>

      {/* HERO — full height, clean split */}
      <header style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        background: c.secondary || '#e9ecef',
        borderBottom: '1px solid #e5e7eb',
        padding: '96px 5% 72px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            <span style={{
              display: 'inline-block', background: `${c.accent}12`, color: c.accent,
              fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 20,
              textTransform: 'uppercase', letterSpacing: 2, marginBottom: 24,
            }}>
              {biz.city}, {biz.state}
            </span>
            <h1 style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.15, color: c.text, marginBottom: 20 }}>
              {copy.headline || 'Custom Wheels & Tire Experts'}
            </h1>
            <p style={{ color: c.muted, fontSize: 17, lineHeight: 1.75, marginBottom: 36 }}>
              {copy.subheadline || biz.tagline || 'Professional wheel fitment, balancing, and tire services.'}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={`tel:${biz.phone}`} style={{
                background: c.accent, color: '#fff', padding: '14px 32px',
                borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none',
              }}>
                {copy.ctaPrimary || 'Get a Quote'}
              </a>
              <a href="#services" style={{
                background: '#fff', color: c.accent, border: `2px solid ${c.accent}`,
                padding: '13px 28px', borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: 'none',
              }}>
                {copy.ctaSecondary || 'Our Services'}
              </a>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {biz.priceRange && (
              <div style={{ background: '#fff', borderRadius: 12, padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderLeft: `4px solid ${c.accent}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>PRICE RANGE</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: c.text }}>{biz.priceRange}</div>
              </div>
            )}
            {biz.yearsInBusiness && (
              <div style={{ background: '#fff', borderRadius: 12, padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderLeft: `4px solid ${c.accent}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>EXPERIENCE</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: c.text }}>{biz.yearsInBusiness}+ Years</div>
              </div>
            )}
            {biz.phone && (
              <div style={{ background: c.accent, borderRadius: 12, padding: '24px', color: '#fff' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.8, marginBottom: 6 }}>CALL US</div>
                <a href={`tel:${biz.phone}`} style={{ fontWeight: 800, fontSize: 20, color: '#fff', textDecoration: 'none' }}>{biz.phone}</a>
              </div>
            )}
            {biz.address && (
              <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderLeft: `4px solid ${c.accent}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>LOCATION</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: c.text }}>{biz.address}, {biz.city}, {biz.state}</div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* AWARDS */}
      {biz.awards && (
        <section style={{ background: '#fefce8', borderTop: '1px solid #fef08a', borderBottom: '1px solid #fef08a', padding: '20px 5%' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 22 }}>🏆</div>
            <div>
              <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#92400e' }}>RECOGNITION: </span>
              <span style={{ color: '#92400e', fontSize: 14, fontWeight: 500 }}>{biz.awards}</span>
            </div>
          </div>
        </section>
      )}

      {/* STATS */}
      <section style={{ background: '#fff', padding: '48px 5%', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 24 }}>
          {[
            { val: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '10+', label: 'Years in Business' },
            { val: '50+', label: 'Wheel Brands' },
            { val: '5K+', label: 'Wheels Installed' },
            { val: '5.0 ★', label: 'Average Rating' },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '20px', background: c.secondary, borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, color: c.accent, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 13, color: c.muted, marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES — list with left border accent */}
      <section id="services" style={{ padding: '80px 5%', background: c.bg }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 60, alignItems: 'start' }}>
          <div>
            <div style={{ position: 'sticky', top: 88 }}>
              <span style={{ display: 'block', background: `${c.accent}12`, color: c.accent, fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 16, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16, width: 'fit-content' }}>Services</span>
              <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.8rem)', fontWeight: 800, color: c.text, marginBottom: 16, lineHeight: 1.15 }}>What We Do</h2>
              {copy.servicesSection?.intro && (
                <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.7 }}>{copy.servicesSection.intro}</p>
              )}
              {biz.phone && (
                <a href={`tel:${biz.phone}`} style={{
                  display: 'inline-block', marginTop: 28, background: c.accent, color: '#fff',
                  padding: '12px 24px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none',
                }}>Call for Pricing</a>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {services.length > 0 ? services.map((svc, i) => (
              <div key={i} style={{
                borderLeft: `4px solid ${i % 3 === 0 ? c.accent : i % 3 === 1 ? '#9ca3af' : '#d1d5db'}`,
                paddingLeft: 24, paddingTop: 24, paddingBottom: 24,
                borderBottom: '1px solid #f3f4f6',
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: c.text, marginBottom: 8 }}>{svc.name}</h3>
                <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{svc.description}</p>
              </div>
            )) : (biz.services || []).map((svc, i) => (
              <div key={i} style={{ borderLeft: `4px solid ${c.accent}`, paddingLeft: 24, paddingTop: 20, paddingBottom: 20, borderBottom: '1px solid #f3f4f6' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: c.text, margin: 0 }}>{svc}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BRANDS ROW */}
      {(brandsList.length > 0 || tireBrandsList.length > 0 || biz.brands || biz.tireBrands) && (
        <section id="brands" style={{ padding: '72px 5%', background: '#fff', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <span style={{ display: 'inline-block', background: `${c.accent}12`, color: c.accent, fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 16, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>Brands</span>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', fontWeight: 800, color: c.text, marginBottom: 32 }}>Brands We Carry</h2>
            {brandsList.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>WHEEL BRANDS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {brandsList.map((brand, i) => (
                    <span key={i} style={{
                      background: c.secondary, color: c.text, border: '1px solid #e5e7eb',
                      padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                    }}>{brand}</span>
                  ))}
                </div>
              </div>
            )}
            {tireBrandsList.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>TIRE BRANDS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {tireBrandsList.map((brand, i) => (
                    <span key={i} style={{
                      background: c.bg, color: c.accent, border: `1.5px solid ${c.accent}44`,
                      padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                    }}>{brand}</span>
                  ))}
                </div>
              </div>
            )}
            {!brandsList.length && !tireBrandsList.length && (biz.brands || biz.tireBrands) && (
              <p style={{ color: c.text, fontSize: 15 }}>{biz.brands || biz.tireBrands}</p>
            )}
          </div>
        </section>
      )}

      {/* ABOUT */}
      <section id="about" style={{ padding: '80px 5%', background: c.secondary, borderTop: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <span style={{ display: 'inline-block', background: `${c.accent}12`, color: c.accent, fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 16, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>About</span>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, color: c.text, marginBottom: 20 }}>About {biz.businessName}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }}>
            <div>
              <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.85, marginBottom: 20 }}>
                {copy.aboutText || `Serving ${biz.city || 'your area'} with expert wheel and tire services.`}
              </p>
              {biz.certifications && (
                <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', borderLeft: `4px solid ${c.accent}`, marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>CERTIFICATIONS</div>
                  <p style={{ color: c.text, fontSize: 14, margin: 0, fontWeight: 500 }}>{biz.certifications}</p>
                </div>
              )}
              {biz.warranty && (
                <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', borderLeft: '4px solid #10b981', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>WARRANTY</div>
                  <p style={{ color: c.text, fontSize: 14, margin: 0 }}>{biz.warranty}</p>
                </div>
              )}
              {biz.specialties && (
                <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', borderLeft: `4px solid ${c.accent}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>SPECIALTIES</div>
                  <p style={{ color: c.text, fontSize: 14, margin: 0 }}>{biz.specialties}</p>
                </div>
              )}
            </div>
            <div>
              {biz.hours && Object.keys(biz.hours).length > 0 && (
                <div style={{ background: '#fff', borderRadius: 12, padding: '24px', border: '1px solid #e5e7eb', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>Hours</div>
                  {Object.entries(biz.hours).map(([day, hrs], i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ color: c.muted, fontWeight: 600, fontSize: 14 }}>{day}</span>
                      <span style={{ color: c.text, fontWeight: 700, fontSize: 14 }}>{hrs}</span>
                    </div>
                  ))}
                </div>
              )}
              {payments.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Payment Methods</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {payments.map((p, i) => (
                      <span key={i} style={{
                        background: c.secondary, color: c.text, border: '1px solid #e5e7eb',
                        padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                      }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      {testimonials.length > 0 && (
        <section style={{ padding: '80px 5%', background: '#fff', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <span style={{ display: 'inline-block', background: `${c.accent}12`, color: c.accent, fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 16, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>Reviews</span>
              <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, color: c.text, margin: 0 }}>Happy Customers</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              {testimonials.map((t, i) => (
                <div key={i} style={{ background: c.secondary, border: '1px solid #e5e7eb', borderRadius: 12, padding: '26px 24px' }}>
                  <div style={{ color: '#f59e0b', marginBottom: 12 }}>★★★★★</div>
                  <p style={{ color: c.text, fontSize: 15, lineHeight: 1.7, fontStyle: 'italic', margin: '0 0 14px' }}>"{t.text}"</p>
                  <p style={{ color: c.muted, fontWeight: 600, fontSize: 13, margin: 0 }}>— {t.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SPLIT CONTACT */}
      <section id="contact" style={{ padding: '80px 5%', borderTop: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
          <div>
            <span style={{ display: 'block', background: `${c.accent}12`, color: c.accent, fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 16, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16, width: 'fit-content' }}>Get In Touch</span>
            <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.8rem)', fontWeight: 800, color: c.text, marginBottom: 16, lineHeight: 1.15 }}>Come See Us</h2>
            <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
              {copy.ctaSecondary || `Serving ${biz.city || 'your area'}, ${biz.state || ''} and surrounding areas`}
            </p>
            <a href={`tel:${biz.phone}`} style={{
              display: 'inline-block', background: c.accent, color: '#fff',
              padding: '14px 32px', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none',
            }}>
              {biz.phone || 'Call Now'}
            </a>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {biz.address && (
              <div style={{ background: c.secondary, borderRadius: 12, padding: '20px 24px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.accent, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>ADDRESS</div>
                <p style={{ color: c.text, fontSize: 15, fontWeight: 500, margin: 0 }}>{biz.address}, {biz.city}, {biz.state}</p>
              </div>
            )}
            {biz.phone && (
              <div style={{ background: c.secondary, borderRadius: 12, padding: '20px 24px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.accent, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>PHONE</div>
                <a href={`tel:${biz.phone}`} style={{ color: c.text, fontSize: 18, fontWeight: 700, textDecoration: 'none' }}>{biz.phone}</a>
              </div>
            )}
            {(biz.instagram || biz.facebook) && (
              <div style={{ background: c.secondary, borderRadius: 12, padding: '20px 24px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.accent, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>SOCIAL</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {biz.instagram && <a href={`https://instagram.com/${biz.instagram.replace('@', '')}`} style={{ color: c.accent, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Instagram: {biz.instagram}</a>}
                  {biz.facebook && <a href={`https://facebook.com/${biz.facebook}`} style={{ color: c.accent, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Facebook: {biz.facebook}</a>}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb', padding: '40px 5% 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: c.accent, marginBottom: 4 }}>{biz.businessName}</div>
            <p style={{ color: c.muted, fontSize: 13, margin: 0 }}>{copy.footerTagline || biz.tagline}</p>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {biz.instagram && (
              <a href={`https://instagram.com/${biz.instagram.replace('@', '')}`} style={{ color: c.accent, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
                Instagram: {biz.instagram}
              </a>
            )}
            {biz.facebook && (
              <a href={`https://facebook.com/${biz.facebook}`} style={{ color: c.accent, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
                Facebook: {biz.facebook}
              </a>
            )}
          </div>
        </div>
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, textAlign: 'center', color: '#d1d5db', fontSize: 12 }}>
          &copy; {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state}
        </div>
      </footer>
    </div>
  );
}
