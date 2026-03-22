import { useState, useRef, useEffect } from 'react';

const EMOJI_GROUPS = {
  'Common': ['⭐', '✅', '🏆', '💎', '🔧', '🛞', '🚗', '🏎️', '💰', '💳', '🕐', '⏱️', '📞', '📍', '🎯', '✓', '★', '♦'],
  'Trust': ['🛡️', '🔒', '✔️', '👍', '💪', '🤝', '👑', '🎖️', '🏅', '📋', '📦', '🚚', '⚡', '🔥', '❤️', '💯'],
  'Business': ['🏢', '🏠', '📊', '📈', '💼', '🎨', '🔨', '⚙️', '🪧', '📱', '💻', '🌟', '🌍', '🌎', '♻️', '🌱'],
  'Vehicles': ['🚙', '🚘', '🏍️', '🛻', '🚐', '🔩', '🛠️', '🧰', '🪛', '🔋', '⛽', '🧽', '🧹', '💧', '✨', '🫧'],
};

// SVG icon paths (16x16 viewBox) — stored as {id, path, label}
const SVG_ICONS = [
  { id: 'icon:check', label: 'Check', path: 'M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z' },
  { id: 'icon:shield', label: 'Shield', path: 'M8 1l6 2.5v4c0 3.5-2.5 6.5-6 7.5-3.5-1-6-4-6-7.5v-4L8 1z' },
  { id: 'icon:star', label: 'Star', path: 'M8 1.5l2 4.5 4.5.5-3.25 3 1 4.5L8 11.5 3.75 14l1-4.5L1.5 6.5 6 6z' },
  { id: 'icon:clock', label: 'Clock', path: 'M8 14A6 6 0 108 2a6 6 0 000 12zm0-1A5 5 0 118 3a5 5 0 010 10zM8 4.5v4l2.5 1.5' },
  { id: 'icon:phone', label: 'Phone', path: 'M5.5 1.5c-.3 0-.6.2-.7.4L3.5 4.5c-.1.3 0 .6.2.8l2 2-2.5 2.5 2 2c.2.2.5.3.8.2l2.6-1.3c.2-.1.4-.4.4-.7v-1.5l3 3v2c0 .6-.4 1-1 1C5.5 14.5 1.5 10.5 1.5 5c0-.6.4-1 1-1h2l3 3H6z' },
  { id: 'icon:location', label: 'Location', path: 'M8 1C5.2 1 3 3.2 3 6c0 4 5 9 5 9s5-5 5-9c0-2.8-2.2-5-5-5zm0 7a2 2 0 110-4 2 2 0 010 4z' },
  { id: 'icon:heart', label: 'Heart', path: 'M8 14s-5.5-3.5-5.5-7.5C2.5 4 4 2.5 5.5 2.5c1 0 2 .5 2.5 1.5.5-1 1.5-1.5 2.5-1.5C12 2.5 13.5 4 13.5 6.5 13.5 10.5 8 14 8 14z' },
  { id: 'icon:bolt', label: 'Bolt', path: 'M7 1l-5 8h5l-1 6 5-8H6l1-6z' },
  { id: 'icon:car', label: 'Car', path: 'M3 10.5v1a1 1 0 001 1h1a1 1 0 001-1v-1m4 0v1a1 1 0 001 1h1a1 1 0 001-1v-1M3.5 7l1-3.5h7L12.5 7m-9 0h9m-9 0a1.5 1.5 0 00-1.5 1.5v2h12v-2A1.5 1.5 0 0012.5 7' },
  { id: 'icon:wrench', label: 'Wrench', path: 'M10.5 2A3.5 3.5 0 007.3 6L2.5 10.8a1.5 1.5 0 002.1 2.1L9.4 8.1A3.5 3.5 0 0010.5 2z' },
  { id: 'icon:cog', label: 'Settings', path: 'M8 10a2 2 0 100-4 2 2 0 000 4zm5.7-1.3l-1-.6a4.8 4.8 0 000-1.2l1-.6c.2-.1.3-.3.2-.5l-1-1.7c-.1-.2-.3-.3-.5-.2l-1 .6a4.8 4.8 0 00-1-.6l-.2-1.2c0-.2-.2-.3-.4-.3H7.2c-.2 0-.4.1-.4.3L6.6 4a4.8 4.8 0 00-1 .6l-1-.6c-.2-.1-.4 0-.5.2l-1 1.7c-.1.2 0 .4.2.5l1 .6a4.8 4.8 0 000 1.2l-1 .6c-.2.1-.3.3-.2.5l1 1.7c.1.2.3.3.5.2l1-.6a4.8 4.8 0 001 .6l.2 1.2c0 .2.2.3.4.3h1.6c.2 0 .4-.1.4-.3l.2-1.2a4.8 4.8 0 001-.6l1 .6c.2.1.4 0 .5-.2l1-1.7c.1-.2 0-.4-.2-.5z' },
  { id: 'icon:truck', label: 'Truck', path: 'M1 3h9v7H1V3zm9 3h3l2 3v4h-2m-3 0H6m-3 0H1m12 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-9 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z' },
  { id: 'icon:dollar', label: 'Dollar', path: 'M8 1v14m3-10.5c0-1.4-1.3-2.5-3-2.5S5 3.1 5 4.5 6.3 7 8 7s3 1.1 3 2.5S9.7 12 8 12s-3-1.1-3-2.5' },
  { id: 'icon:award', label: 'Award', path: 'M8 10a4 4 0 100-8 4 4 0 000 8zm-2.5 1L4 15l4-2 4 2-1.5-4' },
  { id: 'icon:globe', label: 'Globe', path: 'M8 14A6 6 0 108 2a6 6 0 000 12zM2 8h12M8 2c2 2 2.5 4 2.5 6S10 12 8 14M8 2C6 4 5.5 6 5.5 8S6 12 8 14' },
  { id: 'icon:home', label: 'Home', path: 'M2 8l6-6 6 6m-1 0v5a1 1 0 01-1 1H9V10H7v4H4a1 1 0 01-1-1V8' },
  { id: 'icon:mail', label: 'Mail', path: 'M2 3h12a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V4a1 1 0 011-1zm0 1l6 4 6-4' },
  { id: 'icon:calendar', label: 'Calendar', path: 'M3 4h10a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1zm2-2v3m6-3v3M2 7h12' },
];

