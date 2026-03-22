import { useState, useEffect } from 'react';
import { SocialRow } from '../SocialIcons.jsx';
import { formatHours } from '../../../../lib/formatHours.js';
import { HeroImage, AboutImage, GallerySection } from '../ImageLayers.jsx';

// Template: Tint Obsidian -- Ultra-dark void (#050507 bg, #7C3AED accent, #06B6D4 cyan)
// Syne + Outfit fonts, VLT shade guide, film brands, process steps, testimonials

export default function TintObsidian({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const id = 'tint-obsidian-fonts';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Outfit:wght@300;400;500;600;700&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const c = templateMeta?.colors || {
    bg: '#050507',
    accent: '#7C3AED',
    text: '#ffffff',
    secondary: '#0d0d12',
    muted: '#888888',
  };

  // Cyan secondary accent -- hardcoded per spec
  const cCyan = '#06B6D4';

  const font     = templateMeta?.font     || 'Syne, system-ui, sans-serif';
  const bodyFont = templateMeta?.bodyFont || 'Outfit, system-ui, sans-serif';

  const biz          = businessInfo || {};
  const copy         = generatedCopy || {};
  const splitHero    = copy?.heroLayout === 'split';
  const services     = copy.servicesSection?.items || [];
  const svcCols = services.length >= 6 ? Math.ceil(services.length / 2) : services.length || 1;
  const testimonials = copy.testimonialPlaceholders || [];
  const packages     = biz.packages || [];

  const _fb = copy?.filmBrandsList ?? biz.filmBrands;
  const filmBrandsList = _fb
    ? (Array.isArray(_fb) ? _fb.map(b => typeof b === 'object' ? (b.name || '') : b).filter(Boolean) : typeof _fb === 'string' ? _fb.split(/,|·/).map(b => b.trim()).filter(Boolean) : [])
    : [];

  const specialtiesList = biz.specialties
    ? (Array.isArray(biz.specialties)
        ? biz.specialties
        : biz.specialties.split(/,|·/).map(s => s.trim()).filter(Boolean))
    : [];

  const processSteps = [
    { num: '// 01', icon: '📐', title: 'Consultation',     body: 'We assess your vehicle, discuss goals, confirm legal VLT for your state, and recommend the right film tier for your needs and budget.' },
    { num: '// 02', icon: '🧽', title: 'Surface Prep',     body: 'Every glass surface is meticulously cleaned and decontaminated in our controlled bay. A dust-free environment ensures zero contamination under film.' },
    { num: '// 03', icon: '✂️',  title: 'Precision Cut',    body: 'Computerized templates for thousands of vehicle models ensure perfect fitment. No razor blades on your glass, ever.' },
    { num: '// 04', icon: '🔬', title: 'Install & Inspect', body: 'Wet installation, heat-gun forming, edge sealing, and final inspection under UV light. We do not release a vehicle until it is perfect.' },
  ];

  const defaultShades = [
    { vlt: 5,  name: 'Limo Black',  legal: 'Rear windows only' },
    { vlt: 15, name: 'Midnight',    legal: 'Rear-legal in most states' },
    { vlt: 25, name: 'Dark Smoke',  legal: 'Rear-legal in most states' },
    { vlt: 35, name: 'Medium',      legal: 'Front-legal in most states' },
    { vlt: 50, name: 'Light Smoke', legal: 'Universal' },
  ];
  const shades = copy?.shadeGuide?.length > 0 ? copy.shadeGuide : defaultShades;
  const showShadeGuide = copy?.showShadeGuide !== false;

  const panelBg = c.secondary || '#0d0d12';

  const labelTagStyle = {
    fontFamily: font, fontSize: 10, letterSpacing: 4, color: c.accent,
    textTransform: 'uppercase', marginBottom: 16,
    display: 'flex', alignItems: 'center', gap: 12,
  };

  const sectionTitleStyle = {
    fontFamily: font, fontSize: 'clamp(2.2rem, 4vw, 3.6rem)', fontWeight: 800,
    lineHeight: 1.05, letterSpacing: -1, color: c.text, margin: 0,
  };

  return (

    <div style={{ fontFamily: bodyFont, background: c.bg, color: c.text, minHeight: '100vh', overflowX: 'hidden', margin: 0, padding: 0, WebkitFontSmoothing: 'antialiased', containerType: 'inline-size' }}>
      <style>{`@container(max-width:600px){.tp-nav-links a[href^="#"]{display:none!important}.tp-nav-links{gap:12px!important}.tp-2col{grid-template-columns:1fr!important}}`}</style>

      {/* ============================================================ NAV ============================================================ */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 1000,
        background: scrolled ? 'rgba(5,5,7,0.96)' : 'transparent',
        borderBottom: scrolled ? `1px solid ${c.accent}30` : '1px solid transparent',
        transition: 'all 0.35s ease', padding: '0 5%',
        backdropFilter: scrolled ? 'blur(18px)' : 'none',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 70 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 6,
              background: `linear-gradient(135deg, ${c.accent}, ${cCyan})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: `0 0 16px ${c.accent}44`,
            }}>
              <div style={{ width: 14, height: 14, background: 'rgba(255,255,255,0.9)', clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', borderRadius: 1 }} />
            </div>
            {images.logo ? (
              <img src={images.logo} alt={biz.businessName || 'Logo'} style={{ height: 36, objectFit: 'contain' }} />
            ) : (
              <div>
                <div style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: c.text, letterSpacing: -0.5, lineHeight: 1 }}>{biz.businessName || 'Obsidian Tint'}</div>
                <div style={{ fontSize: 10, color: cCyan, letterSpacing: 3, textTransform: 'uppercase', marginTop: 2 }}>{biz.city || 'Studio'}</div>
              </div>
            )}
          </div>
          <div className="tp-nav-links" style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
            {[['#services', 'Services'], ['#films', 'Film Tech'], ['#process', 'Process']].map(([href, label]) => (
              <a key={href} href={href} style={{ color: c.text, textDecoration: 'none', fontWeight: 500, fontSize: 13, opacity: 0.55 }}>{label}</a>
            ))}
            <a href={`tel:${biz.phone}`} style={{
              background: `linear-gradient(135deg, ${c.accent}, ${cCyan})`,
              color: '#fff', padding: '10px 22px', borderRadius: 6, fontWeight: 700, fontSize: 13, textDecoration: 'none',
              boxShadow: `0 0 24px ${c.accent}44`,
            }}>
              {biz.phone ? 'Call Now' : 'Get a Quote'}
            </a>
          </div>
        </div>
      </nav>

      {/* ============================================================ HERO ============================================================ */}
      <header style={splitHero ? { display: 'flex', flexDirection: 'row', minHeight: '85vh' } : { minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center', background: c.bg, overflow: 'hidden' }}>
        {!splitHero && <HeroImage src={images.hero} />}
        {!splitHero && <div style={{
          position: 'absolute', top: '-15%', right: '-8%', width: 800, height: 800,
          background: `radial-gradient(circle, ${c.accent}28 0%, transparent 60%)`, pointerEvents: 'none',
        }} />}
        {!splitHero && <div style={{
          position: 'absolute', bottom: '-10%', left: '-5%', width: 560, height: 560,
          background: `radial-gradient(circle, ${cCyan}18 0%, transparent 65%)`, pointerEvents: 'none',
        }} />}
        {!splitHero && <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.035,
          backgroundImage: `linear-gradient(${c.accent}80 1px, transparent 1px), linear-gradient(90deg, ${c.accent}80 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />}
        {!splitHero && <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 240,
          background: `linear-gradient(to top, ${c.bg}, transparent)`, pointerEvents: 'none',
        }} />}
        <div style={splitHero ? {
          flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: 'clamp(3rem,6vw,6rem)', background: c.bg,
        } : { position: 'relative', zIndex: 1, padding: '8rem 5% 5rem', maxWidth: 1000, margin: '0 auto', textAlign: 'center', width: '100%' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            border: `1px solid ${cCyan}44`, borderRadius: 30,
            padding: '6px 18px', marginBottom: 32,
            fontSize: 11, color: cCyan, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: cCyan, display: 'inline-block', boxShadow: `0 0 8px ${cCyan}` }} />
            {biz.city && biz.state ? `${biz.city}, ${biz.state}` : 'Premium Tint Studio'} · Certified Installers
          </div>
          <h1 style={{
            fontFamily: font, fontSize: 'clamp(1.8rem, 7vw, 6rem)', fontWeight: 800,
            lineHeight: 1.0, letterSpacing: -2, margin: '0 0 24px', color: c.text,
          }}>
            {copy.headline || 'Precision Film. Zero Compromise.'}
          </h1>
          <p style={{
            fontSize: 'clamp(15px, 2vw, 18px)', lineHeight: 1.75, maxWidth: 600, margin: '0 auto 44px',
            background: `linear-gradient(180deg, ${c.text} 0%, rgba(255,255,255,0.5) 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            {copy.subheadline || biz.tagline || 'Professional window film installation for automotive, residential, and commercial applications.'}
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 64 }}>
            <a href={`tel:${biz.phone}`} style={{
              background: `linear-gradient(135deg, ${c.accent}, #a855f7)`,
              color: '#fff', padding: '15px 38px', borderRadius: 8, fontWeight: 700, fontSize: 15, textDecoration: 'none',
              boxShadow: `0 4px 32px ${c.accent}55`,
            }}>
              {copy.ctaPrimary || 'Book an Install'}
            </a>
            <a href="#services" style={{
              border: `1px solid ${cCyan}33`, color: cCyan, padding: '14px 30px',
              borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none',
            }}>
              {copy.ctaSecondary || 'Explore Services'}
            </a>
          </div>
          {!splitHero && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
              border: `1px solid ${c.accent}18`, borderRadius: 10,
              background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(8px)', overflow: 'hidden',
            }}>
              {[
                { key: '// since',    val: biz.yearsInBusiness ? String(new Date().getFullYear() - Number(biz.yearsInBusiness)) : 'Est.' },
                { key: '// location', val: biz.city || 'Local' },
                { key: '// warranty', val: (biz.warranty || biz.warrantyOffered) ? 'Backed' : 'Quality' },
                { key: '// rating',   val: '5.0 ★' },
              ].map((s, i) => (
                <div key={i} style={{
                  flex: '1 1 120px', padding: '20px 24px',
                  borderRight: i < 3 ? `1px solid ${c.accent}15` : 'none', textAlign: 'center',
                }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: 2.5, color: c.accent, textTransform: 'uppercase', marginBottom: 6 }}>{s.key}</div>
                  <div style={{ fontFamily: font, fontSize: 20, fontWeight: 700, color: c.text }}>{s.val}</div>
                </div>
              ))}
            </div>
          )}
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

      {/* ============================================================ VLT SHADE GUIDE ============================================================ */}
      {showShadeGuide && (
      <section style={{ padding: '100px 5%', background: panelBg, borderTop: `1px solid ${c.accent}1a`, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: -200, right: -200, width: 600, height: 600, borderRadius: '50%',
          background: `radial-gradient(circle, ${c.accent}07, transparent 70%)`, pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ ...labelTagStyle, justifyContent: 'center' }}>
              <span style={{ width: 24, height: 1, background: c.accent, flexShrink: 0 }} />
              Tint Options
            </div>
            <h2 style={{ ...sectionTitleStyle, marginBottom: 16 }}>
              Choose your <span style={{ color: '#a855f7' }}>shade.</span>
            </h2>
            <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.75, maxWidth: 560, margin: '0 auto' }}>
              Lower VLT means darker tint. Every shade is precision-cut and professionally installed.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {shades.map((shade, idx) => {
              const vlt = Number(shade.vlt) || 50;
              const opacity = (1 - vlt / 100).toFixed(2);
              const shadeImg = images?.[`shade${idx}`];
              return (
                <div key={idx} style={{
                  background: 'rgba(255,255,255,0.02)', border: `1px solid ${c.accent}20`,
                  borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.2s',
                }}>
                  <div style={{
                    aspectRatio: '1', position: 'relative',
                    background: shadeImg ? 'transparent' : `linear-gradient(180deg, rgba(40,120,200,${(0.12 + (1 - Number(opacity)) * 0.15).toFixed(2)}), transparent 70%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {shadeImg ? (
                      <>
                        <img src={shadeImg} alt={shade.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        {/* Tint overlay on image */}
                        <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${(opacity * 0.4).toFixed(2)})` }} />
                      </>
                    ) : (
                      <>
                        {/* Tint overlay */}
                        <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${opacity})`, borderBottom: `1px solid ${c.accent}18` }} />
                        {/* Car window silhouette */}
                        <svg width="100" height="60" viewBox="0 0 100 60" fill="none" style={{ position: 'relative', zIndex: 1, opacity: 0.5 }}>
                          <path d="M10 55 Q10 25 30 15 L70 15 Q90 25 90 55 Z" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" />
                          <path d="M20 50 Q20 30 35 22 L65 22 Q80 30 80 50 Z" fill={`rgba(255,255,255,${(0.05 + (vlt / 100) * 0.15).toFixed(2)})`} />
                        </svg>
                      </>
                    )}
                    <div style={{
                      position: 'absolute', top: 10, right: 10,
                      background: `${c.accent}22`, border: `1px solid ${c.accent}44`,
                      borderRadius: 6, padding: '4px 10px',
                      fontFamily: 'monospace', fontSize: 10, color: c.accent, letterSpacing: 1, zIndex: 2,
                    }}>{vlt}% VLT</div>
                  </div>
                  <div style={{ padding: '16px 18px' }}>
                    <div style={{ fontFamily: font, fontSize: 18, fontWeight: 700, color: c.text, marginBottom: 4 }}>{shade.name}</div>
                    <div style={{ fontSize: 12, color: c.muted }}>{shade.legal}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* ============================================================ SERVICES ============================================================ */}
      <section id="services" style={{ padding: '100px 5%' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ marginBottom: 64 }}>
            <div style={labelTagStyle}>
              <span style={{ width: 24, height: 1, background: c.accent, flexShrink: 0 }} />
              What We Install
            </div>
            <h2 style={sectionTitleStyle}>
              Every surface. <span style={{ color: '#a855f7' }}>Every vehicle.</span>
            </h2>
            {copy.servicesSection?.intro && (
              <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.75, maxWidth: 520, marginTop: 16 }}>{copy.servicesSection.intro}</p>
            )}
          </div>
          {packages.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {packages.map((pkg, i) => (
                <div key={i} style={{
                  background: panelBg, border: `1px solid ${c.accent}25`,
                  borderRadius: 10, padding: '28px 22px', position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ width: 3, height: 36, background: `linear-gradient(180deg, ${c.accent}, ${cCyan})`, marginBottom: 18, borderRadius: 2 }} />
                  <h3 style={{ fontFamily: font, fontSize: 17, fontWeight: 700, marginBottom: 8, color: c.text }}>
                    {typeof pkg === 'object' ? pkg.name : pkg}
                  </h3>
                  {typeof pkg === 'object' && pkg.price && (
                    <div style={{ fontSize: 24, fontWeight: 800, color: c.accent, marginBottom: 10 }}>{pkg.price}</div>
                  )}
                  {typeof pkg === 'object' && pkg.description && (
                    <p style={{ color: c.muted, fontSize: 13, lineHeight: 1.6, margin: 0 }}>{pkg.description}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${svcCols}, 1fr)`, gap: 16 }}>
              {services.length > 0
                ? services.map((svc, i) => (
                  <div key={i} style={{
                    background: panelBg, border: `1px solid ${c.accent}18`,
                    borderRadius: 10, padding: '32px 26px', position: 'relative', overflow: 'hidden',
                  }}>
                    <div style={{ width: 3, height: 36, background: `linear-gradient(180deg, ${c.accent}, ${cCyan})`, marginBottom: 18, borderRadius: 2 }} />
                    <h3 style={{ fontFamily: font, fontSize: 17, fontWeight: 700, marginBottom: 12, color: c.text }}>{svc.name}</h3>
                    <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.75, margin: 0 }}>{svc.description}</p>
                  </div>
                ))
                : (biz.services || []).map((svc, i) => (
                  <div key={i} style={{ background: panelBg, border: `1px solid ${c.accent}18`, borderRadius: 10, padding: '26px 22px' }}>
                    <div style={{ width: 3, height: 28, background: `linear-gradient(180deg, ${c.accent}, ${cCyan})`, marginBottom: 14, borderRadius: 2 }} />
                    <h3 style={{ fontFamily: font, fontSize: 16, fontWeight: 700, color: c.text, margin: 0 }}>{typeof svc === 'string' ? svc : svc.name}</h3>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </section>

      {/* ============================================================ FILM BRANDS ============================================================ */}
      {filmBrandsList.length > 0 && (
        <section id="films" style={{ padding: '100px 5%', background: panelBg, borderTop: `1px solid ${c.accent}1a`, borderBottom: `1px solid ${c.accent}1a`, position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: -150, right: -150, width: 500, height: 500, borderRadius: '50%',
            background: `radial-gradient(circle, ${cCyan}08, transparent 70%)`, pointerEvents: 'none',
          }} />
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ marginBottom: 60 }}>
              <div style={{ ...labelTagStyle, color: cCyan }}>
                <span style={{ width: 24, height: 1, background: cCyan, flexShrink: 0 }} />
                Film Technology
              </div>
              <h2 style={sectionTitleStyle}>
                Not all film is <span style={{ color: cCyan }}>equal.</span>
              </h2>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {filmBrandsList.map((brand, i) => (
                <div key={i} style={{
                  padding: '18px 28px', borderRadius: 8,
                  background: `linear-gradient(135deg, ${c.accent}18, ${cCyan}0d)`,
                  border: `1px solid ${c.accent}35`,
                  fontFamily: font, fontSize: 15, fontWeight: 700, color: c.text, letterSpacing: 0.3,
                  boxShadow: `0 2px 16px ${c.accent}15`,
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                    background: `linear-gradient(90deg, transparent, ${c.accent}80, transparent)`,
                  }} />
                  {brand}
                </div>
              ))}
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              border: `1px solid ${c.accent}18`, borderRadius: 10, marginTop: 48, overflow: 'hidden',
              background: 'rgba(255,255,255,0.015)',
            }}>
              {[
                { key: 'UV Rejection',   val: '99%' },
                { key: 'IR Rejection',   val: 'Up to 80%' },
                { key: 'Signal Safe',    val: 'Yes' },
                { key: 'Fade Resistant', val: 'Lifetime' },
              ].map((spec, i) => (
                <div key={i} style={{
                  padding: '22px 24px', textAlign: 'center',
                  borderRight: i < 3 ? `1px solid ${c.accent}15` : 'none',
                }}>
                  <div style={{ fontSize: 9, letterSpacing: 2.5, color: cCyan, textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 8 }}>{spec.key}</div>
                  <div style={{ fontFamily: font, fontSize: 22, fontWeight: 700, color: c.text }}>{spec.val}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============================================================ WARRANTY ============================================================ */}
      {(biz.warranty || biz.warrantyOffered) && (
        <section id="warranty" style={{ padding: '90px 5%', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 700, height: 450,
            background: `radial-gradient(ellipse, ${c.accent}12 0%, transparent 70%)`, pointerEvents: 'none',
          }} />
          <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{
              width: 80, height: 80, margin: '0 auto 24px',
              background: `linear-gradient(135deg, ${c.accent}30, ${cCyan}20)`,
              border: `2px solid ${c.accent}60`,
              borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, boxShadow: `0 0 50px ${c.accent}30`,
            }}>🛡</div>
            <div style={{ color: cCyan, fontWeight: 700, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 12, fontFamily: font }}>BACKED BY A GUARANTEE</div>
            <h2 style={{ ...sectionTitleStyle, fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', marginBottom: 20 }}>Our Warranty Promise</h2>
            <div style={{
              color: c.text, fontSize: 16, lineHeight: 1.8, maxWidth: 560, margin: '0 auto',
              padding: '28px 32px',
              background: `linear-gradient(135deg, ${c.accent}10, ${cCyan}08)`,
              border: `1px solid ${c.accent}30`, borderRadius: 12,
              boxShadow: `inset 0 1px 0 ${c.accent}20`,
            }}>
              {biz.warranty || biz.warrantyOffered}
            </div>
          </div>
        </section>
      )}

      {/* ============================================================ PROCESS ============================================================ */}
      <section id="process" style={{ padding: '100px 5%', background: panelBg, borderTop: `1px solid ${c.accent}1a` }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ marginBottom: 72 }}>
            <div style={labelTagStyle}>
              <span style={{ width: 24, height: 1, background: c.accent, flexShrink: 0 }} />
              The Install
            </div>
            <h2 style={sectionTitleStyle}>
              Precision is <span style={{ color: '#a855f7' }}>the standard.</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 32 }}>
            {processSteps.map((step, i) => (
              <div key={i}>
                <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: 2, color: c.accent, marginBottom: 16 }}>
                  <span style={{ background: `${c.accent}18`, border: `1px solid ${c.accent}33`, borderRadius: 4, padding: '3px 8px' }}>{step.num}</span>
                </div>
                <div style={{ fontSize: 28, marginBottom: 14 }}>{step.icon}</div>
                <h3 style={{ fontFamily: font, fontSize: 17, fontWeight: 700, color: c.text, marginBottom: 10 }}>{step.title}</h3>
                <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ ABOUT ============================================================ */}
      <section id="about" style={{ padding: '100px 5%', borderTop: `1px solid ${c.accent}1a` }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 60, alignItems: 'start' }}>
          <div>
            <div style={{ ...labelTagStyle, color: cCyan }}>
              <span style={{ width: 24, height: 1, background: cCyan, flexShrink: 0 }} />
              About the Studio
            </div>
            <h2 style={{ ...sectionTitleStyle, fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', marginBottom: 20 }}>
              About {biz.businessName || 'Us'}
            </h2>
            {(generatedCopy?.aboutLayout || 'image') !== 'stats' ? (
              images.about
                ? <img src={images.about} alt="About" style={{ width: '100%', height: '360px', objectFit: 'cover', borderRadius: '4px', display: 'block', marginBottom: '24px' }} />
                : <div style={{ width: '100%', height: '360px', background: c.secondary, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.muted, fontSize: '0.85rem', marginBottom: '24px' }}>Upload a photo in Images tab</div>
            ) : (
              images.about && (
                <img src={images.about} alt="About" style={{ width: '100%', height: '360px', objectFit: 'cover', borderRadius: '4px', display: 'block', marginBottom: '24px' }} />
              )
            )}
            <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.85, marginBottom: 24 }}>
              {copy.aboutText || `Serving ${biz.city || 'the area'} with premium window tinting and paint protection film.`}
            </p>
            {biz.yearsInBusiness && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 3, height: 36, background: `linear-gradient(180deg, ${c.accent}, ${cCyan})`, borderRadius: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: font, fontSize: 26, fontWeight: 800, color: c.accent }}>{biz.yearsInBusiness}+</div>
                  <div style={{ fontSize: 12, color: c.muted, letterSpacing: 1 }}>Years in Business</div>
                </div>
              </div>
            )}
            {biz.awards && (
              <div style={{ background: panelBg, borderRadius: 8, padding: '16px 20px', marginBottom: 12, borderLeft: '3px solid #ffd700' }}>
                <div style={{ color: '#ffd700', fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>AWARDS</div>
                <p style={{ color: c.text, fontSize: 14, margin: 0 }}>{biz.awards}</p>
              </div>
            )}
            {specialtiesList.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ color: c.muted, fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>SPECIALTIES</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {specialtiesList.map((s, i) => (
                    <span key={i} style={{
                      border: `1px solid ${c.accent}33`, color: c.text,
                      padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                    }}>{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {biz.hours && Object.keys(biz.hours).length > 0 && (
              <div style={{ background: panelBg, padding: '28px 24px', borderRadius: 10, border: `1px solid ${c.accent}18` }}>
                <div style={{ color: cCyan, fontWeight: 700, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 18, fontFamily: font }}>// SHOP HOURS</div>
                {Object.entries(biz.hours).map(([day, hrs], i, arr) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between',
                    borderBottom: i < arr.length - 1 ? `1px solid ${c.accent}12` : 'none',
                    paddingBottom: 10, marginBottom: 10,
                  }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: c.text }}>{day}</span>
                    <span style={{ color: cCyan, fontWeight: 700, fontSize: 13 }}>{hrs}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ background: panelBg, padding: '24px', borderRadius: 10, border: `1px solid ${c.accent}18` }}>
              <div style={{ color: c.accent, fontWeight: 700, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16, fontFamily: font }}>// CONTACT</div>
              {biz.phone && (
                <a href={`tel:${biz.phone}`} style={{ display: 'block', color: c.text, textDecoration: 'none', fontSize: 18, fontWeight: 700, fontFamily: font, marginBottom: 8 }}>{biz.phone}</a>
              )}
              {biz.address && (
                <div style={{ color: c.muted, fontSize: 13, lineHeight: 1.6 }}>
                  {biz.address}{biz.city ? `, ${biz.city}` : ''}{biz.state ? `, ${biz.state}` : ''}
                </div>
              )}
            </div>
            <div style={{ background: panelBg, padding: '20px 24px', borderRadius: 10, border: `1px solid ${c.accent}18` }}>
                <div style={{ color: c.accent, fontWeight: 700, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, fontFamily: font }}>// FOLLOW</div>
                <SocialRow biz={biz} color={cCyan} size={20} images={images} />
              </div>
          </div>
        </div>
      </section>

      {/* GALLERY */}
      <GallerySection images={images} colors={c} font={templateMeta.font} bodyFont={bodyFont} />

      {/* ============================================================ TESTIMONIALS ============================================================ */}
      {testimonials.length > 0 && (
        <section style={{ padding: '100px 5%', background: panelBg, borderTop: `1px solid ${c.accent}1a` }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <div style={{ ...labelTagStyle, justifyContent: 'center' }}>
                <span style={{ width: 24, height: 1, background: c.accent, flexShrink: 0 }} />
                Client Feedback
                <span style={{ width: 24, height: 1, background: c.accent, flexShrink: 0 }} />
              </div>
              <h2 style={sectionTitleStyle}>
                They see <span style={{ color: cCyan }}>clearly.</span>
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
              {testimonials.map((t, i) => {
                const initials = t.name
                  ? t.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                  : '??';
                return (
                  <div key={i} style={{
                    background: c.bg, border: `1px solid ${c.accent}1e`,
                    borderRadius: 12, padding: '30px 26px', position: 'relative', overflow: 'hidden',
                    boxShadow: `0 4px 24px ${c.accent}08`,
                  }}>
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                      background: `linear-gradient(90deg, transparent, ${c.accent}50, transparent)`,
                    }} />
                    <div style={{ color: c.accent, marginBottom: 14, fontSize: 13, letterSpacing: 2 }}>★★★★★</div>
                    <p style={{ color: c.text, fontSize: 15, lineHeight: 1.75, fontStyle: 'italic', margin: '0 0 20px', opacity: 0.9 }}>"{t.text}"</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%',
                        background: `linear-gradient(135deg, ${c.accent}44, ${cCyan}30)`,
                        border: `1px solid ${c.accent}44`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: font, fontSize: 12, fontWeight: 800, color: c.text, flexShrink: 0,
                      }}>{initials}</div>
                      <div>
                        <div style={{ color: c.text, fontWeight: 700, fontSize: 13 }}>{t.name}</div>
                        {t.vehicle && <div style={{ color: c.muted, fontSize: 11, marginTop: 2 }}>{t.vehicle}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ============================================================ CTA BAND ============================================================ */}
      <section style={{ padding: '90px 5%', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 700, height: 450,
          background: `radial-gradient(ellipse, ${c.accent}16 0%, transparent 70%)`, pointerEvents: 'none',
        }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${c.accent}40, transparent)` }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${cCyan}30, transparent)` }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 700, margin: '0 auto' }}>
          <div style={{ ...labelTagStyle, justifyContent: 'center', marginBottom: 20 }}>
            <span style={{ width: 24, height: 1, background: cCyan, flexShrink: 0 }} />
            Ready When You Are
            <span style={{ width: 24, height: 1, background: cCyan, flexShrink: 0 }} />
          </div>
          <h2 style={{ ...sectionTitleStyle, marginBottom: 16, fontSize: 'clamp(2rem, 4vw, 3.2rem)' }}>Book Your Install</h2>
          <p style={{ color: c.muted, fontSize: 16, marginBottom: 12, lineHeight: 1.6 }}>
            {copy.ctaSecondary || `Serving ${biz.city || 'your area'}${biz.state ? `, ${biz.state}` : ''} and surrounding areas. Call or stop by for a free consultation.`}
          </p>
          {biz.hours && (
            <p style={{ color: c.muted, fontSize: '0.9rem', marginBottom: 40 }}>
              {formatHours(biz.hours)}
            </p>
          )}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href={`tel:${biz.phone}`} style={{
              background: `linear-gradient(135deg, ${c.accent}, #a855f7)`,
              color: '#fff', padding: '16px 46px', borderRadius: 8, fontWeight: 700, fontSize: 16, textDecoration: 'none',
              boxShadow: `0 4px 36px ${c.accent}55`,
              fontFamily: font, letterSpacing: 0.3,
            }}>
              {biz.phone || 'Call Now'}
            </a>
            {biz.address && (
              <div style={{
                border: `1px solid ${c.accent}33`, color: c.muted,
                padding: '15px 24px', borderRadius: 8, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                📍 {biz.address}{biz.city ? `, ${biz.city}` : ''}{biz.state ? `, ${biz.state}` : ''}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============================================================ FOOTER ============================================================ */}
      <footer style={{ background: '#030305', padding: '60px 5% 28px', borderTop: `1px solid ${c.accent}18` }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40, marginBottom: 48 }}>
            {/* Brand */}
            <div>
              {/* Footer logo */}
              {images.logo ? (
                <img src={images.logo} alt={biz.businessName} style={{ height: 48, maxWidth: 180, objectFit: 'contain', marginBottom: '0.75rem', display: 'block' }} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 5,
                    background: `linear-gradient(135deg, ${c.accent}, ${cCyan})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <div style={{ width: 11, height: 11, background: 'rgba(255,255,255,0.9)', clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', borderRadius: 1 }} />
                  </div>
                  <div style={{ fontFamily: font, fontWeight: 800, fontSize: 14, color: c.text }}>{biz.businessName || 'Tint Studio'}</div>
                </div>
              )}
              <p style={{ color: '#2e2e3a', fontSize: 13, lineHeight: 1.7 }}>
                {copy.footerTagline || biz.tagline || `Premium window film installation. Serving ${biz.city || 'your city'}.`}
              </p>
            </div>
            {/* Services */}
            <div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 10, letterSpacing: 3, color: '#2e2e3a', textTransform: 'uppercase', marginBottom: 14 }}>// Services</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(services.length > 0 ? services.slice(0, 5) : (biz.services || []).slice(0, 5)).map((svc, i) => (
                  <a key={i} href="#services" style={{ color: '#3a3a4e', fontSize: 13, textDecoration: 'none' }}>
                    {typeof svc === 'object' ? svc.name : svc}
                  </a>
                ))}
              </div>
            </div>
            {/* Studio */}
            <div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 10, letterSpacing: 3, color: '#2e2e3a', textTransform: 'uppercase', marginBottom: 14 }}>// Studio</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[['#shades', 'Shade Guide'], ['#films', 'Film Technology'], ['#process', 'Our Process'], ['#about', 'About Us']].map(([href, label]) => (
                  <a key={href} href={href} style={{ color: '#3a3a4e', fontSize: 13, textDecoration: 'none' }}>{label}</a>
                ))}
              </div>
            </div>
            {/* Connect */}
            <div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 10, letterSpacing: 3, color: '#2e2e3a', textTransform: 'uppercase', marginBottom: 14 }}>// Connect</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {biz.phone && (
                  <a href={`tel:${biz.phone}`} style={{ color: c.accent, fontSize: 14, textDecoration: 'none', fontWeight: 700 }}>{biz.phone}</a>
                )}
                {biz.address && <div style={{ color: '#3a3a4e', fontSize: 13 }}>{biz.address}</div>}
                {biz.city && biz.state && <div style={{ color: '#3a3a4e', fontSize: 13 }}>{biz.city}, {biz.state}</div>}
                <SocialRow biz={biz} color={cCyan} size={20} images={images} />
              </div>
            </div>
          </div>
          <div style={{
            borderTop: `1px solid ${c.accent}10`, paddingTop: 22,
            display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          }}>
            <p style={{ color: '#252530', fontSize: 12 }}>
              &copy; {new Date().getFullYear()} {biz.businessName || 'Tint Studio'}{biz.city ? ` · ${biz.city}` : ''}{biz.state ? `, ${biz.state}` : ''} · All rights reserved
            </p>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#1e1e28', letterSpacing: 2 }}>// see less. look more.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
