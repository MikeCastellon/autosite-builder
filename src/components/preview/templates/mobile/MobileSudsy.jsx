import { useState, useEffect } from 'react';
import { SocialRow } from '../SocialIcons.jsx';
import { HeroImage, AboutImage, GallerySection } from '../ImageLayers.jsx';

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
  const copy         = generatedCopy || {};
  const services     = copy.servicesSection?.items || [];
  const svcCols = services.length >= 6 ? Math.ceil(services.length / 2) : services.length || 1;
  const testimonials = copy.testimonialPlaceholders || [];
  const payments     = biz.paymentMethods || [];
  const packages     = biz.packages || [];
  const bizServices  = Array.isArray(biz.services) ? biz.services : [];

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

  const howSteps = [
    { num: '01', emoji: '📱', title: 'You Book',    desc: 'Call, text, or tap — your choice. Takes about 2 minutes.' },
    { num: '02', emoji: '🚐', title: 'We Show Up',  desc: 'Our van rolls up to your driveway, parking lot, or office.' },
    { num: '03', emoji: '🪧', title: 'We Clean',    desc: 'Pro gear, pro products, pro results — while you chill.' },
    { num: '04', emoji: '😍', title: 'You Love It', desc: 'Spotless car, zero effort on your part. Life is good.' },
  ];

  const whyCards = [
    { icon: '🏠', title: 'We Come To You',      desc: 'Zero trips to a shop. We bring the whole operation to your door.' },
    { icon: '🏆', title: 'Professional Results', desc: 'Pro-grade products and equipment — not a bucket and a sponge.' },
    { icon: '⏰',     title: 'Flexible Scheduling',  desc: 'Same-day often available. Early mornings, weekends — we work around you.' },
    { icon: '💰', title: 'Fair, Honest Pricing', desc: 'No upsell tricks. Just clear pricing for seriously good work.' },
    { icon: '😤', title: 'Zero Excuses Policy',  desc: "We show up, don't cut corners, and if it's not right — we fix it." },
    { icon: '🌎', title: 'Eco-Friendly Methods', desc: 'Water-efficient techniques and biodegradable products. Clean car, clean conscience.' },
  ];

  return (
    <div style={{ fontFamily: bodyFont, background: c.bg, color: c.text, minHeight: '100vh', overflowX: 'hidden', margin: 0, padding: 0, position: 'relative', containerType: 'inline-size' }}>
      <style>{`@container(max-width:600px){.tp-nav-links a[href^="#"]{display:none!important}.tp-nav-links{gap:12px!important}.tp-2col{grid-template-columns:1fr!important}}`}</style>

      {/* STATIC BACKGROUND BUBBLES */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {bgBubbles.map((b, i) => <StaticBubble key={i} {...b} color='#2d9cdb' />)}
      </div>

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: c.accent,
        borderBottom: `3px solid ${c.text}`,
        padding: '12px 5%',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: `0 4px 0 ${c.text}`,
      }}>
        <a href='#' style={{ fontFamily: font, fontSize: 24, color: c.text, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          {images.logo ? (
            <img src={images.logo} alt={biz.businessName || 'Logo'} style={{ height: 36, objectFit: 'contain' }} />
          ) : (
            <>
              <span style={{ fontSize: 22 }}>{String.fromCodePoint(0x1FAA7)}</span>
              {biz.businessName || 'Mobile Detailing'}
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
      <header style={{
        minHeight: '100vh', position: 'relative',
        display: 'flex', alignItems: 'center',
        background: `linear-gradient(135deg, ${c.bg} 0%, ${c.secondary} 60%, #fde68a 100%)`,
        overflow: 'hidden', paddingTop: 80,
      }}>
        <HeroImage src={images.hero} />
        {/* Top stripe */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, background: c.accent }} />
        {heroBubbles.map((b, i) => <StaticBubble key={i} {...b} />)}
        <div className="tp-2col" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 1200, margin: '0 auto', padding: '80px 5% 60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
          {/* Hero left: copy */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: c.text, color: c.accent, fontFamily: font, fontSize: 15, padding: '7px 18px', borderRadius: 980, marginBottom: 24 }}>
              {String.fromCodePoint(0x1F4CD)} We Come To YOU{biz.city ? ` — ${biz.city}` : ''}
            </div>
            <h1 style={{ fontFamily: font, fontSize: 'clamp(1.8rem, 7vw, 5.5rem)', lineHeight: 1.05, color: c.text, margin: '0 0 20px' }}>
              {copy.headline || 'Your Car Deserves Better.'}
            </h1>
            <p style={{ fontSize: 17, fontWeight: 600, color: c.muted, lineHeight: 1.7, maxWidth: 480, marginBottom: 36 }}>
              {copy.subheadline || 'Professional mobile detailing that comes to you. We bring the shine — you bring the car.'}
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
        {/* Bottom zigzag */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: c.text, clipPath: 'polygon(0 100%, 3% 0, 6% 100%, 9% 0, 12% 100%, 15% 0, 18% 100%, 21% 0, 24% 100%, 27% 0, 30% 100%, 33% 0, 36% 100%, 39% 0, 42% 100%, 45% 0, 48% 100%, 51% 0, 54% 100%, 57% 0, 60% 100%, 63% 0, 66% 100%, 69% 0, 72% 100%, 75% 0, 78% 100%, 81% 0, 84% 100%, 87% 0, 90% 100%, 93% 0, 96% 100%, 99% 0, 100% 100%)' }} />
      </header>

      {/* TRUST BAR */}
      <div style={{ background: c.text, padding: '20px 5%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 40, flexWrap: 'wrap' }}>
        {[
          { icon: '⭐', label: '5-Star Rated' },
          { icon: '🚗', label: biz.yearsInBusiness ? biz.yearsInBusiness + '+ Years Experience' : '2,000+ Cars Cleaned' },
          { icon: '📍', label: 'We Come To You!' },
          { icon: '⚡', label: 'Same-Day Available' },
          { icon: '💯', label: 'Satisfaction Guaranteed' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: font, fontSize: 17, color: c.accent }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            {item.label}
          </div>
        ))}
      </div>

      {/* SERVICE AREA BANNER */}
      {biz.serviceArea && (
        <div style={{ background: '#2d9cdb', color: '#fff', padding: '14px 5%', textAlign: 'center', fontFamily: font, fontSize: 18, letterSpacing: 1, borderTop: `3px solid ${c.text}`, borderBottom: `3px solid ${c.text}` }}>
          {String.fromCodePoint(0x1F4CD)} Serving: {biz.serviceArea} — We Come To You!
        </div>
      )}

      {/* SERVICES */}
      <section id='services' style={{ padding: '100px 5%', background: c.bg, position: 'relative' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={sectionTagStyle('1deg')}>{String.fromCodePoint(0x1FAA7)} Our Services</div>
            <h2 style={titleStyle}>We clean <span style={{ color: '#2d9cdb' }}>everything.</span></h2>
            {copy.servicesSection?.intro && (
              <p style={{ fontSize: 15, color: c.muted, fontWeight: 600, marginTop: 12, maxWidth: 520, margin: '12px auto 0' }}>{copy.servicesSection.intro}</p>
            )}
          </div>
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
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id='how' style={{ background: c.accent, padding: '100px 5%', borderTop: `4px solid ${c.text}`, borderBottom: `4px solid ${c.text}`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 10, left: 0, right: 0, fontSize: 20, letterSpacing: 10, opacity: 0.2, whiteSpace: 'nowrap', overflow: 'hidden', pointerEvents: 'none' }}>
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
                <span style={{ fontSize: 42, marginBottom: 14, display: 'block' }}>{step.emoji}</span>
                <h3 style={{ fontFamily: font, fontSize: 22, color: c.text, marginBottom: 8 }}>{step.title}</h3>
                <p style={{ fontSize: 13, color: '#666', fontWeight: 600, lineHeight: 1.55, margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section style={{ padding: '100px 5%', background: '#2d9cdb', borderBottom: `4px solid ${c.text}`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ ...sectionTagStyle(), background: '#fff' }}>{String.fromCodePoint(0x1F4AA)} Why Choose Us</div>
            <h2 style={{ ...titleStyle, color: '#fff' }}>We’re kinda <span style={{ color: c.accent }}>obsessed</span> with clean cars.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {whyCards.map((card, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.12)', border: '3px solid rgba(255,255,255,0.4)', borderRadius: 24, padding: '36px 28px', backdropFilter: 'blur(10px)' }}>
                <span style={{ fontSize: 48, marginBottom: 16, display: 'block' }}>{card.icon}</span>
                <h3 style={{ fontFamily: font, fontSize: 24, color: '#fff', marginBottom: 10 }}>{card.title}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)', fontWeight: 600, lineHeight: 1.65, margin: 0 }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PACKAGES */}
      {packages.length > 0 && (
        <section id="pricing" style={{ padding: "100px 5%", background: c.secondary, borderBottom: `4px solid ${c.text}` }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <div style={sectionTagStyle()}>Pricing</div>
              <h2 style={titleStyle}>Choose Your Package</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
              {packages.map((pkg, i) => {
                const isFeatured = i === Math.floor(packages.length / 2);
                return (
                  <div key={i} style={{ background: isFeatured ? c.text : "#fff", ...neoBorder, borderRadius: 24, padding: "36px 28px", textAlign: "center", position: "relative" }}>
                    {isFeatured && (<div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: c.accent, color: c.text, fontWeight: 900, fontSize: 11, letterSpacing: 2, padding: "4px 16px", borderRadius: 980, whiteSpace: "nowrap", border: `2px solid ${c.text}` }}>MOST POPULAR</div>)}
                    <div style={{ fontFamily: font, fontSize: 22, marginBottom: 8, color: isFeatured ? c.accent : c.text }}>{typeof pkg === "object" ? pkg.name : pkg}</div>
                    {typeof pkg === "object" && pkg.price && (<div style={{ fontFamily: font, fontSize: 36, color: isFeatured ? "#fff" : c.text, marginBottom: 12 }}>{pkg.price}</div>)}
                    {typeof pkg === "object" && pkg.description && (<p style={{ fontSize: 14, lineHeight: 1.6, color: isFeatured ? "rgba(255,255,255,0.75)" : "#666", fontWeight: 600, marginBottom: 20 }}>{pkg.description}</p>)}
                    <a href={`tel:${biz.phone}`} style={{ display: "inline-block", marginTop: 8, background: isFeatured ? c.accent : c.text, color: isFeatured ? c.text : c.accent, padding: "10px 28px", fontFamily: font, fontSize: 18, borderRadius: 980, textDecoration: "none", border: `3px solid ${c.text}` }}>Book Now</a>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ABOUT + HOURS */}
      <section id="about" style={{ padding: "100px 5%", background: c.bg }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 56, alignItems: "start" }}>
          <div>
            <div style={sectionTagStyle("-1deg")}>About Us</div>
            <h2 style={{ ...titleStyle, marginTop: 8, marginBottom: 20 }}>{biz.businessName || "We Detail"}</h2>
            <p style={{ fontSize: 15, fontWeight: 600, color: c.muted, lineHeight: 1.8, marginBottom: 20 }}>
              {copy.aboutText || 'We started with a bucket, a dream, and a serious love for clean cars. Today we bring that same passion to every vehicle we touch.'}
            </p>
            <div style={{ marginTop: '2rem' }}><AboutImage src={images.about} accent={c.accent} /></div>
            {biz.yearsInBusiness && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: c.secondary, ...neoBorder, borderRadius: 16, padding: "12px 18px", marginBottom: 16, fontWeight: 800, fontSize: 14, color: c.text }}>
                {biz.yearsInBusiness}+ Years in Business
              </div>
            )}
            {biz.specialties && (
              <div style={{ background: "#e8f6fe", border: "2.5px solid #2d9cdb", borderRadius: 14, padding: "16px 20px", boxShadow: "3px 3px 0 #2d9cdb", marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase", color: "#1a6fa8", marginBottom: 6 }}>Specialties</div>
                <p style={{ fontSize: 14, color: "#1a6fa8", fontWeight: 600, lineHeight: 1.6, margin: 0 }}>{Array.isArray(biz.specialties) ? biz.specialties.join(" · ") : biz.specialties}</p>
              </div>
            )}
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
          <div>
            {biz.hours && (typeof biz.hours === 'string' ? biz.hours.trim() : Object.keys(biz.hours).length > 0) && (() => {
              const lines = typeof biz.hours === 'string'
                ? biz.hours.split(/[·;|]+/).map(s => s.trim()).filter(Boolean)
                : Object.entries(biz.hours).map(([d, h]) => `${d}: ${h}`);
              return (
              <div style={{ background: c.secondary, ...neoBorder, borderRadius: 24, padding: "28px 24px", marginBottom: 16 }}>
                <div style={{ fontFamily: font, fontSize: 22, color: c.text, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>Hours of Operation</div>
                {lines.map((line, i) => (
                  <div key={i} style={{ borderBottom: "2px dashed rgba(28,25,23,0.12)", paddingBottom: 10, marginBottom: 10, fontSize: 14, fontWeight: 700, color: c.text }}>
                    {line}
                  </div>
                ))}
              </div>
              );
            })()}
            {biz.address && (
              <div style={{ background: "#fff5f8", border: "2.5px solid #ff6b9d", borderRadius: 14, padding: "16px 20px", boxShadow: "3px 3px 0 #ff6b9d" }}>
                <div style={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase", color: "#be185d", marginBottom: 6 }}>Location</div>
                <p style={{ fontSize: 14, color: "#be185d", fontWeight: 600, lineHeight: 1.6, margin: 0 }}>
                  {biz.address}{biz.city ? `, ${biz.city}` : ""}{biz.state ? `, ${biz.state}` : ""}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      {testimonials.length > 0 && (
        <section id="reviews" style={{ padding: "100px 5%", background: c.bg, borderTop: `4px solid ${c.text}` }}>
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
      )}

      {/* CTA SECTION */}
      <section style={{ background: "#ff6b9d", borderTop: `4px solid ${c.text}`, borderBottom: `4px solid ${c.text}`, padding: "80px 5%" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 64, alignItems: "center" }}>
          <div>
            <h2 style={{ fontFamily: font, fontSize: "clamp(36px, 4vw, 58px)", color: "#fff", lineHeight: 1.05, marginBottom: 20 }}>
              Ready for the cleanest car of your life?
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.85)", fontWeight: 600, lineHeight: 1.65, marginBottom: 32 }}>
              {copy.ctaSecondary || "We bring everything — water, power, products. You just point us to the car."}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[{ icon: "📞", label: "Give us a ring!", val: biz.phone || "Call us anytime" },
                { icon: "📍", label: "We serve!",       val: biz.serviceArea || (biz.city ? biz.city + " & surrounding areas" : "Your area") },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", ...neoBorder, borderRadius: 16, padding: "14px 20px" }}>
                  <span style={{ fontSize: 28 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5 }}>{item.label}</div>
                    <div style={{ fontFamily: font, fontSize: 18, color: c.text }}>{item.val}</div>
                  </div>
                </div>
              ))}
              {biz.hours && (
                <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", ...neoBorder, borderRadius: 16, padding: "14px 20px" }}>
                  <span style={{ fontSize: 28 }}>🕐</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5 }}>Hours!</div>
                    <div style={{ fontFamily: font, fontSize: 15, color: c.text }}>{typeof biz.hours === 'string' ? biz.hours : Object.entries(biz.hours).map(([d, h]) => `${d}: ${h}`).join(" · ")}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ background: "#fff", ...neoBorder, borderRadius: 28, padding: "48px 40px", textAlign: "center", boxShadow: `8px 8px 0 ${c.text}`, width: "100%", maxWidth: 420 }}>
              <h3 style={{ fontFamily: font, fontSize: 28, color: c.text, marginBottom: 16 }}>Book Your Detail!</h3>
              <p style={{ fontSize: 14, color: c.muted, fontWeight: 600, lineHeight: 1.6, marginBottom: 28 }}>Call or text us to schedule. We’ll come to your door.</p>
              <a href={`tel:${biz.phone}`} style={{ display: "block", background: c.accent, color: c.text, border: `3px solid ${c.text}`, borderRadius: 16, padding: "16px", fontFamily: font, fontSize: 22, textDecoration: "none", boxShadow: `5px 5px 0 ${c.text}`, marginBottom: 12 }}>
                📞 {biz.phone || "Call Now!"}
              </a>
              {biz.priceRange && <p style={{ fontSize: 12, color: c.muted, fontWeight: 700, margin: 0 }}>Starting price range: {biz.priceRange}</p>}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}

      {/* GALLERY */}
      <GallerySection images={images} colors={c} font={templateMeta.font} bodyFont={bodyFont} />
      <footer style={{ background: c.text, padding: "60px 5% 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 40, background: "#ff6b9d", clipPath: "polygon(0 0, 3% 100%, 6% 0, 9% 100%, 12% 0, 15% 100%, 18% 0, 21% 100%, 24% 0, 27% 100%, 30% 0, 33% 100%, 36% 0, 39% 100%, 42% 0, 45% 100%, 48% 0, 51% 100%, 54% 0, 57% 100%, 60% 0, 63% 100%, 66% 0, 69% 100%, 72% 0, 75% 100%, 78% 0, 81% 100%, 84% 0, 87% 100%, 90% 0, 93% 100%, 96% 0, 99% 100%, 100% 0)" }} />
        <div style={{ maxWidth: 1200, margin: "0 auto", paddingTop: 48, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 48, marginBottom: 48 }}>
          <div>
            <div style={{ fontFamily: font, fontSize: 26, color: c.accent, display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span>🪧</span>
              {biz.businessName || "Mobile Detailing"}
            </div>
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
            &copy; {new Date().getFullYear()} {biz.businessName || "Mobile Detailing"}{biz.city ? " · " + biz.city : ""}{biz.state ? ", " + biz.state : ""} · All rights reserved
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