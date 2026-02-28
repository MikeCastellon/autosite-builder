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

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{typeInfo?.icon}</span>
          <span className="text-sm font-medium text-blue-400 uppercase tracking-wider">{typeInfo?.label}</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Tell us about your business</h1>
        <p className="text-gray-400">The more you fill in, the better your AI-generated website will be.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Common fields */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Basic Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {COMMON_FIELDS.map((field) => (
              <div key={field.key} className={field.key === 'tagline' ? 'sm:col-span-2' : ''}>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                <input
                  type={field.type}
                  value={values[field.key] || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className={`w-full bg-gray-800 border rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition
                    ${errors[field.key] ? 'border-red-500' : 'border-gray-700'}`}
                />
                {errors[field.key] && (
                  <p className="text-red-400 text-xs mt-1">{errors[field.key]}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Type-specific fields */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Your Services</h2>
          {specificFields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                {field.label}
                {field.required && <span className="text-red-400 ml-1">*</span>}
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
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all
                          ${checked
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}
                      >
                        {checked && <span className="mr-1">✓</span>}
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
                  className={`w-full bg-gray-800 border rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none
                    ${errors[field.key] ? 'border-red-500' : 'border-gray-700'}`}
                />
              )}

              {(field.type === 'text' || field.type === 'tel' || field.type === 'number') && (
                <input
                  type={field.type}
                  value={values[field.key] || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className={`w-full bg-gray-800 border rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition
                    ${errors[field.key] ? 'border-red-500' : 'border-gray-700'}`}
                />
              )}

              {errors[field.key] && (
                <p className="text-red-400 text-xs mt-1">{errors[field.key]}</p>
              )}
            </div>
          ))}
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors mt-4"
        >
          Choose a Template →
        </button>
      </form>
    </div>
  );
}
