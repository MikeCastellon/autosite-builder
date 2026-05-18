// src/components/preview/sections/SectionRenderer.jsx
// Dispatches new-style section types to their shared component implementations.
// Existing singleton sections (hero/services/about/gallery/testimonials/cta/etc.)
// remain inline in each template file — this renderer is only for NEW universal
// types and per-instance multi types (mediaText).

import FAQSection from './FAQSection.jsx';
import BeforeAfterSection from './BeforeAfterSection.jsx';
import MediaTextSection from './MediaTextSection.jsx';
import ProcessSection from './ProcessSection.jsx';

const REGISTRY = {
  faq: FAQSection,
  beforeAfter: BeforeAfterSection,
  mediaText: MediaTextSection,
  process: ProcessSection,
};

export default function SectionRenderer({ instance, order, ...shared }) {
  const Comp = REGISTRY[instance.type];
  if (!Comp) return null;
  return (
    <div style={{ order }}>
      <Comp instance={instance} {...shared} />
    </div>
  );
}

export function isRendererManagedType(type) {
  return type in REGISTRY;
}
