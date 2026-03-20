import React, { useState, useEffect } from 'react';
import { SocialRow } from '../SocialIcons.jsx';
import { formatHours } from '../../../../lib/formatHours.js';
import { HeroImage, AboutImage, GallerySection } from '../ImageLayers.jsx';

export default function DetailingAutoSyncWhite({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const c = templateMeta.colors;
  const font = templateMeta.font;
  const bodyFont = templateMeta.bodyFont;
  const [scrolled, setScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&family=DM+Serif+Display:ital@0;1&display=swap';
    document.head.appendChild(link);
    return () => { if (document.head.contains(link)) document.head.removeChild(link); };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const white    = c.bg        || '#ffffff';
  const off      = c.secondary || '#f5f5f7';
  const blue     = c.accent    || '#0071E3';
  const text     = c.text      || '#1d1d1f';
  const text2    = '#424245';
  const text3    = c.muted     || '#6e6e73';
  const text4    = '#a1a1a6';
  const border   = 'rgba(0,0,0,0.08)';
  const border2  = 'rgba(0,0,0,0.12)';
  const radius   = '18px';
  const radiusSm = '12px';
  const shadowSm = '0 2px 12px rgba(0,0,0,0.06)';
  const shadowMd = '0 8px 40px rgba(0,0,0,0.10)';
  const dmSans   = "'DM Sans', " + (bodyFont || 'sans-serif');
  const dmSerif  = "'DM Serif Display', " + (font || 'serif');

  const services     = (generatedCopy && generatedCopy.servicesSection && generatedCopy.servicesSection.items) ? generatedCopy.servicesSection.items : [];
  const svcCols = services.length >= 6 ? Math.ceil(services.length / 2) : services.length || 1;
  const testimonials = (generatedCopy && generatedCopy.testimonialPlaceholders) ? generatedCopy.testimonialPlaceholders : [];

  const stats = [
    { num: '2K+',  label: 'Vehicles Detailed' },
    { num: businessInfo.yearsInBusiness ? businessInfo.yearsInBusiness + '+' : '8+', label: 'Years Experience' },
    { num: '100%', label: 'Satisfaction Rate' },
    { num: businessInfo.city || 'Local', label: 'Serving You' },
  ];

  const specialtyItems = Array.isArray(businessInfo.specialties)
    ? businessInfo.specialties
    : businessInfo.specialties ? [businessInfo.specialties] : ['Auto Auction', 'Fleet Programs', 'Aviation Detail'];

  const brandItems = ['Koch Chemie', 'CARPRO', 'Rupes', "Meguiar's", '3M', 'IGL Coatings'];
  const tileIcons  = ['✦', '◈', '⬡', '◉', '✧', '◆', '◎', '⬟'];

  const s = {
    wrapper: { background: white, color: text, fontFamily: dmSans, WebkitFontSmoothing: 'antialiased', overflowX: 'hidden' },
    nav: {
      position: 'sticky', top: 0, zIndex: 100, height: '52px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: isMobile ? '0 20px' : '0 48px',
      background: scrolled ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.82)',
      backdropFilter: 'saturate(180%) blur(20px)',
      WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      borderBottom: '1px solid ' + (scrolled ? border2 : border),
      transition: 'background 0.3s, border-color 0.3s',
    },
    navLogo: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '17px', fontWeight: 500, color: text, letterSpacing: '-0.3px', fontFamily: dmSans },
    logoRing: { width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg, #1d1d1f 0%, #6e6e73 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    logoRingInner: { width: '10px', height: '10px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.7)' },
    navCta: { background: blue, color: white, fontSize: '13px', fontWeight: 500, padding: '8px 20px', borderRadius: '980px', border: 'none', cursor: 'pointer', fontFamily: dmSans, letterSpacing: '-0.1px', display: isMobile ? 'none' : 'block' },
    hero: { paddingTop: '52px', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: white, position: 'relative', overflow: 'hidden' },
    heroGradient: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,113,227,0.04) 0%, transparent 70%), radial-gradient(ellipse 40% 30% at 80% 80%, rgba(0,113,227,0.04) 0%, transparent 60%)', pointerEvents: 'none' },
    heroContent: { position: 'relative', zIndex: 2, maxWidth: '760px', padding: isMobile ? '60px 24px 80px' : '0 24px' },
    heroChip: { display: 'inline-flex', alignItems: 'center', gap: '6px', background: off, border: '1px solid ' + border2, padding: '6px 14px', borderRadius: '980px', fontSize: '12px', color: text3, fontWeight: 500, marginBottom: '32px', letterSpacing: '0.1px' },
    heroChipDot: { width: '6px', height: '6px', borderRadius: '50%', background: blue, flexShrink: 0 },
    heroH1: { fontFamily: dmSerif, fontSize: isMobile ? '40px' : 'clamp(48px, 7vw, 86px)', fontWeight: 400, lineHeight: 1.05, letterSpacing: isMobile ? '-0.5px' : '-1.5px', color: text, marginBottom: '24px' },
    heroAccent: { color: blue },
    heroSub: { fontSize: '19px', lineHeight: 1.6, color: text3, maxWidth: '520px', margin: '0 auto 40px', fontWeight: 300 },
    heroActions: { display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
    btnBlue: { background: blue, color: white, padding: '15px 36px', borderRadius: '980px', fontSize: '16px', fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: dmSans, letterSpacing: '-0.2px', boxShadow: '0 4px 20px ' + blue + '4d' },
    btnGhost: { background: 'transparent', color: blue, fontSize: '16px', fontWeight: 500, border: 'none', cursor: 'pointer', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: dmSans, letterSpacing: '-0.2px' },
    statsBar: { display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: '1px', background: border, borderTop: '1px solid ' + border, borderBottom: '1px solid ' + border },
    stat: { padding: isMobile ? '28px 16px' : '40px 32px', textAlign: 'center', background: off },
    statNum: { fontFamily: dmSerif, fontSize: isMobile ? '36px' : '52px', fontWeight: 400, lineHeight: 1, color: text, letterSpacing: '-2px', marginBottom: '8px', display: 'block' },
    statLabel: { fontSize: '13px', color: text3, fontWeight: 400, letterSpacing: '-0.1px' },
    sectionWhite: { padding: isMobile ? '80px 24px' : '120px 80px', background: white },
    sectionOff:   { padding: isMobile ? '80px 24px' : '120px 80px', background: white },
    eyebrow: { fontSize: '12px', fontWeight: 500, color: blue, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '16px', display: 'block' },
    sectionTitle: { fontFamily: dmSerif, fontSize: isMobile ? '34px' : 'clamp(34px, 4vw, 54px)', fontWeight: 400, lineHeight: 1.1, letterSpacing: '-1px', color: text, marginBottom: '20px' },
    titleItalicBlue: { fontStyle: 'italic', color: blue },
    bodyText: { fontSize: '17px', color: text3, lineHeight: 1.7, fontWeight: 300, maxWidth: '560px' },
    servicesIntro: { maxWidth: '600px', margin: '0 auto 72px', textAlign: 'center' },
    servicesBento: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${svcCols}, 1fr)`, gap: '16px' },
    tileBase: { background: off, borderRadius: radius, padding: isMobile ? '28px 24px' : '40px 36px', position: 'relative', overflow: 'hidden', border: '1px solid ' + border },
    tileFeatured: { background: text, borderRadius: radius, padding: isMobile ? '28px 24px' : '40px 36px', position: 'relative', overflow: 'hidden', border: 'none', gridColumn: isMobile ? 'span 1' : 'span 2' },
    tileGlow: { position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.8), transparent 70%)', pointerEvents: 'none' },
    tileGlowFeatured: { position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%)', pointerEvents: 'none' },
    tileBadge: { position: 'absolute', top: '20px', right: '20px', background: blue, color: white, fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px', padding: '4px 10px', borderRadius: '980px', textTransform: 'uppercase' },
    tileIcon: { width: '44px', height: '44px', borderRadius: '10px', background: white, border: '1px solid ' + border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '24px', boxShadow: shadowSm },
    tileIconFeatured: { width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '24px' },
    tileH3:         { fontSize: '20px', fontWeight: 500, letterSpacing: '-0.3px', color: text,  marginBottom: '10px' },
    tileH3Featured: { fontSize: '20px', fontWeight: 500, letterSpacing: '-0.3px', color: white, marginBottom: '10px' },
    tileP:          { fontSize: '14px', color: text3,                    lineHeight: 1.65 },
    tilePFeatured:  { fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.65 },
    brands: { padding: isMobile ? '48px 24px' : '56px 80px', borderBottom: '1px solid ' + border, borderTop: '1px solid ' + border, textAlign: 'center', background: white },
    brandsEyebrow: { fontSize: '11px', color: text4, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '32px', display: 'block' },
    brandsRow: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: isMobile ? '24px' : '48px', flexWrap: 'wrap' },
    brand: { fontSize: '15px', fontWeight: 500, color: '#d1d1d6', letterSpacing: '-0.2px' },
    specStrip: { background: off, borderTop: '1px solid ' + border, borderBottom: '1px solid ' + border, padding: isMobile ? '80px 24px' : '80px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '48px' : '80px', alignItems: 'start' },
    specPillsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '36px' },
    specPill: { background: white, border: '1px solid ' + border, borderRadius: radiusSm, padding: '18px 20px' },
    specPillLabel: { fontSize: '11px', color: text4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' },
    specPillVal:   { fontSize: '15px', fontWeight: 500, color: text, letterSpacing: '-0.2px' },
    fleetCard: { background: white, borderRadius: radius, border: '1px solid ' + border, padding: '40px', boxShadow: shadowMd, position: 'relative', overflow: 'hidden', marginBottom: '16px' },
    fleetCardLine: { position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, ' + blue + ', #5AC8FA)', borderRadius: radius + ' ' + radius + ' 0 0' },
    fleetCardNum: { fontFamily: dmSerif, fontSize: '80px', color: '#ebebed', lineHeight: 1, position: 'absolute', right: '24px', top: '16px', pointerEvents: 'none' },
    fleetCardH3: { fontSize: '22px', fontWeight: 500, color: text, letterSpacing: '-0.3px', marginBottom: '14px' },
    fleetCardP:  { fontSize: '14px', color: text3, lineHeight: 1.7, marginBottom: '24px' },
    fleetTags:   { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    tag: { background: off, border: '1px solid ' + border, padding: '5px 12px', borderRadius: '980px', fontSize: '12px', color: text2 },
    testiGrid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: '16px' },
    tcard: { background: white, borderRadius: radius, border: '1px solid ' + border, padding: '36px', boxShadow: shadowSm },
    tcardStars: { color: '#FF9F0A', fontSize: '14px', marginBottom: '16px', letterSpacing: '2px' },
    tcardP:     { fontSize: '15px', color: text2, lineHeight: 1.7, fontWeight: 300, fontStyle: 'italic', marginBottom: '24px' },
    tcardAuthor: { display: 'flex', alignItems: 'center', gap: '12px' },
    tcardAv: { width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #ebebed, #e0e0e4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600, color: text3, border: '1.5px solid ' + border2, flexShrink: 0 },
    tcardName: { fontSize: '14px', fontWeight: 500, color: text },
    tcardRole: { fontSize: '12px', color: text4, marginTop: '1px' },
    footer: { background: text, color: 'rgba(255,255,255,0.6)', padding: isMobile ? '60px 24px 28px' : '64px 80px 32px' },
    footerTop: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr', gap: isMobile ? '32px' : '60px', marginBottom: '56px' },
    footerBrandLogo: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '17px', fontWeight: 500, color: white, marginBottom: '14px', fontFamily: dmSans },
    footerLogoRing: { width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg, #555 0%, #888 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    footerBrandP: { fontSize: '13px', lineHeight: 1.7, maxWidth: '260px' },
    footerColH4: { fontSize: '11px', fontWeight: 600, color: white, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '16px' },
    footerColLink: { fontSize: '13px', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', display: 'block', marginBottom: '10px' },
    footerBottom: { borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px', display: 'flex', justifyContent: isMobile ? 'center' : 'space-between', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '12px' : 0, textAlign: isMobile ? 'center' : 'left' },
    footerLoc: { fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' },
    footerDot: { width: '6px', height: '6px', borderRadius: '50%', background: blue },
  };

  return (
    <div style={s.wrapper}>

      {/* NAV */}
      <nav style={s.nav}>
        {images.logo ? (
          <img src={images.logo} alt={businessInfo.businessName || 'Logo'} style={{ height: 36, objectFit: 'contain' }} />
        ) : (
          <div style={s.navLogo}>
            <div style={s.logoRing}><div style={s.logoRingInner} /></div>
            {businessInfo.businessName}
          </div>
        )}
        <div className="tp-nav-links" style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <a href="#services" style={{ color: text, textDecoration: 'none', fontFamily: dmSans, fontSize: '0.85rem', letterSpacing: '0.05em', opacity: 0.8 }}>Services</a>
          <a href="#reviews" style={{ color: text, textDecoration: 'none', fontFamily: dmSans, fontSize: '0.85rem', letterSpacing: '0.05em', opacity: 0.8 }}>Reviews</a>
          <a href="#contact" style={{ color: text, textDecoration: 'none', fontFamily: dmSans, fontSize: '0.85rem', letterSpacing: '0.05em', opacity: 0.8 }}>Contact</a>
          <button style={s.navCta}>{generatedCopy.ctaPrimary || 'Book a Detail'}</button>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero" style={s.hero}>
        <HeroImage src={images.hero} />
        <div style={s.heroGradient} />
        <div style={s.heroContent}>
          <div style={s.heroChip}>
            <span style={s.heroChipDot} />
            {businessInfo.city}{businessInfo.state ? ', ' + businessInfo.state : ''}
            {businessInfo.serviceArea ? ' · Serving ' + businessInfo.serviceArea : ''}
          </div>
          <h1 style={s.heroH1}>
            {(() => {
              if (!generatedCopy.headline) return businessInfo.businessName;
              const words = generatedCopy.headline.split(' ');
              const last  = words.pop();
              return (
                <>
                  {words.join(' ')}{words.length > 0 ? ' ' : ''}
                  <span style={s.heroAccent}>{last}</span>
                </>
              );
            })()} 
          </h1>
          <p style={s.heroSub}>{generatedCopy.subheadline}</p>
          <div style={s.heroActions}>
            <button style={s.btnBlue}>{generatedCopy.ctaPrimary || 'Get a Free Quote'}</button>
            <button style={s.btnGhost}>
              {generatedCopy.ctaSecondary || 'Explore Services'}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div style={s.statsBar}>
        {stats.map((st, i) => (
          <div key={i} style={s.stat}>
            <span style={s.statNum}>{st.num}</span>
            <span style={s.statLabel}>{st.label}</span>
          </div>
        ))}
      </div>

      {/* SERVICES BENTO */}
      <section id="services" style={s.sectionWhite}>
        <div style={s.servicesIntro}>
          <span style={s.eyebrow}>Services</span>
          <h2 style={s.sectionTitle}>
            Everything your vehicle needs,{' '}
            <em style={s.titleItalicBlue}>nothing it doesn&#8217;t.</em>
          </h2>
          <p style={{ ...s.bodyText, margin: '0 auto', textAlign: 'center' }}>
            {(generatedCopy.servicesSection && generatedCopy.servicesSection.intro)
              ? generatedCopy.servicesSection.intro
              : 'From a single-car detail to a full fleet program, every service is executed to an exacting standard.'}
          </p>
        </div>
        {businessInfo.packages?.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1px', background: blue + '22' }}>
            {businessInfo.packages.map((pkg, i) => (
              <div key={i} style={{ ...s.tileBase, borderTop: `3px solid ${i === 0 ? blue : 'transparent'}` }}>
                <div style={s.tileGlow} />
                <h3 style={s.tileH3}>{pkg.name || pkg}</h3>
                {pkg.price && <div style={{ fontFamily: dmSerif, fontSize: '1.8rem', fontWeight: 700, color: blue, margin: '0.4rem 0 0.75rem' }}>{pkg.price}</div>}
                <p style={s.tileP}>{pkg.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <div style={s.servicesBento}>
            {services.map((svc, i) => {
              const featured = i === 0;
              return (
                <div key={i} style={featured ? s.tileFeatured : s.tileBase}>
                  <div style={featured ? s.tileGlowFeatured : s.tileGlow} />
                  {featured && <div style={s.tileBadge}>Most Popular</div>}
                  <div style={featured ? s.tileIconFeatured : s.tileIcon}>
                    {tileIcons[i % tileIcons.length]}
                  </div>
                  <h3 style={featured ? s.tileH3Featured : s.tileH3}>{svc.name}</h3>
                  <p style={featured ? s.tilePFeatured : s.tileP}>{svc.description}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* BRANDS */}
      <div style={s.brands}>
        <span style={s.brandsEyebrow}>Trusted Professional Products</span>
        <div style={s.brandsRow}>
          {brandItems.map((br, i) => <span key={i} style={s.brand}>{br}</span>)}
        </div>
      </div>

      {/* SPECIALIZATIONS */}
      <div style={s.specStrip}>
        <div>
          <span style={s.eyebrow}>Specializations</span>
          <h2 style={s.sectionTitle}>
            Built for <em style={s.titleItalicBlue}>scale.</em>
            <br />Trusted by industry.
          </h2>
          <p style={s.bodyText}>{generatedCopy.aboutText}</p>
          <div style={s.specPillsGrid}>
            {[
              { label: 'Experience', val: (businessInfo.yearsInBusiness || '8') + '+ Years' },
              { label: 'Response',   val: 'Same-day quotes' },
              { label: 'Coverage',   val: businessInfo.city || 'Local Area' },
              { label: 'Mobile',     val: 'On-site available' },
            ].map((pill, i) => (
              <div key={i} style={s.specPill}>
                <div style={s.specPillLabel}>{pill.label}</div>
                <div style={s.specPillVal}>{pill.val}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          {images.about && (
            <img src={images.about} alt="About" style={{ width: '100%', height: '260px', objectFit: 'cover', borderRadius: '12px', display: 'block', marginBottom: '16px' }} />
          )}
          {specialtyItems.slice(0, 3).map((sp, i) => (
            <div key={i} style={s.fleetCard}>
              <div style={s.fleetCardLine} />
              <div style={s.fleetCardNum}>0{i + 1}</div>
              <h3 style={s.fleetCardH3}>{typeof sp === 'object' ? sp.name : sp}</h3>
              <p style={s.fleetCardP}>
                {typeof sp === 'object'
                  ? sp.description
                  : 'Professional ' + String(sp).toLowerCase() + ' services tailored to your specific needs and operational requirements.'}
              </p>
              {Array.isArray(businessInfo.packages) && businessInfo.packages[i] && (
                <div style={s.fleetTags}>
                  <span style={s.tag}>{typeof businessInfo.packages[i] === 'object' ? businessInfo.packages[i].name : businessInfo.packages[i]}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* GALLERY */}
      <GallerySection images={images} colors={c} font={font} bodyFont={bodyFont} />

      {/* TESTIMONIALS */}
      <section id="reviews" style={s.sectionOff}>
        <div style={{ maxWidth: '520px', margin: '0 auto 72px', textAlign: 'center' }}>
          <span style={s.eyebrow}>Reviews</span>
          <h2 style={s.sectionTitle}>
            What our clients <em style={s.titleItalicBlue}>say.</em>
          </h2>
        </div>
        <div style={s.testiGrid}>
          {testimonials.map((t, i) => {
            const initials = t.name
              ? t.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
              : String(i + 1);
            return (
              <div key={i} style={s.tcard}>
                <div style={s.tcardStars}>&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                <p style={s.tcardP}>&ldquo;{t.text}&rdquo;</p>
                <div style={s.tcardAuthor}>
                  <div style={s.tcardAv}>{initials}</div>
                  <div>
                    <div style={s.tcardName}>{t.name}</div>
                    {t.role && <div style={s.tcardRole}>{t.role}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={s.sectionWhite}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '48px' : '100px', alignItems: 'start' }}>
          <div>
            <span style={s.eyebrow}>Contact</span>
            <h2 style={{ ...s.sectionTitle, marginBottom: '16px' }}>
              Let&#8217;s get your vehicle <em style={s.titleItalicBlue}>sorted.</em>
            </h2>
            <p style={{ ...s.bodyText, marginBottom: '48px' }}>
              Whether you need a single detail or a custom fleet contract &#8212; reach out and we&#8217;ll respond within 2 business hours.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { icon: '📞', label: 'Phone',    val: businessInfo.phone },
                { icon: '📍', label: 'Location', val: businessInfo.address || [businessInfo.city, businessInfo.state].filter(Boolean).join(', ') },
                { icon: '🕐', label: 'Hours',    val: formatHours(businessInfo.hours) },
              ].filter(item => item.val).map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', background: off, border: '1px solid ' + border, borderRadius: radiusSm }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: white, border: '1px solid ' + border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0, boxShadow: shadowSm }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: '11px', color: text4, fontWeight: 500, letterSpacing: '0.3px' }}>{item.label}</div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: text, marginTop: '1px' }}>{item.val}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: off, border: '1px solid ' + border, borderRadius: radius, padding: '44px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 500, color: text, letterSpacing: '-0.3px', marginBottom: '20px' }}>
              Why Choose {businessInfo.businessName}?
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                businessInfo.awards ? 'Award-winning: ' + businessInfo.awards : null,
                businessInfo.yearsInBusiness ? businessInfo.yearsInBusiness + '+ years of professional experience' : null,
                '100% satisfaction guarantee on every job',
                'Professional-grade products — no shortcuts',
                Array.isArray(businessInfo.packages) && businessInfo.packages.length
                  ? 'Packages available: ' + businessInfo.packages.slice(0, 3).map(p => typeof p === 'object' ? p.name : p).join(', ')
                  : null,
              ].filter(Boolean).map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: blue + '15', border: '1px solid ' + blue + '30', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke={blue} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: '14px', color: text2, lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </div>
            <button style={{ width: '100%', background: blue, color: white, border: 'none', borderRadius: '10px', padding: '14px', fontFamily: dmSans, fontSize: '15px', fontWeight: 500, cursor: 'pointer', marginTop: '28px', boxShadow: '0 4px 16px ' + blue + '40', letterSpacing: '-0.2px' }}>
              {generatedCopy.ctaPrimary || 'Get a Free Quote'}
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={s.footer}>
        <div style={s.footerTop}>
          <div>
            {/* Footer logo */}
            {images.logo ? (
              <img src={images.logo} alt={businessInfo.businessName} style={{ height: 48, maxWidth: 180, objectFit: 'contain', marginBottom: '0.75rem', display: 'block' }} />
            ) : (
              <div style={s.footerBrandLogo}>
                <div style={s.footerLogoRing}>
                  <div style={{ ...s.logoRingInner, borderColor: 'rgba(255,255,255,0.4)' }} />
                </div>
                {businessInfo.businessName}
              </div>
            )}
            <p style={s.footerBrandP}>{generatedCopy.footerTagline}</p>
          </div>
          <div>
            <h4 style={s.footerColH4}>Services</h4>
            {services.slice(0, 5).map((svc, i) => (
              <a key={i} href="#services" style={s.footerColLink}>{svc.name}</a>
            ))}
          </div>
          <div>
            <h4 style={s.footerColH4}>Get In Touch</h4>
            {businessInfo.phone && (
              <a href={'tel:' + businessInfo.phone.replace(/D/g, '')} style={s.footerColLink}>{businessInfo.phone}</a>
            )}
            <SocialRow biz={businessInfo} color={blue} size={20} images={images} />
            {businessInfo.city && (
              <span style={{ ...s.footerColLink, cursor: 'default' }}>
                {businessInfo.city}{businessInfo.state ? ', ' + businessInfo.state : ''}
              </span>
            )}
          </div>
        </div>
        <div style={s.footerBottom}>
          <p style={{ fontSize: '12px' }}>
            &copy; {new Date().getFullYear()} {businessInfo.businessName}. All rights reserved.
          </p>
          <div style={s.footerLoc}>
            <div style={s.footerDot} />
            {businessInfo.city}{businessInfo.state ? ', ' + businessInfo.state : ''}
            {businessInfo.serviceArea ? ' · ' + businessInfo.serviceArea : ''}
          </div>
        </div>
      </footer>

    </div>
  );
}