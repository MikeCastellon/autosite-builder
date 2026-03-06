import { useState } from 'react';
import { COMMON_FIELDS, COMMON_EXTRA_FIELDS, TYPE_SPECIFIC_FIELDS, BUSINESS_TYPES } from '../../data/businessTypes.js';
import { DEMO_BUSINESS_INFO } from '../../data/demoData.js';

export default function StepBusinessInfo({ businessType, initialValues, onSubmit }) {
  const typeInfo = BUSINESS_TYPES.find((t) => t.id === businessType);
  const specificFields = TYPE_SPECIFIC_FIELDS[businessType] || [];

  const [values, setValues] = useState(initialValues || {});
  const [errors, setErrors] = useState({});
  const [customInputs, setCustomInputs] = useState({});

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
    onSubmit(values);
  };

  const inputBase = 'w-full bg-white border rounded-xl px-3.5 py-2.5 text-[#1a1a1a] placeholder-[#aaa] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30 focus:border-[#cc0000] transition';

  return (
    <div>
      <div className="mb-8">
        <p className="text-[12px] font-semibold text-[#cc0000] uppercase tracking-[1.5px] mb-3">{typeInfo?.label}</p>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[clamp(24px,4vw,32px)] font-[900] text-[#1a1a1a] tracking-[-1px] leading-[1.1]">Tell us about your business</h1>
          <button
            type="button"
            onClick={() => { setValues(DEMO_BUSINESS_INFO); setErrors({}); }}
            className="shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-[#cc0000]/30 text-[#cc0000] hover:bg-[#cc0000]/5 transition-colors"
          >
            Fill Demo
          </button>
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
                const selected = values[field.key] || [];
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
