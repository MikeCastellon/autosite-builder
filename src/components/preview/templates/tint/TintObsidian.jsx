import { useState, useEffect } from 'react';
import { SocialRow } from '../SocialIcons.jsx';
import { formatHours } from '../../../../lib/formatHours.js';
import { HeroImage, AboutImage, GallerySection } from '../ImageLayers.jsx';
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import GoogleReviewsWidget from '../GoogleReviewsWidget.jsx';
import { getFallbacks } from '../../../../lib/templateFallbacks.js';

// Template: Obsidian Studio -- Ultra-dark void (#050507 bg, #7C3AED accent, #06B6D4 cyan)
// Syne + Outfit fonts, process steps, testimonials, gallery

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
  const fb           = getFallbacks(biz.businessType);
  const copy         = generatedCopy || {};
  const splitHero    = copy?.heroLayout === 'split';
  const services     = copy.servicesSection?.items || [];
  const svcCols = services.length >= 6 ? Math.ceil(services.length / 2) : services.length || 1;
  const testimonials = copy.testimonialPlaceholders || [];
  const packages     = biz.packages || [];

  const specialtiesList = biz.specialties
    ? (Array.isArray(biz.specialties)
        ? biz.specialties
        : biz.specialties.split(/,|·/).map(s => s.trim()).filter(Boolean))
    : [];

  const processSteps = [
    { num: '// 01', icon: '📋', title: 'Consultation',     body: 'We start with a conversation to understand your goals, inspect your vehicle, and recommend the right solution for your needs and budget.' },
    { num: '// 02', icon: '🧽', title: 'Surface Prep',     body: 'Your vehicle is meticulously prepared in our controlled bay. A clean, dust-free environment is the foundation for flawless work.' },
    { num: '// 03', icon: '✂️',  title: 'Precision Work',   body: 'Computerized templates and expert hands ensure perfect fitment every time. No shortcuts, no compromise on quality.' },
    { num: '// 04', icon: '🔬', title: 'Final Inspection', body: 'Every detail is checked under studio lighting before we hand the keys back. We do not release a vehicle until it is perfect.' },
  ];

  const hidden = (id) => copy?.hiddenSections?.includes(id);
  const getOrder = buildSectionOrder(copy, ['hero','services','process','about','gallery','testimonials','cta']);

  const panelBg = c.secondary || '#0d0d12';

  const labelTagStyle = {
    fontFamily: font, fontSize: 10, letterSpacing: 4, color: c.accent,
    textTransform: 'uppercase', marginBottom: 16,
    display: 'flex', alignItems: 'center', gap: 12,
  };

  const sectionTitleStyle = {
    fontFamily: font, fontSize: 'clamp(2.2rem, 4cqi, 3.6rem)', fontWeight: 800,
    lineHeight: 1.05, letterSpacing: -1, color: c.text, margin: 0,
  };

  return (

    <div style={{ fontFamily: bodyFont, background: c.bg, color: c.text, minHeight: '100vh', overflowX: 'clip', margin: 0, padding: 0, WebkitFontSmoothing: 'antialiased', containerType: 'inline-size', display: 'flex', flexDirection: 'column' }}>
      <style>{`@container(max-width:600px){.tp-nav-links a[href^="#"]{display:none!important}.tp-nav-links{gap:12px!important}.tp-2col{grid-template-columns:1fr!important}.tp-3col{grid-template-columns:1fr!important}.tp-obsidian-name{font-size:14px!important;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tp-obsidian-sub{display:none!important}.tp-obsidian-orb{width:26px!important;height:26px!important}.tp-obsidian-cta{font-size:11px!important;padding:7px 14px!important}}`}</style>

      {/* ============================================================ NAV ============================================================ */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 1000,
        background: scrolled ? 'rgba(5,5,7,0.96)' : 'transparent',
        borderBottom: scrolled ? `1px solid ${c.accent}30` : '1px solid transparent',
        transition: 'all 0.35s ease', padding: '0 5%',
        backdropFilter: scrolled ? 'blur(18px)' : 'none',
      
        order: -1,
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 70 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '0 1 auto' }}>
            <div className="tp-obsidian-orb" style={{
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
              <div style={{ minWidth: 0 }}>
                <div className="tp-obsidian-name" style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: c.text, letterSpacing: -0.5, lineHeight: 1 }}>{biz.businessName || fb.shopName}</div>
                <div className="tp-obsidian-sub" style={{ fontSize: 10, color: cCyan, letterSpacing: 3, textTransform: 'uppercase', marginTop: 2 }}>{biz.city || 'Studio'}</div>
              </div>
            )}
          </div>
          <div className="tp-nav-links" style={{ display: 'flex', gap: 32, alignItems: 'center', flexShrink: 0 }}>
            {[['#services', 'Services'], ['#process', 'Process'], ['#about', 'About']].map(([href, label]) => (
              <a key={href} href={href} style={{ color: c.text, textDecoration: 'none', fontWeight: 500, fontSize: 13, opacity: 0.55 }}>{label}</a>
            ))}
            <a href={`tel:${biz.phone}`} className="tp-obsidian-cta" style={{
              background: `linear-gradient(135deg, ${c.accent}, ${cCyan})`,
              color: '#fff', padding: '10px 22px', borderRadius: 6, fontWeight: 700, fontSize: 13, textDecoration: 'none',
              boxShadow: `0 0 24px ${c.accent}44`, whiteSpace: 'nowrap',
            }}>
              {biz.phone ? 'Call Now' : 'Get a Quote'}
            </a>
          </div>
        </div>
      </nav>

      {/* ============================================================ HERO ============================================================ */}
      {!hidden('hero') && (
      <header style={splitHero ? { display: 'flex', flexDirection: 'row', minHeight: '85vh' , order: getOrder('hero') } : { minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center', background: c.bg, overflow: 'hidden' , order: getOrder('hero') }}>
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
          padding: 'clamp(3rem,6cqi,6rem)', background: c.bg,
        } : { position: 'relative', zIndex: 1, padding: '8rem 5% 5rem', maxWidth: 1000, margin: '0 auto', textAlign: 'center', width: '100%' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            border: `1px solid ${cCyan}44`, borderRadius: 30,
            padding: '6px 18px', marginBottom: 32,
            fontSize: 11, color: cCyan, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: cCyan, display: 'inline-block', boxShadow: `0 0 8px ${cCyan}` }} />
            {biz.city && biz.state ? `${biz.city}, ${biz.state}` : fb.heroBadge}
          </div>
          <h1 style={{
            fontFamily: font, fontSize: 'clamp(1.8rem, 4.5cqi, 3.6rem)', fontWeight: 600,
            lineHeight: 1.15, letterSpacing: 0, margin: '0 0 24px', color: c.text,
          }}>
            {copy.headline || fb.headline || 'Precision. Zero Compromise.'}
          </h1>
          <p style={{
            fontSize: 'clamp(15px, 2cqi, 18px)', lineHeight: 1.75, maxWidth: 600, margin: '0 auto 44px',
            background: `linear-gradient(180deg, ${c.text} 0%, rgba(255,255,255,0.5) 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            {copy.subheadline || biz.tagline || fb.subheadline}
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 64 }}>
            <a href={`tel:${biz.phone}`} style={{
              background: `linear-gradient(135deg, ${c.accent}, #a855f7)`,
              color: '#fff', padding: '15px 38px', borderRadius: 8, fontWeight: 700, fontSize: 15, textDecoration: 'none',
              boxShadow: `0 4px 32px ${c.accent}55`,
            }}>
              {copy.ctaPrimary || fb.ctaHeadline || 'Get a Quote'}
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
      )}


      {/* ============================================================ SERVICES ============================================================ */}
      {!hidden('services') && (
      <section id="services" style={{ padding: '100px 5%' , order: getOrder('services') }}>
        <div style={{ maxWidth: 1280, margin: '0 auto'  }}>
          <div style={{ marginBottom: 64 }}>
            <div style={labelTagStyle}>
              <span style={{ width: 24, height: 1, background: c.accent, flexShrink: 0 }} />
              What We Do
            </div>
            <h2 style={sectionTitleStyle}>
              Our <span style={{ color: '#a855f7' }}>services.</span>
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
            <div className="tp-3col" style={{ display: 'grid', gridTemplateColumns: `repeat(${svcCols}, minmax(0, 1fr))`, gap: 16 }}>
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
      )}

      {/* ============================================================ PROCESS ============================================================ */}
      {!hidden('process') && (
      <section id="process" style={{ padding: '100px 5%', background: panelBg, borderTop: `1px solid ${c.accent}1a` , order: getOrder('process') }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ marginBottom: 72 }}>
            <div style={labelTagStyle}>
              <span style={{ width: 24, height: 1, background: c.accent, flexShrink: 0 }} />
              Our Process
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
      )}

      {/* ============================================================ ABOUT ============================================================ */}
      {!hidden('about') && (
      <section id="about" style={{ padding: '100px 5%', borderTop: `1px solid ${c.accent}1a` , order: getOrder('about') }}>
        <div className="tp-2col" style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
          {/* Left: image or stats box */}
          <div>
            {(copy?.aboutLayout || 'image') !== 'stats' ? (
              images.about
                ? <img src={images.about} alt="About" style={{ width: '100%', maxWidth: 520, height: 400, objectFit: 'cover', borderRadius: 10, display: 'block' }} />
                : <div style={{ width: '100%', maxWidth: 520, height: 400, background: panelBg, borderRadius: 10, border: `1px solid ${c.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.muted, fontSize: '0.85rem', textAlign: 'center', padding: 24, boxSizing: 'border-box' }}>Upload an about photo in the Images tab</div>
            ) : (
              <div style={{ width: '100%', maxWidth: 520, background: panelBg, padding: '48px 36px', boxSizing: 'border-box', borderRadius: 10, border: `1px solid ${c.accent}18` }}>
                {(() => {
                  const defaultStats = [
                    { value: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '10+', label: 'Years of Excellence' },
                    { value: '5,000+', label: fb.statLabel },
                    { value: '5★', label: 'Customer Rating' },
                  ];
                  const aboutStats = (copy?.aboutStats || []).map((s, i) => ({
                    value: s.value || defaultStats[i]?.value || '',
                    label: s.label || defaultStats[i]?.label || '',
                  }));
                  if (aboutStats.length === 0) aboutStats.push(...defaultStats);
                  return aboutStats.map((st, i) => (
                    <div key={i} style={{ textAlign: 'center', marginBottom: i < aboutStats.length - 1 ? 32 : 0 }}>
                      <div style={{ fontFamily: font, fontSize: '3rem', fontWeight: 800, color: c.accent, lineHeight: 1 }}>{st.value}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, color: c.muted, marginTop: 8, textTransform: 'uppercase' }}>{st.label}</div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
          {/* Right: text + awards */}
          <div>
            <div style={{ ...labelTagStyle, color: cCyan }}>
              <span style={{ width: 24, height: 1, background: cCyan, flexShrink: 0 }} />
              About the Studio
            </div>
            <h2 style={{ ...sectionTitleStyle, fontSize: 'clamp(1.8rem, 3cqi, 2.6rem)', marginBottom: 20 }}>
              About {biz.businessName || 'Us'}
            </h2>
            <p style={{ color: c.muted, fontSize: 15, lineHeight: 1.85, marginBottom: 24 }}>
              {copy.aboutText || `Serving ${biz.city || 'the area'} with ${fb.aboutFallback}.`}
            </p>
            {biz.awards && (
              <div style={{ background: panelBg, borderRadius: 8, padding: '16px 20px', marginBottom: 16, borderLeft: '3px solid #ffd700' }}>
                <div style={{ color: '#ffd700', fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>AWARDS</div>
                <p style={{ color: c.text, fontSize: 14, margin: 0 }}>{biz.awards}</p>
              </div>
            )}
            {specialtiesList.length > 0 && (
              <div style={{ marginTop: 16 }}>
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
        </div>
      </section>
      )}
      {/* GALLERY */}
      {!hidden('gallery') && (
      <div style={{ order: getOrder('gallery') }}>
      <GallerySection images={images} colors={c} font={templateMeta.font} bodyFont={bodyFont} />
      </div>
      )}

      {/* ============================================================ TESTIMONIALS ============================================================ */}
      {!hidden('testimonials') && (
        copy?.googleWidgetKey ? (
          <div style={{ order: getOrder('testimonials'), padding: '80px 5%' }}>
            {copy.googleReviewsTitle && <h2 style={{ fontFamily: font || 'inherit', fontSize: 'clamp(1.8rem, 3cqi, 2.5rem)', fontWeight: 800, textAlign: 'center', marginBottom: 32, color: c.text }}>{copy.googleReviewsTitle}</h2>}
            <GoogleReviewsWidget widgetKey={copy.googleWidgetKey} theme={copy?.googleReviewsTheme} />
          </div>
        ) : testimonials.length > 0 ? (
        <section style={{ padding: '100px 5%', background: panelBg, borderTop: `1px solid ${c.accent}1a` , order: getOrder('testimonials') }}>
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
        ) : null
      )}

      {/* ============================================================ CTA BAND ============================================================ */}
      {!hidden('cta') && (
      <section style={{ padding: '90px 5%', textAlign: 'center', position: 'relative', overflow: 'hidden' , order: getOrder('cta') }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 700, height: 450,
          background: `radial-gradient(ellipse, ${c.accent}16 0%, transparent 70%)`, pointerEvents: 'none',
        }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${c.accent}40, transparent)` }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${cCyan}30, transparent)` }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 700, margin: '0 auto'  }}>
          <div style={{ ...labelTagStyle, justifyContent: 'center', marginBottom: 20 }}>
            <span style={{ width: 24, height: 1, background: cCyan, flexShrink: 0 }} />
            Ready When You Are
            <span style={{ width: 24, height: 1, background: cCyan, flexShrink: 0 }} />
          </div>
          <h2 style={{ ...sectionTitleStyle, marginBottom: 16, fontSize: 'clamp(2rem, 4cqi, 3.2rem)' }}>{copy.ctaHeadline || fb.ctaHeadline || 'Get in Touch'}</h2>
          <p style={{ color: c.muted, fontSize: 16, marginBottom: 12, lineHeight: 1.6 }}>
            {copy.ctaSubtext || copy.ctaSecondary || `Serving ${biz.city || 'your area'}${biz.state ? `, ${biz.state}` : ''} and surrounding areas. Call or stop by for a free consultation.`}
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
              {copy.ctaButtonText || biz.phone || 'Call Now'}
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
      )}

      {/* ============================================================ FOOTER ============================================================ */}
      <footer style={{ background: '#030305', padding: '60px 5% 28px', borderTop: `1px solid ${c.accent}18`, order: 9999 }}>
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
                  <div style={{ fontFamily: font, fontWeight: 800, fontSize: 14, color: c.text }}>{biz.businessName || fb.shopName}</div>
                </div>
              )}
              <p style={{ color: '#2e2e3a', fontSize: 13, lineHeight: 1.7 }}>
                {copy.footerTagline || biz.tagline || fb.footerDesc || `Professional service. Serving ${biz.city || 'your city'}.`}
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
                {[['#services', 'Services'], ['#process', 'Our Process'], ['#about', 'About Us'], ['#testimonials', 'Reviews']].map(([href, label]) => (
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
              &copy; {new Date().getFullYear()} {biz.businessName || fb.shopName}{biz.city ? ` · ${biz.city}` : ''}{biz.state ? `, ${biz.state}` : ''} · All rights reserved
            </p>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#1e1e28', letterSpacing: 2 }}>// see less. look more.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
