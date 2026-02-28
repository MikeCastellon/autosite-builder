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
    // Cycle through status messages
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
      {/* Animated spinner */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-full border-4 border-gray-700 border-t-blue-500 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-3xl">🚗</div>
      </div>

      <h2 className="text-2xl font-bold text-white mb-3">Building your website...</h2>
      <p className="text-blue-400 font-medium text-lg min-h-[1.75rem] transition-all duration-500">
        {STATUS_MESSAGES[statusIndex]}
      </p>
      <p className="text-gray-600 text-sm mt-4">AI is writing custom copy for {businessInfo.businessName}</p>
    </div>
  );
}
