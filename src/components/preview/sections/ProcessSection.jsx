// src/components/preview/sections/ProcessSection.jsx
// Renders a numbered "How It Works" steps block. Pulls copy from generatedCopy.process.
// Falls back to a generic 4-step placeholder if AI hasn't returned content yet.

export default function ProcessSection({ generatedCopy, templateMeta }) {
  const c = templateMeta.colors;
  const font = templateMeta.font;
  const bodyFont = templateMeta.bodyFont;

  const intro = generatedCopy?.process?.intro || 'How working with us looks.';
  const steps = generatedCopy?.process?.steps?.length
    ? generatedCopy.process.steps
    : [
      { title: 'Get in touch',  description: 'Tell us what you need.' },
      { title: 'We plan it',    description: 'You get a clear quote.' },
      { title: 'We do the work', description: 'On schedule, every time.' },
      { title: 'You enjoy it',  description: 'Driveaway ready.' },
    ];

  return (
    <section style={{ background: c.bg, padding: 'clamp(3rem,6cqi,5rem) clamp(1.5rem,5cqi,3rem)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{
          fontFamily: font, color: c.text, fontWeight: 900,
          fontSize: 'clamp(1.6rem,3.5cqi,2.5rem)', marginBottom: '0.75rem', textAlign: 'center',
        }}>How It Works</h2>
        <p style={{
          fontFamily: bodyFont, color: c.muted,
          fontSize: 'clamp(0.95rem,1.4cqi,1.05rem)', lineHeight: 1.6,
          textAlign: 'center', maxWidth: 640, margin: '0 auto 2.5rem',
        }}>{intro}</p>
        <div style={{
          display: 'grid', gap: '1.5rem',
          gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`,
        }}>
          {steps.map((step, i) => (
            <div key={i} style={{
              background: c.secondary, padding: '1.5rem',
              borderTop: `3px solid ${c.accent}`,
            }}>
              <div style={{
                fontFamily: font, fontSize: '2rem', fontWeight: 900, color: c.accent,
                lineHeight: 1, marginBottom: '0.5rem',
              }}>{String(i + 1).padStart(2, '0')}</div>
              <div style={{
                fontFamily: font, fontSize: '1.05rem', fontWeight: 700,
                color: c.text, marginBottom: '0.4rem',
              }}>{step.title}</div>
              <div style={{
                fontFamily: bodyFont, fontSize: '0.9rem', color: c.muted, lineHeight: 1.55,
              }}>{step.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
