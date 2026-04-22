import { useState, useEffect } from 'react';
import { SocialRow } from '../SocialIcons.jsx';
import { formatHours } from '../../../../lib/formatHours.js';
import { HeroImage, AboutImage, GallerySection } from '../ImageLayers.jsx';
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import GoogleReviewsWidget from '../GoogleReviewsWidget.jsx';
import IconOrEmoji from '../IconOrEmoji.jsx';
import { getFallbacks } from '../../../../lib/templateFallbacks.js';

// Template: Mobile Sudsy
// Warm amber/cream bg, bubbly neo-brutalist mobile detailing aesthetic.
// Boogaloo display font, static CSS bubble decorators, no cursor trail JS.

export default function MobileSudsy({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const [scrolled, setScrolled] = useState(false);

  const c = templateMeta?.colors || {
    bg: '#fffbeb', accent: '#f59e0b', text: '#1c1917',
    secondary: '#fef3c7', muted: '#78716c',
  };
  const font     = templateMeta?.font     || "'Boogaloo', cursive";
  const bodyFont = templateMeta?.bodyFont || "'Nunito', sans-serif";

  const biz          = businessInfo || {};
  const fb           = getFallbacks(biz.businessType);
  const copy         = generatedCopy || {};
  const services     = copy.servicesSection?.items || [];
  const svcCols = services.length >= 6 ? Math.ceil(services.length / 2) : services.length || 1;
  const testimonials = copy.testimonialPlaceholders || [];
  const payments     = biz.paymentMethods || [];
  const packages     = biz.packages || [];
  const bizServices  = Array.isArray(biz.services) ? biz.services : [];
  const splitHero    = copy?.heroLayout === 'split';

  useEffect(() => {
    const id = 'sudsy-fonts';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id; link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Boogaloo&family=Nunito:wght@400;600;700;800;900&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);
  const hidden = (id) => copy?.hiddenSections?.includes(id);
  const getOrder = buildSectionOrder(copy, ['hero','services','process','whyUs','about','gallery','testimonials','cta']);

  const heroBubbles = [
    { w: 80,  h: 80,  top: '12%', left: '5%',  opacity: 0.18, color: '#2d9cdb' },
    { w: 50,  h: 50,  top: '30%', left: '88%', opacity: 0.22, color: '#f59e0b' },
    { w: 110, h: 110, top: '65%', left: '2%',  opacity: 0.12, color: '#2d9cdb' },
    { w: 40,  h: 40,  top: '75%', left: '80%', opacity: 0.25, color: '#f59e0b' },
    { w: 70,  h: 70,  top: '8%',  left: '62%', opacity: 0.15, color: '#2d9cdb' },
    { w: 30,  h: 30,  top: '50%', left: '92%', opacity: 0.20, color: '#f59e0b' },
  ];
  const bgBubbles = [
    { w: 120, h: 120, top: '10%', left: '3%',  opacity: 0.05 },
    { w: 60,  h: 60,  top: '55%', left: '90%', opacity: 0.07 },
    { w: 90,  h: 90,  top: '80%', left: '6%',  opacity: 0.04 },
    { w: 45,  h: 45,  top: '25%', left: '95%', opacity: 0.08 },
    { w: 75,  h: 75,  top: '45%', left: '0%',  opacity: 0.04 },
  ];

  const cardBgs    = ['#fff5f8', '#e8f6fe', '#fffadd', '#e8f8ee', '#fff0e8', '#f5f0ff'];
  const cardEmojis = ['🚿', '✨', '🧹', '🛡️', '🎨', '⚡'];

  const neoBorder = { border: `3px solid ${c.text}`, boxShadow: `5px 5px 0 ${c.text}` };

  const sectionTagStyle = (rotate = '1deg') => ({
    display: 'inline-block', background: c.accent,
    border: `3px solid ${c.text}`,
    padding: '5px 18px', borderRadius: 980,
    fontSize: 13, fontWeight: 800, fontFamily: bodyFont, color: c.text,
    boxShadow: `3px 3px 0 ${c.text}`,
    marginBottom: 14, transform: `rotate(${rotate})`,
    letterSpacing: 1, textTransform: 'uppercase',
  });

  const titleStyle = {
    fontFamily: font, fontSize: 'clamp(32px, 4vw, 52px)',
    color: c.text, lineHeight: 1.1, margin: 0,
  };

  const StaticBubble = ({ w, h, top, left, bottom, right, opacity = 0.18, color = '#2d9cdb' }) => (
    <div style={{
      position: 'absolute', width: w, height: h,
      top, left, bottom, right,
      borderRadius: '50%',
      border: `2px solid ${color}`,
      background: `${color}22`,
      opacity, pointerEvents: 'none',
    }} />
  );

  const defaultHowSteps = [
    { emoji: '📱', title: 'You Book',    desc: 'Call, text, or tap — your choice. Takes about 2 minutes.' },
    { emoji: '🚐', title: 'We Show Up',  desc: 'Our van rolls up to your driveway, parking lot, or office.' },
    { emoji: '🪧', title: 'We Clean',    desc: 'Pro gear, pro products, pro results — while you chill.' },
    { emoji: '😍', title: 'You Love It', desc: 'Spotless car, zero effort on your part. Life is good.' },
  ];
  const howSteps = (copy?.howSteps || defaultHowSteps).map((s, i) => ({
    num: String(i + 1).padStart(2, '0'),
    emoji: s.emoji ?? '✨',
    title: s.title ?? '',
    desc: s.desc ?? '',
  }));

  const defaultWhyCards = [
    { icon: '🏠', title: fb.whyUsTitle,           desc: 'Zero trips to a shop. We bring the whole operation to your door.' },
    { icon: '🏆', title: 'Professional Results', desc: 'Pro-grade products and equipment — not a bucket and a sponge.' },
    { icon: '⏰', title: 'Flexible Scheduling',  desc: 'Same-day often available. Early mornings, weekends — we work around you.' },
    { icon: '💰', title: 'Fair, Honest Pricing', desc: 'No upsell tricks. Just clear pricing for seriously good work.' },
    { icon: '😤', title: 'Zero Excuses Policy',  desc: "We show up, don't cut corners, and if it's not right — we fix it." },
    { icon: '🌎', title: 'Eco-Friendly Methods', desc: 'Water-efficient techniques and biodegradable products. Clean car, clean conscience.' },
  ];
  const whyCards = (copy?.whyCards || defaultWhyCards).filter(c => c.title || c.icon).map((card) => ({
    icon: card.icon ?? '✨',
    title: card.title ?? '',
    desc: card.desc ?? '',
  }));

  return (
    <div style={{ fontFamily: bodyFont, background: c.bg, color: c.text, minHeight: '100vh', overflowX: 'hidden', margin: 0, padding: 0, position: 'relative', containerType: 'inline-size', display: 'flex', flexDirection: 'column' }}>
      <style>{`@container(max-width:600px){.tp-nav-links a[href^="#"]{display:none!important}.tp-nav-links{gap:12px!important}.tp-2col{grid-template-columns:1fr!important}}`}</style>

      {/* STATIC BACKGROUND BUBBLES */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {bgBubbles.map((b, i) => <StaticBubble key={i} {...b} color='#2d9cdb' />)}
      </div>

      {/* NAV */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 1000,
        background: c.accent,
        borderBottom: `3px solid ${c.text}`,
        padding: '12px 5%',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: `0 4px 0 ${c.text}`,
      
        order: -1,
      }}>
        <a href='#' style={{ fontFamily: font, fontSize: 24, color: c.text, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          {images.logo ? (
            <img src={images.logo} alt={biz.businessName || 'Logo'} style={{ height: 36, objectFit: 'contain' }} />
          ) : (
            <>
              <span style={{ fontSize: 22 }}>{String.fromCodePoint(0x1FAA7)}</span>
              {biz.businessName || fb.navSubtitle}
            </>
          )}
        </a>
        <div className="tp-nav-links" style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
          {[{ label: 'Services', href: '#services' }, { label: 'How It Works', href: '#how' }, { label: 'Reviews', href: '#reviews' }].map(({ label, href }) => (
            <a key={label} href={href} style={{ fontFamily: bodyFont, fontWeight: 800, fontSize: 14, color: c.text, textDecoration: 'none', opacity: 0.8 }}>{label}</a>
          ))}
          <a href={`tel:${biz.phone}`} style={{ fontFamily: font, fontSize: 17, background: c.text, color: c.accent, padding: '8px 22px', borderRadius: 980, textDecoration: 'none', border: `2px solid ${c.text}`, boxShadow: '3px 3px 0 rgba(0,0,0,0.25)', whiteSpace: 'nowrap' }}>
            {String.fromCodePoint(0x1F4DE)} Call Us!
          </a>
        </div>
      </nav>

      {/* HERO */}
      {!hidden('hero') && (
      <header style={splitHero ? { display: 'flex', flexDirection: 'row', minHeight: '85vh' , order: getOrder('hero') } : {
        minHeight: '100vh', position: 'relative',
        display: 'flex', alignItems: 'center',
        background: `linear-gradient(135deg, ${c.bg} 0%, ${c.secondary} 60%, #fde68a 100%)`,
        overflow: 'hidden', paddingTop: 80,
      }}>
        {!splitHero && <HeroImage src={images.hero} />}
        {!splitHero && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, background: c.accent }} />}
        {!splitHero && heroBubbles.map((b, i) => <StaticBubble key={i} {...b} />)}
        {splitHero ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
            padding: 'clamp(3rem,6vw,6rem)', background: c.bg,
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: c.text, color: c.accent, fontFamily: font, fontSize: 15, padding: '7px 18px', borderRadius: 980, marginBottom: 24, alignSelf: 'flex-start' }}>
              {String.fromCodePoint(0x1F4CD)} We Come To YOU{biz.city ? ` — ${biz.city}` : ''}
            </div>
            <h1 style={{ fontFamily: font, fontSize: 'clamp(1.8rem, 5vw, 4rem)', lineHeight: 1.05, color: c.text, margin: '0 0 20px' }}>
              {copy.headline || 'Your Car Deserves Better.'}
            </h1>
            <p style={{ fontSize: 17, fontWeight: 600, color: c.muted, lineHeight: 1.7, maxWidth: 480, marginBottom: 36 }}>
              {copy.subheadline || fb.subheadline}
            </p>
            {biz.serviceArea && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#e8f6fe', border: '2.5px solid #2d9cdb', borderRadius: 14, padding: '10px 18px', marginBottom: 32, boxShadow: '3px 3px 0 #2d9cdb', fontWeight: 700, fontSize: 14, color: '#1a6fa8', alignSelf: 'flex-start' }}>
                <span style={{ fontSize: 18 }}>{String.fromCodePoint(0x1F5FA)}</span>
                Serving: {biz.serviceArea}
              </div>
            )}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <a href='#services' style={{ fontFamily: font, fontSize: 20, background: c.text, color: c.accent, padding: '12px 32px', borderRadius: 980, textDecoration: 'none', border: `3px solid ${c.text}`, boxShadow: `5px 5px 0 ${c.accent}`, display: 'inline-block' }}>
                {String.fromCodePoint(0x1FAA7)} {copy.ctaPrimary || 'Book a Detail!'}
              </a>
              <a href='#services' style={{ fontFamily: font, fontSize: 20, background: 'transparent', color: c.text, padding: '12px 28px', borderRadius: 980, textDecoration: 'none', border: `3px solid ${c.text}`, display: 'inline-block' }}>
                See Services →
              </a>
            </div>
          </div>
        ) : (
          <div className="tp-2col" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 1200, margin: '0 auto', padding: '80px 5% 60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
          {/* Hero left: copy */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: c.text, color: c.accent, fontFamily: font, fontSize: 15, padding: '7px 18px', borderRadius: 980, marginBottom: 24 }}>
              {String.fromCodePoint(0x1F4CD)} We Come To YOU{biz.city ? ` — ${biz.city}` : ''}
            </div>
            <h1 style={{ fontFamily: font, fontSize: 'clamp(1.8rem, 5vw, 4rem)', lineHeight: 1.05, color: c.text, margin: '0 0 20px' }}>
              {copy.headline || 'Your Car Deserves Better.'}
            </h1>
            <p style={{ fontSize: 17, fontWeight: 600, color: c.muted, lineHeight: 1.7, maxWidth: 480, marginBottom: 36 }}>
              {copy.subheadline || fb.subheadline}
            </p>
            {biz.serviceArea && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#e8f6fe', border: '2.5px solid #2d9cdb', borderRadius: 14, padding: '10px 18px', marginBottom: 32, boxShadow: '3px 3px 0 #2d9cdb', fontWeight: 700, fontSize: 14, color: '#1a6fa8' }}>
                <span style={{ fontSize: 18 }}>{String.fromCodePoint(0x1F5FA)}</span>
                Serving: {biz.serviceArea}
              </div>
            )}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <a href='#services' style={{ fontFamily: font, fontSize: 20, background: c.text, color: c.accent, padding: '12px 32px', borderRadius: 980, textDecoration: 'none', border: `3px solid ${c.text}`, boxShadow: `5px 5px 0 ${c.accent}`, display: 'inline-block' }}>
                {String.fromCodePoint(0x1FAA7)} {copy.ctaPrimary || 'Book a Detail!'}
              </a>
              <a href='#services' style={{ fontFamily: font, fontSize: 20, background: 'transparent', color: c.text, padding: '12px 28px', borderRadius: 980, textDecoration: 'none', border: `3px solid ${c.text}` , display: 'inline-block' }}>
                See Services →
              </a>
            </div>
          </div>
          {/* Hero right: car SVG */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <svg width='420' height='280' viewBox='0 0 420 280' fill='none' xmlns='http://www.w3.org/2000/svg' style={{ maxWidth: '100%', height: 'auto' }}>
              <ellipse cx='210' cy='248' rx='160' ry='18' fill='rgba(0,0,0,0.08)' />
              <rect x='40' y='160' width='340' height='72' rx='16' fill='#2D9CDB' />
              <rect x='40' y='160' width='340' height='72' rx='16' fill='url(#carGradSudsy)' />
              <path d='M110 160 C120 110 150 90 180 85 L240 85 C270 85 300 110 310 160 Z' fill='#1A7BB8' />
              <path d='M115 155 C125 112 152 95 182 90 L238 90 C268 90 295 112 305 155 Z' fill='#2D9CDB' />
              <path d='M130 150 C138 120 158 104 178 100 L220 100 L225 150 Z' fill='#C8F0FF' stroke='white' strokeWidth='2' />
              <path d='M195 150 L210 100 L240 100 C262 104 278 118 285 150 Z' fill='#C8F0FF' stroke='white' strokeWidth='2' />
              <line x1='210' y1='162' x2='210' y2='230' stroke='white' strokeWidth='2.5' strokeDasharray='4 3' />
              <rect x='150' y='192' width='30' height='8' rx='4' fill='white' opacity='0.7' />
              <rect x='240' y='192' width='30' height='8' rx='4' fill='white' opacity='0.7' />
              <rect x='125' y='168' width='36' height='26' rx='6' fill='#C8F0FF' opacity='0.8' />
              <rect x='258' y='168' width='36' height='26' rx='6' fill='#C8F0FF' opacity='0.8' />
              <circle cx='108' cy='232' r='34' fill='#1A1A2E' />
              <circle cx='108' cy='232' r='24' fill='#333' />
              <circle cx='108' cy='232' r='14' fill='#AAA' />
              <circle cx='108' cy='232' r='6'  fill='#FFE234' />
              <circle cx='312' cy='232' r='34' fill='#1A1A2E' />
              <circle cx='312' cy='232' r='24' fill='#333' />
              <circle cx='312' cy='232' r='14' fill='#AAA' />
              <circle cx='312' cy='232' r='6'  fill='#FFE234' />
              <rect x='44'  y='174' width='32' height='20' rx='8' fill='#FFE234' stroke='#1c1917' strokeWidth='2' />
              <rect x='344' y='174' width='32' height='20' rx='8' fill='#FF6B6B' stroke='#1c1917' strokeWidth='2' />
              <rect x='36'  y='196' width='22' height='28' rx='6' fill='#1A7BB8' stroke='white' strokeWidth='1.5' />
              <rect x='362' y='196' width='22' height='28' rx='6' fill='#1A7BB8' stroke='white' strokeWidth='1.5' />
              <path d='M145 105 Q165 95 185 100' stroke='white' strokeWidth='3' strokeLinecap='round' opacity='0.5' />
              <path d='M150 118 Q175 108 195 112' stroke='white' strokeWidth='2' strokeLinecap='round' opacity='0.3' />
              <defs>
                <linearGradient id='carGradSudsy' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='0%' stopColor='rgba(255,255,255,0.15)' />
                  <stop offset='100%' stopColor='rgba(0,0,0,0.1)' />
                </linearGradient>
              </defs>
            </svg>
            {[{ s: { top: 10, right: 60  }, l: '✨', sz: 24 },
              { s: { top: 55, left: 55   }, l: '💫', sz: 18 },
              { s: { bottom: 65, right: 35 }, l: '⭐', sz: 28 },
              { s: { top: 5, left: 130 }, l: '✨', sz: 16 },
            ].map((x, i) => (
              <span key={i} style={{ position: 'absolute', fontSize: x.sz, ...x.s, pointerEvents: 'none' }}>{x.l}</span>
            ))}
          </div>
        </div>
        )}
        {!splitHero && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: c.text, clipPath: 'polygon(0 100%, 3% 0, 6% 100%, 9% 0, 12% 100%, 15% 0, 18% 100%, 21% 0, 24% 100%, 27% 0, 30% 100%, 33% 0, 36% 100%, 39% 0, 42% 100%, 45% 0, 48% 100%, 51% 0, 54% 100%, 57% 0, 60% 100%, 63% 0, 66% 100%, 69% 0, 72% 100%, 75% 0, 78% 100%, 81% 0, 84% 100%, 87% 0, 90% 100%, 93% 0, 96% 100%, 99% 0, 100% 100%)' }} />}
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


      {/* SERVICES */}
      {!hidden('services') && (
      <section id='services' style={{ padding: '100px 5%', background: c.bg, position: 'relative', order: getOrder('services') }}>
        <div style={{ maxWidth: 1200, margin: '0 auto'  }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={sectionTagStyle('1deg')}>{String.fromCodePoint(0x1FAA7)} Our Services</div>
            <h2 style={titleStyle}>We clean <span style={{ color: '#2d9cdb' }}>everything.</span></h2>
            {copy.servicesSection?.intro && (
              <p style={{ fontSize: 15, color: c.muted, fontWeight: 600, marginTop: 12, maxWidth: 520, margin: '12px auto 0' }}>{copy.servicesSection.intro}</p>
            )}
          </div>
          {packages.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
              {packages.map((pkg, i) => {
                const isFeatured = i === Math.floor(packages.length / 2);
                return (
                  <div key={i} style={{ background: isFeatured ? c.text : cardBgs[i % cardBgs.length], ...neoBorder, borderRadius: 24, padding: '36px 28px', textAlign: 'center', position: 'relative' }}>
                    {isFeatured && (<div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: c.accent, color: c.text, fontWeight: 900, fontSize: 11, letterSpacing: 2, padding: '4px 16px', borderRadius: 980, whiteSpace: 'nowrap', border: `2px solid ${c.text}` }}>MOST POPULAR</div>)}
                    <div style={{ fontFamily: font, fontSize: 22, marginBottom: 8, color: isFeatured ? c.accent : c.text }}>{pkg.name || pkg}</div>
                    {pkg.price && (<div style={{ fontFamily: font, fontSize: '1.8rem', color: isFeatured ? '#fff' : c.text, margin: '0.4rem 0 0.75rem' }}>{pkg.price}</div>)}
                    {pkg.description && (<p style={{ fontSize: 14, lineHeight: 1.6, color: isFeatured ? 'rgba(255,255,255,0.75)' : '#666', fontWeight: 600 }}>{pkg.description}</p>)}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${svcCols}, 1fr)`, gap: 24 }}>
              {services.length > 0
                ? services.map((s, i) => (
                    <div key={i} style={{ background: cardBgs[i % cardBgs.length], ...neoBorder, borderRadius: 24, padding: '36px 32px' }}>
                      <span style={{ fontSize: 48, marginBottom: 14, display: 'block' }}>{cardEmojis[i % cardEmojis.length]}</span>
                      <h3 style={{ fontFamily: font, fontSize: 26, color: c.text, marginBottom: 10 }}>{s.name}</h3>
                      <p style={{ fontSize: 14, color: '#555', lineHeight: 1.65, fontWeight: 600, margin: 0 }}>{s.description}</p>
                    </div>
                  ))
                : bizServices.map((s, i) => (
                    <div key={i} style={{ background: cardBgs[i % cardBgs.length], ...neoBorder, borderRadius: 24, padding: '32px 28px' }}>
                      <span style={{ fontSize: 40, marginBottom: 12, display: 'block' }}>{cardEmojis[i % cardEmojis.length]}</span>
                      <h3 style={{ fontFamily: font, fontSize: 24, color: c.text, margin: 0 }}>{s}</h3>
                    </div>
                  ))
              }
            </div>
          )}
        </div>
      </section>
      )}

      {/* HOW IT WORKS */}
      {!hidden('process') && (
      <section id='how' style={{ background: c.accent, padding: '100px 5%', borderTop: `4px solid ${c.text}`, borderBottom: `4px solid ${c.text}`, position: 'relative', overflow: 'hidden', order: getOrder('process') }}>
        <div style={{ position: 'absolute', top: 10, left: 0, right: 0, fontSize: 20, letterSpacing: 10, opacity: 0.2, whiteSpace: 'nowrap', overflow: 'hidden', pointerEvents: 'none'  }}>
          {String.fromCodePoint(0x1FAA7).repeat(40)}
        </div>
        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={sectionTagStyle('-1deg')}>{String.fromCodePoint(0x1F5FA)} Super Simple</div>
            <h2 style={titleStyle}>How it <span style={{ color: '#fff' }}>works</span> {String.fromCodePoint(0x1F914)}</h2>
            <p style={{ fontSize: 15, color: 'rgba(28,25,23,0.7)', fontWeight: 600, marginTop: 12 }}>Spoiler: it’s embarrassingly easy.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {howSteps.map((step, i) => (
              <div key={i} style={{ background: '#fff', ...neoBorder, borderRadius: 24, padding: '36px 28px', textAlign: 'center' }}>
                <div style={{ fontFamily: font, fontSize: 52, color: '#2d9cdb', lineHeight: 1, marginBottom: 8 }}>{step.num}</div>
                <span style={{ fontSize: 42, marginBottom: 14, display: 'block' }}><IconOrEmoji value={step.emoji} size={42} color={c.accent} /></span>
                <h3 style={{ fontFamily: font, fontSize: 22, color: c.text, marginBottom: 8 }}>{step.title}</h3>
                <p style={{ fontSize: 13, color: '#666', fontWeight: 600, lineHeight: 1.55, margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* WHY US */}
      {!hidden('whyUs') && (
      <section style={{ padding: '100px 5%', background: '#2d9cdb', borderBottom: `4px solid ${c.text}`, position: 'relative', overflow: 'hidden' , order: getOrder('whyUs') }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ ...sectionTagStyle(), background: '#fff' }}>{String.fromCodePoint(0x1F4AA)} Why Choose Us</div>
            <h2 style={{ ...titleStyle, color: '#fff' }}>We’re kinda <span style={{ color: c.accent }}>obsessed</span> with clean cars.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {whyCards.map((card, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.12)', border: '3px solid rgba(255,255,255,0.4)', borderRadius: 24, padding: '32px 24px', backdropFilter: 'blur(10px)' }}>
                <span style={{ fontSize: 42, marginBottom: 14, display: 'block' }}><IconOrEmoji value={card.icon} size={42} color="#fff" /></span>
                <h3 style={{ fontFamily: font, fontSize: 22, color: '#fff', marginBottom: 8 }}>{card.title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', fontWeight: 600, lineHeight: 1.6, margin: 0 }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ABOUT */}
      {!hidden('about') && (
      <section id="about" style={{ padding: "100px 5%", background: c.bg , order: getOrder('about') }}>
        <div className="tp-2col" style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div>
            {(copy?.aboutLayout || 'image') !== 'stats' ? (
              images.about
                ? <img src={images.about} alt="About" style={{ width: '100%', maxWidth: 460, height: 360, objectFit: 'cover', borderRadius: 20, display: 'block', ...neoBorder }} />
                : <div style={{ width: '100%', maxWidth: 460, height: 360, background: c.secondary, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.muted, fontSize: '0.85rem', textAlign: 'center', padding: 24, boxSizing: 'border-box', ...neoBorder }}>Upload an about photo in the Images tab</div>
            ) : (
              <div style={{ width: '100%', maxWidth: 460, background: c.secondary, borderRadius: 20, padding: '40px 32px', boxSizing: 'border-box', ...neoBorder  }}>
                {(() => {
                  const defaultStats = [
                    { value: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '10+', label: 'Years Experience' },
                    { value: '500+', label: fb.statLabel },
                    { value: '5★', label: 'Avg Rating' },
                  ];
                  const aboutStats = (copy?.aboutStats || []).map((s, i) => ({
                    value: s.value || defaultStats[i]?.value || '',
                    label: s.label || defaultStats[i]?.label || '',
                  }));
                  if (aboutStats.length === 0) aboutStats.push(...defaultStats);
                  return aboutStats.map((st, i) => (
                    <div key={i} style={{ textAlign: 'center', marginBottom: i < aboutStats.length - 1 ? 28 : 0 }}>
                      <div style={{ fontFamily: font, fontSize: '3rem', color: c.accent, lineHeight: 1 }}>{st.value}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: c.muted, marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 }}>{st.label}</div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
          <div>
            <div style={sectionTagStyle("-1deg")}>About Us</div>
            <h2 style={{ ...titleStyle, marginTop: 8, marginBottom: 20 }}>{biz.businessName || fb.shopName}</h2>
            <p style={{ fontSize: 15, fontWeight: 600, color: c.muted, lineHeight: 1.8, marginBottom: 20 }}>
              {copy.aboutText || 'We started with a bucket, a dream, and a serious love for clean cars. Today we bring that same passion to every vehicle we touch.'}
            </p>
            {biz.awards && (
              <div style={{ background: "#fffadd", border: `2.5px solid ${c.accent}`, borderRadius: 14, padding: "16px 20px", boxShadow: `3px 3px 0 ${c.accent}`, marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase", color: "#92400e", marginBottom: 6 }}>Awards</div>
                <p style={{ fontSize: 14, color: "#92400e", fontWeight: 600, lineHeight: 1.6, margin: 0 }}>{Array.isArray(biz.awards) ? biz.awards.join(" · ") : biz.awards}</p>
              </div>
            )}
            {payments.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase", color: c.muted, marginBottom: 10 }}>Payment Accepted</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {payments.map((pay, i) => (<span key={i} style={{ background: c.secondary, border: `2px solid ${c.text}`, borderRadius: 980, padding: "4px 14px", fontSize: 12, fontWeight: 800, color: c.text }}>{pay}</span>))}
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

      {/* TESTIMONIALS */}
      {!hidden('testimonials') && (
        copy?.googleWidgetKey ? (
          <div style={{ order: getOrder('testimonials'), padding: '80px 5%' }}>
            {copy.googleReviewsTitle && <h2 style={{ fontFamily: font || 'inherit', fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, textAlign: 'center', marginBottom: 32, color: c.text }}>{copy.googleReviewsTitle}</h2>}
            <GoogleReviewsWidget widgetKey={copy.googleWidgetKey} theme={copy?.googleReviewsTheme} />
          </div>
        ) : testimonials.length > 0 ? (
        <section id="reviews" style={{ padding: "100px 5%", background: c.bg, borderTop: `4px solid ${c.text}` , order: getOrder('testimonials') }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <div style={sectionTagStyle()}>Reviews</div>
              <h2 style={titleStyle}>They used to have <span style={{ color: "#ff6b9d" }}>dirty cars</span> too.</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
              {testimonials.map((t, i) => {
                const reviewBgs = ["#fff5f8", "#fffadd", "#e8f6fe"];
                const decorEmojis = ["🤩", "🫶", "😂"];
                const initials = t.name ? t.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "⭐";
                return (
                  <div key={i} style={{ background: reviewBgs[i % reviewBgs.length], ...neoBorder, borderRadius: 24, padding: "32px", position: "relative", transform: i % 2 === 1 ? "rotate(1deg)" : "none" }}>
                    <div style={{ position: "absolute", top: -18, right: 24, fontSize: 32 }}>{decorEmojis[i % decorEmojis.length]}</div>
                    <div style={{ fontSize: 20, letterSpacing: 2, marginBottom: 14 }}>⭐⭐⭐⭐⭐</div>
                    <p style={{ fontSize: 15, color: c.text, lineHeight: 1.7, fontWeight: 600, fontStyle: "italic", margin: "0 0 20px" }}>"{t.text}"</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 46, height: 46, borderRadius: "50%", background: c.accent, border: `3px solid ${c.text}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, fontSize: 18, color: c.text, fontWeight: 700, flexShrink: 0, boxShadow: `3px 3px 0 ${c.text}` }}>
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: c.text }}>{t.name}</div>
                        {t.role && <div style={{ fontSize: 12, color: c.muted, fontWeight: 600 }}>{t.role}</div>}
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

      {/* CTA SECTION */}
      {!hidden('cta') && (
      <section id="contact" style={{ background: "#ff6b9d", borderTop: `4px solid ${c.text}`, borderBottom: `4px solid ${c.text}`, padding: "80px 5%" , order: getOrder('cta') }}>
        <div className="tp-2col" style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div>
            <h2 style={{ fontFamily: font, fontSize: "clamp(36px, 4vw, 58px)", color: "#fff", lineHeight: 1.05, marginBottom: 20 }}>
              {copy.ctaHeadline || 'Ready for the cleanest car of your life?'}
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.85)", fontWeight: 600, lineHeight: 1.65, marginBottom: 32 }}>
              {copy.ctaSubtext || copy.ctaSecondary || "We bring everything — water, power, products. You just point us to the car."}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                biz.phone ? { icon: "📞", label: "Give us a ring!", val: biz.phone } : null,
                { icon: "📍", label: "We serve!", val: biz.serviceArea || (biz.city ? biz.city + " & surrounding areas" : "Your area") },
                biz.hours ? { icon: "🕐", label: "Hours!", val: formatHours(biz.hours) } : null,
              ].filter(Boolean).map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", ...neoBorder, borderRadius: 16, padding: "14px 20px" }}>
                  <span style={{ fontSize: 28 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5 }}>{item.label}</div>
                    <div style={{ fontFamily: font, fontSize: 16, color: c.text }}>{item.val}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ background: "#fff", ...neoBorder, borderRadius: 28, padding: "48px 40px", textAlign: "center", boxShadow: `8px 8px 0 ${c.text}`, width: "100%" }}>
              <h3 style={{ fontFamily: font, fontSize: 28, color: c.text, marginBottom: 16 }}>{fb.ctaHeadline}!</h3>
              <p style={{ fontSize: 14, color: c.muted, fontWeight: 600, lineHeight: 1.6, marginBottom: 28 }}>Call or text us to schedule. We’ll come to your door.</p>
              <a href={copy?.ctaUrl || (`tel:${biz.phone}`)} style={{ display: "block", background: c.accent, color: c.text, border: `3px solid ${c.text}`, borderRadius: 16, padding: "16px", fontFamily: font, fontSize: 22, textDecoration: "none", boxShadow: `5px 5px 0 ${c.text}` }}>
                {copy.ctaButtonText || `📞 ${biz.phone || "Call Now!"}`}
              </a>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* FOOTER */}
      <footer style={{ background: c.text, padding: "60px 5% 28px", position: "relative", overflow: "hidden" , order: 9999 }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 40, background: "#ff6b9d", clipPath: "polygon(0 0, 3% 100%, 6% 0, 9% 100%, 12% 0, 15% 100%, 18% 0, 21% 100%, 24% 0, 27% 100%, 30% 0, 33% 100%, 36% 0, 39% 100%, 42% 0, 45% 100%, 48% 0, 51% 100%, 54% 0, 57% 100%, 60% 0, 63% 100%, 66% 0, 69% 100%, 72% 0, 75% 100%, 78% 0, 81% 100%, 84% 0, 87% 100%, 90% 0, 93% 100%, 96% 0, 99% 100%, 100% 0)" }} />
        <div style={{ maxWidth: 1200, margin: "0 auto", paddingTop: 48, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 48, marginBottom: 48 }}>
          <div>
            {/* Footer logo */}
            {images.logo ? (
              <img src={images.logo} alt={biz.businessName} style={{ height: 48, maxWidth: 180, objectFit: 'contain', marginBottom: '0.75rem', display: 'block' }} />
            ) : (
              <div style={{ fontFamily: font, fontSize: 26, color: c.accent, display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span>🪧</span>
                {biz.businessName || fb.navSubtitle}
              </div>
            )}
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, fontWeight: 600, maxWidth: 240 }}>
              {copy.footerTagline || "We make dirty cars shine."}
            </p>
          </div>
          <div>
            <h4 style={{ fontFamily: font, fontSize: 20, color: c.accent, marginBottom: 16 }}>Services</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(services.length > 0 ? services.map(s => s.name) : bizServices).slice(0, 6).map((name, i) => (
                <a key={i} href="#services" style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>{name}</a>
              ))}
            </div>
          </div>
          <div>
            <h4 style={{ fontFamily: font, fontSize: 20, color: c.accent, marginBottom: 16 }}>Contact</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {biz.phone && <a href={`tel:${biz.phone}`} style={{ fontSize: 13, fontWeight: 700, color: c.accent, textDecoration: "none" }}>{biz.phone}</a>}
              {biz.address && <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>{biz.address}</span>}
              {(biz.city || biz.state) && <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>{[biz.city, biz.state].filter(Boolean).join(", ")}</span>}
              {biz.serviceArea && <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>Serving: {biz.serviceArea}</span>}
            </div>
          </div>
          <div>
            <h4 style={{ fontFamily: font, fontSize: 20, color: c.accent, marginBottom: 16 }}>Follow Us</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <SocialRow biz={biz} color={c.accent} size={20} images={images} />
              <a href="#services" style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>View Services</a>
              <a href="#reviews"  style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Reviews</a>
            </div>
          </div>
        </div>
        <div style={{ borderTop: "2px dashed rgba(255,255,255,0.12)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)", margin: 0 }}>
            &copy; {new Date().getFullYear()} {biz.businessName || fb.navSubtitle}{biz.city ? " · " + biz.city : ""}{biz.state ? ", " + biz.state : ""} · All rights reserved
          </p>
          <div style={{ fontFamily: font, fontSize: 18, color: c.accent, display: "flex", alignItems: "center", gap: 6 }}>
            <span>🪧</span>
            {copy.footerTagline ? copy.footerTagline.split(".")[0] : "We make dirty cars shine."}
          </div>
        </div>
      </footer>

    </div>
  );
}