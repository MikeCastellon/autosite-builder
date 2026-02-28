import { useEffect, useState, useRef } from 'react';
import { generateWebsite } from '../../lib/generateWebsite.js';

const STATUS_MESSAGES = [
  'Analyzing your business...',
  'Crafting your headline...',
  'Writing service descriptions...',
  'Building your about section...',
  'Generating local SEO copy...',
  'Adding finishing touches...',
  'Almost ready...',
];

export default function StepGenerating({ businessInfo, templateMeta, onSuccess, onError }) {
  const [statusIndex, setStatusIndex] = useState(0);
  const called = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (called.current) return;
    called.current = true;
    generateWebsite(businessInfo, templateMeta)
      .then((copy) => onSuccess(copy))
      .catch((err) => onError(err.message || 'Something went wrong'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      {/* Spinner */}
      <div className="relative mb-10">
        <div className="w-16 h-16 rounded-full border-[3px] border-gray-200 border-t-gray-900 animate-spin" />
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">Building your website...</h2>
      <p className="text-gray-500 font-medium min-h-[1.5rem] text-[15px]">
        {STATUS_MESSAGES[statusIndex]}
      </p>
      <p className="text-gray-400 text-sm mt-3">Writing custom copy for {businessInfo.businessName}</p>
    </div>
  );
}
