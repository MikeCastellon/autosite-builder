import { useState, useEffect, useRef } from 'react';
import { COMMON_FIELDS, COMMON_EXTRA_FIELDS, TYPE_SPECIFIC_FIELDS, BUSINESS_TYPES } from '../../data/businessTypes.js';
import { DEMO_BUSINESS_INFO } from '../../data/demoData.js';
import { useAuth } from '../../lib/AuthContext.jsx';
import { supabase } from '../../lib/supabase.js';

const SOCIALFEEDS_URL = import.meta.env.VITE_SOCIALFEEDS_URL || 'https://social-feeds-app.netlify.app';

export default function StepBusinessInfo({ businessType, initialValues, onSubmit }) {
  const { session } = useAuth();
  const typeInfo = BUSINESS_TYPES.find((t) => t.id === businessType);
  const specificFields = TYPE_SPECIFIC_FIELDS[businessType] || [];

  const [values, setValues] = useState(initialValues || {});
  const [errors, setErrors] = useState({});
  const [customInputs, setCustomInputs] = useState({});
  const [packageDrafts, setPackageDrafts] = useState({});

  // Instagram state
  const [instagramAccount, setInstagramAccount] = useState(null);
  const [instagramLoading, setInstagramLoading] = useState(false);

  // Load existing Instagram widget on mount
  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      setInstagramLoading(true);
      const { data } = await supabase
        .from('widget_configs')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('type', 'instagram-feed')
        .order('created_at', { ascending: false })
        .limit(1);
      if (data?.[0]) {
        setInstagramAccount(data[0]);
        setValues((prev) => ({ ...prev, instagramWidgetKey: data[0].widget_key }));
      }
      setInstagramLoading(false);
    })();
  }, [session?.user?.id]);

  const handleConnectInstagram = () => {
    if (!session?.user?.id) return;
    const fbAppId = import.meta.env.VITE_FB_APP_ID;
    if (!fbAppId) return;
    const state = `${session.user.id}__sitebuilder`;
    const redirectUrl = encodeURIComponent(`${SOCIALFEEDS_URL}/.netlify/functions/instagram-auth-callback`);
    const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${fbAppId}&redirect_uri=${redirectUrl}&scope=instagram_business_basic&response_type=code&state=${state}`;
    // Open as popup, then poll for the new widget
    const popup = window.open(authUrl, 'instagram-auth', 'width=600,height=700');
    const pollInterval = setInterval(async () => {
      // Check if popup closed (user finished or cancelled)
      if (popup?.closed) {
        clearInterval(pollInterval);
        // Check Supabase for newly connected widget
        const { data } = await supabase
          .from('widget_configs')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('type', 'instagram-feed')
          .order('created_at', { ascending: false })
          .limit(1);
        if (data?.[0]) {
          setInstagramAccount(data[0]);
          setValues((prev) => ({ ...prev, instagramWidgetKey: data[0].widget_key }));
        }
      }
    }, 1500);
    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  // Google Place search state
  const reviewSource = values.reviewSource || 'google';
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!placeQuery.trim() || placeQuery.length < 3) { setPlaceResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setPlaceLoading(true);
      try {
        const res = await fetch(`https://social-feeds-app.netlify.app/.netlify/functions/places-search?q=${encodeURIComponent(placeQuery)}`);
        const data = await res.json();
        setPlaceResults(data.results || []);
      } catch { setPlaceResults([]); }
      setPlaceLoading(false);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [placeQuery]);

  const allFields = [...COMMON_FIELDS, ...specificFields];

  const handleChange = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const handleCheckbox = (key, option) => {
    const current = values[key] || [];
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    handleChange(key, next);
  };

  const validate = () => {
    const errs = {};
    allFields.forEach((field) => {
      if (field.required) {
        const val = values[field.key];
        if (!val || (Array.isArray(val) && val.length === 0) || val === '') {
          errs[field.key] = `${field.label} is required`;
        }
      }
    });
    return errs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    // Ensure reviewSource default is included
    const finalValues = { ...values };
    if (!finalValues.reviewSource) finalValues.reviewSource = 'google';
    onSubmit(finalValues);
  };

  const inputBase = 'w-full bg-white border rounded-xl px-3.5 py-2.5 text-[#1a1a1a] placeholder-[#aaa] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30 focus:border-[#cc0000] transition';

  const DEMO_ALLOWED_EMAILS = [
    'dev@639hz.com',
    'mike.castellon5@gmail.com',
  ];
  const canFillDemo = DEMO_ALLOWED_EMAILS.includes(session?.user?.email?.toLowerCase() ?? '');

  return (
    <div>
      <div className="mb-8">
        <p className="text-[12px] font-semibold text-[#cc0000] uppercase tracking-[1.5px] mb-3">{typeInfo?.label}</p>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[clamp(24px,4vw,32px)] font-[900] text-[#1a1a1a] tracking-[-1px] leading-[1.1]">Tell us about your business</h1>
          {canFillDemo && (
            <button
              type="button"
              onClick={() => { setValues(DEMO_BUSINESS_INFO); setErrors({}); }}
              className="shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-[#cc0000]/30 text-[#cc0000] hover:bg-[#cc0000]/5 transition-colors"
            >
              Fill Demo
            </button>
          )}
        </div>
        <p className="text-[#555] text-[15px] mt-2">The more detail you provide, the better the AI-generated copy will be.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-7">
        {/* Common fields */}
        <div className="space-y-4">
          <p className="text-[11px] font-semibold text-[#cc0000] uppercase tracking-[1.5px]">Basic Information</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {COMMON_FIELDS.map((field) => (
              <div key={field.key} className={field.key === 'tagline' ? 'sm:col-span-2' : ''}>
                <label className="block text-[13px] font-medium text-[#1a1a1a] mb-1.5">
                  {field.label}
                  {field.required && <span className="text-[#cc0000] ml-1">*</span>}
                </label>
                <input
                  type={field.type}
                  value={values[field.key] || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className={`${inputBase} ${errors[field.key] ? 'border-[#cc0000] ring-1 ring-[#cc0000]/30' : 'border-black/[0.12]'}`}
                />
                {errors[field.key] && (
                  <p className="text-[#cc0000] text-xs mt-1">{errors[field.key]}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Type-specific fields */}
        <div className="space-y-5">
          <p className="text-[11px] font-semibold text-[#cc0000] uppercase tracking-[1.5px]">Services & Specialties</p>
          {specificFields.map((field) => (
            <div key={field.key}>
              <label className="block text-[13px] font-medium text-[#1a1a1a] mb-2">
                {field.label}
                {field.required && <span className="text-[#cc0000] ml-1">*</span>}
              </label>

              {field.type === 'multicheck' && (() => {
                const rawSelected = values[field.key] || [];
                // Normalize: if demo data filled objects ({name,price,...}), extract names
                const selected = rawSelected.map((s) => typeof s === 'object' ? (s.name || '') : s).filter(Boolean);
                const customOnes = selected.filter((s) => !field.options.includes(s));
                const allOptions = [...field.options, ...customOnes];
                const inputVal = customInputs[field.key] || '';

                const addCustom = () => {
                  const trimmed = inputVal.trim();
                  if (!trimmed || selected.includes(trimmed)) return;
                  handleChange(field.key, [...selected, trimmed]);
                  setCustomInputs((prev) => ({ ...prev, [field.key]: '' }));
                };

                return (
                  <div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {allOptions.map((option) => {
                        const checked = selected.includes(option);
                        const isCustom = !field.options.includes(option);
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => handleCheckbox(field.key, option)}
                            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium border transition-all
                              ${checked
                                ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white'
                                : 'bg-white border-black/[0.12] text-[#555] hover:border-[#cc0000]/40'}`}
                          >
                            {checked && (
                              <svg className="-mt-px shrink-0" width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                            {option}
                            {isCustom && checked && (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleChange(field.key, selected.filter((s) => s !== option));
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.click()}
                                className="ml-0.5 opacity-60 hover:opacity-100 text-[11px] leading-none"
                              >
                                ×
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Add custom service */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inputVal}
                        onChange={(e) => setCustomInputs((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
                        placeholder="Add a service..."
                        className="flex-1 bg-white border border-black/[0.12] rounded-xl px-3 py-2 text-[13px] text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30 focus:border-[#cc0000] transition"
                      />
                      <button
                        type="button"
                        onClick={addCustom}
                        disabled={!inputVal.trim()}
                        className="px-3 py-2 bg-[#faf9f7] hover:bg-[#f2f0ec] disabled:opacity-40 disabled:cursor-not-allowed text-[#555] text-[13px] font-medium rounded-xl transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                );
              })()}

              {field.type === 'textarea' && (
                <textarea
                  value={values[field.key] || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className={`${inputBase} resize-none ${errors[field.key] ? 'border-[#cc0000]' : 'border-black/[0.12]'}`}
                />
              )}

              {field.type === 'packages' && (() => {
                const pkgs = Array.isArray(values[field.key]) ? values[field.key] : [];
                const draft = packageDrafts[field.key] || { name: '', price: '', description: '' };

                const updateDraft = (k, v) =>
                  setPackageDrafts((prev) => ({ ...prev, [field.key]: { ...draft, [k]: v } }));

                const addPackage = () => {
                  if (!draft.name.trim()) return;
                  handleChange(field.key, [...pkgs, { name: draft.name.trim(), price: draft.price.trim(), description: draft.description.trim() }]);
                  setPackageDrafts((prev) => ({ ...prev, [field.key]: { name: '', price: '', description: '' } }));
                };

                const removePackage = (i) =>
                  handleChange(field.key, pkgs.filter((_, idx) => idx !== i));

                return (
                  <div className="space-y-2">
                    {pkgs.map((pkg, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 px-3.5 py-2.5 bg-[#faf9f7] border border-black/[0.07] rounded-xl">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-semibold text-[#1a1a1a]">{pkg.name}</span>
                            {pkg.price && <span className="text-[13px] font-bold text-[#cc0000]">{pkg.price}</span>}
                          </div>
                          {pkg.description && <p className="text-[12px] text-[#888] mt-0.5 leading-snug">{pkg.description}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => removePackage(i)}
                          className="shrink-0 text-[#bbb] hover:text-[#cc0000] text-[18px] leading-none transition-colors mt-0.5"
                          title="Remove"
                        >×</button>
                      </div>
                    ))}

                    <div className="border border-black/[0.10] rounded-xl p-3.5 space-y-2.5 bg-white">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={draft.name}
                          onChange={(e) => updateDraft('name', e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPackage())}
                          placeholder="Name (e.g. Full Detail, Basic)"
                          className="col-span-1 bg-white border border-black/[0.12] rounded-lg px-3 py-2 text-[13px] text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30 focus:border-[#cc0000] transition"
                        />
                        <input
                          type="text"
                          value={draft.price}
                          onChange={(e) => updateDraft('price', e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPackage())}
                          placeholder="Price (e.g. $299)"
                          className="col-span-1 bg-white border border-black/[0.12] rounded-lg px-3 py-2 text-[13px] text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30 focus:border-[#cc0000] transition"
                        />
                      </div>
                      <input
                        type="text"
                        value={draft.description}
                        onChange={(e) => updateDraft('description', e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPackage())}
                        placeholder="Description (optional)"
                        className="w-full bg-white border border-black/[0.12] rounded-lg px-3 py-2 text-[13px] text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30 focus:border-[#cc0000] transition"
                      />
                      <button
                        type="button"
                        onClick={addPackage}
                        disabled={!draft.name.trim()}
                        className="w-full py-2 text-[13px] font-semibold rounded-lg border border-dashed border-black/[0.15] text-[#555] hover:border-[#cc0000]/40 hover:text-[#cc0000] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        + Add Package
                      </button>
                    </div>
                  </div>
                );
              })()}

              {(field.type === 'text' || field.type === 'tel' || field.type === 'number') && (
                <input
                  type={field.type}
                  value={values[field.key] || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className={`${inputBase} ${errors[field.key] ? 'border-[#cc0000]' : 'border-black/[0.12]'}`}
                />
              )}

              {errors[field.key] && (
                <p className="text-[#cc0000] text-xs mt-1">{errors[field.key]}</p>
              )}
            </div>
          ))}
        </div>

        {/* Extra optional fields */}
        <div className="space-y-5">
          <p className="text-[11px] font-semibold text-[#cc0000] uppercase tracking-[1.5px]">Additional Details (Optional)</p>
          {/* Payment methods multicheck */}
          {COMMON_EXTRA_FIELDS.filter(f => f.type === 'multicheck').map((field) => (
            <div key={field.key}>
              <label className="block text-[13px] font-medium text-[#1a1a1a] mb-2">{field.label}</label>
              {(() => {
                const selected = values[field.key] || [];
                return (
                  <div className="flex flex-wrap gap-2">
                    {field.options.map((option) => {
                      const checked = selected.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            const next = checked ? selected.filter(o => o !== option) : [...selected, option];
                            handleChange(field.key, next);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium border transition-all
                            ${checked ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white' : 'bg-white border-black/[0.12] text-[#555] hover:border-[#cc0000]/40'}`}
                        >
                          {checked && (
                            <svg className="-mt-px shrink-0" width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                          {option}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ))}
          {/* Awards text field */}
          {COMMON_EXTRA_FIELDS.filter(f => f.type !== 'multicheck').map((field) => (
            <div key={field.key}>
              <label className="block text-[13px] font-medium text-[#1a1a1a] mb-1.5">{field.label}</label>
              <input
                type="text"
                value={values[field.key] || ''}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className={`${inputBase} border-black/[0.12]`}
              />
            </div>
          ))}
        </div>

        {/* Review Source */}
        <div className="space-y-4">
          <p className="text-[11px] font-semibold text-[#cc0000] uppercase tracking-[1.5px]">Customer Reviews</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => handleChange('reviewSource', 'google')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-[13px] font-medium border transition-all ${reviewSource === 'google' ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white' : 'bg-white border-black/[0.12] text-[#555] hover:border-[#cc0000]/40'}`}>
              ⭐ Google Reviews
            </button>
            <button type="button" onClick={() => handleChange('reviewSource', 'testimonials')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-[13px] font-medium border transition-all ${reviewSource === 'testimonials' ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white' : 'bg-white border-black/[0.12] text-[#555] hover:border-[#cc0000]/40'}`}>
              💬 AI Testimonials
            </button>
          </div>

          {reviewSource === 'google' && (
            <div>
              {values.googlePlace ? (
                <div className="flex items-center justify-between bg-[#f0fdf4] border border-[#86efac] rounded-xl px-4 py-3">
                  <div>
                    <div className="text-[13px] font-semibold text-[#166534]">✓ {values.googlePlace.placeName}</div>
                    <div className="text-[11px] text-[#4ade80]">
                      {values.googlePlace.rating}★ · {values.googlePlace.reviewCount} reviews
                    </div>
                  </div>
                  <button type="button" onClick={() => { handleChange('googlePlace', null); setPlaceQuery(''); }}
                    className="text-[12px] text-[#888] hover:text-[#cc0000] transition">Change</button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={placeQuery}
                    onChange={(e) => setPlaceQuery(e.target.value)}
                    placeholder="Search your business on Google..."
                    className="w-full bg-white border border-black/[0.12] rounded-xl px-4 py-2.5 text-[13px] text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30 focus:border-[#cc0000] transition"
                  />
                  {placeLoading && <div className="absolute right-3 top-3 text-[11px] text-[#aaa]">Searching...</div>}
                  {placeResults.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-black/[0.12] rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {placeResults.map((place) => (
                        <button key={place.place_id} type="button"
                          onClick={() => {
                            handleChange('googlePlace', {
                              placeId: place.place_id,
                              placeName: place.name,
                              rating: place.rating,
                              reviewCount: place.review_count,
                            });
                            setPlaceResults([]);
                            setPlaceQuery('');
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-[#faf9f7] border-b border-black/[0.06] last:border-0 transition">
                          <div className="text-[13px] font-semibold text-[#1a1a1a]">{place.name}</div>
                          <div className="text-[11px] text-[#888]">
                            {place.address}
                            {place.rating ? ` · ${place.rating}★` : ''}
                            {place.review_count ? ` · ${place.review_count} reviews` : ''}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className="text-[11px] text-[#aaa] mt-2">Real Google reviews will appear on your website.</p>
            </div>
          )}

          {reviewSource === 'testimonials' && (
            <p className="text-[11px] text-[#aaa]">AI will generate realistic placeholder testimonials for your site.</p>
          )}
        </div>

        {/* Instagram Feed - disabled for now, pending Meta App Review */}
        {false && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-[#cc0000] uppercase tracking-[1.5px]">Instagram Feed (Optional)</p>
        </div>
        )}

        <button
          type="submit"
          className="w-full bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold py-3.5 px-6 rounded-xl transition-all text-[15px]"
        >
          Choose a Template
        </button>
      </form>
    </div>
  );
}
