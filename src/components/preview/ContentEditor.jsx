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

  const sections = [
    { id: 'hero', label: 'Hero' },
    { id: 'services', label: 'Services' },
    ...(isSudsy ? [{ id: 'howItWorks', label: 'How It Works' }, { id: 'whyUs', label: 'Why Us' }] : []),
    ...(isWheel ? [{ id: 'products', label: 'Products' }, { id: 'brands', label: 'Brands' }] : []),
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
                      <input type="text" value={step.emoji ?? ''} onChange={(e) => updateStep(i, 'emoji', e.target.value)} placeholder="📱" className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[18px] text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
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
                      <input type="text" value={card.icon ?? ''} onChange={(e) => updateCard(i, 'icon', e.target.value)} placeholder="🏠" className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[18px] text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
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
