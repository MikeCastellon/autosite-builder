import { useEffect, useState, useRef } from 'react';
import {
  generateWebsite,
  generationErrorMessage,
  isRetryableGenerationError,
} from '../../lib/generateWebsite.js';

// What the wait looks like, by elapsed time. The job reports no progress
// while the model writes, and its usual duration has not been measured yet,
// so this states no typical time: only that it can take minutes (the wizard
// waits up to 5 minutes) and that leaving the page loses the result.
function waitingText(seconds) {
  if (seconds < 60) return 'This can take a few minutes. Please keep this page open.';
  if (seconds < 150) return 'Still writing. Please keep this page open.';
  return 'Still working on it. Thanks for waiting.';
}

export default function StepGenerating({ businessInfo, templateMeta, onSuccess, onError }) {
  // Each Try again is a new run: a new job, using one daily generation,
  // unless the last run lost the connection while its job was still on the
  // server; then the run polls that job again (resumeRef).
  const [run, setRun] = useState(0);
  const [error, setError] = useState(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const startedRun = useRef(null);
  const resumeRef = useRef(null);
  const controllerRef = useRef(null);
  const mounted = useRef(false);

  // Leaving the step stops the polling. StrictMode's dev-only unmount and
  // remount runs this cleanup too, so the abort waits a tick and is skipped
  // when the component is mounted again.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const controller = controllerRef.current;
      setTimeout(() => { if (!mounted.current) controller?.abort(); }, 0);
    };
  }, []);

  useEffect(() => {
    if (error) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [error]);

  useEffect(() => {
    // One job per run, also under StrictMode's double effect.
    if (startedRun.current === run) return;
    startedRun.current = run;
    const jobId = resumeRef.current || undefined;
    resumeRef.current = null;
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setStartedAt(Date.now());
    setNow(Date.now());

    generateWebsite(businessInfo, templateMeta, { signal: controller.signal, jobId })
      .then((copy) => {
        if (controller.signal.aborted || !mounted.current) return;
        onSuccess(copy);
      })
      .catch((err) => {
        if (controller.signal.aborted || !mounted.current) return;
        console.error(`[generate-website] failed for "${businessInfo?.businessName}"`,
          { status: err?.status, code: err?.code, resumable: Boolean(err?.resumeJobId), error: err?.message || 'Unknown error' });
        resumeRef.current = err?.resumeJobId || null;
        setError(err);
      });
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    const message = generationErrorMessage(error);
    // Only failures that may pass on a second try (network, 5xx, timeout)
    // offer Try again; a daily limit or a too-long list would fail the same way.
    const canRetry = isRetryableGenerationError(error);
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center pb-10">
        <p className="text-[12px] font-semibold text-[#cc0000] uppercase tracking-[1.5px] mb-8">
          Generating your site
        </p>
        <h1 className="text-[clamp(22px,4vw,30px)] font-[900] text-[#1a1a1a] mb-3 tracking-[-1px] leading-[1.1]">
          We couldn't write your website copy
        </h1>
        <p role="alert" className="text-[#555] text-[15px] font-medium max-w-md">
          {message}
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-8">
          {canRetry && (
            <button
              type="button"
              onClick={() => setRun((r) => r + 1)}
              className="bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold py-3 px-6 rounded-xl transition-all text-[15px]"
            >
              Try again
            </button>
          )}
          <button
            type="button"
            onClick={() => onError(message)}
            className="bg-white border border-black/[0.12] hover:border-[#cc0000]/40 text-[#1a1a1a] font-semibold py-3 px-6 rounded-xl transition-all text-[15px]"
          >
            Back to templates
          </button>
        </div>
      </div>
    );
  }

  const seconds = Math.max(0, Math.round((now - startedAt) / 1000));

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
        Writing your website copy...
      </h1>

      <p className="text-[#555] text-[15px] font-medium min-h-[1.5rem]" aria-live="polite">
        {waitingText(seconds)}
      </p>

      <p className="text-ink-tertiary text-sm mt-3">
        Writing custom copy for <span className="font-semibold text-[#1a1a1a]">{businessInfo.businessName}</span>
      </p>

    </div>
  );
}
