import { useState, useEffect } from 'react';
import { SocialRow } from '../SocialIcons.jsx';
import { formatHours } from '../../../../lib/formatHours.js';
import { HeroImage, AboutImage, GallerySection } from '../ImageLayers.jsx';
import IconOrEmoji from '../IconOrEmoji.jsx';
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import GoogleReviewsWidget from '../GoogleReviewsWidget.jsx';
import { getFallbacks } from '../../../../lib/templateFallbacks.js';

// Template: Wheel Apex — Alloy & Bronze e-commerce style
// Bebas Neue display + DM Sans body, brushed-alloy palette, bronze accents,
// product card grid, finish selector, fitment band, brand strip, trust bar

export default function WheelApex({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = "@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&display=swap');";
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const c = templateMeta?.colors || { bg: '#F0F1F3', accent: '#A8813A', text: '#1C1E24', secondary: '#FFFFFF', muted: '#7A7D88' };
  const display = "'Bebas Neue', sans-serif";
  const body = "'DM Sans', sans-serif";
  const biz = businessInfo || {};
  const fb = getFallbacks(biz.businessType);
  const copy = generatedCopy || {};
  const splitHero = copy?.heroLayout === 'split';
  const services = copy.servicesSection?.items || [];
  const testimonials = copy.testimonialPlaceholders || [];
  const payments = biz.paymentMethods || [];
  const packages = biz.packages || [];
  const hidden = (id) => copy?.hiddenSections?.includes(id);
  const getOrder = buildSectionOrder(copy, ['hero', 'ticker', 'trustBar', 'products', 'about', 'brands', 'gallery', 'testimonials', 'cta']);

  const D = {
    bg: '#F0F1F3', bg2: '#E8EAED', bg3: '#DDDFE3',
    card: '#FFFFFF',
    alloy: '#B8BEC7', alloyMid: '#8A9099', alloyDark: '#5C6270',
    bronze: '#A8813A', bronzeLight: '#C9A46A', bronzeBg: '#F7F0E6',
    ink: '#1C1E24', ink2: '#3A3D46', muted: '#7A7D88',
    border: '#D4D7DD', borderLight: '#E4E6EA',
  };

  const parseBrands = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(b => typeof b === 'object' ? (b.name || '') : b).filter(Boolean);
    if (typeof val === 'string') return val.split(/,|·/).map(b => b.trim()).filter(Boolean);
    return [];
  };
  const brandsList = parseBrands(copy?.wheelBrands ?? biz.brands);
  const tireBrandsList = parseBrands(copy?.tireBrandsList ?? biz.tireBrands);

  const defaultStats = [
    { value: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '10+', label: 'Years Experience' },
    { value: '2,400+', label: 'SKUs in Stock' },
    { value: '4.9', label: 'Avg Rating' },
  ];
  const heroStats = (copy?.aboutStats || []).map((s, i) => ({
    value: s.value || defaultStats[i]?.value || '',
    label: s.label || defaultStats[i]?.label || '',
  }));
  if (heroStats.length === 0) heroStats.push(...defaultStats);

  return (
    <div style={{ fontFamily: body, background: D.bg, color: D.ink, minHeight: '100vh', overflowX: 'hidden', containerType: 'inline-size', display: 'flex', flexDirection: 'column' }}>
      <style>{`@container(max-width:600px){.tp-nav-links{display:none!important}.tp-2col{grid-template-columns:1fr!important}.tp-3col{grid-template-columns:1fr 1fr!important}.tp-trust-bar{flex-wrap:wrap}.tp-trust-bar>div{min-width:50%;border-bottom:1px solid ${D.border}}}`}</style>

      {/* NAV */}
      <nav style={{ order: -1,
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', height: 64,
        background: D.card, borderBottom: `1px solid ${D.border}`,
        boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,0.06)' : 'none',
        transition: 'box-shadow 0.3s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {images.logo ? (
            <img src={images.logo} alt={biz.businessName} style={{ height: 32, objectFit: 'contain' }} />
          ) : (
            <a href="#" style={{ fontFamily: display, fontSize: 26, letterSpacing: 3, color: D.ink, textDecoration: 'none' }}>
              {(biz.businessName || fb.shopName).split(' ')[0].toUpperCase()}<span style={{ color: D.bronze }}>{(biz.businessName || fb.shopName).split(' ').slice(1).join(' ').toUpperCase() || fb.shopName.split(' ').slice(1).join(' ').toUpperCase()}</span>
            </a>
          )}
        </div>
        <div className="tp-nav-links" style={{ display: 'flex', gap: 28, listStyle: 'none' }}>
          {['Services', 'Brands', 'About', 'Contact'].map(link => (
            <a key={link} href={`#${link.toLowerCase()}`} style={{ fontSize: 12, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: D.alloyDark, textDecoration: 'none' }}>{link}</a>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {biz.phone && <a href={`tel:${biz.phone}`} style={{ fontSize: 12, fontWeight: 500, color: D.muted, textDecoration: 'none' }}>{biz.phone}</a>}
          <a href={copy?.ctaPrimaryUrl || `tel:${biz.phone}`} style={{ background: D.ink, color: '#fff', fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', padding: '10px 22px', textDecoration: 'none' }}>
            {copy.ctaPrimary || 'Get a Quote'}
          </a>
        </div>
      </nav>

      {/* HERO */}
      {!hidden('hero') && (
      <header style={splitHero ? {
        order: getOrder('hero'), display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 500, background: D.card, borderBottom: `1px solid ${D.border}`,
      } : {
        order: getOrder('hero'), minHeight: '100vh', display: 'flex', alignItems: 'center',
        background: D.card, borderBottom: `1px solid ${D.border}`,
        position: 'relative', overflow: 'hidden',
      }}>
        {!splitHero && <HeroImage src={images.hero} />}
        <div style={splitHero ? {
          padding: '72px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        } : {
          position: 'relative', zIndex: 1, padding: '96px 48px 72px', maxWidth: 700,
        }}>
          <p style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: D.bronze, marginBottom: 14, fontWeight: 500 }}>
            ◆ {fb.heroBadge}{biz.city ? ` · ${biz.city}` : ''}
          </p>
          <h1 style={{ fontFamily: display, fontSize: 'clamp(48px, 7vw, 88px)', lineHeight: 0.92, letterSpacing: 1, color: D.ink, marginBottom: 24 }}>
            {copy.headline ? (
              (() => {
                const words = copy.headline.trim().split(' ');
                const mid = Math.ceil(words.length / 2);
                return <>{words.slice(0, mid).join(' ')}<br /><span style={{ color: D.alloyMid }}>{words.slice(mid).join(' ')}</span></>;
              })()
            ) : (
              <>FORGE<br /><span style={{ color: D.alloyMid }}>YOUR</span><br />RIDE</>
            )}
          </h1>
          <p style={{ fontSize: 14, color: D.muted, lineHeight: 1.75, maxWidth: 420, marginBottom: 32, fontWeight: 300 }}>
            {copy.subheadline || biz.tagline || fb.subheadline}
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <a href={copy?.ctaPrimaryUrl || `tel:${biz.phone}`} style={{ background: D.ink, color: '#fff', fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', padding: '13px 28px', textDecoration: 'none' }}>
              {copy.ctaPrimary || fb.ctaHeadline}
            </a>
            <a href={copy?.ctaSecondaryUrl || '#services'} style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: D.ink2, padding: '13px 0', borderBottom: `1px solid ${D.alloyMid}`, textDecoration: 'none' }}>
              {copy.ctaSecondary || 'View Services →'}
            </a>
          </div>
        </div>
        {splitHero && (
          <div style={{ background: D.bg, position: 'relative', borderLeft: `1px solid ${D.border}`, minHeight: 400, overflow: 'hidden' }}>
            {images.hero ? (
              <img src={images.hero} alt="Hero" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: D.muted }}>Hero image</span>
              </div>
            )}
          </div>
        )}
      </header>
      )}

      {/* TICKER */}
      {!hidden('ticker') && (
      <div style={{ order: getOrder('ticker'), background: D.ink, padding: '10px 0', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', gap: 40, animation: 'apexTick 22s linear infinite' }}>
          {[...Array(2)].map((_, r) => {
            const rawTicker = copy?.tickerItems?.length > 0
              ? copy.tickerItems
              : (Array.isArray(biz.specialties) ? biz.specialties : typeof biz.specialties === 'string' && biz.specialties.trim() ? biz.specialties.split(/,\s*/) : fb.tickerItems);
            const tickerItems = Array.isArray(rawTicker) ? rawTicker : [rawTicker];
            return tickerItems.flatMap((item, i) => [
              <span key={`${r}-${i}`} style={{ fontSize: 11, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: D.alloy }}>{typeof item === 'object' ? item.name : item}</span>,
              <span key={`${r}-d-${i}`} style={{ color: D.bronze, fontSize: 11 }}>◆</span>,
            ]);
          })}
        </div>
        <style>{`@keyframes apexTick { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
      </div>
      )}

      {/* TRUST BAR */}
      {!hidden('trustBar') && (() => {
        const defaultTrust = [
          { emoji: '🕐', label: biz.yearsInBusiness ? `${biz.yearsInBusiness}+ years experience` : 'Professional service', sub: 'Trusted locally' },
          { emoji: '✓', label: fb.guaranteeLabel, sub: 'Or we make it right' },
          { emoji: '💳', label: payments.length > 0 ? payments.slice(0, 2).join(' · ') : 'Finance available', sub: payments.length > 0 ? 'Accepted' : '0% for 12 months' },
          { emoji: '★', label: '4.9 star rating', sub: 'Customer reviews' },
        ];
        const trustItems = (copy?.trustBar || []).length > 0
          ? copy.trustBar.map((t, i) => ({
              emoji: t.emoji ?? defaultTrust[i]?.emoji ?? '★',
              label: t.label || defaultTrust[i]?.label || '',
              sub: t.sub || defaultTrust[i]?.sub || '',
            }))
          : defaultTrust;
        return (
          <div className="tp-trust-bar" style={{ order: getOrder('trustBar'), display: 'flex', borderBottom: `1px solid ${D.border}`, background: D.card }}>
            {trustItems.map((item, i) => (
              <div key={i} style={{ flex: 1, padding: '14px 20px', borderRight: i < trustItems.length - 1 ? `1px solid ${D.border}` : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, background: D.bronzeBg, border: '1px solid #E8D9C0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>
                  <IconOrEmoji value={item.emoji} size={16} color="#A8813A" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: D.ink2 }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: D.muted, marginTop: 1 }}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* SERVICES / PRODUCTS — product card grid */}
      {!hidden('products') && (() => {
        const products = copy?.products?.length > 0 ? copy.products : (packages.length > 0 ? packages : services.length > 0 ? services : fb.defaultProducts);
        return (
          <section id="services" style={{ order: getOrder('products'), padding: '64px 48px' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
              <div>
                <p style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: D.bronze, marginBottom: 8, fontWeight: 500 }}>◆ {copy?.products?.length > 0 ? 'Our Products' : 'Our Services'}</p>
                <h2 style={{ fontFamily: display, fontSize: 44, letterSpacing: 1, color: D.ink, lineHeight: 1, margin: 0 }}>
                  {copy.servicesSection?.intro ? copy.servicesSection.intro.split(' ').slice(0, 3).join(' ') : 'What We Offer'}
                </h2>
              </div>
            </div>
            <div className="tp-3col" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(products.length, 3)}, 1fr)`, gap: 16 }}>
              {products.map((item, i) => (
                <div key={i} style={{ background: D.card, border: `1px solid ${D.border}`, overflow: 'hidden' }}>
                  <div style={{ aspectRatio: '1 / 1', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: `1px solid ${D.border}`, position: 'relative', overflow: 'hidden' }}>
                    {(item.badge || (i === 0 && !copy?.products)) && (
                      <span style={{ position: 'absolute', top: 12, left: 12, fontSize: 10, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', padding: '4px 9px', background: D.bronzeBg, color: D.bronze, zIndex: 1 }}>
                        {item.badge || 'Popular'}
                      </span>
                    )}
                    {item.image ? (
                      <img src={item.image} alt={item.name || 'Product'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <span style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: D.muted }}>Image</span>
                    )}
                  </div>
                  <div style={{ padding: '18px 20px' }}>
                    <div style={{ fontFamily: display, fontSize: 22, letterSpacing: 0.5, color: D.ink, marginBottom: 3 }}>{typeof item === 'string' ? item : (item.name || 'Product')}</div>
                    <div style={{ fontSize: 12, color: D.muted, marginBottom: 16 }}>{item.description || ''}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {item.price && (
                        <div>
                          <div style={{ fontFamily: display, fontSize: 24, color: D.bronze, letterSpacing: 0.5 }}>{item.price}</div>
                        </div>
                      )}
                      <div style={{ width: 36, height: 36, background: D.bg, border: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: D.alloyDark }}>→</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            </div>
          </section>
        );
      })()}

      {/* ABOUT — standard pattern: image/stats left, text right */}
      {!hidden('about') && (
      <section id="about" style={{ order: getOrder('about'), padding: '80px 48px', background: D.card, borderTop: `1px solid ${D.border}`, borderBottom: `1px solid ${D.border}` }}>
        <div className="tp-2col" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
          <div>
            {(copy?.aboutLayout || 'image') !== 'stats' ? (
              images.about
                ? <img src={images.about} alt="About" style={{ width: '100%', maxWidth: 460, height: 360, objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: '100%', maxWidth: 460, height: 360, background: D.bg2, border: `1px dashed ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.muted, fontSize: '0.85rem', textAlign: 'center', padding: 24, boxSizing: 'border-box' }}>Upload an about photo in the Images tab</div>
            ) : (
              <div style={{ width: '100%', maxWidth: 460, background: D.bg, padding: '40px 32px', boxSizing: 'border-box', border: `1px solid ${D.border}` }}>
                {(() => {
                  const defStats = [
                    { value: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '10+', label: 'Years in Business' },
                    { value: '50+', label: 'Brands Available' },
                    { value: '5K+', label: fb.statLabel },
                  ];
                  const stats = (copy?.aboutStats || []).map((s, i) => ({
                    value: s.value || defStats[i]?.value || '',
                    label: s.label || defStats[i]?.label || '',
                  }));
                  if (stats.length === 0) stats.push(...defStats);
                  return stats.map((st, i) => (
                    <div key={i} style={{ textAlign: 'center', marginBottom: i < stats.length - 1 ? 28 : 0 }}>
                      <div style={{ fontFamily: display, fontSize: '3rem', fontWeight: 900, color: D.bronze, lineHeight: 1 }}>{st.value}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: D.muted, marginTop: 6, textTransform: 'uppercase' }}>{st.label}</div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
          <div>
            <p style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: D.bronze, marginBottom: 8, fontWeight: 500 }}>◆ About Us</p>
            <h2 style={{ fontFamily: display, fontSize: 40, letterSpacing: 1, color: D.ink, lineHeight: 1, margin: '0 0 20px' }}>About {biz.businessName || 'Us'}</h2>
            <p style={{ fontSize: 14, color: D.muted, lineHeight: 1.75, fontWeight: 300, marginBottom: 20 }}>
              {copy.aboutText || `Located in ${biz.city || 'your area'}, we specialize in ${fb.aboutFallback}.`}
            </p>
            {biz.awards && (
              <div style={{ background: D.bronzeBg, border: '1px solid #E8D9C0', padding: '14px 18px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: D.bronze, fontWeight: 500, marginBottom: 4 }}>Awards</div>
                <div style={{ fontSize: 13, color: D.ink2 }}>{biz.awards}</div>
              </div>
            )}
            {payments.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: D.muted, fontWeight: 500, marginBottom: 10 }}>Payment Accepted</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {payments.map((p, i) => (
                    <span key={i} style={{ fontSize: 11, color: D.alloyDark, letterSpacing: 0.5, padding: '4px 10px', background: D.bg2, border: `1px solid ${D.border}` }}>{p}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
      )}

      {/* BRANDS */}
      {!hidden('brands') && (brandsList.length > 0 || tireBrandsList.length > 0) && (
        <section id="brands" style={{ order: getOrder('brands'), padding: '48px', background: D.card, borderTop: `1px solid ${D.border}` }}>
          <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: D.muted, textAlign: 'center', marginBottom: 24 }}>Brands we carry</div>
          <div style={{ display: 'flex', border: `1px solid ${D.border}` }}>
            {(brandsList.length > 0 ? brandsList : ['ENKEI', 'VOSSEN', 'HRE', 'ROTIFORM', 'WORK']).map((brand, i, arr) => (
              <div key={i} style={{
                flex: 1, padding: '24px 0', borderRight: i < arr.length - 1 ? `1px solid ${D.border}` : 'none',
                textAlign: 'center', fontFamily: display, fontSize: 18, letterSpacing: 2, color: D.bg3,
              }}>{brand}</div>
            ))}
          </div>
          {tireBrandsList.length > 0 && (
            <div style={{ display: 'flex', border: `1px solid ${D.border}`, borderTop: 'none', marginTop: 0 }}>
              {tireBrandsList.map((brand, i, arr) => (
                <div key={i} style={{
                  flex: 1, padding: '20px 0', borderRight: i < arr.length - 1 ? `1px solid ${D.border}` : 'none',
                  textAlign: 'center', fontFamily: display, fontSize: 16, letterSpacing: 2, color: D.alloy,
                }}>{brand}</div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* GALLERY */}
      {!hidden('gallery') && (
      <div style={{ order: getOrder('gallery') }}>
      <GallerySection images={images} colors={{ ...c, bg: D.bg, accent: D.bronze, text: D.ink, secondary: D.card, muted: D.muted }} font={display} bodyFont={body} />
      </div>
      )}

      {/* TESTIMONIALS */}
      {!hidden('testimonials') && (
        copy?.googleWidgetKey ? (
          <div style={{ order: getOrder('testimonials'), padding: '80px 5%' }}>
            {copy.googleReviewsTitle && <h2 style={{ fontFamily: display || 'inherit', fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, textAlign: 'center', marginBottom: 32, color: D.ink }}>{copy.googleReviewsTitle}</h2>}
            <GoogleReviewsWidget widgetKey={copy.googleWidgetKey} theme={copy?.googleReviewsTheme} />
          </div>
        ) : testimonials.length > 0 ? (
        <section style={{ order: getOrder('testimonials'), padding: '64px 48px', background: D.card, borderTop: `1px solid ${D.border}` }}>
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: D.bronze, marginBottom: 8, fontWeight: 500 }}>◆ Reviews</p>
            <h2 style={{ fontFamily: display, fontSize: 44, letterSpacing: 1, color: D.ink, lineHeight: 1, margin: 0 }}>Customer Reviews</h2>
          </div>
          <div className="tp-3col" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(testimonials.length, 3)}, 1fr)`, gap: 1, background: D.border }}>
            {testimonials.map((t, i) => (
              <div key={i} style={{ background: D.card, padding: '28px 24px' }}>
                <div style={{ color: D.bronze, fontSize: 14, marginBottom: 14, letterSpacing: 2 }}>★★★★★</div>
                <p style={{ color: D.ink2, fontSize: 14, lineHeight: 1.75, fontWeight: 300, fontStyle: 'italic', margin: '0 0 16px' }}>"{t.text}"</p>
                <div style={{ fontSize: 12, fontWeight: 500, color: D.muted, letterSpacing: 0.5 }}>— {t.name}</div>
              </div>
            ))}
          </div>
        </section>
        ) : null
      )}

      {/* CTA / CONTACT */}
      {!hidden('cta') && (
      <section id="contact" style={{ order: getOrder('cta'), background: D.bronzeBg, borderTop: '1px solid #E8D9C0', borderBottom: '1px solid #E8D9C0', padding: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: D.bronze, marginBottom: 8, fontWeight: 500 }}>{copy.ctaSubtext || '◆ Get in touch'}</p>
          <div style={{ fontFamily: display, fontSize: 38, letterSpacing: 1, color: D.ink, lineHeight: 1 }}>{copy.ctaHeadline || 'Ready to upgrade?'}</div>
          <div style={{ fontSize: 13, color: D.muted, marginTop: 6 }}>
            {biz.address && <>{biz.address}, {biz.city}, {biz.state}</>}
            {biz.hours && <> · {formatHours(biz.hours)}</>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a href={copy?.ctaUrl || `tel:${biz.phone}`} style={{ background: D.ink, color: '#fff', fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', padding: '12px 24px', textDecoration: 'none' }}>
            {copy.ctaButtonText || copy.ctaPrimary || biz.phone || 'Contact Us'}
          </a>
        </div>
      </section>
      )}

      {/* FOOTER */}
      <footer style={{ order: 9999, padding: '36px 48px', background: D.card, borderTop: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {images.logo ? (
            <img src={images.logo} alt={biz.businessName} style={{ height: 24, objectFit: 'contain' }} />
          ) : (
            <span style={{ fontFamily: display, fontSize: 20, letterSpacing: 3, color: D.alloyMid }}>
              {(biz.businessName || fb.shopName).split(' ')[0].toUpperCase()}<span style={{ color: D.bronze }}>{(biz.businessName || fb.shopName).split(' ').slice(1).join(' ').toUpperCase() || fb.shopName.split(' ').slice(1).join(' ').toUpperCase()}</span>
            </span>
          )}
          <span style={{ fontSize: 13, color: D.muted }}>·</span>
          <span style={{ fontSize: 12, color: D.muted }}>{copy.footerTagline || biz.tagline || ''}</span>
        </div>
        <SocialRow biz={biz} color={D.bronze} size={16} images={images} />
        <div style={{ fontSize: 11, color: D.muted, letterSpacing: 0.3 }}>
          © {new Date().getFullYear()} {biz.businessName} · {biz.city}, {biz.state}
        </div>
      </footer>
    </div>
  );
}
