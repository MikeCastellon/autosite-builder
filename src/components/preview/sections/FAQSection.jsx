// src/components/preview/sections/FAQSection.jsx
// Renders an FAQ accordion. Per-instance content lives in
// generatedCopy.sectionContent[instance.id] = { items: [{q,a}, ...] }.
// Falls back to generic placeholder questions if AI hasn't returned content yet.

import { useState } from 'react';

export default function FAQSection({ instance, generatedCopy, templateMeta, businessInfo }) {
  const c = templateMeta.colors;
  const font = templateMeta.font;
  const bodyFont = templateMeta.bodyFont;
  const content = generatedCopy?.sectionContent?.[instance.id] || {};
  const items = content.items?.length ? content.items : [
    { q: `What areas does ${businessInfo?.businessName || 'your shop'} serve?`,
      a: `We proudly serve ${businessInfo?.city || 'the local area'} and surrounding neighborhoods.` },
    { q: 'Do I need an appointment?',
      a: 'Appointments are recommended but we do take walk-ins when our schedule allows.' },
    { q: 'How long does a typical service take?',
      a: 'Most services are completed the same day. We will give you a clear ETA at drop-off.' },
    { q: 'What forms of payment do you accept?',
      a: 'We accept all major credit cards, debit, and cash.' },
  ];

  const [open, setOpen] = useState(0);

  return (
    <section style={{ background: c.bg, padding: 'clamp(3rem,6cqi,5rem) clamp(1.5rem,5cqi,3rem)' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <h2 style={{
          fontFamily: font, color: c.text, fontWeight: 900,
          fontSize: 'clamp(1.6rem,3.5cqi,2.5rem)', marginBottom: '2rem', textAlign: 'center',
        }}>Frequently Asked Questions</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i} style={{
                background: c.secondary, border: `1px solid ${c.accent}22`,
              }}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  style={{
                    width: '100%', padding: '1rem 1.25rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontFamily: font, color: c.text, fontWeight: 700, textAlign: 'left',
                    fontSize: '1rem',
                  }}
                >
                  <span>{item.q}</span>
                  <span style={{
                    color: c.accent, fontSize: '1.25rem', flexShrink: 0,
                    transform: isOpen ? 'rotate(45deg)' : 'rotate(0)', transition: 'transform 0.18s',
                  }}>+</span>
                </button>
                {isOpen && (
                  <div style={{
                    padding: '0 1.25rem 1.25rem',
                    fontFamily: bodyFont, color: c.muted, lineHeight: 1.6,
                    fontSize: '0.95rem',
                  }}>{item.a}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
