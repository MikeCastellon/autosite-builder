// Loads the Google Maps JavaScript API once, with a script tag, for the
// Admin > Leads map. No npm package: the repo can't take new dependencies
// from this machine, and the API is one script either way.
//
// The browser key (VITE_GOOGLE_MAPS_BROWSER_KEY) is a separate key from the
// server's GOOGLE_PLACES_API_KEY: it ships in the bundle, so it must be
// restricted by HTTP referrer to the builder's own hostnames.
let loading = null;

export const MAPS_KEY = import.meta.env?.VITE_GOOGLE_MAPS_BROWSER_KEY || '';

export function loadGoogleMaps() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No browser'));
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (!MAPS_KEY) return Promise.reject(new Error('VITE_GOOGLE_MAPS_BROWSER_KEY is not set'));
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const callback = `__acgMapsReady${Date.now()}`;
    window[callback] = () => {
      delete window[callback];
      resolve(window.google.maps);
    };
    // A bad or unrestricted key still loads the script; Google reports it here.
    window.gm_authFailure = () => reject(new Error('Google refused the Maps key for this site'));
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}&v=weekly&loading=async&callback=${callback}`;
    s.async = true;
    s.onerror = () => {
      loading = null;
      reject(new Error('Couldn\'t load Google Maps'));
    };
    document.head.appendChild(s);
  });
  return loading;
}
