import { useState, useEffect } from 'react';
import { SocialRow } from '../SocialIcons.jsx';
import { HeroImage, AboutImage, GallerySection } from '../ImageLayers.jsx';

// Template: Mechanic Ironclad
// Industrial dark aesthetic with rust-red accent (#111111 bg, #C0392B accent, #ffffff text)
// Bebas Neue display font + Barlow body. Features: diagonal hero, animated marquee ticker,
// numbered service cards, CSS garage scene in about section, WHY grid, hexagon-avatar
// testimonials, contact/hours panel, parallelogram CTA band, columnar footer.

export default function MechanicIronclad({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const [scrolled, setScrolled] = useState(false);

  const c = templateMeta?.colors || {
    bg: '#111111',
    accent: '#C0392B',
    text: '#ffffff',
    secondary: '#1e1e1e',
    muted: '#aaaaaa',
  };
  const bodyFont = templateMeta?.bodyFont || "'Barlow', sans-serif";

  const biz          = businessInfo || {};
  const copy         = generatedCopy || {};
  const services     = copy.servicesSection?.items || [];
  const svcCols = services.length >= 6 ? Math.ceil(services.length / 2) : services.length || 1;
  const testimonials = copy.testimonialPlaceholders || [];

  // Normalise any field to a clean string array
  const toArray = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(String).filter(Boolean);
    return String(val).split(/,|·/).map((s) => s.trim()).filter(Boolean);
  };

  const certList      = toArray(biz.certifications);
  const specialtyList = toArray(biz.specialties);

  // ── Google Fonts ──────────────────────────────────────────────────
  useEffect(() => {
    const id = 'ironclad-fonts';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id   = id;
      link.rel  = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;500;600;700;800;900&family=Barlow:wght@300;400;500;600&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  // ── Sticky nav ────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Font stacks ───────────────────────────────────────────────────
  const bebas     = "'Bebas Neue', 'Barlow Condensed', sans-serif";
  const condensed = "'Barlow Condensed', sans-serif";

  // ── Shared style objects ──────────────────────────────────────────
  const eyebrow = {
    fontFamily: condensed,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 5,
    textTransform: 'uppercase',
    color: c.accent,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  };

  const sectionTitle = {
    fontFamily: bebas,
    fontSize: 'clamp(44px, 5vw, 68px)',
    letterSpacing: 2,
    lineHeight: 0.95,
    color: c.text,
    margin: 0,
  };

  // SVG noise — fine grain for metal texture
  const noiseBg =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='4' height='4' fill='%23000'/%3E%3Crect x='0' y='0' width='1' height='1' fill='%23fff' opacity='0.015'/%3E%3Crect x='2' y='2' width='1' height='1' fill='%23fff' opacity='0.01'/%3E%3C/svg%3E\")";

  // Diagonal hatch for steel-plate overlays
  const hatch =
    'repeating-linear-gradient(-45deg, transparent, transparent 20px, rgba(255,255,255,0.012) 20px, rgba(255,255,255,0.012) 40px)';

  // Dashed rust accent border stripe
  const dashedRust = `repeating-linear-gradient(90deg, ${c.accent} 0px, ${c.accent} 30px, transparent 30px, transparent 40px)`;

  // Cycling service card icons
  const svcIcons = ['🔧', '🛑', '⚙️', '❄️', '🛢️', '🔩', '🔋', '🚗', '🛞'];

  // Static "Why Us" value props
  const whyItems = [
    { glyph: '⚡', title: 'Fast Turnaround',  body: "Most jobs completed same-day. We know your car is your livelihood — we keep bay time to a minimum." },
    { glyph: '💯', title: 'No Upsells',        body: "We fix what is broken. If it ain't broke, we won't tell you it is just to pad the bill." },
    { glyph: '🔩', title: 'Quality Parts',     body: 'OEM or top-tier aftermarket — no junkyard specials. The repair lasts or we do it again.' },
    { glyph: '🤝', title: 'Family-Owned',      body: "Your car isn't a number here. We remember your vehicle history and treat you like a neighbor." },
  ];

  // Extract up-to-2-letter initials for hexagon avatars
  const initials = (name = '') =>
    name.split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

  // ── Sub-components ────────────────────────────────────────────────
  const EyebrowBar = ({ label }) => (
    <div style={eyebrow}>
      <span style={{ width: 28, height: 2, background: c.accent, display: 'inline-block', flexShrink: 0 }} />
      {label}
    </div>
  );

  return (
    <div
      style={{
        fontFamily: bodyFont,
        background: c.bg,
        color: c.text,
        minHeight: '100vh',
        overflowX: 'hidden',
        margin: 0,
        padding: 0,
        backgroundImage: noiseBg,
        backgroundRepeat: 'repeat',
        containerType: 'inline-size',
      }}
    >
      <style>{`@container(max-width:600px){.tp-nav-links a[href^="#"]{display:none!important}.tp-nav-links{gap:12px!important}.tp-2col{grid-template-columns:1fr!important}}`}</style>
      {/* Marquee keyframe injection */}
      <style>{`
        @keyframes ironcladMarquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════
          FIXED NAV
      ═══════════════════════════════════════════════════════════ */}
      <nav
        style={{
          position: 'sticky', top: 0, zIndex: 1000,
          height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 5%',
          background: scrolled ? 'rgba(8,8,8,0.98)' : 'rgba(10,10,10,0.95)',
          borderBottom: `2px solid ${c.accent}`,
          backdropFilter: 'blur(12px)',
          transition: 'background 0.3s',
        }}
      >
        {/* Logo mark */}
        {images.logo ? (
          <img src={images.logo} alt={biz.businessName || 'Logo'} style={{ height: 42, objectFit: 'contain' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 42, height: 42, background: c.accent,
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: bebas, fontSize: 14, color: '#fff', letterSpacing: 1, flexShrink: 0,
              }}
            >
              {(biz.businessName || 'IC').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'IC'}
            </div>
            <div>
              <span style={{ fontFamily: bebas, fontSize: 22, letterSpacing: 3, color: c.text, lineHeight: 1, display: 'block' }}>
                {biz.businessName || 'AUTO REPAIR'}
              </span>
              <span style={{ fontFamily: condensed, fontSize: 9, letterSpacing: 4, color: c.accent, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginTop: 1 }}>
                {[biz.city, biz.state].filter(Boolean).join(', ')}
              </span>
            </div>
          </div>
        )}

        {/* Nav links */}
        <div className="tp-nav-links" style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          {[['#services', 'Services'], ['#about', 'Our Shop'], ['#testimonials', 'Reviews'], ['#contact', 'Contact']].map(([href, label]) => (
            <a
              key={href} href={href}
              style={{ fontFamily: condensed, fontSize: 12, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: '#8a8a8a', textDecoration: 'none' }}
            >
              {label}
            </a>
          ))}
          <a
            href={biz.phone ? `tel:${biz.phone}` : '#contact'}
            style={{
              background: c.accent, color: '#fff', fontFamily: condensed,
              fontSize: 14, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase',
              padding: '11px 26px', textDecoration: 'none',
              clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
            }}
          >
            {copy.ctaPrimary || 'Book Service'}
          </a>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════
          HERO — full-viewport, diagonal steel-plate layout
      ═══════════════════════════════════════════════════════════ */}
      <header
        style={{ minHeight: '100vh', paddingTop: 68, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center' }}
      >
        <HeroImage src={images.hero} />
        {/* Dark diagonal base gradient */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0A0A0A 0%, #1a1a1a 40%, #0f0f0f 100%)' }} />
        {/* Rust-tinted grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(192,57,43,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(192,57,43,0.07) 1px, transparent 1px)`, backgroundSize: '60px 60px' }} />
        {/* Steel-plate slash (right side) */}
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '55%', background: '#1C1C1C', clipPath: 'polygon(12% 0, 100% 0, 100% 100%, 0% 100%)', backgroundImage: hatch }} />
        {/* Ghost year number */}
        {biz.yearsInBusiness && (
          <div style={{ position: 'absolute', right: '4%', top: '50%', transform: 'translateY(-50%)', fontFamily: bebas, fontSize: 'clamp(160px, 22vw, 340px)', color: 'rgba(255,255,255,0.025)', lineHeight: 1, pointerEvents: 'none', userSelect: 'none', letterSpacing: -8 }}>
            {biz.yearsInBusiness}
          </div>
        )}

        {/* Hero content */}
        <div style={{ position: 'relative', zIndex: 2, padding: 'clamp(40px, 8vw, 80px) 5%', maxWidth: 740 }}>
          {/* Kicker line */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <div style={{ width: 40, height: 3, background: c.accent, flexShrink: 0 }} />
            <span style={{ fontFamily: condensed, fontSize: 12, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase', color: c.accent }}>
              {biz.yearsInBusiness ? `Est. ${new Date().getFullYear() - Number(biz.yearsInBusiness)} · ` : ''}
              {[biz.city, biz.state].filter(Boolean).join(', ')}
            </span>
          </div>

          {/* H1 */}
          <h1 style={{ fontFamily: bebas, fontSize: 'clamp(32px, 10vw, 130px)', lineHeight: 0.92, letterSpacing: 2, color: c.text, margin: '0 0 28px' }}>
            {copy.headline ? (
              copy.headline
            ) : (
              <>
                BUILT<br />
                <span style={{ color: c.accent }}>TOUGH.</span><br />
                <span style={{ WebkitTextStroke: '2px #C0C0C0', color: 'transparent' }}>DONE RIGHT.</span>
              </>
            )}
          </h1>

          <p style={{ fontFamily: bodyFont, fontSize: 17, lineHeight: 1.7, color: '#8A8A8A', maxWidth: 460, marginBottom: 44, fontWeight: 400 }}>
            {copy.subheadline || biz.tagline || `Real mechanics. Real tools. No shortcuts. Serving ${biz.city || 'your area'} with honest, quality auto repair.`}
          </p>

          {/* CTA buttons */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <a
              href={biz.phone ? `tel:${biz.phone}` : '#contact'}
              style={{ background: c.accent, color: '#fff', fontFamily: condensed, fontSize: 16, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase', padding: '16px 40px', textDecoration: 'none', display: 'inline-block', clipPath: 'polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%)' }}
            >
              {copy.ctaPrimary || 'Schedule Service'}
            </a>
            <a
              href="#services"
              style={{ color: c.text, fontFamily: condensed, fontSize: 15, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '2px solid #8A8A8A', paddingBottom: 4 }}
            >
              {copy.ctaSecondary || 'View All Services'} &rarr;
            </a>
          </div>

          {/* Stat strip */}
          <div style={{ display: 'flex', gap: 48, marginTop: 60, paddingTop: 40, borderTop: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
            {[
              { val: biz.yearsInBusiness ? `${biz.yearsInBusiness}+` : '10+', label: 'Years in Business' },
              { val: '5,000+',  label: 'Cars Serviced' },
              { val: '100%',    label: 'Guaranteed Work' },
            ].map((s) => (
              <div key={s.label}>
                <div style={{ fontFamily: bebas, fontSize: 42, color: c.accent, lineHeight: 1, letterSpacing: 1 }}>{s.val}</div>
                <div style={{ fontFamily: condensed, fontSize: 11, letterSpacing: 2, color: '#6B6560', textTransform: 'uppercase', fontWeight: 600, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════
          MARQUEE TICKER
      ═══════════════════════════════════════════════════════════ */}
      <div style={{ background: c.accent, borderTop: '2px solid #8B0000', borderBottom: '2px solid #8B0000', padding: '14px 0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', animation: 'ironcladMarquee 28s linear infinite', width: 'max-content' }}>
          {[0, 1].map((pass) =>
            (services.length > 0
              ? services.map((s) => s.name)
              : (Array.isArray(biz.services)
                  ? biz.services
                  : ['Engine Repair', 'Brake Service', 'Oil Change', 'Transmission', 'AC Repair', 'Suspension', 'Diagnostics', 'Exhaust'])
            ).map((label, i) => (
              <span
                key={`${pass}-${i}`}
                style={{ fontFamily: bebas, fontSize: 18, letterSpacing: 4, color: 'rgba(255,255,255,0.85)', padding: '0 40px', display: 'inline-flex', alignItems: 'center', gap: 40, whiteSpace: 'nowrap' }}
              >
                {String(label).toUpperCase()}
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>&#9881;</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SERVICES GRID
      ═══════════════════════════════════════════════════════════ */}
      <section id="services" style={{ padding: 'clamp(72px, 10vw, 120px) 5%', background: '#141414', position: 'relative' }}>
        {/* Top dashed rust stripe */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundImage: dashedRust }} />
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: 72 }}>
            <EyebrowBar label="What We Do" />
            <h2 style={sectionTitle}>
              NO JOB TOO<br />
              <span style={{ color: c.accent }}>HEAVY.</span>
            </h2>
            {copy.servicesSection?.intro && (
              <p style={{ fontSize: 16, color: '#6B6560', lineHeight: 1.75, maxWidth: 500, marginTop: 18 }}>
                {copy.servicesSection.intro}
              </p>
            )}
          </div>
          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${svcCols}, 1fr)`, gap: 3, background: 'rgba(255,255,255,0.04)' }}>
            {(services.length > 0 ? services : []).map((svc, i) => (
              <div
                key={i}
                style={{ background: '#1C1C1C', padding: 'clamp(28px, 4vw, 44px) clamp(20px, 3vw, 36px)', position: 'relative', overflow: 'hidden', borderTop: '3px solid transparent', transition: 'background 0.25s, border-color 0.25s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#202020'; e.currentTarget.style.borderTopColor = c.accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#1C1C1C'; e.currentTarget.style.borderTopColor = 'transparent'; }}
              >
                <div style={{ fontFamily: bebas, fontSize: 72, color: 'rgba(255,255,255,0.04)', lineHeight: 1, marginBottom: 20, userSelect: 'none' }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <span style={{ fontSize: 32, marginBottom: 16, display: 'block' }}>{svcIcons[i % svcIcons.length]}</span>
                <h3 style={{ fontFamily: condensed, fontSize: 22, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: c.text, margin: '0 0 12px' }}>
                  {svc.name}
                </h3>
                <p style={{ fontSize: 14, color: '#6B6560', lineHeight: 1.7, margin: 0 }}>{svc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          ABOUT / SHOP — split: CSS garage visual | copy
      ═══════════════════════════════════════════════════════════ */}
      <section id="about" style={{ background: c.bg, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', borderTop: '1px solid rgba(255,255,255,0.06)' }}>

        {/* LEFT — garage visual / about image */}
        <div style={{ position: 'relative', minHeight: 520, background: '#242424', overflow: 'hidden' }}>
          {images.about ? (
            <img src={images.about} alt="About" style={{ width: '100%', height: '100%', minHeight: 520, objectFit: 'cover', display: 'block' }} />
          ) : (
            <>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #0d0d0d 0%, #1a1a1a 60%, #111 100%)' }} />
              {/* Floor with subtle vertical grid */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%', background: '#161616', borderTop: '3px solid #2a2a2a', backgroundImage: 'repeating-linear-gradient(90deg, transparent 0px, transparent 39px, rgba(255,255,255,0.03) 39px, rgba(255,255,255,0.03) 40px)' }} />
              {/* Garage door */}
              <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: '68%', height: '56%', background: '#202020', border: '3px solid #333', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 2, padding: 4 }}>
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} style={{ flex: 1, background: '#2a2a2a', border: '1px solid #333' }} />
                ))}
              </div>
              {/* Amber work-light strip */}
              <div style={{ position: 'absolute', top: '8%', left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, #F39C12, transparent)', boxShadow: '0 0 20px #F39C12, 0 0 60px rgba(243,156,18,0.3)', opacity: 0.7 }} />
              {/* Silhouette tools */}
              <div style={{ position: 'absolute', top: '20%', right: '8%', fontSize: 48, color: 'rgba(255,255,255,0.07)', transform: 'rotate(45deg)' }}>🔧</div>
              <div style={{ position: 'absolute', bottom: '38%', left: '6%', fontSize: 56, color: 'rgba(255,255,255,0.05)' }}>⚙️</div>
            </>
          )}
          {/* Bottom name overlay */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 'clamp(24px, 4vw, 40px)', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }}>
            {certList.length > 0 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${c.accent}`, padding: '8px 18px', fontFamily: condensed, fontSize: 12, fontWeight: 700, letterSpacing: 3, color: c.accent, textTransform: 'uppercase', marginBottom: 12 }}>
                🏆 {certList[0]}
              </div>
            )}
            <div style={{ fontFamily: bebas, fontSize: 'clamp(26px, 4vw, 42px)', letterSpacing: 1, color: '#F0EDE8', lineHeight: 1.1 }}>
              {biz.businessName || 'THE SHOP'}<br />
              <span style={{ color: c.accent }}>{[biz.city, biz.state].filter(Boolean).join(', ')}</span>
            </div>
          </div>
        </div>

        {/* RIGHT — About copy */}
        <div style={{ padding: 'clamp(48px, 8vw, 80px) clamp(32px, 6vw, 64px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <EyebrowBar label="About the Shop" />
          <h2 style={{ ...sectionTitle, marginBottom: 0 }}>
            WE DON&apos;T<br />CUT <span style={{ color: c.accent }}>CORNERS.</span>
          </h2>
          <p style={{ fontSize: 15, color: '#6B6560', lineHeight: 1.85, marginTop: 18, marginBottom: 24, maxWidth: 420 }}>
            {copy.aboutText || `Serving ${biz.city || 'your area'} with expert auto repair built on straight talk, fair prices, and work you can stake your safety on.`}
          </p>

          {/* Credential list */}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
            {certList.map((cert, i) => (
              <li key={'c' + i} style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14, color: '#C0C0C0', fontWeight: 500 }}>
                <div style={{ width: 36, height: 36, flexShrink: 0, background: '#1C1C1C', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🔧</div>
                <span><strong style={{ color: c.text }}>{cert}</strong></span>
              </li>
            ))}
            {biz.warrantyOffered && (
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: 16, fontSize: 14, color: '#C0C0C0', fontWeight: 500 }}>
                <div style={{ width: 36, height: 36, flexShrink: 0, background: '#1C1C1C', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🛡️</div>
                <span><strong style={{ color: c.text }}>Warranty: </strong>{biz.warrantyOffered}</span>
              </li>
            )}
            {specialtyList.length > 0 && (
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: 16, fontSize: 14, color: '#C0C0C0', fontWeight: 500 }}>
                <div style={{ width: 36, height: 36, flexShrink: 0, background: '#1C1C1C', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🏎️</div>
                <span><strong style={{ color: c.text }}>Specialties: </strong>{specialtyList.join(' · ')}</span>
              </li>
            )}
            {biz.awards && (
              <li style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14, color: '#C0C0C0', fontWeight: 500 }}>
                <div style={{ width: 36, height: 36, flexShrink: 0, background: '#1C1C1C', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🏆</div>
                <span><strong style={{ color: c.text }}>Recognition: </strong>{biz.awards}</span>
              </li>
            )}
          </ul>

          <a
            href={biz.phone ? `tel:${biz.phone}` : '#contact'}
            style={{ background: c.accent, color: '#fff', fontFamily: condensed, fontSize: 16, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase', padding: '16px 40px', textDecoration: 'none', display: 'inline-block', alignSelf: 'flex-start', clipPath: 'polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%)' }}
          >
            Schedule Your Visit &rarr;
          </a>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          WHY IRONCLAD — 4-cell grid
      ═══════════════════════════════════════════════════════════ */}
      <section style={{ background: '#1C1C1C', padding: 'clamp(72px, 10vw, 100px) 5%', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 64 }}>
            <EyebrowBar label="Why Choose Us" />
            <h2 style={sectionTitle}>
              STRAIGHT TALK.<br />
              <span style={{ color: c.accent }}>SOLID WORK.</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2, background: 'rgba(255,255,255,0.04)' }}>
            {whyItems.map((item, i) => (
              <div
                key={i}
                style={{ background: '#141414', padding: 'clamp(28px, 4vw, 44px) clamp(20px, 3vw, 32px)', position: 'relative', transition: 'background 0.25s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#1C1C1C'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#141414'; }}
              >
                <span style={{ fontSize: 36, marginBottom: 20, display: 'block' }}>{item.glyph}</span>
                <h3 style={{ fontFamily: condensed, fontSize: 19, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: c.text, margin: '0 0 10px' }}>{item.title}</h3>
                <p style={{ fontSize: 13, color: '#6B6560', lineHeight: 1.7, margin: 0 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          TESTIMONIALS
      ═══════════════════════════════════════════════════════════ */}
      {testimonials.length > 0 && (
        <section id="testimonials" style={{ background: c.bg, padding: 'clamp(72px, 10vw, 100px) 5%', position: 'relative' }}>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundImage: dashedRust }} />
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ marginBottom: 64 }}>
              <EyebrowBar label="What Customers Say" />
              <h2 style={sectionTitle}>
                THEY CAME IN<br />
                <span style={{ color: c.accent }}>SKEPTICAL.</span>
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              {testimonials.map((t, i) => (
                <div
                  key={i}
                  style={{ background: '#1C1C1C', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `4px solid ${c.accent}`, padding: 40, position: 'relative', overflow: 'hidden', transition: 'transform 0.25s, box-shadow 0.25s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 20px 60px rgba(0,0,0,0.5)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ color: '#F39C12', fontSize: 15, letterSpacing: 2, marginBottom: 18 }}>★★★★★</div>
                  <p style={{ fontSize: 15, color: '#8A8A8A', lineHeight: 1.75, fontStyle: 'italic', fontWeight: 300, margin: '0 0 28px' }}>
                    <span style={{ fontFamily: bebas, fontSize: 52, color: c.accent, lineHeight: 0, verticalAlign: -18, marginRight: 4 }}>&ldquo;</span>
                    {t.text}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {/* Hexagon avatar */}
                    <div
                      style={{ width: 44, height: 44, background: c.accent, clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: bebas, fontSize: 16, color: '#fff', flexShrink: 0 }}
                    >
                      {initials(t.name)}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: c.text, letterSpacing: 0.5 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: '#6B6560', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>Verified Customer</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          CONTACT + HOURS — two-column
      ═══════════════════════════════════════════════════════════ */}
      <section
        id="contact"
        style={{ background: '#141414', padding: 'clamp(72px, 10vw, 100px) 5%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'clamp(40px, 6vw, 80px)', alignItems: 'start' }}
      >
        {/* Left — contact detail cards */}
        <div>
          <EyebrowBar label="Get In Touch" />
          <h2 style={{ ...sectionTitle, marginBottom: 20 }}>
            LET&apos;S GET<br /><span style={{ color: c.accent }}>TO WORK.</span>
          </h2>
          <p style={{ fontSize: 15, color: '#6B6560', lineHeight: 1.75, marginBottom: 36, maxWidth: 380 }}>
            {copy.footerTagline || `Serving ${biz.city || 'your area'} and surrounding communities.`}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {biz.phone && (
              <a href={`tel:${biz.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', background: '#1C1C1C', borderLeft: `3px solid ${c.accent}`, textDecoration: 'none' }}>
                <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>📞</span>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: '#6B6560', textTransform: 'uppercase', fontWeight: 600 }}>Phone</div>
                  <div style={{ fontFamily: condensed, fontSize: 18, fontWeight: 700, color: c.text, letterSpacing: 0.5, marginTop: 2 }}>{biz.phone}</div>
                </div>
              </a>
            )}
            {biz.address && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', background: '#1C1C1C', borderLeft: '3px solid transparent' }}>
                <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>📍</span>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: '#6B6560', textTransform: 'uppercase', fontWeight: 600 }}>Address</div>
                  <div style={{ fontFamily: condensed, fontSize: 16, fontWeight: 700, color: c.text, letterSpacing: 0.5, marginTop: 2 }}>
                    {biz.address}{biz.city ? `, ${biz.city}` : ''}{biz.state ? ` ${biz.state}` : ''}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right — hours table + warranty callout */}
        <div>
          <EyebrowBar label="Shop Hours" />
          <h2 style={{ ...sectionTitle, marginBottom: 28, fontSize: 'clamp(32px, 4vw, 52px)' }}>
            WE&apos;RE OPEN<br /><span style={{ color: c.accent }}>WHEN YOU NEED US.</span>
          </h2>
          {biz.hours && Object.keys(biz.hours).length > 0 ? (
            <div style={{ background: '#1C1C1C' }}>
              {Object.entries(biz.hours).map(([day, hrs], i, arr) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#C0C0C0' }}>{day}</span>
                  <span style={{ fontFamily: condensed, fontSize: 15, fontWeight: 700, letterSpacing: 0.5, color: String(hrs).toLowerCase().includes('closed') ? '#6B6560' : c.text }}>{hrs}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#6B6560', fontSize: 14 }}>Call us for current hours.</p>
          )}
          {biz.warrantyOffered && (
            <div style={{ marginTop: 24, background: '#1C1C1C', border: `1px solid ${c.accent}44`, borderLeft: `4px solid ${c.accent}`, padding: '20px 24px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 26, flexShrink: 0 }}>🛡️</span>
              <div>
                <div style={{ fontFamily: condensed, fontSize: 11, fontWeight: 800, letterSpacing: 4, color: c.accent, textTransform: 'uppercase', marginBottom: 4 }}>Our Guarantee</div>
                <p style={{ fontSize: 14, color: '#C0C0C0', margin: 0, lineHeight: 1.6 }}>{biz.warrantyOffered}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          CTA BAND
      ═══════════════════════════════════════════════════════════ */}
      <section style={{ background: c.accent, padding: 'clamp(64px, 10vw, 96px) 5%', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: hatch, opacity: 0.4 }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: bebas, fontSize: 'clamp(36px, 6vw, 72px)', letterSpacing: 3, color: '#fff', margin: '0 0 14px', lineHeight: 0.95 }}>
            READY TO GET<br />YOUR CAR FIXED RIGHT?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 16, marginBottom: 40, fontFamily: bodyFont }}>
            {biz.city
              ? `Serving ${biz.city}${biz.state ? ', ' + biz.state : ''} and surrounding areas.`
              : 'Call us today — no appointment needed for most services.'}
          </p>
          <a
            href={biz.phone ? `tel:${biz.phone}` : '#contact'}
            style={{ background: '#000', color: '#fff', fontFamily: bebas, fontSize: 22, letterSpacing: 4, padding: '18px 56px', textDecoration: 'none', display: 'inline-block', clipPath: 'polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%)' }}
          >
            {biz.phone || 'CALL NOW'}
          </a>
          {biz.address && (
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 20 }}>
              📍 {biz.address}{biz.city ? `, ${biz.city}` : ''}{biz.state ? `, ${biz.state}` : ''}
            </p>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════════ */}

      {/* GALLERY */}
      <GallerySection images={images} colors={c} font={templateMeta.font} bodyFont={bodyFont} />
      <footer style={{ background: c.bg, borderTop: `2px solid ${c.accent}`, padding: 'clamp(48px, 8vw, 64px) 5% clamp(24px, 4vw, 32px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'clamp(28px, 5vw, 56px)', marginBottom: 48 }}>

            {/* Brand column */}
            <div>
              {/* Footer logo */}
              {images.logo ? (
                <img src={images.logo} alt={biz.businessName} style={{ height: 48, maxWidth: 180, objectFit: 'contain', marginBottom: '0.75rem', display: 'block' }} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div style={{ width: 42, height: 42, background: c.accent, clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: bebas, fontSize: 14, color: '#fff', flexShrink: 0 }}>
                    {(biz.businessName || 'IC').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'IC'}
                  </div>
                  <div>
                    <span style={{ fontFamily: bebas, fontSize: 20, letterSpacing: 3, color: c.text, display: 'block', lineHeight: 1 }}>{biz.businessName || 'AUTO REPAIR'}</span>
                    <span style={{ fontFamily: condensed, fontSize: 9, letterSpacing: 4, color: c.accent, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginTop: 1 }}>{[biz.city, biz.state].filter(Boolean).join(', ')}</span>
                  </div>
                </div>
              )}
              <p style={{ fontSize: 13, color: '#6B6560', lineHeight: 1.8, maxWidth: 260 }}>
                {copy.footerTagline || biz.tagline || 'Family-owned auto repair. Real mechanics, fair prices, work guaranteed.'}
              </p>
            </div>

            {/* Services column */}
            {services.length > 0 && (
              <div>
                <h4 style={{ fontFamily: condensed, fontSize: 12, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', color: c.accent, margin: '0 0 18px' }}>Services</h4>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {services.slice(0, 6).map((s, i) => (
                    <li key={i}><a href="#services" style={{ fontSize: 13, color: '#6B6560', textDecoration: 'none', fontWeight: 500 }}>{s.name}</a></li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quick links */}
            <div>
              <h4 style={{ fontFamily: condensed, fontSize: 12, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', color: c.accent, margin: '0 0 18px' }}>Quick Links</h4>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[['#about', 'About Us'], ['#testimonials', 'Reviews'], ['#contact', 'Schedule Service']].map(([href, label]) => (
                  <li key={href}><a href={href} style={{ fontSize: 13, color: '#6B6560', textDecoration: 'none', fontWeight: 500 }}>{label}</a></li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 style={{ fontFamily: condensed, fontSize: 12, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', color: c.accent, margin: '0 0 18px' }}>Contact</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {biz.phone && <a href={`tel:${biz.phone}`} style={{ fontSize: 13, color: '#6B6560', textDecoration: 'none', fontWeight: 500 }}>{biz.phone}</a>}
                {biz.address && <span style={{ fontSize: 13, color: '#6B6560', fontWeight: 500 }}>{biz.address}</span>}
                {(biz.city || biz.state) && <span style={{ fontSize: 13, color: '#6B6560', fontWeight: 500 }}>{[biz.city, biz.state].filter(Boolean).join(', ')}</span>}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <p style={{ fontSize: 12, color: '#6B6560', letterSpacing: 0.5, margin: 0 }}>
              &copy; {new Date().getFullYear()} {biz.businessName || 'Auto Repair'}
              {biz.city ? ` · ${biz.city}` : ''}{biz.state ? `, ${biz.state}` : ''} · All rights reserved
            </p>
            <span style={{ fontFamily: bebas, fontSize: 16, letterSpacing: 3, color: c.accent }}>
              BUILT TOUGH. DONE RIGHT.
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
