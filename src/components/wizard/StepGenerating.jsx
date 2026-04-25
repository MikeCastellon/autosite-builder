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

const MAX_ATTEMPTS = 3;

export default function StepGenerating({ businessInfo, templateMeta, onSuccess, onError }) {
  const [statusIndex, setStatusIndex] = useState(0);
  const [attempt, setAttempt] = useState(1);
  const [retrying, setRetrying] = useState(false);
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

    async function run() {
      for (let i = 1; i <= MAX_ATTEMPTS; i++) {
        try {
          if (i > 1) {
            setRetrying(true);
            setAttempt(i);
            // Short delay before retry so the UI updates
            await new Promise((res) => setTimeout(res, 1500));
          }
          const copy = await generateWebsite(businessInfo, templateMeta);
          setRetrying(false);
          onSuccess(copy);
          return;
        } catch (err) {
          const msg = err?.message || 'Unknown error';
          console.error(
            `[generate-website] attempt ${i}/${MAX_ATTEMPTS} failed for "${businessInfo?.businessName}"`,
            { attempt: i, error: msg, businessInfo }
          );
          if (i === MAX_ATTEMPTS) {
            setRetrying(false);
            onError(msg || 'Something went wrong generating your site. Please try again.');
          }
        }
      }
    }

    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center pb-10">

      {/* Step label */}
      <p className="text-[12px] font-semibold text-[#cc0000] uppercase tracking-[1.5px] mb-8">
        Generating your site
      </p>

      {/* Spinner */}
      <div className="relative mb-10">
        <div className="w-16 h-16 rounded-full border-[3px] border-[#f2f0ec] border-t-[#cc0000] animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-[#cc0000]/10" />
        </div>
      </div>

      <h1 className="text-[clamp(22px,4vw,30px)] font-[900] text-[#1a1a1a] mb-3 tracking-[-1px] leading-[1.1]">
        {retrying
          ? `Retrying… (${attempt} of ${MAX_ATTEMPTS})`
          : 'Building your website...'}
      </h1>

      <p className="text-[#555] text-[15px] font-medium min-h-[1.5rem]">
        {retrying ? 'Hang tight, starting fresh…' : STATUS_MESSAGES[statusIndex]}
      </p>

      <p className="text-[#888] text-sm mt-3">
        Writing custom copy for <span className="font-semibold text-[#1a1a1a]">{businessInfo.businessName}</span>
      </p>

      {/* Animated progress dots */}
      <div className="flex items-center gap-1.5 mt-10">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i === statusIndex
                ? 'w-4 h-2 bg-[#cc0000]'
                : 'w-2 h-2 bg-[#e0ddd8]'
            }`}
          />
        ))}
      </div>

    </div>
  );
}
