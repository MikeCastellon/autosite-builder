import { useState, useEffect } from 'react';
import { SocialRow } from '../SocialIcons.jsx';
import { formatHours } from '../../../../lib/formatHours.js';
import { HeroImage, AboutImage, GallerySection } from '../ImageLayers.jsx';
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import GoogleReviewsWidget from '../GoogleReviewsWidget.jsx';
import InstagramFeedWidget from '../InstagramFeedWidget.jsx';

// Template: Wheel Clean — White & gunmetal (#f8f9fa bg, #374151 accent)
// Professional clean, services list with left border accent, brands as styled text

export default function WheelClean({ businessInfo, generatedCopy, templateMeta, images = {} }) {
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
  const splitHero = copy?.heroLayout === 'split';
  const services = copy.servicesSection?.items || [];
  const svcCols = services.length >= 6 ? Math.ceil(services.length / 2) : services.length || 1;
  const testimonials = copy.testimonialPlaceholders || [];
  const payments = biz.paymentMethods || [];
  const packages = biz.packages || [];
  const hidden = (id) => copy?.hiddenSections?.includes(id);
  const getOrder = buildSectionOrder(copy, ['hero', 'awards', 'statsBar', 'services', 'brands', 'about', 'gallery', 'testimonials', 'instagram', 'cta']);

  const parseBrands = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(b => typeof b === 'object' ? (b.name || '') : b).filter(Boolean);
    if (typeof val === 'string') return val.split(/,|·/).map(b => b.trim()).filter(Boolean);
    return [];
  };
  const brandsList = parseBrands(copy?.wheelBrands ?? biz.brands);
  const tireBrandsList = parseBrands(copy?.tireBrandsList ?? biz.tireBrands);

  return (
    <div style={{ fontFamily: font, background: c.bg, color: c.text, minHeight: '100vh', overflowX: 'hidden', margin: 0, padding: 0, containerType: 'inline-size', display: 'flex', flexDirection: 'column' }}>
      <style>{`@container(max-width:600px){.tp-nav-links a[href^="#"]{display:none!important}.tp-nav-links{gap:12px!important}.tp-2col{grid-template-columns:1fr!important}.tp-4col{grid-template-columns:1fr 1fr!important}}`}</style>

      {/* STICKY NAV */}
      <nav style={{ order: -1,
        position: 'sticky', top: 0, zIndex: 1000,
        background: scrolled ? 'rgba(248,249,250,0.97)' : c.bg,
        borderBottom: scrolled ? '1px solid #e5e7eb' : '1px solid transparent',
        transition: 'all 0.3s ease',
        padding: '0 5%',
        boxShadow: scrolled ? '0 1px 12px rgba(0,0,0,0.06)' : 'none',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <div>
            {images.logo ? (
              <img src={images.logo} alt={biz.businessName || 'Logo'} style={{ height: 36, objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: 18, fontWeight: 800, color: c.accent }}>{biz.businessName || 'Wheel Shop'}</span>
            )}
            <span style={{ display: 'block', fontSize: 11, color: c.muted, letterSpacing: 1.5, textTransform: 'uppercase' }}>Custom Wheels · {biz.city}, {biz.state}</span>
          </div>
          <div className="tp-nav-links" style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
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

      {/* HERO */}
      {!hidden('hero') && (
      <header style={splitHero ? { order: getOrder('hero'), display: 'flex', flexDirection: 'row', minHeight: '85vh' } : {
        order: getOrder('hero'), minHeight: '100vh', display: 'flex', alignItems: 'center',
        background: c.secondary || '#e9ecef',
        borderBottom: '1px solid #e5e7eb',
        padding: '96px 5% 72px',
        position: 'relative', overflow: 'hidden',
      }}>
        {!splitHero && <HeroImage src={images.hero} />}
        {splitHero ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
            padding: 'clamp(3rem,6vw,6rem)', background: c.secondary,
          }}>
            <span style={{
              display: 'inline-block', background: `${c.accent}12`, color: c.accent,
              fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 20,
              textTransform: 'uppercase', letterSpacing: 2, marginBottom: 24, alignSelf: 'flex-start',
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
              <a href={copy?.ctaPrimaryUrl || (`tel:${biz.phone}`)} style={{
                background: c.accent, color: '#fff', padding: '14px 32px',
                borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none',
              }}>
                {copy.ctaPrimary || 'Get a Quote'}
              </a>
              <a href={copy?.ctaSecondaryUrl || '#services'} style={{
                background: '#fff', color: c.accent, border: `2px solid ${c.accent}`,
                padding: '13px 28px', borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: 'none',
              }}>
                {copy.ctaSecondary || 'Our Services'}
              </a>
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 700, margin: '0 auto' }}>
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
              <a href={copy?.ctaPrimaryUrl || (`tel:${biz.phone}`)} style={{
                background: c.accent, color: '#fff', padding: '14px 32px',
                borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none',
              }}>
                {copy.ctaPrimary || 'Get a Quote'}
              </a>
              <a href={copy?.ctaSecondaryUrl || '#services'} style={{
                background: '#fff', color: c.accent, border: `2px solid ${c.accent}`,
                padding: '13px 28px', borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: 'none',
              }}>
                {copy.ctaSecondary || 'Our Services'}
              </a>
            </div>
          </div>
        )}
        {splitHero && (
          <div style={{ flex: 1, position: 'relative', minHeight: '85vh', overflow: 'hidden' }}>
            {images.hero
              ? <img src={images.hero} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: '100%', height: '100%', background: c.accent }} />
            }
          </div>
        )}
      </header>
      )}

      {/* AWARDS */}
      {!hidden('awards') && biz.awards && (
        <section style={{ order: getOrder('awards'), background: '#fefce8', borderTop: '1px solid #fef08a', borderBottom: '1px solid #fef08a', padding: '20px 5%' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 22 }}>🏆</div>
            <div>
              <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#92400e' }}>RECOGNITION: </span>
              <span style={{ color: '#92400e', fontSize: 14, fontWeight: 500 }}>{biz.awards}</span>
            </div>
          </div>
        </section>
      )}

      {/* STATS BAR */}
      {!hidden('statsBar') && (
      <section style={{ order: getOrder('statsBar'), background: '#fff', padding: '48px 5%', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 24 }}>
          {(() => {
            const defaultStats = [
              { value: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '10+', label: 'Years in Business' },
              { value: '50+', label: 'Wheel Brands' },
              { value: '5K+', label: 'Wheels Installed' },
              { value: '5.0 ★', label: 'Average Rating' },
            ];
            const stats = (copy?.heroStats || []).length > 0
              ? copy.heroStats.map((s, i) => ({
                  value: s.value || defaultStats[i]?.value || '',
                  label: s.label || defaultStats[i]?.label || '',
                }))
              : defaultStats;
            return stats.map((s, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '20px', background: c.secondary, borderRadius: 12, border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '2.4rem', fontWeight: 800, color: c.accent, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 13, color: c.muted, marginTop: 6 }}>{s.label}</div>
              </div>
            ));
          })()}
        </div>
      </section>
      )}

      {/* SERVICES */}
      {!hidden('services') && (
      <section id="services" style={{ order: getOrder('services'), padding: '80px 5%', background: c.bg }}>
        <div className="tp-2col" style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 60, alignItems: 'start' }}>
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
          {packages.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1px', background: `${c.accent}22` }}>
              {packages.map((pkg, i) => (
                <div key={i} style={{ background: '#fff', padding: '32px 28px', borderTop: `3px solid ${i === 1 ? c.accent : 'transparent'}` }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: c.text, marginBottom: 8 }}>{pkg.name || pkg}</h3>
                  {pkg.price && <div style={{ fontFamily: font, fontSize: '1.8rem', fontWeight: 800, color: c.accent, margin: '0.4rem 0 0.75rem' }}>{pkg.price}</div>}
                  {pkg.description && <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{pkg.description}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${svcCols}, 1fr)`, gap: 0 }}>
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
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: c.text, margin: 0 }}>{typeof svc === 'string' ? svc : svc.name}</h3>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      )}

      {/* BRANDS */}
      {!hidden('brands') && (brandsList.length > 0 || tireBrandsList.length > 0 || biz.brands || biz.tireBrands) && (
        <section id="brands" style={{ order: getOrder('brands'), padding: '72px 5%', background: '#fff', borderTop: '1px solid #e5e7eb' }}>
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

      {/* ABOUT — standard pattern: image/stats left, text right */}
      {!hidden('about') && (
      <section id="about" style={{ order: getOrder('about'), padding: '80px 5%', background: c.secondary, borderTop: '1px solid #e5e7eb' }}>
        <div className="tp-2col" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
          <div>
            {(copy?.aboutLayout || 'image') !== 'stats' ? (
              images.about
                ? <img src={images.about} alt="About" style={{ width: '100%', maxWidth: 460, height: 360, objectFit: 'cover', borderRadius: 10, display: 'block' }} />
                : <div style={{ width: '100%', maxWidth: 460, height: 360, background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.muted, fontSize: '0.85rem', textAlign: 'center', padding: 24, boxSizing: 'border-box' }}>Upload an about photo in the Images tab</div>
            ) : (
              <div style={{ width: '100%', maxWidth: 460, background: '#fff', padding: '40px 32px', boxSizing: 'border-box', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                {(() => {
                  const defaultStats = [
                    { value: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '10+', label: 'Years in Business' },
                    { value: '50+', label: 'Brands Available' },
                    { value: '5K+', label: 'Wheels Installed' },
                  ];
                  const aboutStats = (copy?.aboutStats || []).map((s, i) => ({
                    value: s.value || defaultStats[i]?.value || '',
                    label: s.label || defaultStats[i]?.label || '',
                  }));
                  if (aboutStats.length === 0) aboutStats.push(...defaultStats);
                  return aboutStats.map((st, i) => (
                    <div key={i} style={{ textAlign: 'center', marginBottom: i < aboutStats.length - 1 ? 28 : 0 }}>
                      <div style={{ fontSize: '3rem', fontWeight: 800, color: c.accent, lineHeight: 1 }}>{st.value}</div>
                      <div style={{ fontSize: 13, color: c.muted, marginTop: 6 }}>{st.label}</div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
          <div>
            <span style={{ display: 'inline-block', background: `${c.accent}12`, color: c.accent, fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 16, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>About</span>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, color: c.text, marginBottom: 20 }}>About {biz.businessName}</h2>
            <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.85, marginBottom: 20 }}>
              {copy.aboutText || `Serving ${biz.city || 'your area'} with expert wheel and tire services.`}
            </p>
            {biz.warranty && (
              <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', borderLeft: '4px solid #10b981', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>WARRANTY</div>
                <p style={{ color: c.text, fontSize: 14, margin: 0 }}>{biz.warranty}</p>
              </div>
            )}
            {biz.specialties && (
              <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', borderLeft: `4px solid ${c.accent}`, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>SPECIALTIES</div>
                <p style={{ color: c.text, fontSize: 14, margin: 0 }}>{biz.specialties}</p>
              </div>
            )}
            {payments.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ color: c.muted, fontWeight: 700, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>PAYMENT ACCEPTED</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {payments.map((p, i) => (
                    <span key={i} style={{
                      background: '#fff', color: c.text, border: '1px solid #e5e7eb',
                      padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
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
        copy?.googleWidgetKey ? (
          <div style={{ order: getOrder('testimonials'), padding: '80px 5%' }}>
            {copy.googleReviewsTitle && <h2 style={{ fontFamily: font || 'inherit', fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, textAlign: 'center', marginBottom: 32, color: c.text }}>{copy.googleReviewsTitle}</h2>}
            <GoogleReviewsWidget widgetKey={copy.googleWidgetKey} />
          </div>
        ) : testimonials.length > 0 ? (
        <section style={{ order: getOrder('testimonials'), padding: '80px 5%', background: '#fff', borderTop: '1px solid #e5e7eb' }}>
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
        ) : null
      )}

      {/* INSTAGRAM FEED */}
      {!hidden('instagram') && copy?.instagramWidgetKey && (
        <section style={{ order: getOrder('instagram'), padding: '80px 5%' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {copy.instagramFeedTitle && <h2 style={{ fontFamily: font || 'inherit', fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, textAlign: 'center', marginBottom: 32, color: c.text }}>{copy.instagramFeedTitle}</h2>}
            <InstagramFeedWidget widgetKey={copy.instagramWidgetKey} />
          </div>
        </section>
      )}

      {/* CTA — full-width banner */}
      {!hidden('cta') && (
      <section id="contact" style={{ order: getOrder('cta'), background: c.accent, padding: '72px 5%', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, color: '#fff', margin: '0 0 12px' }}>{copy.ctaHeadline || 'Ready to Upgrade?'}</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, marginBottom: 32, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
          {copy.ctaSubtext || `${biz.city || 'Your city'}, ${biz.state || ''} — Stop by or give us a call today`}
        </p>
        <a href={copy?.ctaUrl || (`tel:${biz.phone}`)} style={{
          display: 'inline-block', background: '#fff', color: c.accent,
          padding: '16px 44px', borderRadius: 10, fontWeight: 800, fontSize: 17, textDecoration: 'none',
        }}>
          {copy.ctaButtonText || copy.ctaPrimary || biz.phone || 'Call Now'}
        </a>
        {biz.address && <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 20 }}>
          {biz.address}, {biz.city}, {biz.state}
        </p>}
        {biz.hours && (
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 8 }}>
            {formatHours(biz.hours)}
          </p>
        )}
      </section>
      )}

      {/* FOOTER */}
      <footer style={{ order: 9999, background: '#f9fafb', borderTop: '1px solid #e5e7eb', padding: '40px 5% 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            {images.logo ? (
              <img src={images.logo} alt={biz.businessName} style={{ height: 48, maxWidth: 180, objectFit: 'contain', marginBottom: '0.75rem', display: 'block' }} />
            ) : (
              <div style={{ fontWeight: 800, fontSize: 15, color: c.accent, marginBottom: 4 }}>{biz.businessName}</div>
            )}
            <p style={{ color: c.muted, fontSize: 13, margin: 0 }}>{copy.footerTagline || biz.tagline}</p>
          </div>
          <SocialRow biz={biz} color={c.accent} size={20} images={images} />
        </div>
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, textAlign: 'center', color: '#d1d5db', fontSize: 12 }}>
          &copy; {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state}
        </div>
      </footer>
    </div>
  );
}
