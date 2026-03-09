import React from 'react';

/**
 * Shared image layer components for all templates.
 * These render user-uploaded images (hero bg, about photo, gallery).
 */

/* ── Hero background image with dark overlay ─────────────────────── */
export function HeroImage({ src, overlay = 'rgba(0,0,0,0.55)' }) {
  if (!src) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 0,
      backgroundImage: `url(${src})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: overlay }} />
    </div>
  );
}

/* ── About section image ─────────────────────────────────────────── */
export function AboutImage({ src, accent = '#888' }) {
  if (!src) return null;
  return (
    <div style={{ borderRadius: '8px', overflow: 'hidden', border: `2px solid ${accent}22` }}>
      <img src={src} alt="About us" style={{
        width: '100%', height: '320px', objectFit: 'cover', display: 'block',
      }} />
    </div>
  );
}

/* ── Gallery section (renders 1-3 photos in a grid) ──────────────── */
export function GallerySection({ images = {}, colors = {}, font, bodyFont }) {
  const imgs = [images.gallery0, images.gallery1, images.gallery2].filter(Boolean);
  if (imgs.length === 0) return null;

  return (
    <section style={{
      padding: 'clamp(3rem, 7vw, 6rem) clamp(1.5rem, 7vw, 5rem)',
      background: colors.secondary || colors.bg,
    }}>
      <div style={{
        fontFamily: bodyFont, fontSize: '0.7rem', letterSpacing: '0.25em',
        textTransform: 'uppercase', color: colors.accent, marginBottom: '0.75rem',
      }}>
        Our Work
      </div>
      <h2 style={{
        fontFamily: font, fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)',
        color: colors.text, marginBottom: '2rem', fontWeight: 700,
      }}>
        Gallery
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(imgs.length, 3)}, 1fr)`,
        gap: '1rem',
      }}>
        {imgs.map((src, i) => (
          <div key={i} style={{ borderRadius: '8px', overflow: 'hidden' }}>
            <img
              src={src}
              alt={`Gallery photo ${i + 1}`}
              style={{
                width: '100%', height: '280px', objectFit: 'cover', display: 'block',
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