// Render an icon value — if it starts with "icon:" render SVG, otherwise render as text/emoji
function IconOrEmoji({ value, size = 16, color = 'currentColor' }) {
  if (!value) return null;
  const icon = value.startsWith?.('icon:') && SVG_ICONS.find(i => i.id === value);
  if (icon) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d={icon.path} stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return <span>{value}</span>;
}

function EmojiPicker({ value, onChange, placeholder = '⭐' }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('emoji');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isIcon = value?.startsWith?.('icon:');

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-400 hover:border-gray-400 transition"
        style={{ width: 52, height: 38, fontSize: isIcon ? 14 : 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {value ? <IconOrEmoji value={value} size={18} color="#555" /> : <span style={{ opacity: 0.3, fontSize: 18 }}>{placeholder}</span>}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.15)', width: 260 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #eee', padding: '6px 10px 0' }}>
            {['emoji', 'icons'].map(t => (
              <button key={t} type="button" onClick={() => setTab(t)}
                style={{ flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: tab === t ? '#111' : '#999', borderBottom: tab === t ? '2px solid #111' : '2px solid transparent', background: 'none', border: 'none', borderBottomStyle: 'solid', cursor: 'pointer' }}>
                {t === 'emoji' ? '😀 Emoji' : '◇ Icons'}
              </button>
            ))}
          </div>
          <div style={{ padding: 10, maxHeight: 240, overflowY: 'auto' }}>
            {tab === 'emoji' ? (
              <>
                {Object.entries(EMOJI_GROUPS).map(([group, emojis]) => (
                  <div key={group} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#999', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, padding: '0 2px' }}>{group}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      {emojis.map((emoji) => (
                        <button key={emoji} type="button" onClick={() => { onChange(emoji); setOpen(false); }}
                          style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: value === emoji ? '#f3f4f6' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseOut={(e) => e.currentTarget.style.background = value === emoji ? '#f3f4f6' : 'transparent'}
                        >{emoji}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {SVG_ICONS.map((icon) => (
                  <button key={icon.id} type="button" title={icon.label} onClick={() => { onChange(icon.id); setOpen(false); }}
                    style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: value === icon.id ? '#f3f4f6' : 'transparent', border: value === icon.id ? '1px solid #d1d5db' : '1px solid transparent', borderRadius: 8, cursor: 'pointer' }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f3f4f6'}
                    onMouseOut={(e) => e.currentTarget.style.background = value === icon.id ? '#f3f4f6' : 'transparent'}
                  >
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d={icon.path} stroke="#555" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid #eee', padding: '6px 10px' }}>
            <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)}
              placeholder="Or type any emoji/text"
              className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-[12px] text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
        </div>
      )}
    </div>
  );
}

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

function Toggle({ value, onChange, options }) {
  return (
    <div className="flex gap-1 mb-4">
      {options.map(opt => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={`flex-1 py-1.5 px-2 rounded-lg text-[12px] font-medium border transition ${value === opt.value ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function ContentEditor({ isOpen, onClose, copy, images, onCopyChange, onImagesChange, templateMeta, templateId, customColors = {}, onCustomColors }) {
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

  const isSudsy = templateId === 'mobile_sudsy';
  const isWheel = templateId?.startsWith('wheel_');
  const isTint = templateId?.startsWith('tint_');
  const isApex = templateId === 'wheel_apex';
  const isObsidian = templateId === 'tint_obsidian';

  // Section visibility toggle registry per template
  const TOGGLEABLE = {
    _default: [
      { id: 'statsBar', label: 'Stats Bar' },
      { id: 'services', label: 'Services' },
      { id: 'about', label: 'About' },
      { id: 'gallery', label: 'Gallery' },
      { id: 'testimonials', label: 'Reviews' },
      { id: 'cta', label: 'Contact / CTA' },
      { id: 'awards', label: 'Awards' },
    ],
    wheel_apex: [
      { id: 'trustBar', label: 'Trust Bar' },
      { id: 'ticker', label: 'Scrolling Ticker' },
      { id: 'products', label: 'Products' },
      { id: 'brands', label: 'Brands' },
      { id: 'about', label: 'About' },
      { id: 'gallery', label: 'Gallery' },
      { id: 'testimonials', label: 'Reviews' },
      { id: 'cta', label: 'Contact / CTA' },
    ],
    wheel_edge: [
      { id: 'statsBar', label: 'Stats Bar' },
      { id: 'services', label: 'Services' },
      { id: 'brands', label: 'Brands' },
      { id: 'about', label: 'About' },
      { id: 'gallery', label: 'Gallery' },
      { id: 'testimonials', label: 'Reviews' },
      { id: 'cta', label: 'Contact / CTA' },
    ],
    wheel_clean: [
      { id: 'statsBar', label: 'Stats Bar' },
      { id: 'awards', label: 'Awards' },
      { id: 'services', label: 'Services' },
      { id: 'brands', label: 'Brands' },
      { id: 'about', label: 'About' },
      { id: 'gallery', label: 'Gallery' },
      { id: 'testimonials', label: 'Reviews' },
      { id: 'cta', label: 'Contact / CTA' },
    ],
    tint_obsidian: [
      { id: 'shadeGuide', label: 'Shade Guide' },
      { id: 'services', label: 'Services' },
      { id: 'brands', label: 'Film Brands' },
      { id: 'process', label: 'Process Steps' },
      { id: 'about', label: 'About' },
      { id: 'gallery', label: 'Gallery' },
      { id: 'testimonials', label: 'Reviews' },
      { id: 'cta', label: 'Contact / CTA' },
    ],
    tint_elite: [
      { id: 'statsBar', label: 'Stats Bar' },
      { id: 'services', label: 'Services' },
      { id: 'brands', label: 'Film Brands' },
      { id: 'about', label: 'About' },
      { id: 'gallery', label: 'Gallery' },
      { id: 'testimonials', label: 'Reviews' },
      { id: 'cta', label: 'Contact / CTA' },
    ],
    tint_dark: [
      { id: 'statsBar', label: 'Stats Bar' },
      { id: 'services', label: 'Services' },
      { id: 'brands', label: 'Film Brands' },
      { id: 'about', label: 'About' },
      { id: 'gallery', label: 'Gallery' },
      { id: 'testimonials', label: 'Reviews' },
      { id: 'cta', label: 'Contact / CTA' },
    ],
    mobile_sudsy: [
      { id: 'services', label: 'Services' },
      { id: 'process', label: 'How It Works' },
      { id: 'whyUs', label: 'Why Choose Us' },
      { id: 'about', label: 'About' },
      { id: 'gallery', label: 'Gallery' },
      { id: 'testimonials', label: 'Reviews' },
      { id: 'cta', label: 'Contact / CTA' },
    ],
    carwash_bubble: [
      { id: 'services', label: 'Services' },
      { id: 'process', label: 'How It Works' },
      { id: 'about', label: 'About' },
      { id: 'gallery', label: 'Gallery' },
      { id: 'testimonials', label: 'Reviews' },
      { id: 'cta', label: 'Contact / CTA' },
    ],
  };
  const toggleableSections = TOGGLEABLE[templateId] || TOGGLEABLE._default;
  const hiddenSections = copy?.hiddenSections || [];
  const isSectionHidden = (id) => hiddenSections.includes(id);
  const toggleSection = (id) => {
    const next = isSectionHidden(id)
      ? hiddenSections.filter(s => s !== id)
      : [...hiddenSections, id];
    setCopy('hiddenSections', next);
  };

  const sections = [
    { id: 'hero', label: 'Hero' },
    { id: 'visibility', label: 'Sections' },
    { id: 'services', label: 'Services' },
    ...(isSudsy ? [{ id: 'howItWorks', label: 'How It Works' }, { id: 'whyUs', label: 'Why Us' }] : []),
    ...(isWheel ? [{ id: 'products', label: 'Products' }, { id: 'brands', label: 'Brands' }] : []),
    ...(isTint && !isWheel ? [{ id: 'filmBrands', label: 'Film Brands' }] : []),
    ...(isObsidian ? [{ id: 'shadeGuide', label: 'Shades' }] : []),
    ...(isApex ? [{ id: 'trustBar', label: 'Trust Bar' }, { id: 'ticker', label: 'Ticker' }] : []),
    { id: 'about', label: 'About' },
    { id: 'testimonials', label: 'Reviews' },
    { id: 'images', label: 'Images' },
    { id: 'colors', label: 'Colors' },
    { id: 'footer', label: 'Footer' },
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20" style={{ right: 320, zIndex: 9998 }} onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-80 bg-white border-l border-gray-200 flex flex-col shadow-2xl" style={{ top: 52, zIndex: 9999 }}>
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
        <div className="flex gap-0.5 px-3 pt-3 pb-2 shrink-0 flex-wrap" style={{ position: 'relative', zIndex: 2 }}>
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveSection(s.id); }}
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

          {activeSection === 'visibility' && (
            <>
              <p className="text-[11px] text-gray-400 mb-4">Toggle sections on or off. Hidden sections won't appear on your site.</p>
              {toggleableSections.map(({ id, label }) => (
                <label key={id} className="flex items-center justify-between py-2.5 border-b border-gray-100 cursor-pointer">
                  <span className="text-[13px] text-gray-700">{label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!isSectionHidden(id)}
                    onClick={() => toggleSection(id)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${!isSectionHidden(id) ? 'bg-gray-900' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${!isSectionHidden(id) ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </label>
              ))}
            </>
          )}

          {activeSection === 'hero' && (
            <>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Hero Layout</p>
              <Toggle
                value={copy?.heroLayout || 'full'}
                onChange={(v) => setCopy('heroLayout', v)}
                options={[{ value: 'full', label: '⬛ Full Background' }, { value: 'split', label: '▥ Split (Image Right)' }]}
              />
              <Field label="Headline" value={copy.headline} onChange={(v) => setCopy('headline', v)} />
              <Field label="Subheadline" value={copy.subheadline} onChange={(v) => setCopy('subheadline', v)} multiline rows={2} />
              <Field label="Primary Button" value={copy.ctaPrimary} onChange={(v) => setCopy('ctaPrimary', v)} />
              <Field label="Secondary Button" value={copy.ctaSecondary} onChange={(v) => setCopy('ctaSecondary', v)} />
              <Field label="Button 1 URL (optional)" value={copy?.ctaPrimaryUrl} onChange={(v) => setCopy('ctaPrimaryUrl', v)} />
              <Field label="Button 2 URL (default: calls phone)" value={copy?.ctaSecondaryUrl} onChange={(v) => setCopy('ctaSecondaryUrl', v)} />
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

          {activeSection === 'howItWorks' && isSudsy && (() => {
            const defaults = [
              { emoji: '📱', title: 'You Book', desc: 'Call, text, or tap — your choice. Takes about 2 minutes.' },
              { emoji: '🚐', title: 'We Show Up', desc: 'Our van rolls up to your driveway, parking lot, or office.' },
              { emoji: '🪧', title: 'We Clean', desc: 'Pro gear, pro products, pro results — while you chill.' },
              { emoji: '😍', title: 'You Love It', desc: 'Spotless car, zero effort on your part. Life is good.' },
            ];
            const steps = copy?.howSteps || defaults.map(d => ({ ...d }));
            const updateStep = (i, key, val) => {
              const current = [...steps];
              current[i] = { ...current[i], [key]: val };
              setCopy('howSteps', current);
            };
            const removeStep = (i) => {
              const current = [...steps];
              current.splice(i, 1);
              setCopy('howSteps', current);
            };
            const addStep = () => {
              setCopy('howSteps', [...steps, { emoji: '✨', title: '', desc: '' }]);
            };
            return (
              <>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">How It Works Steps</p>
                {steps.map((step, i) => (
                  <div key={i} className="mb-4 p-3 bg-gray-50 rounded-lg relative">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Step {i + 1}</p>
                      {steps.length > 1 && (
                        <button type="button" onClick={() => removeStep(i)} className="text-[11px] text-red-400 hover:text-red-600 transition">Remove</button>
                      )}
                    </div>
                    <div className="grid grid-cols-[60px_1fr] gap-2 mb-2">
                      <EmojiPicker value={step.emoji ?? ''} onChange={(v) => updateStep(i, 'emoji', v)} placeholder="📱" />
                      <input type="text" value={step.title ?? ''} onChange={(e) => updateStep(i, 'title', e.target.value)} placeholder="Step title" className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </div>
                    <textarea rows={2} value={step.desc ?? ''} onChange={(e) => updateStep(i, 'desc', e.target.value)} placeholder="Step description" className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
                  </div>
                ))}
                <button type="button" onClick={addStep} className="w-full py-2 text-[12px] font-semibold text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-700 transition mb-2">+ Add Step</button>
              </>
            );
          })()}

          {activeSection === 'whyUs' && isSudsy && (() => {
            const defaultCards = [
              { icon: '🏠', title: 'We Come To You', desc: 'Zero trips to a shop. We bring the whole operation to your door.' },
              { icon: '🏆', title: 'Professional Results', desc: 'Pro-grade products and equipment — not a bucket and a sponge.' },
              { icon: '⏰', title: 'Flexible Scheduling', desc: 'Same-day often available. Early mornings, weekends — we work around you.' },
              { icon: '💰', title: 'Fair, Honest Pricing', desc: 'No upsell tricks. Just clear pricing for seriously good work.' },
              { icon: '😤', title: 'Zero Excuses Policy', desc: "We show up, don't cut corners, and if it's not right — we fix it." },
              { icon: '🌎', title: 'Eco-Friendly Methods', desc: 'Water-efficient techniques and biodegradable products.' },
            ];
            const cards = copy?.whyCards || defaultCards.map(d => ({ ...d }));
            const updateCard = (i, key, val) => {
              const current = [...cards];
              current[i] = { ...current[i], [key]: val };
              setCopy('whyCards', current);
            };
            const removeCard = (i) => {
              const current = [...cards];
              current.splice(i, 1);
              setCopy('whyCards', current);
            };
            const addCard = () => {
              setCopy('whyCards', [...cards, { icon: '✨', title: '', desc: '' }]);
            };
            return (
              <>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Why Choose Us Cards</p>
                {cards.map((card, i) => (
                  <div key={i} className="mb-4 p-3 bg-gray-50 rounded-lg relative">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Card {i + 1}</p>
                      {cards.length > 1 && (
                        <button type="button" onClick={() => removeCard(i)} className="text-[11px] text-red-400 hover:text-red-600 transition">Remove</button>
                      )}
                    </div>
                    <div className="grid grid-cols-[60px_1fr] gap-2 mb-2">
                      <EmojiPicker value={card.icon ?? ''} onChange={(v) => updateCard(i, 'icon', v)} placeholder="🏠" />
                      <input type="text" value={card.title ?? ''} onChange={(e) => updateCard(i, 'title', e.target.value)} placeholder="Card title" className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </div>
                    <textarea rows={2} value={card.desc ?? ''} onChange={(e) => updateCard(i, 'desc', e.target.value)} placeholder="Card description" className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
                  </div>
                ))}
                <button type="button" onClick={addCard} className="w-full py-2 text-[12px] font-semibold text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-700 transition mb-2">+ Add Card</button>
              </>
            );
          })()}

          {activeSection === 'products' && isWheel && (() => {
            const products = copy?.products || [];
            const showProducts = copy?.showProducts !== false;
            const updateProduct = (i, key, val) => {
              const current = [...products];
              current[i] = { ...current[i], [key]: val };
              setCopy('products', current);
            };
            const removeProduct = (i) => {
              const current = [...products];
              current.splice(i, 1);
              setCopy('products', current);
            };
            const addProduct = () => {
              setCopy('products', [...products, { name: '', price: '', description: '', badge: '' }]);
            };
            return (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Show Products Section</p>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showProducts}
                    onClick={() => setCopy('showProducts', !showProducts)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${showProducts ? 'bg-gray-900' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showProducts ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                {showProducts && (
                  <>
                    <p className="text-[11px] text-gray-400 mb-3">Add products or packages to display in the grid.</p>
                    {products.map((prod, i) => (
                      <div key={i} className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Product {i + 1}</p>
                          <button type="button" onClick={() => removeProduct(i)} className="text-[11px] text-red-400 hover:text-red-600 transition">Remove</button>
                        </div>
                        <div className="mb-3">
                          <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Product Image</label>
                          <label className="block cursor-pointer">
                            {prod.image ? (
                              <div className="relative group rounded-lg overflow-hidden border border-gray-200">
                                <img src={prod.image} alt="Product" className="w-full h-24 object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                  <span className="text-white text-[11px] font-medium">Change</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-16 border-2 border-dashed border-gray-200 rounded-lg hover:border-gray-400 transition text-gray-400 hover:text-gray-600">
                                <span className="text-[11px]">+ Upload Image</span>
                              </div>
                            )}
                            <input type="file" accept="image/*" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = (ev) => updateProduct(i, 'image', ev.target.result);
                              reader.readAsDataURL(file);
                            }} className="sr-only" />
                          </label>
                          {prod.image && (
                            <button onClick={() => updateProduct(i, 'image', null)} className="mt-1 text-[11px] text-red-400 hover:text-red-600 transition">Remove image</button>
                          )}
                        </div>
                        <Field label="Name" value={prod.name ?? ''} onChange={(v) => updateProduct(i, 'name', v)} />
                        <Field label="Price" value={prod.price ?? ''} onChange={(v) => updateProduct(i, 'price', v)} />
                        <Field label="Description" value={prod.description ?? ''} onChange={(v) => updateProduct(i, 'description', v)} />
                        <Field label="Badge (e.g. Bestseller, New, Sale)" value={prod.badge ?? ''} onChange={(v) => updateProduct(i, 'badge', v)} />
                      </div>
                    ))}
                    <button type="button" onClick={addProduct} className="w-full py-2 text-[12px] font-semibold text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-700 transition mb-2">+ Add Product</button>
                  </>
                )}
              </>
            );
          })()}

          {activeSection === 'brands' && isWheel && (
            <>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Wheel Brands</p>
              <Field label="Comma-separated" value={copy?.wheelBrands?.join?.(', ') ?? ''} onChange={(v) => setCopy('wheelBrands', v.split(',').map(s => s.trim()).filter(Boolean))} multiline rows={2} />
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-4">Tire Brands</p>
              <Field label="Comma-separated" value={copy?.tireBrandsList?.join?.(', ') ?? ''} onChange={(v) => setCopy('tireBrandsList', v.split(',').map(s => s.trim()).filter(Boolean))} multiline rows={2} />
            </>
          )}

          {activeSection === 'filmBrands' && isTint && (
            <>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Film Brands</p>
              <Field label="Comma-separated (e.g. XPEL, LLumar, 3M)" value={copy?.filmBrandsList?.join?.(', ') ?? ''} onChange={(v) => setCopy('filmBrandsList', v.split(',').map(s => s.trim()).filter(Boolean))} multiline rows={2} />
              <p className="text-[11px] text-gray-400 mt-1">Leave empty to use film brands from your business info form.</p>
            </>
          )}

          {activeSection === 'shadeGuide' && isObsidian && (() => {
            const defaultShades = [
              { vlt: '5', name: 'Limo Black', legal: 'Rear windows only' },
              { vlt: '15', name: 'Midnight', legal: 'Rear-legal in most states' },
              { vlt: '25', name: 'Dark Smoke', legal: 'Rear-legal in most states' },
              { vlt: '35', name: 'Medium', legal: 'Front-legal in most states' },
              { vlt: '50', name: 'Light Smoke', legal: 'Universal' },
            ];
            const shades = copy?.shadeGuide?.length > 0 ? copy.shadeGuide : defaultShades.map(d => ({ ...d }));
            const showShades = copy?.showShadeGuide !== false;
            const updateShade = (i, key, val) => {
              const current = [...shades];
              current[i] = { ...current[i], [key]: val };
              setCopy('shadeGuide', current);
            };
            const removeShade = (i) => {
              const current = [...shades];
              current.splice(i, 1);
              setCopy('shadeGuide', current);
            };
            const addShade = () => {
              setCopy('shadeGuide', [...shades, { vlt: '20', name: '', legal: '' }]);
            };
            return (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Show Shade Guide</p>
                  <button type="button" role="switch" aria-checked={showShades}
                    onClick={() => setCopy('showShadeGuide', !showShades)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${showShades ? 'bg-gray-900' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showShades ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                {showShades && (
                  <>
                    <p className="text-[11px] text-gray-400 mb-3">Configure tint shade options shown to customers.</p>
                    {shades.map((shade, i) => (
                      <div key={i} className="mb-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Shade {i + 1}</p>
                          {shades.length > 1 && (
                            <button type="button" onClick={() => removeShade(i)} className="text-[11px] text-red-400 hover:text-red-600 transition">Remove</button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <input type="text" value={shade.vlt ?? ''} onChange={(e) => updateShade(i, 'vlt', e.target.value)} placeholder="VLT %" className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          <input type="text" value={shade.name ?? ''} onChange={(e) => updateShade(i, 'name', e.target.value)} placeholder="Name" className="col-span-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                        <input type="text" value={shade.legal ?? ''} onChange={(e) => updateShade(i, 'legal', e.target.value)} placeholder="Legal note (e.g. Rear-legal)" className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        <div className="mt-2">
                          <ImageSlot label={`Shade ${i + 1} Photo`} value={images?.[`shade${i}`]} onChange={(v) => setImage(`shade${i}`, v)} />
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={addShade} className="w-full py-2 text-[12px] font-semibold text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-700 transition mb-2">+ Add Shade</button>
                  </>
                )}
              </>
            );
          })()}

          {activeSection === 'trustBar' && isApex && (() => {
            const defaultTrust = [
              { emoji: '🕐', label: 'Professional service', sub: 'Trusted locally' },
              { emoji: '✓', label: 'Fitment guaranteed', sub: 'Or free return' },
              { emoji: '💳', label: 'Finance available', sub: '0% for 12 months' },
              { emoji: '★', label: '4.9 star rating', sub: 'Customer reviews' },
            ];
            const items = copy?.trustBar?.length > 0 ? copy.trustBar : defaultTrust.map(d => ({ ...d }));
            const updateItem = (i, key, val) => {
              const current = [...items];
              current[i] = { ...current[i], [key]: val };
              setCopy('trustBar', current);
            };
            const removeItem = (i) => {
              const current = [...items];
              current.splice(i, 1);
              setCopy('trustBar', current);
            };
            const addItem = () => {
              setCopy('trustBar', [...items, { emoji: '★', label: '', sub: '' }]);
            };
            return (
              <>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Trust Bar Items</p>
                {items.map((item, i) => (
                  <div key={i} className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Item {i + 1}</p>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)} className="text-[11px] text-red-400 hover:text-red-600 transition">Remove</button>
                      )}
                    </div>
                    <div className="grid grid-cols-[60px_1fr] gap-2 mb-2">
                      <EmojiPicker value={item.emoji ?? ''} onChange={(v) => updateItem(i, 'emoji', v)} placeholder="🕐" />
                      <input type="text" value={item.label ?? ''} onChange={(e) => updateItem(i, 'label', e.target.value)} placeholder="Label text" className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </div>
                    <input type="text" value={item.sub ?? ''} onChange={(e) => updateItem(i, 'sub', e.target.value)} placeholder="Sub-text" className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>
                ))}
                <button type="button" onClick={addItem} className="w-full py-2 text-[12px] font-semibold text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-700 transition mb-2">+ Add Item</button>
              </>
            );
          })()}

          {activeSection === 'ticker' && isApex && (() => {
            const items = copy?.tickerItems || [];
            return (
              <>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Scrolling Ticker Text</p>
                <p className="text-[11px] text-gray-400 mb-3">Comma-separated items that scroll across the dark bar.</p>
                <Field
                  label="Ticker items (comma-separated)"
                  value={items.length > 0 ? items.join(', ') : ''}
                  onChange={(v) => setCopy('tickerItems', v.split(',').map(s => s.trim()).filter(Boolean))}
                  multiline
                  rows={3}
                />
                <p className="text-[11px] text-gray-400 mt-1">Leave empty to use specialties from your business info.</p>
              </>
            );
          })()}

          {activeSection === 'about' && (
            <>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Left Panel Style</p>
              <Toggle
                value={copy?.aboutLayout || 'image'}
                onChange={(v) => setCopy('aboutLayout', v)}
                options={[{ value: 'stats', label: '📊 Stats Box' }, { value: 'image', label: '🖼 Photo' }]}
              />
              {(copy?.aboutLayout || 'image') === 'stats' && (
                <div className="mt-3 mb-2 space-y-3">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Stats (value + label)</p>
                  {[0, 1, 2].map((i) => {
                    const stat = copy?.aboutStats?.[i] || {};
                    const updateStat = (key, val) => {
                      const current = [...(copy?.aboutStats || [{ value: '', label: '' }, { value: '', label: '' }, { value: '', label: '' }])];
                      current[i] = { ...current[i], [key]: val };
                      setCopy('aboutStats', current);
                    };
                    return (
                      <div key={i} className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={stat.value || ''}
                          onChange={(e) => updateStat('value', e.target.value)}
                          placeholder={['e.g. 10+', 'e.g. 500+', 'e.g. 5★'][i]}
                          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <input
                          type="text"
                          value={stat.label || ''}
                          onChange={(e) => updateStat('label', e.target.value)}
                          placeholder={['Years Experience', 'Cars Detailed', 'Avg Rating'][i]}
                          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              <Field label="About Text" value={copy.aboutText} onChange={(v) => setCopy('aboutText', v)} multiline rows={8} />
            </>
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

          {activeSection === 'colors' && templateMeta && (
            <>
              <p className="text-[11px] text-gray-400 mb-4">Click a swatch to change the color. Changes apply live.</p>
              {[
                { key: 'bg', label: 'Background' },
                { key: 'accent', label: 'Accent / Brand' },
                { key: 'text', label: 'Text' },
                { key: 'secondary', label: 'Surface' },
                { key: 'muted', label: 'Muted Text' },
              ].map(({ key, label }) => {
                const base = templateMeta.colors[key] || '#000000';
                const val = customColors?.[key] ?? base;
                return (
                  <div key={key} className="flex items-center justify-between mb-3">
                    <span className="text-[13px] text-gray-700">{label}</span>
                    <div className="flex items-center gap-2">
                      {customColors?.[key] && (
                        <button onClick={() => onCustomColors(prev => { const n = { ...prev }; delete n[key]; return n; })}
                          className="text-[11px] text-gray-400 hover:text-red-500 transition">reset</button>
                      )}
                      <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-200 cursor-pointer shadow-sm">
                        <div className="absolute inset-0" style={{ background: val }} />
                        <input type="color" value={val}
                          onChange={(e) => onCustomColors(prev => ({ ...prev, [key]: e.target.value }))}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                      </div>
                    </div>
                  </div>
                );
              })}
              {Object.keys(customColors || {}).length > 0 && (
                <button onClick={() => onCustomColors({})}
                  className="mt-2 text-[12px] text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg px-3 py-1.5 w-full transition">
                  Reset all colors to default
                </button>
              )}
            </>
          )}

          {activeSection === 'footer' && (
            <>
              <Field label="Footer Tagline" value={copy.footerTagline} onChange={(v) => setCopy('footerTagline', v)} />
              <Field label="CTA Button URL (optional)" value={copy?.ctaUrl} onChange={(v) => setCopy('ctaUrl', v)} />
              <div className="mt-4 mb-2">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Social Icons</p>
                <p className="text-[11px] text-gray-400 mb-3">Toggle which social icons appear on your site.</p>
                {[
                  { key: 'hideInstagram', label: 'Instagram' },
                  { key: 'hideFacebook', label: 'Facebook' },
                  { key: 'hideTiktok', label: 'TikTok' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center justify-between py-2 border-b border-gray-100 cursor-pointer">
                    <span className="text-[13px] text-gray-700">{label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!images?.[key]}
                      onClick={() => setImage(key, !images?.[key])}
                      className={`relative w-9 h-5 rounded-full transition-colors ${!images?.[key] ? 'bg-gray-900' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${!images?.[key] ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </label>
                ))}
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}
