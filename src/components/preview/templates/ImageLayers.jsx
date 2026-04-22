import React from 'react';

/* ── Hero background image with dark overlay ─────────────────────── */
export function HeroImage({ src, overlay = 'rgba(0,0,0,0.55)' }) {
  if (!src) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${src})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: overlay }} />
      </div>
    </div>
  );
}

/* ── About section image ─────────────────────────────────────────── */
export function AboutImage({ src }) {
  if (!src) return null;

  return (
    <div style={{ borderRadius: '8px', overflow: 'hidden' }}>
      <img src={src} alt="About us" style={{ width: '100%', height: '320px', objectFit: 'cover', display: 'block' }} />
    </div>
  );
}

/* ── Gallery section (renders 3 slots) ───────────────────────────── */
export function GallerySection({ images = {}, colors = {}, font, bodyFont }) {
  const slots = ['gallery0', 'gallery1', 'gallery2'];
  const hasAny = slots.some(k => images[k]);

  if (!hasAny) return null;

  return (
    <section style={{
      padding: 'clamp(3rem, 7cqi, 6rem) clamp(1.5rem, 7cqi, 5rem)',
      background: colors.secondary || colors.bg,
    }}>
      <div style={{
        fontFamily: bodyFont, fontSize: '0.7rem', letterSpacing: '0.25em',
        textTransform: 'uppercase', color: colors.accent, marginBottom: '0.75rem',
      }}>
        Our Work
      </div>
      <h2 style={{
        fontFamily: font, fontSize: 'clamp(1.8rem, 3.5cqi, 2.8rem)',
        color: colors.text, marginBottom: '2rem', fontWeight: 700,
      }}>
        Gallery
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
      }}>
        {slots.map(key => images[key] ? (
          <div key={key} style={{ borderRadius: '8px', overflow: 'hidden' }}>
            <img src={images[key]} alt="" style={{ width: '100%', height: '280px', objectFit: 'cover', display: 'block' }} />
          </div>
        ) : null)}
      </div>
    </section>
  );
}
