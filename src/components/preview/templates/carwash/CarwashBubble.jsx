import { useState, useEffect } from 'react';
import { SocialRow } from '../SocialIcons.jsx';
import { HeroImage, AboutImage, GallerySection } from '../ImageLayers.jsx';

// Template: Carwash Bubble
// Bright, playful, cheerful car wash aesthetic. No canvas, no custom cursor JS.
// Fonts: Righteous (headings) + Nunito (body)

export default function CarwashBubble({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const c = templateMeta?.colors || {
    bg: '#f0f9ff', accent: '#06b6d4', text: '#0c4a6e', secondary: '#e0f7fa', muted: '#64748b',
  };
  const font = templateMeta?.font || 'Righteous, cursive';
  const bodyFont = templateMeta?.bodyFont || 'Nunito, sans-serif';

  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const services = copy.servicesSection?.items || [];
  const svcCols = services.length >= 6 ? Math.ceil(services.length / 2) : services.length || 1;
  const testimonials = copy.testimonialPlaceholders || [];
  const payments = Array.isArray(biz.paymentMethods) ? biz.paymentMethods : [];
  const awards = Array.isArray(biz.awards) ? biz.awards : biz.awards ? [biz.awards] : [];
  const specialties = Array.isArray(biz.specialties) ? biz.specialties : biz.specialties ? [biz.specialties] : [];

  const [scrolled, setScrolled] = useState(false);

  // Load Righteous + Nunito via useEffect
  useEffect(() => {
    const id = 'carwash-bubble-fonts';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id; link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Righteous&family=Nunito:ital,wght@0,400;0,600;0,700;0,800;0,900;1,700&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  // Sticky nav
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const accentLight = '#bae6fd';
  const deepBg      = '#0c2340';

  const gradText = {
    background: `linear-gradient(135deg, ${c.accent}, #14b8a6, #a78bfa)`,
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  };

  // CSS-only bubble decorations — no canvas
  const BubbleBlob = ({ size, top, left, right, bottom, color, opacity = 0.18, blur = 0 }) => (
    <div style={{
      position: 'absolute', width: size, height: size, borderRadius: '50%',
      background: color || `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.6), ${c.accent}55)`,
      opacity, top, left, right, bottom,
      filter: blur ? `blur(${blur}px)` : undefined,
      pointerEvents: 'none',
      border: '1.5px solid rgba(255,255,255,0.4)',
      boxShadow: `inset 0 0 ${Math.round(parseInt(size) * 0.2)}px rgba(255,255,255,0.5)`,
    }} />
  );

  const SmallBubble = ({ size, top, left, right, bottom }) => (
    <div style={{
      position: 'absolute', width: size, height: size, borderRadius: '50%',
      background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.7), rgba(6,182,212,0.25))',
      opacity: 0.55, top, left, right, bottom,
      border: '1px solid rgba(255,255,255,0.6)', pointerEvents: 'none',
    }} />
  );

  const hoursLines = typeof biz.hours === 'string' && biz.hours.trim()
    ? biz.hours.split(/[·;|]+/).map(s => s.trim()).filter(Boolean)
    : typeof biz.hours === 'object' && biz.hours
      ? Object.entries(biz.hours).map(([d, h]) => `${d}: ${h}`)
      : [];
  const hasHours = hoursLines.length > 0;

  const steps = [
    { icon: '🚗', title: 'Pull In',          desc: 'Drive up, choose your package on the display, and follow our guide lights into the bay.' },
    { icon: '🫧', title: 'Foam Attack',      desc: 'High-pressure pre-soak, triple foam cannons, soft-touch brushes, and an underbody flush.' },
    { icon: '💧', title: 'Rinse & Protect',  desc: 'Spot-free rinse removes every trace of soap. Protectant seals your finish for days.' },
    { icon: '😍', title: 'Drive Away Clean', desc: 'Roll out fresh and sparkling. Your car is already turning heads — come back anytime.' },
  ];

  const featuresList = [
    { icon: '🌊', title: 'Soft-Touch Equipment',   desc: 'Ultra-soft brushes clean thoroughly without scratching your paint or trim.' },
    { icon: '🌿', title: 'Eco-Friendly Soaps',     desc: 'Biodegradable, phosphate-free soaps. We recycle up to 80% of our wash water.' },
    { icon: '⚡',     title: 'In & Out in Minutes',    desc: 'High-throughput tunnel moves fast. Get a full wash without disrupting your day.' },
    { icon: '🛡️', title: 'Satisfaction Guarantee', desc: 'Not happy? Come back and we will rewash — no questions, no forms, guaranteed.' },
  ];

  const avatarGradients = [
    `linear-gradient(135deg, ${c.accent}, #14b8a6)`,
    'linear-gradient(135deg, #a78bfa, #06b6d4)',
    'linear-gradient(135deg, #f472b6, #fb923c)',
  ];

  const packageIcons = ['💧', '🫧', '✨', '🌟'];

  return (
    <div style={{ fontFamily: bodyFont, background: c.bg, color: c.text, minHeight: '100vh', overflowX: 'hidden', margin: 0, padding: 0, containerType: 'inline-size' }}>
      <style>{`@container(max-width:600px){.tp-nav-links a[href^="#"]{display:none!important}.tp-nav-links{gap:12px!important}.tp-2col{grid-template-columns:1fr!important}}`}</style>

      {/* Marquee keyframe */}
      <style>{'@keyframes soapScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }'}</style>

      {/* ═══ NAV ═══ */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 1000, height: 66,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 5%',
        background: scrolled ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.75)',
        backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: `1.5px solid rgba(6,182,212,${scrolled ? 0.25 : 0.1})`,
        boxShadow: scrolled ? '0 2px 24px rgba(6,182,212,0.12)' : 'none',
        transition: 'all 0.3s ease',
      }}>
        <a href='#' style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          {images.logo ? (
            <img src={images.logo} alt={biz.businessName || 'Logo'} style={{ height: 38, objectFit: 'contain' }} />
          ) : (
            <>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: `radial-gradient(circle at 35% 30%, #fff, ${c.accent})`,
                border: `2px solid ${c.accent}`, flexShrink: 0,
                boxShadow: `0 0 0 3px ${accentLight}55`,
              }} />
              <div>
                <span style={{ fontFamily: font, fontSize: 17, color: c.text, display: 'block', lineHeight: 1.1 }}>
                  {biz.businessName || 'Bubble Rush'}
                </span>
                <span style={{ fontSize: 10, color: c.muted || '#64748b', letterSpacing: 1.5, textTransform: 'uppercase', display: 'block' }}>
                  Car Wash{biz.city ? ` · ${biz.city}` : ''}
                </span>
              </div>
            </>
          )}
        </a>
        <div className="tp-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {[['#packages', 'Packages'], ['#how', 'How It Works'], ['#reviews', 'Reviews']].map(([href, label]) => (
            <a key={href} href={href} style={{ color: c.text, textDecoration: 'none', fontWeight: 700, fontSize: 13, opacity: 0.8 }}>{label}</a>
          ))}
          <a href={biz.phone ? `tel:${biz.phone}` : '#'} style={{
            background: `linear-gradient(135deg, ${c.accent}, #14b8a6)`,
            color: '#fff', padding: '9px 22px', borderRadius: 50,
            fontWeight: 800, fontSize: 13, textDecoration: 'none',
            boxShadow: `0 4px 16px ${c.accent}44`,
          }}>Get Washed 🫧</a>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <header style={{
        minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center',
        background: 'linear-gradient(160deg, #e0f7ff 0%, #f0f9ff 50%, #eff6ff 100%)',
        overflow: 'hidden', paddingTop: 66,
      }}>
        <HeroImage src={images.hero} />
        <BubbleBlob size='480px' top='-120px' left='-120px' opacity={0.22} blur={8} />
        <BubbleBlob size='320px' bottom='-80px' right='-60px' opacity={0.18} blur={6} />
        <BubbleBlob size='220px' top='40%' right='6%' opacity={0.28} />
        <SmallBubble size='70px'  top='18%' left='62%' />
        <SmallBubble size='42px'  top='62%' left='48%' />
        <SmallBubble size='28px'  top='78%' left='72%' />
        <SmallBubble size='52px'  top='30%' right='22%' />
        <SmallBubble size='36px'  bottom='22%' left='20%' />
        <SmallBubble size='20px'  top='50%' left='30%' />

        <div style={{ position: 'relative', zIndex: 1, padding: '6rem 5% 5rem', maxWidth: 800 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.75)', borderRadius: 50,
            padding: '6px 18px', marginBottom: 28, border: `1.5px solid ${accentLight}`,
            fontSize: 13, fontWeight: 700, color: c.text, backdropFilter: 'blur(8px)',
          }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 2px #86efac' }} />
            {biz.city || 'Your City'}{biz.state ? `, ${biz.state}` : ''} — Open Now
          </div>

          <h1 style={{ fontFamily: font, fontSize: 'clamp(1.8rem, 9vw, 6.5rem)', lineHeight: 0.95, letterSpacing: '-0.01em', margin: '0 0 1.2rem', color: c.text }}>
            {copy.headline ? copy.headline : (
              <>
                <span style={gradText}>{biz.businessName || 'Bubble Rush'}</span>
                <br />
                <span>Car Wash</span>
              </>
            )}
          </h1>

          <p style={{ fontSize: 'clamp(1rem, 2.2vw, 1.2rem)', color: c.muted || '#64748b', maxWidth: 520, marginBottom: 40, lineHeight: 1.7, fontWeight: 600 }}>
            {copy.subheadline || 'Thick foam. Sparkling rinse. A finish so clean you will want to park and just stare.'}
          </p>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 48 }}>
            <a href='#packages' style={{ background: `linear-gradient(135deg, ${c.accent}, #14b8a6)`, color: '#fff', padding: '15px 36px', borderRadius: 50, fontWeight: 800, fontSize: 16, textDecoration: 'none', boxShadow: `0 6px 24px ${c.accent}44`, display: 'inline-block' }}>
              {copy.ctaPrimary || '🫧 See Our Packages'}
            </a>
            <a href='#how' style={{ background: 'rgba(255,255,255,0.7)', color: c.text, padding: '13px 30px', borderRadius: 50, fontWeight: 800, fontSize: 15, textDecoration: 'none', border: `1.5px solid ${accentLight}`, backdropFilter: 'blur(8px)', display: 'inline-block' }}>
              How It Works →
            </a>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { val: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '10+', label: 'Years Open' },
              { val: '4.9★', label: 'Google Rating' },
              { val: biz.priceRange || '$$', label: 'Fair Pricing' },
              { val: '7 Days', label: 'Always Open' },
            ].map((badge, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.75)', borderRadius: 20, padding: '12px 20px', textAlign: 'center', minWidth: 80, border: `1.5px solid ${accentLight}`, backdropFilter: 'blur(8px)' }}>
                <div style={{ fontFamily: font, fontSize: 20, color: c.accent, lineHeight: 1 }}>{badge.val}</div>
                <div style={{ fontSize: 10, color: c.muted || '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>{badge.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, lineHeight: 0 }}>
          <svg viewBox='0 0 1440 90' preserveAspectRatio='none' xmlns='http://www.w3.org/2000/svg' style={{ width: '100%', display: 'block' }}>
            <path d='M0,60 C180,90 360,20 540,55 C720,90 900,25 1080,55 C1260,85 1380,40 1440,60 L1440,90 L0,90 Z' fill='white' />
          </svg>
        </div>
      </header>

      {/* ═══ SOAP MARQUEE ═══ */}
      <div style={{ background: `linear-gradient(135deg, ${c.accent}, #14b8a6)`, overflow: 'hidden', padding: '14px 0' }}>
        <div style={{ display: 'flex', animation: 'soapScroll 22s linear infinite', width: 'max-content' }}>
          {[
            'EXPRESS WASH','FULL FOAM BATH','TRIPLE FOAM WAX','CERAMIC SHIELD',
            'SPOT-FREE RINSE','TIRE SHINE','AIR FRESHENER','UNLIMITED PLANS',
            'EXPRESS WASH','FULL FOAM BATH','TRIPLE FOAM WAX','CERAMIC SHIELD',
            'SPOT-FREE RINSE','TIRE SHINE','AIR FRESHENER','UNLIMITED PLANS',
          ].map((item, i) => (
            <span key={i} style={{ fontFamily: font, fontSize: 14, letterSpacing: 2.5, color: 'rgba(255,255,255,0.9)', padding: '0 28px', display: 'flex', alignItems: 'center', gap: 24, whiteSpace: 'nowrap' }}>
              {item} <span style={{ fontSize: 15 }}>🫧</span>
            </span>
          ))}
        </div>
      </div>

      {/* ═══ PACKAGES ═══ */}
      <section id='packages' style={{ background: 'white', padding: '100px 5%', position: 'relative', overflow: 'hidden' }}>
        <BubbleBlob size='300px' top='-80px' right='-60px' opacity={0.08} blur={10} color={c.accent} />
        <BubbleBlob size='180px' bottom='40px' left='-50px' opacity={0.06} blur={8} color='#14b8a6' />
        <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <span style={{ display: 'inline-block', background: `${c.accent}18`, color: c.accent, borderRadius: 50, padding: '6px 18px', fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>🫧 Wash Packages</span>
            <h2 style={{ fontFamily: font, fontSize: 'clamp(2rem, 5vw, 3rem)', color: c.text, margin: '0 0 16px', lineHeight: 1.1 }}>
              Pick your{' '}<span style={gradText}>perfect wash.</span>
            </h2>
            <p style={{ color: c.muted || '#64748b', fontSize: 15, maxWidth: 560, margin: '0 auto', lineHeight: 1.7, fontWeight: 600 }}>
              {copy.servicesSection?.intro || 'Every package uses professional-grade soaps and equipment. Zero shortcuts.'}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${biz.packages?.length > 0 ? Math.min(biz.packages.length, 3) : svcCols}, 1fr)`, gap: 20 }}>
            {(biz.packages?.length > 0 ? biz.packages : services.length > 0 ? services : [
              { name: 'Express', description: 'Quick, fresh, done right. High-pressure pre-rinse, foam wash, spot-free exit.' },
              { name: 'Bubble Rush', description: 'The full foam experience — triple foam cannon, tire scrub, Rain-X protectant.' },
              { name: 'Ultimate Shine', description: 'Showroom-worthy every time. Ceramic spray, clear-coat sealant, wheel brightener.' },
            ]).map((pkg, i, arr) => {
              const isFeatured = i === Math.floor(arr.length / 2);
              return (
                <div key={i} style={{
                  position: 'relative',
                  background: isFeatured ? `linear-gradient(145deg, ${c.accent}, #14b8a6)` : 'white',
                  border: `2px solid ${isFeatured ? 'transparent' : accentLight}`,
                  borderRadius: 28, padding: '36px 28px', textAlign: 'center',
                  boxShadow: isFeatured ? `0 16px 48px ${c.accent}44` : '0 4px 24px rgba(6,182,212,0.08)',
                  transform: isFeatured ? 'scale(1.04)' : 'scale(1)',
                  overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: isFeatured ? 'rgba(255,255,255,0.12)' : `${c.accent}10`, pointerEvents: 'none' }} />
                  {isFeatured && <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 50, padding: '3px 12px', fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase' }}>Most Popular</div>}
                  <div style={{ fontSize: 36, marginBottom: 12 }}>{packageIcons[i] || '🫧'}</div>
                  <h3 style={{ fontFamily: font, fontSize: 22, color: isFeatured ? '#fff' : c.text, margin: '0 0 10px' }}>{pkg.name || pkg}</h3>
                  {pkg.price && <div style={{ fontFamily: font, fontSize: '1.8rem', fontWeight: 800, color: isFeatured ? '#fff' : c.accent, margin: '0.4rem 0 0.75rem' }}>{pkg.price}</div>}
                  <p style={{ fontSize: 14, lineHeight: 1.65, color: isFeatured ? 'rgba(255,255,255,0.85)' : c.muted || '#64748b', margin: '0 0 12px', fontWeight: 600 }}>{pkg.description}</p>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 32, borderRadius: 24, background: `linear-gradient(135deg, ${c.secondary || '#e0f7fa'}, #eff6ff)`, border: `1.5px solid ${accentLight}`, padding: '28px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, boxShadow: '0 4px 24px rgba(6,182,212,0.07)' }}>
            <div>
              <p style={{ fontFamily: font, fontSize: 22, color: c.text, margin: '0 0 4px' }}>🔄 Unlimited Monthly Plans</p>
              <p style={{ fontSize: 13, color: c.muted || '#64748b', margin: 0, fontWeight: 600 }}>Wash every day if you want. Cancel anytime — no contracts, no drama.</p>
            </div>
            <a href={biz.phone ? `tel:${biz.phone}` : '#'} style={{ background: `linear-gradient(135deg, ${c.accent}, #14b8a6)`, color: '#fff', borderRadius: 50, padding: '12px 28px', fontWeight: 800, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap', boxShadow: `0 4px 16px ${c.accent}44` }}>Learn More →</a>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id='how' style={{ background: `linear-gradient(160deg, ${c.secondary || '#e0f7fa'} 0%, ${c.bg} 100%)`, padding: '100px 5%', position: 'relative', overflow: 'hidden' }}>
        <BubbleBlob size='500px' top='-180px' left='-120px' opacity={0.14} blur={20} color={c.accent} />
        <BubbleBlob size='350px' bottom='-100px' right='-80px' opacity={0.11} blur={16} color='#a78bfa' />
        <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span style={{ display: 'inline-block', background: `${c.accent}18`, color: c.accent, borderRadius: 50, padding: '6px 18px', fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>⚡ The Process</span>
            <h2 style={{ fontFamily: font, fontSize: 'clamp(2rem, 5vw, 3rem)', color: c.text, margin: '0 0 16px', lineHeight: 1.1 }}>
              Wash to{' '}<span style={gradText}>wow</span>{' '}in minutes.
            </h2>
            <p style={{ color: c.muted || '#64748b', fontSize: 15, maxWidth: 480, margin: '0 auto', lineHeight: 1.7, fontWeight: 600 }}>Pull in, ride through, drive out spotless. The whole thing takes under 5 minutes.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {steps.map((step, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1.5px solid rgba(255,255,255,0.9)', borderRadius: 28, padding: '36px 24px', textAlign: 'center', boxShadow: '0 8px 32px rgba(6,182,212,0.07)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 16, left: 16, width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${c.accent}, #14b8a6)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font, fontSize: 14, color: '#fff', boxShadow: `0 3px 10px ${c.accent}44` }}>{i + 1}</div>
                <div style={{ fontSize: 38, marginBottom: 14 }}>{step.icon}</div>
                <h3 style={{ fontFamily: font, fontSize: 18, color: c.text, margin: '0 0 10px' }}>{step.title}</h3>
                <p style={{ color: c.muted || '#64748b', fontSize: 13, lineHeight: 1.7, margin: 0, fontWeight: 600 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES + ABOUT ═══ */}
      <section style={{ background: 'white', padding: '100px 5%', position: 'relative', overflow: 'hidden' }}>
        <BubbleBlob size='260px' top='-60px' right='-60px' opacity={0.07} blur={10} color={c.accent} />
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <span style={{ display: 'inline-block', background: `${c.accent}18`, color: c.accent, borderRadius: 50, padding: '6px 18px', fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>💎 Why {biz.businessName || 'Us'}</span>
            <h2 style={{ fontFamily: font, fontSize: 'clamp(2rem, 5vw, 3rem)', color: c.text, margin: '0 0 16px', lineHeight: 1.1 }}>
              Not all car washes are{' '}<span style={gradText}>equal.</span>
            </h2>
          </div>
          <div className="tp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {featuresList.map((feat, i) => (
                <div key={i} style={{ display: 'flex', gap: 18, alignItems: 'flex-start', background: c.bg, border: `1.5px solid ${accentLight}`, borderRadius: 20, padding: '20px 22px', boxShadow: '0 4px 16px rgba(6,182,212,0.06)' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: `linear-gradient(135deg, ${c.accent}18, #14b8a618)`, border: `1.5px solid ${accentLight}` }}>{feat.icon}</div>
                  <div>
                    <h3 style={{ fontFamily: font, fontSize: 16, color: c.text, margin: '0 0 6px' }}>{feat.title}</h3>
                    <p style={{ color: c.muted || '#64748b', fontSize: 13, lineHeight: 1.65, margin: 0, fontWeight: 600 }}>{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ background: c.bg, borderRadius: 24, border: `1.5px solid ${accentLight}`, padding: '28px', position: 'relative', overflow: 'hidden' }}>
                <BubbleBlob size='100px' top='-25px' right='-25px' opacity={0.18} />
                <span style={{ display: 'inline-block', background: `${c.accent}18`, color: c.accent, borderRadius: 50, padding: '4px 14px', fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>About Us</span>
                <h3 style={{ fontFamily: font, fontSize: 20, color: c.text, margin: '0 0 12px' }}>{biz.businessName || 'Who We Are'}</h3>
                {images.about && (
                  <img src={images.about} alt="About" style={{ width: '100%', height: '260px', objectFit: 'cover', borderRadius: '16px', display: 'block', marginBottom: '16px' }} />
                )}
                <p style={{ color: c.muted || '#64748b', fontSize: 14, lineHeight: 1.75, margin: '0 0 16px', fontWeight: 600 }}>
                  {copy.aboutText || `Based in ${biz.city || 'your city'}${biz.state ? `, ${biz.state}` : ''}, we deliver a top-tier car wash every time.${biz.yearsInBusiness ? ` Over ${biz.yearsInBusiness} years in business — we know clean.` : ''}`}
                </p>
                {specialties.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {specialties.map((s, idx) => <span key={idx} style={{ background: `${c.accent}15`, color: c.accent, borderRadius: 50, padding: '4px 14px', fontSize: 12, fontWeight: 700 }}>{s}</span>)}
                  </div>
                )}
                {awards.length > 0 && (
                  <div style={{ padding: '12px 16px', background: '#fefce8', borderRadius: 14, border: '1.5px solid #fde68a' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#92400e', letterSpacing: 1, textTransform: 'uppercase' }}>🏆 Awards: </span>
                    <span style={{ fontSize: 13, color: '#78350f', fontWeight: 600 }}>{awards.join(', ')}</span>
                  </div>
                )}
              </div>
              {hasHours && (
                <div style={{ background: 'white', borderRadius: 24, border: `2px solid ${accentLight}`, padding: '24px 26px', boxShadow: '0 4px 20px rgba(6,182,212,0.07)' }}>
                  <div style={{ fontFamily: font, fontSize: 16, color: c.accent, marginBottom: 16 }}>Hours of Operation</div>
                  {hoursLines.map((line, i) => (
                    <div key={i} style={{ borderBottom: i < hoursLines.length - 1 ? `1px solid ${accentLight}` : 'none', padding: '9px 0' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: c.text }}>{line}</span>
                    </div>
                  ))}
                </div>
              )}
              {payments.length > 0 && (
                <div style={{ background: c.bg, borderRadius: 20, border: `1.5px solid ${accentLight}`, padding: '18px 22px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: c.muted || '#64748b', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Payment Accepted</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {payments.map((p, idx) => <span key={idx} style={{ background: 'white', color: c.text, border: `1.5px solid ${accentLight}`, borderRadius: 50, padding: '4px 14px', fontSize: 12, fontWeight: 700 }}>{p}</span>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      {testimonials.length > 0 && (
        <section id='reviews' style={{ background: `linear-gradient(170deg, ${c.bg} 0%, ${c.secondary || '#e0f7fa'} 100%)`, padding: '100px 5%', position: 'relative', overflow: 'hidden' }}>
          <BubbleBlob size='280px' top='0' right='5%' opacity={0.13} blur={12} color='#a78bfa' />
          <BubbleBlob size='180px' bottom='0' left='8%' opacity={0.11} blur={8} color='#14b8a6' />
          <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <span style={{ display: 'inline-block', background: `${c.accent}18`, color: c.accent, borderRadius: 50, padding: '6px 18px', fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>⭐ Customer Love</span>
              <h2 style={{ fontFamily: font, fontSize: 'clamp(2rem, 5vw, 3rem)', color: c.text, margin: '0 0 16px', lineHeight: 1.1 }}>
                {biz.city ? `${biz.city}'s` : 'Our'}{' '}<span style={gradText}>cleanest fans.</span>
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              {testimonials.map((t, i) => {
                const initials = t.name ? t.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';
                return (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1.5px solid rgba(255,255,255,0.9)', borderRadius: 24, padding: '32px', boxShadow: '0 8px 32px rgba(6,182,212,0.08)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: -30, right: -30, width: 90, height: 90, borderRadius: '50%', background: `${c.accent}12`, pointerEvents: 'none' }} />
                    <div style={{ color: '#fbbf24', fontSize: 18, letterSpacing: 3, marginBottom: 16 }}>★★★★★</div>
                    <p style={{ color: c.text, lineHeight: 1.75, fontStyle: 'italic', margin: '0 0 24px', fontSize: 14, fontWeight: 600 }}>"{t.text}"</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: avatarGradients[i % avatarGradients.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font, fontSize: 15, color: '#fff', flexShrink: 0, boxShadow: `0 3px 12px ${c.accent}44`, border: '2px solid rgba(255,255,255,0.8)' }}>{initials}</div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: c.text }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: c.muted || '#64748b', fontWeight: 600, marginTop: 2 }}>{biz.city || 'Happy Customer'}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═══ CTA BAND ═══ */}
      <section style={{ padding: '100px 5%', background: `linear-gradient(135deg, ${deepBg} 0%, #0c2340 60%, #0c1a2e 100%)`, position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: `conic-gradient(from 0deg at 50% 50%, ${c.accent}12, #a78bfa0c, #14b8a60c, ${c.accent}12)`, pointerEvents: 'none' }} />
        <SmallBubble size='110px' top='10%'  left='5%' />
        <SmallBubble size='70px'  top='60%'  right='8%' />
        <SmallBubble size='45px'  bottom='20%' left='18%' />
        <SmallBubble size='35px'  top='25%'  right='15%' />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontFamily: font, fontSize: 'clamp(2.2rem, 5vw, 3.8rem)', color: '#fff', lineHeight: 1.05, margin: '0 0 20px' }}>
            Your car is{' '}
            <span style={{ background: 'linear-gradient(135deg, #93c5fd, #6ee7b7, #c4b5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>one rinse away</span>
            {' '}from perfect.
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.6)', fontWeight: 600, marginBottom: 40, lineHeight: 1.65 }}>
            {copy.ctaSecondary || `Stop driving around in a dirty car. Come see what all the foam is about${biz.city ? ` in ${biz.city}` : ''}.`}
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href='#packages' style={{ background: `linear-gradient(135deg, ${c.accent}, #14b8a6)`, color: '#fff', padding: '16px 40px', borderRadius: 50, fontWeight: 800, fontSize: 17, textDecoration: 'none', boxShadow: `0 8px 32px ${c.accent}55`, display: 'inline-block' }}>See Packages 🫧</a>
            <a href={biz.phone ? `tel:${biz.phone}` : '#'} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '14px 34px', borderRadius: 50, fontWeight: 800, fontSize: 16, textDecoration: 'none', border: '1.5px solid rgba(255,255,255,0.25)', display: 'inline-block' }}>
              {biz.phone ? `Call ${biz.phone}` : 'Call Us Now'}
            </a>
          </div>
          {biz.address && <p style={{ color: 'rgba(255,255,255,0.32)', fontSize: 13, marginTop: 28, fontWeight: 600 }}>📍 {biz.address}{biz.city ? `, ${biz.city}` : ''}{biz.state ? `, ${biz.state}` : ''}</p>}
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}

      {/* GALLERY */}
      <GallerySection images={images} colors={c} font={font} bodyFont={bodyFont} />
      <footer style={{ background: deepBg, padding: '72px 5% 32px', position: 'relative', overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, background: `conic-gradient(from 180deg at 50% 0%, ${c.accent}0e, #14b8a60a, transparent 40%)`, pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 48, marginBottom: 52 }}>
            <div>
              {/* Footer logo */}
              {images.logo ? (
                <img src={images.logo} alt={biz.businessName} style={{ height: 48, maxWidth: 180, objectFit: 'contain', marginBottom: '0.75rem', display: 'block' }} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, #fff, ${c.accent})`, border: `2px solid ${c.accent}`, flexShrink: 0 }} />
                  <span style={{ fontFamily: font, fontSize: 15, color: '#fff' }}>{biz.businessName || 'Bubble Rush'}</span>
                </div>
              )}
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.8, margin: 0, maxWidth: 240, fontWeight: 600 }}>
                {copy.footerTagline || `${biz.city ? `Serving ${biz.city}` : 'Professional car wash'} — your car deserves the best.`}
              </p>
            </div>
            <div>
              <h4 style={{ fontFamily: font, fontSize: 15, marginBottom: 18, background: `linear-gradient(135deg, ${c.accent}, #14b8a6)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Services</h4>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(services.length > 0 ? services.slice(0, 4) : ['Express Wash', 'Bubble Rush', 'Ultimate Shine', 'Unlimited Plans']).map((s, i) => (
                  <li key={i}><a href='#packages' style={{ color: 'rgba(255,255,255,0.42)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>{typeof s === 'object' ? s.name : s}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 style={{ fontFamily: font, fontSize: 15, marginBottom: 18, background: `linear-gradient(135deg, ${c.accent}, #14b8a6)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Contact</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {biz.phone && <a href={`tel:${biz.phone}`} style={{ color: 'rgba(255,255,255,0.48)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>📞 {biz.phone}</a>}
                {biz.address && <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13, fontWeight: 600, lineHeight: 1.6 }}>📍 {biz.address}{biz.city ? `, ${biz.city}` : ''}{biz.state ? `, ${biz.state}` : ''}</span>}
              </div>
            </div>
            <div>
              <h4 style={{ fontFamily: font, fontSize: 15, marginBottom: 18, background: `linear-gradient(135deg, ${c.accent}, #14b8a6)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Follow</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <SocialRow biz={biz} color={c.accent} size={20} images={images} />
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.26)', fontWeight: 600, margin: 0 }}>
              &copy; {new Date().getFullYear()} {biz.businessName || 'Bubble Rush Car Wash'}. All rights reserved.
            </p>
            <span style={{ fontFamily: font, fontSize: 13, letterSpacing: 0.5, background: 'linear-gradient(135deg, #93c5fd, #6ee7b7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {copy.footerTagline || 'Squeaky clean, every time. 🫧'}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}