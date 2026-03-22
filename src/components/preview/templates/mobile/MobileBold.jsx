import { useState, useEffect } from 'react';
import { SocialRow } from '../SocialIcons.jsx';
import { formatHours } from '../../../../lib/formatHours.js';
import { HeroImage, AboutImage, GallerySection } from '../ImageLayers.jsx';
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import GoogleReviewsWidget from '../GoogleReviewsWidget.jsx';

// Template: Mobile Bold — Orange & dark (#1a1a1a bg, #f97316 accent)
// Aggressive diagonal slashes, "WE COME TO YOU" badge, truck emoji nav, service area banner, packages pricing

export default function MobileBold({ businessInfo, generatedCopy, templateMeta, images = {} }) {
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
  const svcCols = services.length >= 6 ? Math.ceil(services.length / 2) : services.length || 1;
  const testimonials = copy.testimonialPlaceholders || [];
  const payments = biz.paymentMethods || [];
  const packages = biz.packages || [];

  const hidden = (id) => copy?.hiddenSections?.includes(id);
  const getOrder = buildSectionOrder(copy, ['hero','services','about','gallery','testimonials','cta']);

  const splitHero = generatedCopy?.heroLayout === 'split';

  const slashBg = `repeating-linear-gradient(
    -55deg,
    transparent,
    transparent 38px,
    rgba(249,115,22,0.07) 38px,
    rgba(249,115,22,0.07) 40px
  )`;

  return (
    <div style={{ fontFamily: font, background: c.bg, color: c.text, minHeight: '100vh', overflowX: 'hidden', margin: 0, padding: 0, containerType: 'inline-size' }}>
      <style>{`@container(max-width:600px){.tp-nav-links a[href^="#"]{display:none!important}.tp-nav-links{gap:12px!important}.tp-2col{grid-template-columns:1fr!important}}`}</style>

      {/* STICKY NAV */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 1000,
        background: scrolled ? 'rgba(26,26,26,0.96)' : 'transparent',
        borderBottom: scrolled ? `3px solid ${c.accent}` : '3px solid transparent',
        transition: 'all 0.3s ease',
        padding: '0 5%',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
      
        order: -1,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🚛</span>
            <div>
              {images.logo ? (
              <img src={images.logo} alt={biz.businessName || 'Logo'} style={{ height: 36, objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: 17, fontWeight: 900, color: c.text, textTransform: 'uppercase', letterSpacing: 1 }}>{biz.businessName || 'MOBILE DETAIL'}</span>
            )}
              <span style={{ display: 'block', fontSize: 10, color: c.accent, letterSpacing: 2, textTransform: 'uppercase' }}>Mobile Detailing · {biz.city}</span>
            </div>
          </div>
          <div className="tp-nav-links" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
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
      {!hidden('hero') && (
      <header style={splitHero ? { display: 'flex', flexDirection: 'row', minHeight: '85vh', order: getOrder('hero') } : {
        minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center',
        background: `linear-gradient(135deg, #1a1a1a 0%, #2d1800 55%, #1a1a1a 100%)`,
        overflow: 'hidden',
        order: getOrder('hero'),
      }}>
        {!splitHero && <HeroImage src={images.hero} />}
        {!splitHero && <div style={{ position: 'absolute', inset: 0, background: slashBg }} />}
        {!splitHero && <div style={{ position: 'absolute', top: 0, right: 0, width: '40%', height: '100%', background: `linear-gradient(to left, rgba(249,115,22,0.12), transparent)` }} />}

        <div style={splitHero ? {
          flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: 'clamp(3rem,6vw,6rem)', background: c.bg,
        } : { position: 'relative', zIndex: 2, padding: '7rem 5% 4rem', maxWidth: 960 }}>
          <div style={{
            display: 'inline-block', background: c.accent, color: '#fff',
            fontWeight: 900, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase',
            padding: '5px 16px', marginBottom: 24,
            clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)',
          }}>
            MOBILE DETAILING — {biz.city || 'YOUR CITY'}, {biz.state || ''}
          </div>
          <h1 style={{
            fontSize: 'clamp(1.8rem, 8vw, 6rem)', fontWeight: 900, lineHeight: 0.95,
            textTransform: 'uppercase', letterSpacing: '-0.02em', margin: '0 0 1.2rem',
          }}>
            {copy.headline || `DETAIL\nCOMES\nTO YOU`}
          </h1>
          <p style={{ fontSize: 18, color: splitHero ? c.text : '#bbb', maxWidth: 500, marginBottom: 40, lineHeight: 1.6 }}>
            {copy.subheadline || biz.tagline || 'Professional mobile detailing at your door.'}
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <a href={copy?.ctaPrimaryUrl || '#pricing'} style={{
              background: c.accent, color: '#fff', padding: '15px 36px',
              fontWeight: 900, fontSize: 16, letterSpacing: 1, textTransform: 'uppercase',
              textDecoration: 'none', display: 'inline-block',
              clipPath: 'polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%)',
            }}>
              {copy.ctaPrimary || 'VIEW PACKAGES'}
            </a>
            <a href={copy?.ctaSecondaryUrl || (`tel:${biz.phone}`)} style={{
              border: `3px solid ${c.accent}`, color: c.accent, padding: '12px 28px',
              fontWeight: 900, fontSize: 16, letterSpacing: 1, textTransform: 'uppercase',
              textDecoration: 'none', display: 'inline-block',
            }}>
              {copy.ctaSecondary || ('CALL ' + (biz.phone || 'NOW'))}
            </a>
          </div>
        </div>
        {splitHero && (
          <div style={{ flex: 1, position: 'relative', minHeight: '85vh', overflow: 'hidden' }}>
            {images.hero
              ? <img src={images.hero} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: '100%', height: '100%', background: c.secondary }} />
            }
          </div>
        )}
      </header>
      )}


      {/* SERVICE AREA BANNER */}
      {biz.serviceArea && (
        <div style={{
          background: c.accent, color: '#fff', padding: '14px 5%', textAlign: 'center',
          fontWeight: 900, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase',
        }}>
          SERVING: {biz.serviceArea}
        </div>
      )}

      {/* SERVICES */}
      {!hidden('services') && (
      <section id="services" style={{ padding: '80px 5%' , order: getOrder('services') }}>
        <div style={{ maxWidth: 1200, margin: '0 auto'  }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ color: c.accent, fontWeight: 900, letterSpacing: 3, fontSize: 11, textTransform: 'uppercase', marginBottom: 8 }}>WHAT WE DO</div>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, textTransform: 'uppercase', margin: 0, lineHeight: 1 }}>OUR SERVICES</h2>
            {copy.servicesSection?.intro && (
              <p style={{ color: '#888', fontSize: 15, lineHeight: 1.7, maxWidth: 520, marginTop: 16 }}>{copy.servicesSection.intro}</p>
            )}
          </div>
          {packages.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {packages.map((pkg, i) => {
                const isFeature = i === Math.floor(packages.length / 2);
                return (
                  <div key={i} style={{
                    background: isFeature ? c.accent : c.secondary || '#2a2a2a',
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
                      {pkg.name || pkg}
                    </div>
                    {pkg.price && (
                      <div style={{ fontFamily: font, fontSize: '1.8rem', fontWeight: 900, color: isFeature ? '#fff' : c.accent, margin: '0.4rem 0 0.75rem' }}>{pkg.price}</div>
                    )}
                    {pkg.description && (
                      <p style={{ color: isFeature ? 'rgba(255,255,255,0.85)' : '#aaa', fontSize: 14, lineHeight: 1.6 }}>{pkg.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${svcCols}, 1fr)`, gap: 16 }}>
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
                  <h3 style={{ fontWeight: 900, textTransform: 'uppercase', fontSize: 15, color: c.accent, margin: 0 }}>{typeof s === 'string' ? s : s.name}</h3>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      )}

      {/* ABOUT */}
      {!hidden('about') && (
      <section id="about" style={{ padding: '80px 5%' , order: getOrder('about') }}>
        <div className="tp-2col" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            {(copy?.aboutLayout || 'image') !== 'stats' ? (
              images.about
                ? <img src={images.about} alt="About" style={{ width: '100%', maxWidth: 460, height: 360, objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: '100%', maxWidth: 460, height: 360, background: c.secondary || '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777', fontSize: '0.85rem', textAlign: 'center', padding: 24, boxSizing: 'border-box' }}>Upload an about photo in the Images tab</div>
            ) : (
              <div style={{ width: '100%', maxWidth: 460, background: c.secondary || '#2a2a2a', padding: '40px 32px', boxSizing: 'border-box'  }}>
                {(() => {
                  const defaultStats = [
                    { value: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '10+', label: 'Years in Business' },
                    { value: '500+', label: 'Rides Detailed' },
                    { value: '100%', label: 'Mobile Service' },
                  ];
                  const aboutStats = (copy?.aboutStats || []).map((s, i) => ({
                    value: s.value || defaultStats[i]?.value || '',
                    label: s.label || defaultStats[i]?.label || '',
                  }));
                  if (aboutStats.length === 0) aboutStats.push(...defaultStats);
                  return aboutStats.map((st, i) => (
                    <div key={i} style={{ textAlign: 'center', marginBottom: i < aboutStats.length - 1 ? 28 : 0 }}>
                      <div style={{ fontSize: '3rem', fontWeight: 900, color: c.accent, lineHeight: 1 }}>{st.value}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#777', marginTop: 6, textTransform: 'uppercase' }}>{st.label}</div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
          <div>
            <div style={{ color: c.accent, fontWeight: 900, letterSpacing: 3, fontSize: 11, textTransform: 'uppercase', marginBottom: 8 }}>ABOUT US</div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 24px', lineHeight: 1 }}>
              {biz.businessName || 'WE DETAIL'}
            </h2>
            <p style={{ color: '#bbb', lineHeight: 1.8, fontSize: 15, marginBottom: 20 }}>
              {copy.aboutText || `Based in ${biz.city || 'your area'}, we bring professional detailing directly to you.`}
            </p>
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
        </div>
      </section>
      )}

      {/* GALLERY */}
      {!hidden('gallery') && (
      <div style={{ order: getOrder('gallery') }}>
      <GallerySection images={images} colors={c} font={font} bodyFont={templateMeta.bodyFont} />
      </div>
      )}

      {/* TESTIMONIALS */}
      {!hidden('testimonials') && (
        copy?.reviewMode === 'google' && copy?.googleWidgetKey ? (
          <div style={{ order: getOrder('testimonials'), padding: '80px 5%' }}>
            <GoogleReviewsWidget widgetKey={copy.googleWidgetKey} />
          </div>
        ) : testimonials.length > 0 ? (
        <section style={{ padding: '80px 5%', background: c.secondary || '#2a2a2a', borderTop: '1px solid #333' , order: getOrder('testimonials') }}>
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
        ) : null
      )}

      {/* CTA SECTION */}
      {!hidden('cta') && (
      <section style={{ padding: '80px 5%', textAlign: 'center' , order: getOrder('cta') }}>
        <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 16px', lineHeight: 1 }}>READY TO BOOK?</h2>
        <p style={{ color: '#888', fontSize: 16, marginBottom: 40 }}>{copy.ctaSecondary || `Serving ${biz.city || 'your area'}. We come to you.`}</p>
        <a href={copy?.ctaUrl || (`tel:${biz.phone}`)} style={{
          display: 'inline-block', background: c.accent, color: '#fff',
          padding: '18px 48px', fontWeight: 900, fontSize: 18,
          letterSpacing: 2, textTransform: 'uppercase', textDecoration: 'none',
          clipPath: 'polygon(16px 0%, 100% 0%, calc(100% - 16px) 100%, 0% 100%)',
        }}>
          {copy.ctaPrimary || 'CALL ' + (biz.phone || 'NOW')}
        </a>
        {biz.address && <p style={{ color: '#555', fontSize: 13, marginTop: 20 }}>📍 {biz.address}, {biz.city}, {biz.state}</p>}
        {biz.hours && (
          <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '8px' }}>
            {formatHours(biz.hours)}
          </p>
        )}
      </section>
      )}

      {/* FOOTER */}
      <footer style={{ background: '#111', padding: '48px 5% 28px', borderTop: `3px solid ${c.accent}`, order: 9999 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 36, marginBottom: 32 }}>
          <div>
            {/* Footer logo */}
            {images.logo ? (
              <img src={images.logo} alt={biz.businessName} style={{ height: 48, maxWidth: 180, objectFit: 'contain', marginBottom: '0.75rem', display: 'block' }} />
            ) : (
              <div style={{ fontWeight: 900, fontSize: 15, color: c.accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                🚛 {biz.businessName}
              </div>
            )}
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
            <SocialRow biz={biz} color={c.accent} size={20} images={images} />
          </div>
        </div>
        <div style={{ borderTop: '1px solid #222', paddingTop: 20, textAlign: 'center', color: '#444', fontSize: 12 }}>
          &copy; {new Date().getFullYear()} {biz.businessName}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
