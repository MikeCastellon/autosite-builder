import React, { useState, useEffect } from 'react';
import { SocialRow } from '../SocialIcons.jsx';
import { formatHours } from '../../../../lib/formatHours.js';
import { HeroImage, AboutImage, GallerySection } from '../ImageLayers.jsx';

export default function DetailingAutoSyncDark({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const c = templateMeta.colors;
  const font = templateMeta.font;
  const bodyFont = templateMeta.bodyFont;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Barlow:wght@300;400;500;600&family=Barlow+Condensed:wght@400;500;700&display=swap';
    document.head.appendChild(link);
    return () => { if (document.head.contains(link)) document.head.removeChild(link); };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const dark3 = '#141820';
  const mid = '#1E232E';
  const textDim = c.muted || '#6B7280';
  const textColor = '#D0D4DC';
  const goldDim = 'rgba(201,168,76,0.15)';

  const services = generatedCopy?.servicesSection?.items || [];
  const svcCols = services.length >= 6 ? Math.ceil(services.length / 2) : services.length || 1;
  const testimonials = generatedCopy?.testimonialPlaceholders || [];
  const yearsNum = businessInfo.yearsInBusiness || '8';
  const cityName = businessInfo.city || 'Local';
  const stateName = businessInfo.state || 'FL';

  const stats = [
    { num: yearsNum + ' Years', label: 'Experience' },
    { num: '2,000+', label: 'Vehicles Detailed' },
    { num: '100%', label: 'Satisfaction Rate' },
    { num: cityName + ' ' + stateName, label: 'Specialists' },
  ];

  const processSteps = [
    { num: '01', title: 'Consultation', desc: 'We assess your vehicle or fleet, discuss your goals, and recommend the right service package based on condition, timeline, and budget.' },
    { num: '02', title: 'Inspection', desc: 'A thorough paint and interior inspection documents existing defects, contamination levels, and protection status before work begins.' },
    { num: '03', title: 'Detailing', desc: 'Our certified technicians execute each step of the process with precision-grade equipment and professional-grade products.' },
    { num: '04', title: 'Final Review', desc: "A quality control walkthrough ensures every detail meets our standard. We don't hand off a vehicle until it's perfect." },
  ];

  const brands = ['Koch Chemie', 'CARPRO', 'Rupes', "Meguiar's", '3M', 'Gyeon'];

  const specializations = [
    { title: 'Auto Auction Detailing', desc: 'High-throughput detailing for dealer auctions and wholesale operations. We understand auction timelines and deliver showroom-ready results at volume pricing.' },
    { title: 'Aviation Fleet Services', desc: 'Interior cabin detailing, exterior wash-and-wax, and protective coating for private aircraft. We use only aviation-approved products with on-site hangar service available.' },
    { title: 'Commercial Fleet Programs', desc: 'Custom maintenance contracts for delivery fleets, rideshare operators, rental agencies, and corporate vehicle pools. Flexible scheduling and volume discounts.' },
    { title: 'On-Site Mobile Service', desc: 'We come to you. Our fully-equipped mobile units serve dealerships, businesses, and residential clients throughout the metro area.' },
  ];

  const serviceIcons = ['✦', '◈', '⬡', '◉', '✧', '◆', '◇', '✣'];

  const s = {
    wrapper: { background: c.bg, color: textColor, fontFamily: bodyFont, overflowX: 'hidden', containerType: 'inline-size' },
    nav: {
      position: 'sticky', top: 0, zIndex: 100,
      padding: scrolled ? '14px clamp(1.5rem,5vw,3.75rem)' : '20px clamp(1.5rem,5vw,3.75rem)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      transition: 'all 0.4s',
      background: scrolled ? 'rgba(8,10,13,0.97)' : 'linear-gradient(to bottom, rgba(8,10,13,0.95), transparent)',
      borderBottom: scrolled ? '1px solid ' + goldDim : '1px solid transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
    },
    navLogoWrap: { display: 'flex', alignItems: 'center', gap: '12px' },
    logoIcon: { width: '38px', height: '38px', border: '1.5px solid ' + c.accent, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    logoIconInner: { width: '20px', height: '20px', border: '1.5px solid ' + c.accent + 'bb', borderRadius: '50%' },
    logoText: { fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '3px', fontSize: '15px', color: c.text, fontWeight: 500, display: 'block' },
    logoSub: { fontSize: '9px', letterSpacing: '5px', color: c.accent, fontWeight: 300, display: 'block', marginTop: '-2px' },
    navCta: { background: 'transparent', border: '1px solid ' + c.accent, color: c.accent, padding: '10px 24px', fontFamily: bodyFont, fontSize: '11px', letterSpacing: '2.5px', textTransform: 'uppercase', cursor: 'pointer' },
    hero: { minHeight: '100vh', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden', padding: 'clamp(5rem,10vw,8rem) clamp(1.5rem,5vw,3.75rem) clamp(4rem,8vw,6rem)' },
    heroBg: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 70% 50%, rgba(201,168,76,0.06) 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 20% 80%, rgba(201,168,76,0.04) 0%, transparent 60%), linear-gradient(135deg, #080A0D 0%, #0E1116 50%, #080A0D 100%)' },
    heroGrid: {
      position: 'absolute', inset: 0,
      backgroundImage: 'linear-gradient(rgba(201,168,76,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.04) 1px, transparent 1px)',
      backgroundSize: '80px 80px',
      WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)',
      maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)',
    },
    heroLine: { position: 'absolute', left: 0, top: '50%', width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.2), transparent)' },
    heroContent: { position: 'relative', zIndex: 2, maxWidth: '700px' },
    heroEyebrow: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' },
    heroEyebrowLine: { width: '48px', height: '1px', background: c.accent, flexShrink: 0 },
    heroEyebrowText: { fontSize: '11px', letterSpacing: '4px', color: c.accent, textTransform: 'uppercase', fontWeight: 500, fontFamily: bodyFont },
    heroH1: { fontFamily: font, fontSize: 'clamp(1.8rem,7vw,5.75rem)', fontWeight: 300, lineHeight: 1.0, color: c.text, marginBottom: '28px' },
    heroH1Em: { fontStyle: 'italic', color: c.accent },
    heroDesc: { fontSize: 'clamp(0.9rem,1.5vw,1rem)', lineHeight: 1.8, color: textDim, maxWidth: '480px', marginBottom: '48px', fontWeight: 300, fontFamily: bodyFont },
    heroActions: { display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' },
    btnPrimary: { background: c.accent, color: c.bg, padding: '16px 40px', fontFamily: bodyFont, fontSize: '12px', letterSpacing: '2.5px', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer', border: 'none' },
    btnSecondary: { color: textColor, fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500, fontFamily: bodyFont, background: 'transparent', border: 'none', cursor: 'pointer' },
    btnSecondaryCircle: { width: '36px', height: '36px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 },
    statsBar: { background: dark3, borderTop: '1px solid ' + goldDim, borderBottom: '1px solid ' + goldDim, padding: 'clamp(1.5rem,3vw,2rem) clamp(1.5rem,5vw,3.75rem)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))' },
    statItem: { textAlign: 'center', padding: '1rem', borderRight: '1px solid rgba(255,255,255,0.06)' },
    statItemLast: { textAlign: 'center', padding: '1rem' },
    statNum: { fontFamily: font, fontSize: 'clamp(2rem,4vw,3rem)', fontWeight: 300, color: c.accent, lineHeight: 1, display: 'block' },
    statLabel: { fontSize: '11px', letterSpacing: '2.5px', color: textDim, textTransform: 'uppercase', marginTop: '6px', fontFamily: bodyFont, display: 'block' },
    sectionLabel: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' },
    sectionLabelLine: { width: '32px', height: '1px', background: c.accent, flexShrink: 0 },
    sectionLabelText: { fontSize: '10px', letterSpacing: '4px', color: c.accent, textTransform: 'uppercase', fontWeight: 600, fontFamily: bodyFont },
    sectionTitle: { fontFamily: font, fontSize: 'clamp(2rem,4vw,3.625rem)', fontWeight: 300, lineHeight: 1.1, color: c.text },
    sectionTitleEm: { fontStyle: 'italic', color: c.accent },
    servicesSection: { background: c.secondary, padding: 'clamp(4rem,8vw,7.5rem) clamp(1.5rem,5vw,3.75rem)' },
    servicesHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'clamp(3rem,6vw,4.5rem)', flexWrap: 'wrap', gap: '1.5rem' },
    servicesHeaderLeft: { maxWidth: '520px' },
    servicesHeaderP: { color: textDim, lineHeight: 1.8, marginTop: '20px', fontSize: '15px', fontFamily: bodyFont },
    servicesGrid: { display: 'grid', gap: '2px' },
    serviceCard: { background: mid, padding: 'clamp(2rem,3vw,3rem) clamp(1.5rem,2.5vw,2.5rem)', position: 'relative', overflow: 'hidden', borderBottom: '3px solid ' + c.accent },
    serviceNum: { fontFamily: font, fontSize: '64px', fontWeight: 300, color: 'rgba(201,168,76,0.12)', lineHeight: 1, marginBottom: '24px' },
    serviceIcon: { fontSize: '28px', marginBottom: '20px', color: c.accent },
    serviceCardH3: { fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', letterSpacing: '1.5px', textTransform: 'uppercase', color: c.text, marginBottom: '14px', fontWeight: 500 },
    serviceCardP: { color: textDim, fontSize: '14px', lineHeight: 1.7, fontFamily: bodyFont },
    brandsSection: { background: dark3, padding: 'clamp(2.5rem,5vw,4.5rem) clamp(1.5rem,5vw,3.75rem)', textAlign: 'center', borderTop: '1px solid rgba(201,168,76,0.1)', borderBottom: '1px solid rgba(201,168,76,0.1)' },
    brandsLabel: { fontSize: '10px', letterSpacing: '4px', color: textDim, textTransform: 'uppercase', marginBottom: '40px', fontFamily: bodyFont },
    brandsRow: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'clamp(1.5rem,4vw,4rem)', flexWrap: 'wrap' },
    brandItem: { fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', letterSpacing: '3px', textTransform: 'uppercase', color: textDim, fontWeight: 500 },
    brandDot: { color: c.accent + '55', fontSize: '18px' },
    specSection: { background: c.bg, padding: 'clamp(4rem,8vw,7.5rem) clamp(1.5rem,5vw,3.75rem)' },
    specGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 'clamp(2rem,5vw,5rem)', alignItems: 'start', marginTop: 'clamp(2.5rem,5vw,4.5rem)' },
    specCardMain: { background: mid, border: '1px solid rgba(201,168,76,0.2)', padding: '3rem', position: 'relative', overflow: 'hidden', minHeight: '360px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' },
    specCardMainBg: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at top right, rgba(201,168,76,0.08), transparent 60%)', pointerEvents: 'none' },
    specBgText: { position: 'absolute', top: '20px', right: '20px', fontFamily: font, fontSize: '100px', fontWeight: 300, color: 'rgba(201,168,76,0.05)', lineHeight: 1, pointerEvents: 'none', userSelect: 'none' },
    specCardH2: { fontFamily: font, fontSize: 'clamp(1.8rem,3vw,2.625rem)', fontWeight: 300, color: c.text, lineHeight: 1.15, position: 'relative', zIndex: 1 },
    specCardP: { color: textDim, fontSize: '14px', lineHeight: 1.8, marginTop: '16px', position: 'relative', zIndex: 1, fontFamily: bodyFont },
    specList: { listStyle: 'none', padding: 0, margin: 0 },
    specItem: { padding: '24px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '20px', alignItems: 'flex-start' },
    specDot: { width: '8px', height: '8px', borderRadius: '50%', background: c.accent, flexShrink: 0, marginTop: '7px' },
    specItemH4: { fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', letterSpacing: '1px', textTransform: 'uppercase', color: c.text, marginBottom: '6px', fontWeight: 500 },
    specItemP: { color: textDim, fontSize: '13px', lineHeight: 1.6, fontFamily: bodyFont },
    processSection: { background: c.secondary, padding: 'clamp(4rem,8vw,7.5rem) clamp(1.5rem,5vw,3.75rem)' },
    processSteps: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: '1px', background: 'rgba(255,255,255,0.05)', marginTop: 'clamp(2.5rem,5vw,4.5rem)' },
    processStep: { background: c.secondary, padding: 'clamp(2rem,3vw,3rem) clamp(1.5rem,2.5vw,2.25rem)' },
    stepNum: { width: '44px', height: '44px', border: '1px solid ' + c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', letterSpacing: '1px', color: c.accent, marginBottom: '28px', flexShrink: 0 },
    processStepH3: { fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', letterSpacing: '1.5px', textTransform: 'uppercase', color: c.text, marginBottom: '14px', fontWeight: 500 },
    processStepP: { color: textDim, fontSize: '13px', lineHeight: 1.7, fontFamily: bodyFont },
    testimonialsSection: { background: c.bg, padding: 'clamp(4rem,8vw,7.5rem) clamp(1.5rem,5vw,3.75rem)' },
    testiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: '24px', marginTop: 'clamp(2.5rem,5vw,4.5rem)' },
    testiCard: { background: dark3, border: '1px solid rgba(255,255,255,0.05)', padding: '2.5rem' },
    testiQuote: { fontFamily: font, fontSize: '60px', color: c.accent, lineHeight: 0.5, marginBottom: '20px', opacity: 0.5 },
    testiStars: { color: c.accent, fontSize: '13px', marginBottom: '12px', letterSpacing: '2px' },
    testiText: { color: textColor, fontSize: 'clamp(0.9rem,1.2vw,0.9375rem)', lineHeight: 1.8, fontStyle: 'italic', marginBottom: '28px', fontFamily: font, fontWeight: 300 },
    testiAuthor: { display: 'flex', alignItems: 'center', gap: '14px' },
    testiAvatar: { width: '44px', height: '44px', borderRadius: '50%', background: mid, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', color: c.accent, fontWeight: 700, border: '1px solid rgba(201,168,76,0.3)', flexShrink: 0 },
    testiName: { fontSize: '13px', color: c.text, fontWeight: 600, fontFamily: bodyFont },
    ctaSection: { background: dark3, borderTop: '1px solid ' + goldDim, padding: 'clamp(4rem,8vw,7.5rem) clamp(1.5rem,5vw,3.75rem)', textAlign: 'center' },
    ctaH2: { fontFamily: font, fontSize: 'clamp(2rem,4vw,3.5rem)', fontWeight: 300, lineHeight: 1.1, color: c.text, marginBottom: '20px' },
    ctaDesc: { color: textDim, fontSize: '15px', lineHeight: 1.8, maxWidth: '520px', margin: '0 auto 2.5rem', fontFamily: bodyFont },
    contactRow: { display: 'flex', justifyContent: 'center', gap: 'clamp(1.5rem,4vw,3rem)', flexWrap: 'wrap', marginBottom: '2.5rem' },
    contactItem: { display: 'flex', alignItems: 'center', gap: '14px' },
    contactIcon: { width: '40px', height: '40px', border: '1px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.accent, fontSize: '18px', flexShrink: 0 },
    contactLabel: { fontSize: '11px', letterSpacing: '2px', color: textDim, textTransform: 'uppercase', fontFamily: bodyFont, display: 'block', textAlign: 'left' },
    contactVal: { color: c.text, fontSize: '15px', fontFamily: bodyFont, display: 'block', textAlign: 'left' },
    footer: { background: '#060709', padding: 'clamp(2.5rem,5vw,4rem) clamp(1.5rem,5vw,3.75rem) clamp(1.5rem,3vw,2rem)', borderTop: '1px solid rgba(201,168,76,0.1)' },
    footerTop: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 'clamp(2rem,4vw,3.75rem)', marginBottom: '3rem' },
    footerBrandP: { color: textDim, fontSize: '14px', lineHeight: 1.8, marginTop: '16px', maxWidth: '280px', fontFamily: bodyFont },
    footerColH4: { fontSize: '10px', letterSpacing: '3px', color: c.accent, textTransform: 'uppercase', marginBottom: '20px', fontWeight: 600, fontFamily: bodyFont },
    footerLink: { color: textDim, fontSize: '13px', textDecoration: 'none', fontFamily: bodyFont, display: 'block', marginBottom: '10px' },
    footerBottom: { borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' },
    footerBottomP: { color: textDim, fontSize: '12px', letterSpacing: '1px', fontFamily: bodyFont },
    footerBadge: { fontFamily: 'Barlow Condensed, sans-serif', fontSize: '10px', letterSpacing: '3px', color: c.accent, border: '1px solid rgba(201,168,76,0.3)', padding: '6px 14px' },
  };

  return (
    <div style={s.wrapper}>
      <style>{`@container(max-width:600px){.tp-nav-links a[href^="#"]{display:none!important}.tp-nav-links{gap:12px!important}.tp-2col{grid-template-columns:1fr!important}}`}</style>

      {/* NAV */}
      <nav style={s.nav}>
        {images.logo ? (
          <img src={images.logo} alt={businessInfo.businessName || 'Logo'} style={{ height: 38, objectFit: 'contain' }} />
        ) : (
          <div style={s.navLogoWrap}>
            <div style={s.logoIcon}>
              <div style={s.logoIconInner} />
            </div>
            <div>
              <span style={s.logoText}>{businessInfo.businessName ? businessInfo.businessName.toUpperCase() : 'YOUR BUSINESS'}</span>
              <span style={s.logoSub}>DETAILING SPECIALISTS</span>
            </div>
          </div>
        )}
        <div className="tp-nav-links" style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <a href="#services" style={{ color: textColor, textDecoration: 'none', fontFamily: bodyFont, fontSize: '0.85rem', letterSpacing: '0.05em', opacity: 0.8 }}>Services</a>
          <a href="#about" style={{ color: textColor, textDecoration: 'none', fontFamily: bodyFont, fontSize: '0.85rem', letterSpacing: '0.05em', opacity: 0.8 }}>About</a>
          <a href="#reviews" style={{ color: textColor, textDecoration: 'none', fontFamily: bodyFont, fontSize: '0.85rem', letterSpacing: '0.05em', opacity: 0.8 }}>Reviews</a>
          <button style={s.navCta}>{businessInfo.phone}</button>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero" style={s.hero}>
        <HeroImage src={images.hero} />
        <div style={s.heroBg} />
        <div style={s.heroGrid} />
        <div style={s.heroLine} />
        <div style={s.heroContent}>
          <div style={s.heroEyebrow}>
            <div style={s.heroEyebrowLine} />
            <span style={s.heroEyebrowText}>
              {businessInfo.city}, {businessInfo.state}
              {businessInfo.yearsInBusiness
                ? ' · Est. ' + (new Date().getFullYear() - parseInt(businessInfo.yearsInBusiness, 10))
                : ''}
            </span>
          </div>
          <h1 style={s.heroH1}>{generatedCopy.headline || 'Your Vehicle. Perfected.'}</h1>
          <p style={s.heroDesc}>{generatedCopy.subheadline}</p>
          <div style={s.heroActions}>
            <button style={s.btnPrimary}>{generatedCopy.ctaPrimary || 'Request a Quote'}</button>
            <button style={s.btnSecondary}>
              <span style={s.btnSecondaryCircle}>↓</span>
              {generatedCopy.ctaSecondary || 'Explore Services'}
            </button>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <div style={s.statsBar}>
        {stats.map((st, i) => (
          <div key={i} style={i === stats.length - 1 ? s.statItemLast : s.statItem}>
            <span style={s.statNum}>{st.num}</span>
            <span style={s.statLabel}>{st.label}</span>
          </div>
        ))}
      </div>

      {/* SERVICES */}
      <section id="services" style={s.servicesSection}>
        <div style={s.servicesHeader}>
          <div style={s.servicesHeaderLeft}>
            <div style={s.sectionLabel}>
              <div style={s.sectionLabelLine} />
              <span style={s.sectionLabelText}>What We Offer</span>
            </div>
            <h2 style={s.sectionTitle}>
              Detailing Services<br />
              <em style={s.sectionTitleEm}>Built for Results</em>
            </h2>
            <p style={s.servicesHeaderP}>
              {generatedCopy?.servicesSection?.intro || 'From a single car to an entire fleet, our packages are engineered for efficiency, consistency, and a showroom finish every time.'}
            </p>
          </div>
        </div>
        {businessInfo.packages?.length > 0 ? (
          <div style={{ display: 'flex', gap: '1px', flexWrap: 'wrap', background: c.accent + '22' }}>
            {businessInfo.packages.map((pkg, i) => (
              <div key={i} style={{
                flex: '1 1 200px', background: mid,
                borderTop: i === 1 ? '2px solid ' + c.accent : '2px solid transparent',
                padding: '1.75rem',
              }}>
                <div style={{ fontSize: '0.65rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: c.accent, fontFamily: bodyFont, marginBottom: '0.5rem' }}>{pkg.name || pkg}</div>
                {pkg.price && <div style={{ fontFamily: font, fontSize: '1.8rem', fontWeight: 300, color: c.accent, margin: '0.4rem 0 0.75rem' }}>{pkg.price}</div>}
                {pkg.description && <p style={{ color: textDim, fontSize: '0.82rem', lineHeight: 1.65, marginTop: '0.5rem' }}>{pkg.description}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...s.servicesGrid, gridTemplateColumns: `repeat(${svcCols}, 1fr)` }}>
            {services.map((svc, i) => (
              <div key={i} style={s.serviceCard}>
                <div style={s.serviceNum}>{String(i + 1).padStart(2, '0')}</div>
                <div style={s.serviceIcon}>{serviceIcons[i % serviceIcons.length]}</div>
                <h3 style={s.serviceCardH3}>{svc.name}</h3>
                <p style={s.serviceCardP}>{svc.description}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* BRANDS */}
      <div style={s.brandsSection}>
        <p style={s.brandsLabel}>Professional-Grade Products We Trust</p>
        <div style={s.brandsRow}>
          {brands.map((brand, i) => (
            <React.Fragment key={i}>
              <span style={s.brandItem}>{brand}</span>
              {i < brands.length - 1 && <span style={s.brandDot}>◦</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* SPECIALIZATIONS */}
      <section style={s.specSection}>
        <div style={s.sectionLabel}>
          <div style={s.sectionLabelLine} />
          <span style={s.sectionLabelText}>Our Specializations</span>
        </div>
        <div style={s.specGrid}>
          <div style={s.specCardMain}>
            <div style={s.specCardMainBg} />
            <div style={s.specBgText}>360</div>
            <h2 style={s.specCardH2}>
              Trusted by<br />
              <em style={s.sectionTitleEm}>Industries</em><br />
              that Demand<br />
              Precision
            </h2>
            <p style={s.specCardP}>
              {businessInfo.specialties || 'Built from the ground up to serve high-volume, high-standard clients where consistency is non-negotiable and results are expected every time.'}
            </p>
          </div>
          <ul style={s.specList}>
            {specializations.map((spec, i) => (
              <li key={i} style={s.specItem}>
                <div style={s.specDot} />
                <div>
                  <h4 style={s.specItemH4}>{spec.title}</h4>
                  <p style={s.specItemP}>{spec.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* PROCESS */}
      <section style={s.processSection}>
        <div style={s.sectionLabel}>
          <div style={s.sectionLabelLine} />
          <span style={s.sectionLabelText}>How We Work</span>
        </div>
        <h2 style={s.sectionTitle}>
          Our <em style={s.sectionTitleEm}>Proven</em> Process
        </h2>
        <div style={s.processSteps}>
          {processSteps.map((step, i) => (
            <div key={i} style={s.processStep}>
              <div style={s.stepNum}>{step.num}</div>
              <h3 style={s.processStepH3}>{step.title}</h3>
              <p style={s.processStepP}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ABOUT */}
      {generatedCopy.aboutText && (
        <section id="about" style={{ background: c.bg, padding: 'clamp(4rem,8vw,7.5rem) clamp(1.5rem,5vw,3.75rem)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 'clamp(2rem,4vw,5rem)', alignItems: 'start' }}>
            <div>
              <div style={s.sectionLabel}>
                <div style={s.sectionLabelLine} />
                <span style={s.sectionLabelText}>Our Story</span>
              </div>
              <h2 style={s.sectionTitle}>
                The Art of<br /><em style={s.sectionTitleEm}>the Detail</em>
              </h2>
              {businessInfo.yearsInBusiness && (
                <p style={{ marginTop: '1.25rem', color: textDim, fontSize: '13px', letterSpacing: '2px', fontFamily: bodyFont, textTransform: 'uppercase' }}>
                  {businessInfo.yearsInBusiness} Years of Excellence
                </p>
              )}
            </div>
            <div style={{ position: 'relative', paddingLeft: '2rem' }}>
              <span style={{ fontFamily: font, fontSize: '8rem', color: c.accent, lineHeight: 0.6, opacity: 0.2, position: 'absolute', top: '1rem', left: '-1rem', userSelect: 'none', pointerEvents: 'none' }}>
                &quot;
              </span>
              <p style={{ fontFamily: bodyFont, color: textDim, fontSize: '1rem', lineHeight: 1.85, position: 'relative', zIndex: 1 }}>
                {generatedCopy.aboutText}
              </p>
            <div style={{ marginTop: '2rem' }}><AboutImage src={images.about} accent={c.accent} /></div>
              {businessInfo.awards && (
                <div style={{ marginTop: '1.5rem', display: 'inline-block', background: c.accent, color: c.bg, fontFamily: bodyFont, fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', padding: '6px 16px', fontWeight: 700 }}>
                  {businessInfo.awards}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* TESTIMONIALS */}
      <section id="reviews" style={s.testimonialsSection}>
        <div style={s.sectionLabel}>
          <div style={s.sectionLabelLine} />
          <span style={s.sectionLabelText}>Client Testimonials</span>
        </div>
        <h2 style={s.sectionTitle}>
          What Our <em style={s.sectionTitleEm}>Clients</em> Say
        </h2>
        <div style={s.testiGrid}>
          {testimonials.map((t, i) => {
            const initials = t.name
              ? t.name.split(' ').slice(0, 2).map(n => n[0]).join('')
              : '★';
            return (
              <div key={i} style={s.testiCard}>
                <div style={s.testiQuote}>&quot;</div>
                <div style={s.testiStars}>★★★★★</div>
                <p style={s.testiText}>{t.text}</p>
                <div style={s.testiAuthor}>
                  <div style={s.testiAvatar}>{initials}</div>
                  <div>
                    <div style={s.testiName}>{t.name}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA SECTION */}
      <section style={s.ctaSection}>
        <div style={{ ...s.sectionLabel, justifyContent: 'center', marginBottom: '1rem' }}>
          <div style={s.sectionLabelLine} />
          <span style={s.sectionLabelText}>Ready to Begin?</span>
          <div style={s.sectionLabelLine} />
        </div>
        <h2 style={s.ctaH2}>
          Ready to <em style={s.sectionTitleEm}>Elevate</em><br />
          Your Vehicle?
        </h2>
        <p style={s.ctaDesc}>
          Whether you need a single signature detail or a custom fleet contract, we are ready to deliver. Contact us and we will respond within 2 business hours.
        </p>
        <div style={s.contactRow}>
          <div style={s.contactItem}>
            <div style={s.contactIcon}>☎</div>
            <div>
              <span style={s.contactLabel}>Phone</span>
              <span style={s.contactVal}>{businessInfo.phone}</span>
            </div>
          </div>
          {businessInfo.city && (
            <div style={s.contactItem}>
              <div style={s.contactIcon}>◎</div>
              <div>
                <span style={s.contactLabel}>Location</span>
                <span style={s.contactVal}>{businessInfo.city}, {businessInfo.state}</span>
              </div>
            </div>
          )}
          {businessInfo.hours && (
            <div style={s.contactItem}>
              <div style={s.contactIcon}>⏷</div>
              <div>
                <span style={s.contactLabel}>Hours</span>
                <span style={s.contactVal}>{formatHours(businessInfo.hours)}</span>
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={s.btnPrimary}>{generatedCopy.ctaPrimary || 'Request a Quote'}</button>
          <button style={{ background: 'transparent', border: '1px solid ' + c.accent, color: c.accent, padding: '16px 40px', fontFamily: bodyFont, fontSize: '12px', letterSpacing: '2.5px', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer' }}>
            {businessInfo.phone}
          </button>
        </div>
      </section>

      {/* FOOTER */}

      {/* GALLERY */}
      <GallerySection images={images} colors={c} font={font} bodyFont={bodyFont} />
      <footer style={s.footer}>
        <div style={s.footerTop}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <div style={{ ...s.logoIcon, width: '32px', height: '32px' }}>
                <div style={{ ...s.logoIconInner, width: '16px', height: '16px' }} />
              </div>
              <div>
                <span style={s.logoText}>{businessInfo.businessName ? businessInfo.businessName.toUpperCase() : 'YOUR BUSINESS'}</span>
                <span style={s.logoSub}>DETAILING SPECIALISTS</span>
              </div>
            </div>
            <p style={s.footerBrandP}>{generatedCopy.footerTagline}</p>
            {businessInfo.address && (
              <p style={{ ...s.footerBrandP, marginTop: '0.5rem', fontSize: '13px' }}>{businessInfo.address}</p>
            )}
          </div>
          <div>
            <h4 style={s.footerColH4}>Services</h4>
            {services.slice(0, 6).map((svc, i) => (
              <span key={i} style={s.footerLink}>{svc.name}</span>
            ))}
          </div>
          <div>
            <h4 style={s.footerColH4}>Contact</h4>
            {businessInfo.phone && (
              <a href={'tel:' + businessInfo.phone} style={s.footerLink}>{businessInfo.phone}</a>
            )}
            {businessInfo.city && (
              <span style={s.footerLink}>{businessInfo.city}, {businessInfo.state}</span>
            )}
            <SocialRow biz={businessInfo} color={c.accent} size={20} images={images} />
          </div>
        </div>
        <div style={s.footerBottom}>
          <p style={s.footerBottomP}>
            © {new Date().getFullYear()} {businessInfo.businessName} — Professional Vehicle Detailing. All rights reserved.
          </p>
          <div style={s.footerBadge}>
            {businessInfo.city} · {businessInfo.state}
          </div>
        </div>
      </footer>
    </div>
  );
}
