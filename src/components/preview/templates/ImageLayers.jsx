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

/* ── Gallery section ─────────────────────────────────────────────── */
// Reads any number of `gallery0`, `gallery1`, … `galleryN` slots from `images`.
// 1–3 photos → static grid (existing layout). 4+ photos → swipeable
// scroll-snap carousel that works without JS, so it survives the static
// HTML export (renderToStaticMarkup) and behaves natively on touch +
// trackpad + mouse-wheel.
export function GallerySection({ images = {}, colors = {}, font, bodyFont }) {
  const galleryImages = Object.keys(images || {})
    .filter((k) => /^gallery\d+$/.test(k) && images[k])
    .sort((a, b) => Number(a.replace('gallery', '')) - Number(b.replace('gallery', '')))
    .map((k) => images[k]);

  if (galleryImages.length === 0) return null;

  const isCarousel = galleryImages.length > 3;

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

      {isCarousel ? (
        <>
          {/* Hide scrollbars cross-browser. Inline <style> survives SSR. */}
          <style>{`
            .acg-gallery-track::-webkit-scrollbar { display: none; }
            .acg-gallery-track { scrollbar-width: none; -ms-overflow-style: none; }
          `}</style>
          <div
            className="acg-gallery-track"
            style={{
              display: 'flex',
              gap: '1rem',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              paddingBottom: '0.5rem',
              // Negative margin pulls the track out to the section's edge
              // padding so cards bleed into the viewport gutter, signalling
              // there's more to scroll. Positive padding keeps the first
              // card snap-aligned with the heading.
              marginLeft: 'calc(-1 * clamp(1.5rem, 7cqi, 5rem))',
              marginRight: 'calc(-1 * clamp(1.5rem, 7cqi, 5rem))',
              paddingLeft: 'clamp(1.5rem, 7cqi, 5rem)',
              paddingRight: 'clamp(1.5rem, 7cqi, 5rem)',
            }}
          >
            {galleryImages.map((src, i) => (
              <div key={i} style={{
                flex: '0 0 auto',
                width: 'min(78%, 360px)',
                scrollSnapAlign: 'start',
                borderRadius: '8px',
                overflow: 'hidden',
              }}>
                <img src={src} alt="" style={{
                  width: '100%',
                  height: '320px',
                  objectFit: 'cover',
                  display: 'block',
                }} />
              </div>
            ))}
          </div>
          <div style={{
            fontFamily: bodyFont,
            fontSize: '0.75rem',
            color: colors.muted || '#888',
            marginTop: '1rem',
            textAlign: 'center',
            letterSpacing: '0.05em',
          }}>
            ← Swipe to see more →
          </div>
        </>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${galleryImages.length}, 1fr)`,
          gap: '1rem',
        }}>
          {galleryImages.map((src, i) => (
            <div key={i} style={{ borderRadius: '8px', overflow: 'hidden' }}>
              <img src={src} alt="" style={{ width: '100%', height: '280px', objectFit: 'cover', display: 'block' }} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
