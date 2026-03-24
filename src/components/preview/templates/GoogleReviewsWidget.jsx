import { useEffect, useRef } from 'react';

const WIDGET_SCRIPT_URL = 'https://social-feeds-app.netlify.app/widgets.js';

export default function GoogleReviewsWidget({ widgetKey, theme }) {
  const containerRef = useRef(null);
  const mountedRef = useRef(false);
  const prevThemeRef = useRef(theme);

  useEffect(() => {
    if (!widgetKey || !containerRef.current) return;

    // If theme changed, force remount
    if (mountedRef.current && prevThemeRef.current !== theme) {
      mountedRef.current = false;
      containerRef.current.innerHTML = '';
    }
    prevThemeRef.current = theme;

    if (mountedRef.current) return;
    mountedRef.current = true;

    // Update data-theme attribute
    if (theme) {
      containerRef.current.setAttribute('data-theme', theme);
    } else {
      containerRef.current.removeAttribute('data-theme');
    }

    // Load widget script if not already loaded
    if (!document.getElementById('sf-widget-script')) {
      const script = document.createElement('script');
      script.id = 'sf-widget-script';
      script.src = WIDGET_SCRIPT_URL;
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        if (window.SocialFeeds?.mount) {
          window.SocialFeeds.mount(containerRef.current);
        }
      };
    } else {
      setTimeout(() => {
        if (window.SocialFeeds?.mount) {
          window.SocialFeeds.mount(containerRef.current);
        }
      }, 100);
    }

    return () => { mountedRef.current = false; };
  }, [widgetKey, theme]);

  if (!widgetKey) return null;

  return (
    <div
      ref={containerRef}
      data-widget="google-reviews"
      data-widget-key={widgetKey}
      data-theme={theme || undefined}
      style={{ maxWidth: 1200, margin: '0 auto' }}
    />
  );
}
