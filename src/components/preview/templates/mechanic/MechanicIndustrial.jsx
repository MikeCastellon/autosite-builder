import { useState, useEffect } from 'react';
import { SocialRow } from '../SocialIcons.jsx';
import { formatHours } from '../../../../lib/formatHours.js';
import { HeroImage, AboutImage, GallerySection } from '../ImageLayers.jsx';

// Template: Mechanic Industrial — Dark steel & yellow (#1c1c1c bg, #eab308 accent, #2c2c2c secondary)
// Gear/wrench feel, shop hours section, certifications as yellow badges, warranty guarantee box,
// payment methods, awards, warrantyOffered displayed

export default function MechanicIndustrial({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const hidden = (id) => copy?.hiddenSections?.includes(id);

  const c = templateMeta?.colors || { bg: '#1c1c1c', accent: '#eab308', text: '#e8e8e8', secondary: '#2c2c2c', muted: '#888888' };
  const font = templateMeta?.bodyFont || 'Inter, system-ui, sans-serif';
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const splitHero = copy?.heroLayout === 'split';
  const services = copy.servicesSection?.items || [];
  const svcCols = services.length >= 6 ? Math.ceil(services.length / 2) : services.length || 1;
  const testimonials = copy.testimonialPlaceholders || [];
  const payments = biz.paymentMethods || [];

  const certList = biz.certifications
    ? (typeof biz.certifications === 'string' ? biz.certifications.split(/,|·/).map(c => c.trim()) : biz.certifications)
    : [];

  return (
    <div style={{ fontFamily: font, background: c.bg, color: c.text, minHeight: '100vh', overflowX: 'hidden', margin: 0, padding: 0, containerType: 'inline-size' }}>
      <style>{`@container(max-width:600px){.tp-nav-links a[href^="#"]{display:none!important}.tp-nav-links{gap:12px!important}.tp-2col{grid-template-columns:1fr!important}}`}</style>

      {/* STICKY NAV */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 1000,
        background: scrolled ? 'rgba(28,28,28,0.97)' : 'transparent',
        borderBottom: scrolled ? `3px solid ${c.accent}` : '3px solid transparent',
        transition: 'all 0.3s ease',
        padding: '0 5%',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <div>
            {images.logo ? (
              <img src={images.logo} alt={biz.businessName || 'Logo'} style={{ height: 36, objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: 17, fontWeight: 900, color: c.text, textTransform: 'uppercase', letterSpacing: 1 }}>{biz.businessName || 'AUTO REPAIR'}</span>
            )}
            <span style={{ display: 'block', fontSize: 10, color: c.accent, letterSpacing: 2, textTransform: 'uppercase' }}>Auto Repair · {biz.city}, {biz.state}</span>
          </div>
          <div className="tp-nav-links" style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            <a href="#services" style={{ color: c.text, textDecoration: 'none', fontWeight: 700, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.75 }}>Services</a>
            <a href="#hours" style={{ color: c.text, textDecoration: 'none', fontWeight: 700, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.75 }}>Hours</a>
            <a href="#about" style={{ color: c.text, textDecoration: 'none', fontWeight: 700, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.75 }}>About</a>
            <a href={`tel:${biz.phone}`} style={{
              background: c.accent, color: '#000', padding: '10px 22px',
              borderRadius: 3, fontWeight: 900, fontSize: 13, textDecoration: 'none',
              textTransform: 'uppercase', letterSpacing: 1,
            }}>
              CALL NOW
            </a>
          </div>
        </div>
      </nav>

      {/* HERO — full height, industrial feel */}
      <header style={splitHero ? { display: 'flex', flexDirection: 'row', minHeight: '85vh' } : {
        minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center',
        background: `linear-gradient(160deg, ${c.secondary || '#2c2c2c'} 0%, ${c.bg} 70%)`,
        overflow: 'hidden',
        borderBottom: '1px solid #333',
      }}>
        {!splitHero && <HeroImage src={images.hero} />}
        {!splitHero && <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(rgba(234,179,8,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(234,179,8,0.04) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }} />}
        {!splitHero && <div style={{
          position: 'absolute', top: 0, left: 0,
          width: 8, height: '100%',
          background: `linear-gradient(180deg, ${c.accent}, transparent)`,
          opacity: 0.6,
        }} />}
        {!splitHero && <div style={{
          position: 'absolute', top: 0, right: '30%',
          width: 1, height: '100%',
          background: `linear-gradient(180deg, transparent, ${c.accent}22, transparent)`,
        }} />}

        <div style={splitHero ? {
          flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: 'clamp(3rem,6vw,6rem)', background: c.bg,
        } : { position: 'relative', zIndex: 1, padding: '7rem 5% 4rem', maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <span style={{ fontSize: 22 }}>⚙️</span>
            <span style={{ color: c.accent, fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', fontWeight: 700 }}>
              Trusted Auto Repair · {biz.city}, {biz.state}
            </span>
          </div>
          <h1 style={{
            fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 900, lineHeight: 1.05,
            textTransform: 'uppercase', letterSpacing: '-0.01em', margin: '0 0 20px',
          }}>
            {copy.headline || `WE FIX\nWHAT OTHERS\nCAN'T.`}
          </h1>
          <p style={{ color: c.muted, fontSize: 16, lineHeight: 1.75, maxWidth: 500, marginBottom: 40 }}>
            {copy.subheadline || biz.tagline || 'Reliable auto repair with honest pricing and expert technicians.'}
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <a href={copy?.ctaPrimaryUrl || (`tel:${biz.phone}`)} style={{
              background: c.accent, color: '#000', padding: '15px 36px',
              borderRadius: 3, fontWeight: 900, fontSize: 15, letterSpacing: 1, textTransform: 'uppercase',
              textDecoration: 'none', display: 'inline-block',
            }}>
              {copy.ctaPrimary || 'SCHEDULE SERVICE'}
            </a>
            <a href="#services" style={{
              border: `2px solid ${c.accent}`, color: c.accent, padding: '13px 26px',
              borderRadius: 3, fontWeight: 800, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase',
              textDecoration: 'none', display: 'inline-block',
            }}>
              {copy.ctaSecondary || 'OUR SERVICES'}
            </a>
          </div>
        </div>
        {splitHero && (
          <div style={{ flex: 1, position: 'relative', minHeight: '85vh', overflow: 'hidden' }}>
            {images.hero
              ? <img src={images.hero} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: '100%', height: '100%', background: c.secondary || '#2c2c2c' }} />
            }
          </div>
        )}
      </header>


      {/* STATS */}
      {!hidden('statsBar') && (
      <section style={{ background: c.secondary || '#2c2c2c', padding: '3.5rem 5%', borderBottom: '1px solid #333' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 24, textAlign: 'center' }}>
          {[
            { val: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '10+', label: 'YEARS IN BUSINESS' },
            { val: '5K+', label: 'VEHICLES REPAIRED' },
            { val: '5★', label: 'AVERAGE RATING' },
            { val: '100%', label: 'SATISFACTION GUARANTEED' },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: c.accent, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#666', marginTop: 8, textTransform: 'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* SERVICES */}
      {!hidden('services') && (
      <section id="services" style={{ padding: '80px 5%' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <div style={{ width: 36, height: 4, background: c.accent, borderRadius: 2 }} />
            <span style={{ color: c.accent, fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', fontWeight: 700 }}>SERVICES</span>
          </div>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 14px', letterSpacing: '-0.01em' }}>WHAT WE FIX</h2>
          {copy.servicesSection?.intro && (
            <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.7, maxWidth: 520, marginBottom: 48 }}>{copy.servicesSection.intro}</p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${svcCols}, 1fr)`, gap: 2 }}>
            {services.length > 0 ? services.map((svc, i) => (
              <div key={i} style={{
                background: i % 2 === 0 ? c.secondary : '#232323',
                padding: '28px 24px',
                borderTop: `2px solid ${i === 0 || i === 1 ? c.accent : 'transparent'}`,
                borderBottom: '1px solid #2a2a2a',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 28, height: 28, background: `${c.accent}18`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🔧</div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: i < 2 ? c.accent : c.text, margin: 0 }}>{svc.name}</h3>
                </div>
                <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{svc.description}</p>
              </div>
            )) : (biz.services || []).map((svc, i) => (
              <div key={i} style={{ background: i % 2 === 0 ? c.secondary : '#232323', padding: '24px 22px', borderTop: `2px solid ${i < 2 ? c.accent : 'transparent'}` }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: c.text, margin: 0 }}>{typeof svc === 'string' ? svc : svc.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* SHOP HOURS — prominently shown section */}
      <section id="hours" style={{ padding: '80px 5%', background: c.secondary, borderTop: '1px solid #333', borderBottom: '1px solid #333' }}>
        <div className="tp-2col" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{ width: 36, height: 4, background: c.accent, borderRadius: 2 }} />
              <span style={{ color: c.accent, fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', fontWeight: 700 }}>SCHEDULE</span>
            </div>
            <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.8rem)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 8px', letterSpacing: '-0.01em' }}>SHOP HOURS</h2>
            <p style={{ color: c.muted, fontSize: 14, marginBottom: 28 }}>We're open and ready to serve you.</p>
            {biz.hours && Object.keys(biz.hours).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {Object.entries(biz.hours).map(([day, hrs], i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 20px',
                    background: i % 2 === 0 ? c.bg : 'transparent',
                    borderRadius: 3,
                  }}>
                    <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 13, letterSpacing: 1, color: c.text }}>{day}</span>
                    <span style={{
                      color: hrs.toLowerCase().includes('closed') ? '#ef4444' : c.accent,
                      fontWeight: 800, fontSize: 14,
                    }}>{hrs}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: c.muted, fontSize: 14 }}>Call us for current hours.</p>
            )}
          </div>
          <div>

            {/* AWARDS */}
            {!hidden('awards') && biz.awards && (
              <div style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.25)', borderRadius: 6, padding: '18px 20px', marginBottom: 16 }}>
                <div style={{ color: '#ffd700', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>RECOGNITION</div>
                <p style={{ color: c.text, fontSize: 14, margin: 0, fontWeight: 500 }}>{biz.awards}</p>
              </div>
            )}

            {/* PAYMENT METHODS */}
            {payments.length > 0 && (
              <div style={{ background: c.bg, borderRadius: 6, padding: '18px 20px', border: '1px solid #333' }}>
                <div style={{ color: c.accent, fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>PAYMENT METHODS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {payments.map((p, i) => (
                    <span key={i} style={{
                      background: '#2a2a2a', color: '#ccc', border: '1px solid #444',
                      padding: '5px 14px', borderRadius: 3, fontSize: 12, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: 0.5,
                    }}>{p}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* WARRANTY / GUARANTEE CALLOUT BOX */}
      {(biz.warranty || biz.warrantyOffered) && (
        <section style={{ padding: '64px 5%', borderBottom: '1px solid #333' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{
              background: c.secondary, border: `2px solid ${c.accent}`,
              borderRadius: 6, padding: '36px 40px',
              display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 28, alignItems: 'center',
              boxShadow: `0 0 30px ${c.accent}18`,
            }}>
              <div style={{
                width: 72, height: 72,
                background: `${c.accent}18`, border: `2px solid ${c.accent}`,
                borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, flexShrink: 0,
              }}>
                🛡
              </div>
              <div>
                <div style={{ color: c.accent, fontSize: 11, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 8 }}>OUR GUARANTEE</div>
                <h3 style={{ fontSize: 22, fontWeight: 900, textTransform: 'uppercase', margin: '0 0 10px' }}>
                  {biz.warrantyOffered ? 'Warranty Offered' : 'Parts & Labor Warranty'}
                </h3>
                <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.7, margin: 0 }}>
                  {biz.warranty || biz.warrantyOffered}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ABOUT */}
      {!hidden('about') && (
      <section id="about" style={{ padding: '80px 5%', background: c.secondary, borderBottom: '1px solid #333' }}>
        <div className="tp-2col" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{ width: 36, height: 4, background: c.accent, borderRadius: 2 }} />
              <span style={{ color: c.accent, fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', fontWeight: 700 }}>OUR SHOP</span>
            </div>
            <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.8rem)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 20px', letterSpacing: '-0.01em' }}>ABOUT US</h2>
            {(generatedCopy?.aboutLayout || 'image') !== 'stats' ? (
              images.about
                ? <img src={images.about} alt="About" style={{ width: '100%', height: '360px', objectFit: 'cover', borderRadius: '4px', display: 'block', marginBottom: '20px' }} />
                : <div style={{ width: '100%', height: '360px', background: c.bg, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.muted, fontSize: '0.85rem', marginBottom: '20px' }}>Upload a photo in Images tab</div>
            ) : (
              images.about && (
                <img src={images.about} alt="About" style={{ width: '100%', height: '360px', objectFit: 'cover', borderRadius: '4px', display: 'block', marginBottom: '20px' }} />
              )
            )}
            <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.85, marginBottom: 20 }}>
              {copy.aboutText || `Serving ${biz.city || 'your area'} with expert auto repair since day one.`}
            </p>
            {biz.specialties && (
              <div style={{ background: c.bg, borderRadius: 4, padding: '14px 18px', marginBottom: 12, borderLeft: `4px solid ${c.accent}` }}>
                <div style={{ color: c.accent, fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>SPECIALTIES</div>
                <p style={{ color: c.text, fontSize: 14, margin: 0 }}>{biz.specialties}</p>
              </div>
            )}
            {biz.brands && (
              <div style={{ background: c.bg, borderRadius: 4, padding: '14px 18px', borderLeft: `4px solid ${c.accent}` }}>
                <div style={{ color: c.accent, fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>BRANDS WE SERVICE</div>
                <p style={{ color: c.text, fontSize: 14, margin: 0 }}>{biz.brands}</p>
              </div>
            )}
          </div>
          <div className="tp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { num: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '10+', label: 'YEARS' },
              { num: '5K+', label: 'VEHICLES' },
              { num: '5★', label: 'RATING' },
              { num: '100%', label: 'GUARANTEED' },
            ].map(({ num, label }) => (
              <div key={label} style={{
                background: c.bg, border: '1px solid #333', borderRadius: 4, padding: '24px 16px', textAlign: 'center',
                borderTop: `3px solid ${c.accent}`,
              }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: c.accent, lineHeight: 1 }}>{num}</div>
                <div style={{ color: c.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginTop: 8 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* GALLERY */}
      {!hidden('gallery') && (
      <GallerySection images={images} colors={c} font={font} bodyFont={templateMeta.bodyFont} />
      )}

      {/* TESTIMONIALS */}
      {!hidden('testimonials') && testimonials.length > 0 && (
        <section style={{ padding: '80px 5%', borderBottom: '1px solid #333' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 }}>
              <div style={{ width: 36, height: 4, background: c.accent, borderRadius: 2 }} />
              <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.5rem)', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>REVIEWS</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              {testimonials.map((t, i) => (
                <div key={i} style={{
                  background: c.secondary, borderLeft: `4px solid ${c.accent}`,
                  padding: '24px 24px 24px 26px',
                }}>
                  <div style={{ color: c.accent, marginBottom: 12 }}>★★★★★</div>
                  <p style={{ color: c.text, fontSize: 15, lineHeight: 1.7, fontStyle: 'italic', margin: '0 0 14px' }}>"{t.text}"</p>
                  <p style={{ color: c.accent, fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>— {t.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      {!hidden('cta') && (
      <section style={{ background: c.accent, padding: '80px 5%', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)', fontWeight: 900, color: '#000', textTransform: 'uppercase', margin: '0 0 14px', letterSpacing: '-0.01em' }}>
          SCHEDULE SERVICE
        </h2>
        <p style={{ color: 'rgba(0,0,0,0.55)', fontSize: 16, marginBottom: 36 }}>
          {copy.ctaSecondary || `Serving ${biz.city || 'your area'}, ${biz.state || ''} and surrounding areas`}
        </p>
        <a href={copy?.ctaUrl || (`tel:${biz.phone}`)} style={{
          background: '#000', color: c.accent, padding: '17px 48px',
          borderRadius: 3, fontWeight: 900, fontSize: 18, textDecoration: 'none',
          display: 'inline-block', textTransform: 'uppercase', letterSpacing: 1.5,
        }}>
          {copy.ctaPrimary || biz.phone || 'CALL NOW'}
        </a>
        {biz.address && (
          <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: 13, marginTop: 20 }}>
            📍 {biz.address}, {biz.city}, {biz.state}
          </p>
        )}
        {biz.hours && (
          <p style={{ color: 'rgba(0,0,0,0.45)', fontSize: '0.9rem', marginTop: '8px' }}>
            {formatHours(biz.hours)}
          </p>
        )}
      </section>
      )}

      {/* FOOTER */}
      <footer style={{ background: '#111', padding: '48px 5% 24px', borderTop: `3px solid ${c.accent}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 36, marginBottom: 32 }}>
          <div>
            {/* Footer logo */}
            {images.logo ? (
              <img src={images.logo} alt={biz.businessName} style={{ height: 48, maxWidth: 180, objectFit: 'contain', marginBottom: '0.75rem', display: 'block' }} />
            ) : (
              <div style={{ fontWeight: 900, fontSize: 14, color: c.accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                ⚙️ {biz.businessName}
              </div>
            )}
            <p style={{ color: '#555', fontSize: 13, lineHeight: 1.7 }}>{copy.footerTagline || biz.tagline}</p>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#444', marginBottom: 12 }}>CONTACT</div>
            <div style={{ color: '#666', fontSize: 14, lineHeight: 2 }}>
              {biz.phone && <div>{biz.phone}</div>}
              {biz.address && <div>{biz.address}</div>}
              {biz.city && <div>{biz.city}, {biz.state}</div>}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#444', marginBottom: 12 }}>FOLLOW US</div>
            <SocialRow biz={biz} color={c.accent} size={20} images={images} />
          </div>
          {payments.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#444', marginBottom: 12 }}>WE ACCEPT</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {payments.map((p, i) => (
                  <span key={i} style={{
                    background: '#222', color: '#888', border: '1px solid #333',
                    padding: '3px 10px', borderRadius: 3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                  }}>{p}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ borderTop: '1px solid #222', paddingTop: 20, textAlign: 'center', color: '#444', fontSize: 12 }}>
          &copy; {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state} · All rights reserved.
        </div>
      </footer>
    </div>
  );
}
