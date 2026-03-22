import { useEffect, useRef } from 'react';

const WIDGET_SCRIPT_URL = 'https://social-feeds-app.netlify.app/widgets.js';

export default function GoogleReviewsWidget({ widgetKey }) {
  const containerRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!widgetKey || !containerRef.current || mountedRef.current) return;
    mountedRef.current = true;

    // Load widget script if not already loaded
    if (!document.getElementById('sf-widget-script')) {
      const script = document.createElement('script');
      script.id = 'sf-widget-script';
      script.src = WIDGET_SCRIPT_URL;
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        // After script loads, it auto-mounts widgets with data-widget attribute
        if (window.SocialFeeds?.mount) {
          window.SocialFeeds.mount(containerRef.current);
        }
      };
    } else {
      // Script already loaded — mount manually
      setTimeout(() => {
        if (window.SocialFeeds?.mount) {
          window.SocialFeeds.mount(containerRef.current);
        }
      }, 100);
    }

    return () => { mountedRef.current = false; };
  }, [widgetKey]);

  if (!widgetKey) return null;

  return (
    <div
      ref={containerRef}
      data-widget="google-reviews"
      data-widget-key={widgetKey}
      style={{ maxWidth: 1200, margin: '0 auto' }}
    />
  );
}
