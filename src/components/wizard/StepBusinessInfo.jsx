import { useState } from 'react';
import { COMMON_FIELDS, TYPE_SPECIFIC_FIELDS, BUSINESS_TYPES } from '../../data/businessTypes.js';

export default function StepBusinessInfo({ businessType, initialValues, onSubmit }) {
  const typeInfo = BUSINESS_TYPES.find((t) => t.id === businessType);
  const specificFields = TYPE_SPECIFIC_FIELDS[businessType] || [];

  const [values, setValues] = useState(initialValues || {});
  const [errors, setErrors] = useState({});

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

  const inputBase = 'w-full bg-white border rounded-lg px-3.5 py-2.5 text-gray-900 placeholder-gray-400 text-[14px] focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition';

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{typeInfo?.label}</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Tell us about your business</h1>
        <p className="text-gray-500 text-[15px]">The more detail you provide, the better the AI-generated copy will be.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-7">
        {/* Common fields */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Basic Information</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {COMMON_FIELDS.map((field) => (
              <div key={field.key} className={field.key === 'tagline' ? 'sm:col-span-2' : ''}>
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input
                  type={field.type}
                  value={values[field.key] || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className={`${inputBase} ${errors[field.key] ? 'border-red-400 ring-1 ring-red-300' : 'border-gray-300'}`}
                />
                {errors[field.key] && (
                  <p className="text-red-500 text-xs mt-1">{errors[field.key]}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Type-specific fields */}
        <div className="space-y-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Services & Specialties</p>
          {specificFields.map((field) => (
            <div key={field.key}>
              <label className="block text-[13px] font-medium text-gray-700 mb-2">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>

              {field.type === 'multicheck' && (
                <div className="flex flex-wrap gap-2">
                  {field.options.map((option) => {
                    const checked = (values[field.key] || []).includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleCheckbox(field.key, option)}
                        className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition-all
                          ${checked
                            ? 'bg-gray-900 border-gray-900 text-white'
                            : 'bg-white border-gray-300 text-gray-600 hover:border-gray-500'}`}
                      >
                        {checked && (
                          <svg className="inline mr-1 -mt-0.5" width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}

              {field.type === 'textarea' && (
                <textarea
                  value={values[field.key] || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className={`${inputBase} resize-none ${errors[field.key] ? 'border-red-400' : 'border-gray-300'}`}
                />
              )}

              {(field.type === 'text' || field.type === 'tel' || field.type === 'number') && (
                <input
                  type={field.type}
                  value={values[field.key] || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className={`${inputBase} ${errors[field.key] ? 'border-red-400' : 'border-gray-300'}`}
                />
              )}

              {errors[field.key] && (
                <p className="text-red-500 text-xs mt-1">{errors[field.key]}</p>
              )}
            </div>
          ))}
        </div>

        <button
          type="submit"
          className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-6 rounded-lg transition-colors text-[15px]"
        >
          Choose a Template
        </button>
      </form>
    </div>
  );
}
