// Tawk.to live chat loader. Uses the env var VITE_TAWK_EMBED, which is the
// path Tawk gives you in their embed snippet — looks like
// "<property_id>/<widget_id>" (e.g. "65f0123abc/1ho1abc"). Their default
// widget id is `default` if you didn't create extras.
//
// The script is loaded lazily on the first openTawk() call so we don't pay
// the script cost for visitors who never click the chat button. We also
// hide Tawk's own floating bubble so it doesn't compete with our `?`
// button — the user opens chat exclusively via our Support buttons.
const EMBED = import.meta.env.VITE_TAWK_EMBED || '';

let loadPromise = null;

export function isTawkConfigured() {
  return !!EMBED;
}

function loadScript() {
  if (loadPromise) return loadPromise;
  if (!EMBED) return Promise.reject(new Error('Tawk not configured'));

  loadPromise = new Promise((resolve, reject) => {
    // Configure BEFORE the script loads so onLoad can hide the bubble before
    // it ever paints. Otherwise users see a brief flash of Tawk's UI.
    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_API.onLoad = function () {
      try { window.Tawk_API.hideWidget(); } catch { /* noop */ }
    };

    const s = document.createElement('script');
    s.async = true;
    s.src = `https://embed.tawk.to/${EMBED}`;
    s.charset = 'UTF-8';
    s.setAttribute('crossorigin', '*');
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load chat'));
    document.head.appendChild(s);
  });

  return loadPromise;
}

export async function openTawk() {
  if (!EMBED) throw new Error('Tawk not configured');
  await loadScript();
  // Tawk_API.maximize works once the widget is ready. onLoad fires before
  // we get here when the script is freshly loaded; if the user clicks twice
  // quickly we just re-maximize.
  try {
    window.Tawk_API.showWidget();
    window.Tawk_API.maximize();
  } catch (e) {
    // If the widget isn't quite ready yet, listen for it.
    window.Tawk_API.onLoad = function () {
      try { window.Tawk_API.showWidget(); window.Tawk_API.maximize(); } catch { /* noop */ }
    };
  }
}
