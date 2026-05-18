// src/components/preview/sections/BeforeAfterSection.jsx
// Grid of before/after image pairs. Per-instance content holds the list of
// pair refs; the actual images live in `images` keyed by `<instanceId>_pair<N>_before` / `_after`.

export default function BeforeAfterSection({ instance, generatedCopy, templateMeta, images = {} }) {
  const c = templateMeta.colors;
  const font = templateMeta.font;
  const bodyFont = templateMeta.bodyFont;
  const content = generatedCopy?.sectionContent?.[instance.id] || {};
  const pairCount = content.pairCount || 3;
  const heading = content.heading || 'Before & After';
  const intro = content.intro || 'Real results from real customers.';

  const pairs = [];
  for (let i = 0; i < pairCount; i++) {
    const before = images[`${instance.id}_pair${i}_before`];
    const after = images[`${instance.id}_pair${i}_after`];
    pairs.push({ before, after });
  }
  const hasAnyImages = pairs.some(p => p.before || p.after);

  if (!hasAnyImages) {
    return (
      <section style={{ background: c.bg, padding: 'clamp(3rem,6cqi,5rem) clamp(1.5rem,5cqi,3rem)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: font, color: c.text, fontWeight: 900, fontSize: 'clamp(1.6rem,3.5cqi,2.5rem)', marginBottom: '0.5rem' }}>{heading}</h2>
          <p style={{ fontFamily: bodyFont, color: c.muted, fontSize: '0.95rem' }}>
            Upload before/after photos in the editor to populate this section.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section style={{ background: c.bg, padding: 'clamp(3rem,6cqi,5rem) clamp(1.5rem,5cqi,3rem)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h2 style={{ fontFamily: font, color: c.text, fontWeight: 900, fontSize: 'clamp(1.6rem,3.5cqi,2.5rem)', marginBottom: '0.5rem', textAlign: 'center' }}>{heading}</h2>
        <p style={{ fontFamily: bodyFont, color: c.muted, fontSize: 'clamp(0.95rem,1.4cqi,1.05rem)', textAlign: 'center', marginBottom: '2.5rem', maxWidth: 640, marginInline: 'auto' }}>{intro}</p>
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {pairs.map((p, i) => (
            <div key={i} style={{ background: c.secondary, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', background: c.accent + '22' }}>
                <PairCell label="Before" src={p.before} c={c} bodyFont={bodyFont} />
                <PairCell label="After"  src={p.after}  c={c} bodyFont={bodyFont} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PairCell({ label, src, c, bodyFont }) {
  return (
    <div style={{ position: 'relative', minHeight: 200, background: c.bg }}>
      {src
        ? <img src={src} alt={label} style={{ width: '100%', height: '100%', minHeight: 200, objectFit: 'cover', display: 'block' }} />
        : <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.muted, fontFamily: bodyFont, fontSize: '0.85rem' }}>{label}: upload photo</div>
      }
      <span style={{
        position: 'absolute', top: 8, left: 8,
        background: c.accent, color: '#fff', padding: '3px 10px',
        fontFamily: bodyFont, fontSize: '0.7rem', fontWeight: 700,
        letterSpacing: '0.12em', textTransform: 'uppercase',
      }}>{label}</span>
    </div>
  );
}
