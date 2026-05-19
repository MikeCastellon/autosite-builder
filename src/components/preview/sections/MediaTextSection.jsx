// src/components/preview/sections/MediaTextSection.jsx
// Image-or-video block beside a heading + body + optional CTA.
// Per-instance content: generatedCopy.sectionContent[instance.id] =
//   { heading, body, image?, video?, ctaLabel?, ctaUrl?, alignment: 'left'|'right' }
// Per-instance image lookup in `images` map keyed by instance id:
//   images[`mediaText_${instance.id}`]

export default function MediaTextSection({ instance, generatedCopy, templateMeta, images = {} }) {
  const c = templateMeta.colors;
  const font = templateMeta.font;
  const bodyFont = templateMeta.bodyFont;
  const content = generatedCopy?.sectionContent?.[instance.id] || {};
  const alignment = content.alignment === 'right' ? 'right' : 'left';
  const imageSrc = images[`mediaText_${instance.id}`] || content.image || null;

  const heading = content.heading || 'Tell your story';
  const body = content.body || 'Add custom copy here in the editor to highlight what makes you different.';

  const reverse = alignment === 'right';

  return (
    <section style={{
      background: c.bg, padding: 'clamp(3rem, 7cqi, 6rem) clamp(1.5rem, 7cqi, 5rem)',
    }}>
      <div style={{
        display: 'grid', gap: 'clamp(1.5rem,3cqi,3rem)',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        direction: reverse ? 'rtl' : 'ltr',
      }}>
        <div style={{ direction: 'ltr', minHeight: 240 }}>
          {imageSrc
            ? <img src={imageSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 240 }} />
            : <div style={{
                width: '100%', minHeight: 240, background: c.secondary,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: bodyFont, color: c.muted, fontSize: '0.85rem',
              }}>Upload an image in the editor</div>
          }
        </div>
        <div style={{ direction: 'ltr', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h2 style={{
            fontFamily: font, color: c.text, fontWeight: 900,
            fontSize: 'clamp(1.4rem,3cqi,2.25rem)', lineHeight: 1.1, marginBottom: '1rem',
          }}>{heading}</h2>
          <p style={{
            fontFamily: bodyFont, color: c.muted, lineHeight: 1.65,
            fontSize: 'clamp(0.95rem,1.4cqi,1.05rem)', marginBottom: content.ctaLabel ? '1.5rem' : 0,
          }}>{body}</p>
          {content.ctaLabel && (
            <a href={content.ctaUrl || '#contact'} style={{
              alignSelf: 'flex-start',
              background: c.accent, color: '#fff', padding: '12px 28px',
              fontFamily: bodyFont, fontSize: '0.9rem', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              textDecoration: 'none', display: 'inline-block',
            }}>{content.ctaLabel}</a>
          )}
        </div>
      </div>
    </section>
  );
}
