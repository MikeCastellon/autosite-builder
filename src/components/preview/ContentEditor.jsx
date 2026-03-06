import { useState } from 'react';

const SECTION_ICON = {
  hero: '✦',
  services: '⚙',
  about: '◎',
  testimonials: '❝',
  footer: '◻',
};

function Field({ label, value, onChange, multiline = false, rows = 3 }) {
  const base = 'w-full text-[13px] text-gray-800 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition resize-none';
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</label>
      {multiline ? (
        <textarea rows={rows} value={value || ''} onChange={(e) => onChange(e.target.value)} className={base} />
      ) : (
        <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} className={base} />
      )}
    </div>
  );
}

function ImageSlot({ label, value, onChange }) {
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onChange(ev.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className="mb-4">
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</label>
      <label className="block cursor-pointer">
        {value ? (
          <div className="relative group rounded-lg overflow-hidden border border-gray-200">
            <img src={value} alt={label} className="w-full h-28 object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <span className="text-white text-[12px] font-medium">Change Image</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-20 border-2 border-dashed border-gray-200 rounded-lg hover:border-gray-400 transition text-gray-400 hover:text-gray-600">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="mb-1">
              <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="text-[12px]">Upload {label}</span>
          </div>
        )}
        <input type="file" accept="image/*" onChange={handleFile} className="sr-only" />
      </label>
      {value && (
        <button onClick={() => onChange(null)} className="mt-1 text-[11px] text-red-400 hover:text-red-600 transition">
          Remove
        </button>
      )}
    </div>
  );
}

export default function ContentEditor({ isOpen, onClose, copy, images, onCopyChange, onImagesChange }) {
  const [activeSection, setActiveSection] = useState('hero');

  const setCopy = (path, value) => {
    const parts = path.split('.');
    const next = structuredClone(copy);
    let obj = next;
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    obj[parts[parts.length - 1]] = value;
    onCopyChange(next);
  };

  const setServiceItem = (index, field, value) => {
    const next = structuredClone(copy);
    next.servicesSection.items[index][field] = value;
    onCopyChange(next);
  };

  const setTestimonial = (index, field, value) => {
    const next = structuredClone(copy);
    next.testimonialPlaceholders[index][field] = value;
    onCopyChange(next);
  };

  const setImage = (key, value) => {
    onImagesChange((prev) => ({ ...prev, [key]: value }));
  };

  const sections = [
    { id: 'hero', label: 'Hero' },
    { id: 'services', label: 'Services' },
    { id: 'about', label: 'About' },
    { id: 'testimonials', label: 'Reviews' },
    { id: 'images', label: 'Images' },
    { id: 'footer', label: 'Footer' },
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 z-[70] w-80 bg-white border-l border-gray-200 flex flex-col shadow-2xl" style={{ top: 52 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-[13px] font-semibold text-gray-900">Edit Content</p>
            <p className="text-[11px] text-gray-400">Changes apply live</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex gap-0.5 px-3 pt-3 pb-2 shrink-0 flex-wrap">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeSection === s.id
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Scrollable fields */}
        <div className="flex-1 overflow-y-auto px-4 py-2">

          {activeSection === 'hero' && (
            <>
              <Field label="Headline" value={copy.headline} onChange={(v) => setCopy('headline', v)} />
              <Field label="Subheadline" value={copy.subheadline} onChange={(v) => setCopy('subheadline', v)} multiline rows={2} />
              <Field label="Primary Button" value={copy.ctaPrimary} onChange={(v) => setCopy('ctaPrimary', v)} />
              <Field label="Secondary Button" value={copy.ctaSecondary} onChange={(v) => setCopy('ctaSecondary', v)} />
            </>
          )}

          {activeSection === 'services' && (
            <>
              <Field label="Services Intro" value={copy.servicesSection?.intro} onChange={(v) => setCopy('servicesSection.intro', v)} multiline rows={2} />
              {copy.servicesSection?.items?.map((item, i) => (
                <div key={i} className="mb-5 p-3 bg-gray-50 rounded-lg">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Service {i + 1}</p>
                  <Field label="Name" value={item.name} onChange={(v) => setServiceItem(i, 'name', v)} />
                  <Field label="Description" value={item.description} onChange={(v) => setServiceItem(i, 'description', v)} multiline rows={2} />
                </div>
              ))}
            </>
          )}

          {activeSection === 'about' && (
            <Field label="About Text" value={copy.aboutText} onChange={(v) => setCopy('aboutText', v)} multiline rows={8} />
          )}

          {activeSection === 'testimonials' && (
            <>
              {copy.testimonialPlaceholders?.map((t, i) => (
                <div key={i} className="mb-5 p-3 bg-gray-50 rounded-lg">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Review {i + 1}</p>
                  <Field label="Review Text" value={t.text} onChange={(v) => setTestimonial(i, 'text', v)} multiline rows={3} />
                  <Field label="Customer Name" value={t.name} onChange={(v) => setTestimonial(i, 'name', v)} />
                </div>
              ))}
            </>
          )}

          {activeSection === 'images' && (
            <>
              <p className="text-[11px] text-gray-400 mb-4">Upload photos to replace the placeholder backgrounds on your site.</p>
              <ImageSlot label="Business Logo" value={images?.logo} onChange={(v) => setImage('logo', v)} />
              <hr className="my-4 border-gray-100" />
              <ImageSlot label="Hero Background" value={images?.hero} onChange={(v) => setImage('hero', v)} />
              <ImageSlot label="About Section" value={images?.about} onChange={(v) => setImage('about', v)} />
              <ImageSlot label="Gallery Photo 1" value={images?.gallery0} onChange={(v) => setImage('gallery0', v)} />
              <ImageSlot label="Gallery Photo 2" value={images?.gallery1} onChange={(v) => setImage('gallery1', v)} />
              <ImageSlot label="Gallery Photo 3" value={images?.gallery2} onChange={(v) => setImage('gallery2', v)} />
            </>
          )}

          {activeSection === 'footer' && (
            <Field label="Footer Tagline" value={copy.footerTagline} onChange={(v) => setCopy('footerTagline', v)} />
          )}

        </div>
      </div>
    </>
  );
}
