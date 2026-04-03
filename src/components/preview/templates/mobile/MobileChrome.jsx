import { useState, useEffect } from 'react';
import { SocialRow } from '../SocialIcons.jsx';
import { formatHours } from '../../../../lib/formatHours.js';
import { HeroImage, AboutImage, GallerySection } from '../ImageLayers.jsx';
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import GoogleReviewsWidget from '../GoogleReviewsWidget.jsx';
import { getFallbacks } from '../../../../lib/templateFallbacks.js';

export default function MobileChrome({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const hidden = (id) => generatedCopy?.hiddenSections?.includes(id);
  const getOrder = buildSectionOrder(generatedCopy, ['hero','statsBar','services','about','gallery','testimonials','cta']);

  const fb = getFallbacks(businessInfo.businessType);
  const c = templateMeta.colors;
  const font = templateMeta.font;
  const bodyFont = templateMeta.bodyFont;
  const splitHero = generatedCopy?.heroLayout === 'split';

  // Chrome shimmer gradient
  const chromeGradient = `linear-gradient(135deg, #94a3b8 0%, #cbd5e1 30%, #94a3b8 50%, #64748b 70%, #94a3b8 100%)`;

  const defaultStats = [
    { value: businessInfo.yearsInBusiness ? `${businessInfo.yearsInBusiness}+` : '10+', label: 'Years Experience' },
    { value: '1,000+', label: fb.statLabel },
    { value: '100%', label: 'Satisfaction Rate' },
  ];
  const stats = (generatedCopy?.aboutStats || []).map((s, i) => ({
    value: s.value || defaultStats[i]?.value || '',
    label: s.label || defaultStats[i]?.label || '',
  }));
  if (stats.length === 0) stats.push(...defaultStats);

  const _svcItems = generatedCopy.servicesSection.items;
  const svcCols = _svcItems.length >= 6 ? Math.ceil(_svcItems.length / 2) : _svcItems.length || 1;

  const navStyle = {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: scrolled ? 'rgba(10,10,10,0.97)' : 'transparent',
    backdropFilter: scrolled ? 'blur(20px)' : 'none',
    borderBottom: scrolled ? '1px solid rgba(148,163,184,0.2)' : '1px solid transparent',
    transition: 'all 0.4s ease',
    fontFamily: bodyFont,
  };

  // Chrome line dividers for hero (thin 1px horizontal lines)
  const chromeLine = (top, opacity = 0.12) => ({
    position: 'absolute',
    left: 0,
    right: 0,
    top,
    height: '1px',
    background: `linear-gradient(90deg, transparent 0%, rgba(148,163,184,${opacity}) 20%, rgba(203,213,225,${opacity * 1.5}) 50%, rgba(148,163,184,${opacity}) 80%, transparent 100%)`,
    pointerEvents: 'none',
  });

  const heroStyle = {
    minHeight: '100vh',
    background: c.bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  };

  const heroGlowStyle = {
    position: 'absolute',
    top: '30%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '600px',
    height: '600px',
    background: 'radial-gradient(ellipse, rgba(148,163,184,0.04) 0%, transparent 70%)',
    pointerEvents: 'none',
  };

  const sectionStyle = (bg) => ({
    padding: '88px 24px',
    background: bg || c.bg,
    fontFamily: bodyFont,
    position: 'relative',
  });

  const cardStyle = {
    background: c.secondary,
    border: '1px solid rgba(148,163,184,0.12)',
    borderRadius: '2px',
    padding: '36px 28px',
    flex: '1 1 260px',
    maxWidth: '360px',
    position: 'relative',
    overflow: 'hidden',
    transition: 'border-color 0.2s ease',
  };

  const cardAccentTop = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '1px',
    background: chromeGradient,
  };

  const accentBtnStyle = {
    display: 'inline-block',
    background: chromeGradient,
    color: '#000000',
    padding: '14px 36px',
    borderRadius: '1px',
    fontWeight: 700,
    fontSize: '0.9rem',
    textDecoration: 'none',
    fontFamily: font,
    cursor: 'pointer',
    border: 'none',
    letterSpacing: '2px',
    textTransform: 'uppercase',
  };

  const outlineBtnStyle = {
    display: 'inline-block',
    background: 'transparent',
    color: c.accent,
    padding: '14px 36px',
    borderRadius: '1px',
    fontWeight: 700,
    fontSize: '0.9rem',
    textDecoration: 'none',
    fontFamily: font,
    cursor: 'pointer',
    border: `1px solid rgba(148,163,184,0.5)`,
    letterSpacing: '2px',
    textTransform: 'uppercase',
  };

  const pricingTierStyle = (featured) => ({
    background: featured ? c.secondary : 'transparent',
    border: featured ? `1px solid rgba(148,163,184,0.35)` : `1px solid rgba(148,163,184,0.1)`,
    borderRadius: '2px',
    padding: '40px 32px',
    flex: '1 1 240px',
    maxWidth: '320px',
    position: 'relative',
    overflow: 'hidden',
    textAlign: 'center',
  });

  return (
    <div style={{ background: c.bg, color: c.text, fontFamily: bodyFont, containerType: 'inline-size', display: 'flex', flexDirection: 'column' }}>
      <style>{`@container(max-width:600px){.tp-nav-links a[href^="#"]{display:none!important}.tp-nav-links{gap:12px!important}.tp-2col{grid-template-columns:1fr!important}}`}</style>
      {/* NAV */}
      <nav style={{ ...navStyle, order: -1 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '72px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '28px', height: '28px', background: chromeGradient, borderRadius: '50%' }} />
            {images.logo ? (
              <img src={images.logo} alt={businessInfo.businessName || 'Logo'} style={{ height: 36, objectFit: 'contain' }} />
            ) : (
              <div style={{ fontFamily: font, fontWeight: 700, fontSize: '1.1rem', color: '#ffffff', letterSpacing: '3px', textTransform: 'uppercase' }}>
                {businessInfo.businessName}
              </div>
            )}
          </div>
          <div className="tp-nav-links" style={{ display: 'flex', gap: '36px', alignItems: 'center' }}>
            {['Services', 'Packages', 'About', 'Contact'].map(link => (
              <a key={link} href={`#${link.toLowerCase()}`} style={{ color: c.muted, textDecoration: 'none', fontWeight: 400, fontSize: '0.82rem', letterSpacing: '2px', textTransform: 'uppercase', transition: 'color 0.2s' }}>{link}</a>
            ))}
            <a href={`tel:${businessInfo.phone}`} style={accentBtnStyle}>{businessInfo.phone}</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      {!hidden('hero') && (
      <section style={splitHero ? { display: 'flex', flexDirection: 'row', minHeight: '85vh', order: getOrder('hero') } : { ...heroStyle, order: getOrder('hero') }}>
        {!splitHero && <HeroImage src={images.hero} />}
        {!splitHero && <div style={heroGlowStyle} />}
        {!splitHero && [15, 25, 75, 85].map((top, i) => (
          <div key={i} style={chromeLine(`${top}%`, i % 2 === 0 ? 0.1 : 0.06)} />
        ))}
        {!splitHero && <div style={{ position: 'absolute', left: '8%', top: 0, bottom: 0, width: '1px', background: 'linear-gradient(180deg, transparent 0%, rgba(148,163,184,0.08) 30%, rgba(148,163,184,0.08) 70%, transparent 100%)' }} />}
        {!splitHero && <div style={{ position: 'absolute', right: '8%', top: 0, bottom: 0, width: '1px', background: 'linear-gradient(180deg, transparent 0%, rgba(148,163,184,0.08) 30%, rgba(148,163,184,0.08) 70%, transparent 100%)' }} />}

        <div style={splitHero ? {
          flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: 'clamp(3rem,6vw,6rem)', background: c.bg,
        } : { textAlign: 'center', maxWidth: '800px', padding: '140px 24px 100px', position: 'relative', zIndex: 1 }}>
          {/* Elite badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', border: '1px solid rgba(148,163,184,0.25)', borderRadius: '1px', padding: '10px 24px', marginBottom: '36px', alignSelf: splitHero ? 'flex-start' : undefined }}>
            <div style={{ width: '6px', height: '6px', background: chromeGradient, borderRadius: '50%' }} />
            <span style={{ fontFamily: font, fontSize: '0.72rem', fontWeight: 600, letterSpacing: '4px', textTransform: 'uppercase', background: chromeGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {fb.heroBadge}
            </span>
            <div style={{ width: '6px', height: '6px', background: chromeGradient, borderRadius: '50%' }} />
          </div>
          <h1 style={{ fontFamily: font, fontSize: 'clamp(2.4rem, 5vw, 4rem)', fontWeight: 300, color: c.text, lineHeight: 1.15, marginBottom: '24px', letterSpacing: '-1px', textAlign: splitHero ? 'left' : 'center' }}>
            {generatedCopy.headline}
          </h1>
          <div style={{ width: '80px', height: '1px', background: chromeGradient, margin: splitHero ? '0 0 28px' : '0 auto 28px' }} />
          <p style={{ fontSize: '1.05rem', color: c.muted, marginBottom: '48px', lineHeight: 1.8, maxWidth: '560px', margin: splitHero ? '0 0 48px' : '0 auto 48px', fontWeight: 300, letterSpacing: '0.3px' }}>
            {generatedCopy.subheadline}
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: splitHero ? 'flex-start' : 'center', flexWrap: 'wrap' }}>
            <a href={generatedCopy?.ctaPrimaryUrl || '#services'} style={{ ...accentBtnStyle, textDecoration: 'none' }}>{generatedCopy.ctaPrimary}</a>
            <a href={generatedCopy?.ctaSecondaryUrl || ('tel:' + (businessInfo.phone || ''))} style={{ ...outlineBtnStyle, textDecoration: 'none' }}>{generatedCopy.ctaSecondary}</a>
          </div>
          {businessInfo.tagline && (
            <p style={{ marginTop: '36px', color: 'rgba(148,163,184,0.5)', fontSize: '0.82rem', letterSpacing: '2px', textTransform: 'uppercase' }}>{businessInfo.tagline}</p>
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
      </section>
      )}

      {/* STATS BAR */}
      {!hidden('statsBar') && (
      <section style={{ background: c.secondary, borderTop: '1px solid rgba(148,163,184,0.1)', borderBottom: '1px solid rgba(148,163,184,0.1)', padding: '44px 24px', fontFamily: bodyFont , order: getOrder('statsBar') }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '24px'  }}>
          {stats.map((s, i) => (
            <div key={i} style={{ textAlign: 'center', position: 'relative' }}>
              {i < stats.length - 1 && <div style={{ position: 'absolute', right: '-40px', top: '20%', bottom: '20%', width: '1px', background: 'rgba(148,163,184,0.15)' }} />}
              <div style={{ fontFamily: font, fontSize: '2rem', fontWeight: 300, background: chromeGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', color: c.muted, letterSpacing: '2.5px', textTransform: 'uppercase', marginTop: '6px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* SERVICES */}
      {!hidden('services') && (
      <section id="services" style={{ ...sectionStyle(), order: getOrder('services') }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(148,163,184,0.08), transparent)' }} />
        <div style={{ maxWidth: '1200px', margin: '0 auto'  }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div style={{ display: 'inline-block', width: '40px', height: '1px', background: chromeGradient, marginBottom: '20px' }} />
            <h2 style={{ fontFamily: font, fontSize: '2.2rem', fontWeight: 300, color: c.text, marginBottom: '16px', letterSpacing: '-0.5px' }}>Our Services</h2>
            <p style={{ color: c.muted, maxWidth: '520px', margin: '0 auto', fontSize: '0.95rem', lineHeight: 1.8, fontWeight: 300 }}>{generatedCopy.servicesSection.intro}</p>
          </div>
          {businessInfo.packages?.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
              {businessInfo.packages.map((pkg, i) => (
                <div key={i} style={pricingTierStyle(i === 1)}>
                  {i === 1 && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: chromeGradient }} />}
                  {i === 1 && (
                    <div style={{ position: 'absolute', top: '16px', right: '16px', border: `1px solid rgba(148,163,184,0.4)`, color: c.muted, fontSize: '0.62rem', fontWeight: 600, padding: '3px 8px', letterSpacing: '2px', textTransform: 'uppercase' }}>FEATURED</div>
                  )}
                  <div style={{ fontFamily: font, fontSize: '0.72rem', letterSpacing: '3px', textTransform: 'uppercase', color: c.muted, marginBottom: '12px' }}>Package {String(i + 1).padStart(2, '0')}</div>
                  <div style={{ fontFamily: font, fontSize: '1.3rem', fontWeight: 500, color: c.text, marginBottom: '8px' }}>{pkg.name || pkg}</div>
                  {pkg.price && (
                    <div style={{ fontFamily: font, fontSize: '2rem', fontWeight: 300, background: chromeGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0.4rem 0 0.75rem' }}>{pkg.price}</div>
                  )}
                  {pkg.description && <p style={{ color: c.muted, fontSize: '0.85rem', lineHeight: 1.7, fontWeight: 300 }}>{pkg.description}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${svcCols}, 1fr)`, gap: '20px' }}>
              {generatedCopy.servicesSection.items.map((svc, i) => (
                <div key={i} style={cardStyle}>
                  <div style={cardAccentTop} />
                  <div style={{ fontFamily: font, fontSize: '0.68rem', letterSpacing: '3px', textTransform: 'uppercase', background: chromeGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '14px' }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <h3 style={{ fontFamily: font, fontSize: '1.05rem', fontWeight: 500, color: c.text, marginBottom: '12px', letterSpacing: '0.5px' }}>{svc.name}</h3>
                  <p style={{ color: c.muted, fontSize: '0.88rem', lineHeight: 1.7, fontWeight: 300 }}>{svc.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      )}

      {/* ABOUT */}
      {!hidden('about') && (
      <section id="about" style={{ ...sectionStyle(), order: getOrder('about') }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', gap: '80px', alignItems: 'center', flexWrap: 'wrap'  }}>
          <div style={{ flex: '1 1 300px', minWidth: '260px' }}>
            {(generatedCopy?.aboutLayout || 'image') !== 'stats' ? (
              images.about
                ? <img src={images.about} alt="About" style={{ width: '100%', height: '360px', objectFit: 'cover', borderRadius: '4px', display: 'block' }} />
                : <div style={{ width: '100%', maxWidth: '440px', height: '360px', background: c.secondary, border: '1px solid rgba(148,163,184,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.muted, fontSize: '0.85rem' }}>Upload a photo in Images tab</div>
            ) : (
              images.about ? (
                <img src={images.about} alt="About" style={{ width: '100%', height: '360px', objectFit: 'cover', borderRadius: '4px', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', maxWidth: '440px', height: '360px', background: c.secondary, border: '1px solid rgba(148,163,184,0.1)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: chromeGradient }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', background: chromeGradient }} />
                  {[...Array(6)].map((_, i) => (
                    <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${15 + i * 15}%`, height: '1px', background: `rgba(148,163,184,${0.04 - i * 0.004})` }} />
                  ))}
                  <span style={{ fontSize: '4rem', opacity: 0.4 }}>◈</span>
                </div>
              )
            )}
          </div>
          <div style={{ flex: '1 1 380px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ width: '24px', height: '1px', background: chromeGradient }} />
              <span style={{ fontSize: '0.72rem', letterSpacing: '3px', textTransform: 'uppercase', color: c.muted }}>About Us</span>
            </div>
            <h2 style={{ fontFamily: font, fontSize: '2rem', fontWeight: 300, color: c.text, marginBottom: '24px', lineHeight: 1.3, letterSpacing: '-0.5px' }}>
              Precision Detailing, Delivered to You
            </h2>
            <p style={{ color: c.muted, lineHeight: 1.85, fontSize: '0.95rem', marginBottom: '32px', fontWeight: 300 }}>{generatedCopy.aboutText}</p>
            {businessInfo.awards && businessInfo.awards.length > 0 && (
              <div>
                <div style={{ fontSize: '0.68rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'rgba(148,163,184,0.4)', marginBottom: '10px' }}>Recognition</div>
                {businessInfo.awards.map((award, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(148,163,184,0.06)', color: c.muted, fontSize: '0.88rem', fontWeight: 300 }}>
                    <div style={{ width: '4px', height: '4px', background: chromeGradient, borderRadius: '50%', flexShrink: 0 }} />
                    {award}
                  </div>
                ))}
              </div>
            )}
            {businessInfo.serviceArea && (
              <p style={{ marginTop: '20px', color: 'rgba(148,163,184,0.5)', fontSize: '0.82rem', letterSpacing: '1px' }}>
                Service Area: {businessInfo.serviceArea}
              </p>
            )}
          </div>
        </div>
      </section>
      )}

      {/* GALLERY */}
      {!hidden('gallery') && (
      <div style={{ order: getOrder('gallery') }}>
      <GallerySection images={images} colors={c} font={font} bodyFont={bodyFont} />
      </div>
      )}

      {/* TESTIMONIALS */}
      {!hidden('testimonials') && (
        generatedCopy?.googleWidgetKey ? (
          <div style={{ order: getOrder('testimonials'), padding: '80px 5%' }}>
            {generatedCopy.googleReviewsTitle && <h2 style={{ fontFamily: font || 'inherit', fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, textAlign: 'center', marginBottom: 32, color: c.text }}>{generatedCopy.googleReviewsTitle}</h2>}
            <GoogleReviewsWidget widgetKey={generatedCopy.googleWidgetKey} theme={generatedCopy?.googleReviewsTheme} />
          </div>
        ) : generatedCopy.testimonialPlaceholders?.length > 0 ? (
      <section style={{ ...sectionStyle(c.secondary), borderTop: '1px solid rgba(148,163,184,0.08)' , order: getOrder('testimonials') }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto'  }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 style={{ fontFamily: font, fontSize: '2.2rem', fontWeight: 300, color: c.text, letterSpacing: '-0.5px' }}>Client Testimonials</h2>
            <div style={{ width: '60px', height: '1px', background: chromeGradient, margin: '16px auto 0' }} />
          </div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {generatedCopy.testimonialPlaceholders.map((t, i) => (
              <div key={i} style={{ background: c.bg, border: '1px solid rgba(148,163,184,0.1)', padding: '32px', maxWidth: '360px', flex: '1 1 260px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: chromeGradient }} />
                <div style={{ fontSize: '0.75rem', letterSpacing: '3px', background: chromeGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '16px' }}>★ ★ ★ ★ ★</div>
                <p style={{ color: c.muted, fontSize: '0.92rem', lineHeight: 1.75, fontStyle: 'italic', marginBottom: '20px', fontWeight: 300 }}>"{t.text}"</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '24px', height: '1px', background: chromeGradient }} />
                  <span style={{ color: c.text, fontSize: '0.82rem', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 500 }}>{t.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
        ) : null
      )}

      {/* CONTACT / CTA */}
      {!hidden('cta') && (
      <section id="contact" style={{ ...sectionStyle(), borderTop: '1px solid rgba(148,163,184,0.08)', textAlign: 'center' , order: getOrder('cta') }}>
        <div style={{ maxWidth: '700px', margin: '0 auto'  }}>
          <div style={{ width: '1px', height: '60px', background: chromeGradient, margin: '0 auto 40px' }} />
          <h2 style={{ fontFamily: font, fontSize: '2.4rem', fontWeight: 300, color: c.text, marginBottom: '16px', letterSpacing: '-1px' }}>
            {generatedCopy.ctaHeadline || fb.ctaHeadline}
          </h2>
          <p style={{ color: c.muted, fontSize: '1rem', marginBottom: '48px', lineHeight: 1.8, fontWeight: 300 }}>
            {generatedCopy.ctaSubtext || (<>{businessInfo.phone && `Call us at ${businessInfo.phone}.`} {businessInfo.address && `We come to you in ${businessInfo.city}, ${businessInfo.state}.`}
            {businessInfo.hours && ` Available ${formatHours(businessInfo.hours)}.`}</>)}
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '32px' }}>
            <a href={`tel:${businessInfo.phone}`} style={accentBtnStyle}>Call Now</a>
            <a href={generatedCopy?.ctaUrl || (`tel:${businessInfo.phone}`)} style={{ ...outlineBtnStyle, textDecoration: 'none' }}>{generatedCopy.ctaButtonText || generatedCopy.ctaPrimary || 'Get a Quote'}</a>
          </div>
          {businessInfo.paymentMethods && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '24px' }}>
              <span style={{ color: 'rgba(148,163,184,0.35)', fontSize: '0.72rem', letterSpacing: '2px', textTransform: 'uppercase', marginRight: '8px', alignSelf: 'center' }}>We Accept:</span>
              {businessInfo.paymentMethods.map((pm, i) => (
                <span key={i} style={{ border: '1px solid rgba(148,163,184,0.15)', color: c.muted, padding: '5px 12px', fontSize: '0.75rem', letterSpacing: '0.5px' }}>{pm}</span>
              ))}
            </div>
          )}
          {businessInfo.warranty && (
            <p style={{ marginTop: '28px', color: 'rgba(148,163,184,0.4)', fontSize: '0.82rem', letterSpacing: '0.5px' }}>
              🛡️ {businessInfo.warranty}
            </p>
          )}
        </div>
      </section>
      )}

      {/* FOOTER */}
      <footer style={{ background: '#050505', borderTop: '1px solid rgba(148,163,184,0.08)', padding: '52px 24px', fontFamily: bodyFont , order: 9999 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '32px', marginBottom: '48px' }}>
            <div>
              {/* Footer logo */}
              {images.logo ? (
                <img src={images.logo} alt={businessInfo.businessName} style={{ height: 48, maxWidth: 180, objectFit: 'contain', marginBottom: '0.75rem', display: 'block' }} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ width: '20px', height: '20px', background: chromeGradient, borderRadius: '50%' }} />
                  <div style={{ fontFamily: font, fontSize: '1rem', fontWeight: 600, color: '#ffffff', letterSpacing: '3px', textTransform: 'uppercase' }}>{businessInfo.businessName}</div>
                </div>
              )}
              <p style={{ color: 'rgba(148,163,184,0.35)', fontSize: '0.85rem', maxWidth: '300px', lineHeight: 1.6, fontWeight: 300 }}>{generatedCopy.footerTagline}</p>
            </div>
            <SocialRow biz={businessInfo} color={c.accent} size={20} images={images} />
          </div>
          <div style={{ borderTop: '1px solid rgba(148,163,184,0.06)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <p style={{ color: 'rgba(148,163,184,0.2)', fontSize: '0.75rem', letterSpacing: '0.5px' }}>© {new Date().getFullYear()} {businessInfo.businessName}. All rights reserved.</p>
            <p style={{ color: 'rgba(148,163,184,0.2)', fontSize: '0.75rem' }}>{businessInfo.city}, {businessInfo.state}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
