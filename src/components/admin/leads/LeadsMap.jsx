import { useEffect, useRef, useState } from 'react';
import { categoryColor } from '../../../lib/leadCategories.js';
import { MAPS_KEY, loadGoogleMaps } from '../../../lib/googleMapsLoader.js';

/** More pins than this and the map stutters; the list still has them all. */
export const MAP_PIN_LIMIT = 1500;

const KM_PER_MILE = 1.609344;

function pinIcon(maps, p, selected) {
  return {
    path: maps.SymbolPath.CIRCLE,
    scale: selected ? 9 : 6,
    fillColor: categoryColor(p.category),
    // A shop with no website is the one we want: solid. One with its own
    // site is a long shot: faded.
    fillOpacity: p.website_kind === 'own' ? 0.35 : 0.95,
    strokeColor: selected ? '#cc0000' : '#ffffff',
    strokeWeight: selected ? 3 : 1.5,
  };
}

/**
 * The businesses on the list as dots, coloured by type, with the scanned
 * areas outlined. Clicking a dot picks that business; the tab shows its row
 * under the map. Ported from Genius Routes' LeadsMap.
 *
 * The map is made once. Pins are diffed by id (a business that leaves the
 * list takes only its own pin with it), and the view re-frames only when
 * `fitKey` (the tab's filters) changes, so working down a street doesn't
 * throw the map back out after every decision.
 */
export default function LeadsMap({ rows = [], scans = [], selectedId = null, onSelect, fitKey = '' }) {
  const el = useRef(null);
  const mapRef = useRef(null);
  const mapsRef = useRef(null);
  const pinsRef = useRef(new Map()); // prospect id -> Marker
  const fittedRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState('');

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  // The map, once.
  useEffect(() => {
    if (!MAPS_KEY || !el.current) return undefined;
    let cancelled = false;
    loadGoogleMaps().then((maps) => {
      if (cancelled || !el.current) return;
      mapsRef.current = maps;
      mapRef.current = new maps.Map(el.current, {
        center: { lat: 28.29, lng: -81.41 },
        zoom: 10,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
      });
      setReady(true);
    }).catch((e) => { if (!cancelled) setFailed(e.message || 'Couldn\'t load Google Maps'); });
    return () => { cancelled = true; };
  }, []);

  // Where we've scanned: faint circles, redrawn only when the scans change.
  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!ready || !map) return undefined;
    const circles = scans
      .filter((s) => !s.error && Number.isFinite(Number(s.center_lat)))
      .map((s) => new maps.Circle({
        map,
        center: { lat: Number(s.center_lat), lng: Number(s.center_lng) },
        radius: Number(s.radius_mi) * KM_PER_MILE * 1000,
        strokeColor: '#1a1a1a',
        strokeOpacity: 0.25,
        strokeWeight: 1,
        fillOpacity: 0,
        clickable: false,
      }));
    return () => circles.forEach((c) => c.setMap(null));
  }, [ready, scans]);

  // Businesses: add the new, drop the gone, leave the rest alone.
  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!ready || !map) return;
    const shown = rows.slice(0, MAP_PIN_LIMIT);
    const want = new Set(shown.map((p) => p.id));
    const pins = pinsRef.current;
    for (const [id, m] of pins) {
      if (!want.has(id)) { m.setMap(null); pins.delete(id); }
    }
    for (const p of shown) {
      if (pins.has(p.id)) continue;
      const on = p.id === selectedRef.current;
      const m = new maps.Marker({
        map,
        position: { lat: p.lat, lng: p.lng },
        title: p.name,
        icon: pinIcon(maps, p, on),
        zIndex: on ? 10 : 2,
      });
      m.addListener('click', () => onSelectRef.current?.(p.id));
      m.__prospect = p;
      pins.set(p.id, m);
    }
    if (shown.length && fittedRef.current !== fitKey) {
      fittedRef.current = fitKey;
      const bounds = new maps.LatLngBounds();
      for (const p of shown) bounds.extend({ lat: p.lat, lng: p.lng });
      map.fitBounds(bounds, 40);
    }
  }, [ready, rows, fitKey]);

  // Selection: restyle the old pin and the new one, nothing else.
  const lastSelected = useRef(null);
  useEffect(() => {
    const maps = mapsRef.current;
    if (!maps) return;
    for (const id of [lastSelected.current, selectedId]) {
      const m = id && pinsRef.current.get(id);
      if (!m) continue;
      const on = id === selectedId;
      m.setIcon(pinIcon(maps, m.__prospect, on));
      m.setZIndex(on ? 10 : 2);
    }
    lastSelected.current = selectedId;
  }, [selectedId, ready]);

  // Take the pins down with the tab.
  useEffect(() => () => {
    pinsRef.current.forEach((m) => m.setMap(null));
    pinsRef.current.clear();
  }, []);

  if (!MAPS_KEY || failed) {
    return (
      <div className="rounded-xl border border-black/[0.07] bg-[#faf9f7] p-6 text-center text-sm text-[#555]">
        {MAPS_KEY
          ? `The map didn't load: ${failed}.`
          : 'The map needs a Google Maps browser key: set VITE_GOOGLE_MAPS_BROWSER_KEY (Maps JavaScript API, restricted to this site) in Netlify and redeploy.'}
      </div>
    );
  }

  return <div ref={el} data-testid="leads-map" className="h-[60vh] min-h-[360px] w-full overflow-hidden rounded-xl border border-black/[0.07]" />;
}
