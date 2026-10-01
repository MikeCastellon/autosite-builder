import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { FONT_SLOTS } from '../../data/fontOptions.js';
import { TEMPLATES } from '../../data/templates.js';
import { BUSINESS_TYPES } from '../../data/businessTypes.js';
import { useAlert } from '../ui/AlertProvider.jsx';
import { formatPhone } from '../../lib/formatPhone.js';
import { formatPrice } from '../../lib/formatPrice.js';
import { uploadSiteImage } from '../../lib/imageUpload.js';
import { mergeSectionOrder, orderNeedsRepair, sameOrder, moveSection, placeSectionOrder } from '../../lib/sectionManifest.js';
import { getFallbacks, businessKind, defaultHowSteps, defaultWhyCards } from '../../lib/templateFallbacks.js';
import { useTemplateInfo } from './useTemplateInfo.js';
import { editorTabs, templateReads, shadeGuideState, googleBadgeDefaults, templateHelp } from './editorCapabilities.js';
import { colorChecks, formatRatio } from './colorChecks.js';
import HeroServicesPanel from './editor/HeroServicesPanel.jsx';
import FeaturedServicePanel from './editor/FeaturedServicePanel.jsx';
import CtaPhotoField from './editor/CtaPhotoField.jsx';
import ServiceDetailsFields from './editor/ServiceDetailsFields.jsx';
import HeadingsPanel from './editor/HeadingsPanel.jsx';
import FooterBuilderPanel from './editor/FooterBuilderPanel.jsx';
import GoogleRatingPanel, { TypedRatingNote } from './editor/GoogleRatingPanel.jsx';
import TestimonialSourceFields, { ReviewSourcesIntro } from './editor/TestimonialSourceFields.jsx';
import DayHoursEditor from './editor/DayHoursEditor.jsx';
import BusinessExtrasPanel from './editor/BusinessExtrasPanel.jsx';
import { followServiceRename, removeServiceRefs } from './editor/serviceRefs.js';
import { patchServiceList } from './editor/serviceDetails.js';
import { MoveButtons, moveItem } from './editor/fields.jsx';

// The Vehicle Makes tab carries the kit's make logos (~70 KB): load it when
// the tab opens, so the app's main bundle does not grow by them. If the
// chunk cannot load (most likely an old hashed file gone after a deploy
// while the editor was open), the tab says so instead of throwing: the app
// has no error boundary, so a failed lazy import would blank the editor.
const VehicleMakesPanel = lazy(() => import('./editor/VehicleMakesPanel.jsx').catch(() => ({
  default: function VehicleMakesUnavailable() {
    return <p className="text-[12px] text-gray-500 py-3 leading-snug">Couldn&apos;t load this tab. Reload the page to try again (your changes are saved as you go).</p>;
  },
})));

const EMOJI_GROUPS = {
  'Common': ['⭐', '✅', '🏆', '💎', '🔧', '🛞', '🚗', '🏎️', '💰', '💳', '🕐', '⏱️', '📞', '📍', '🎯', '✓', '★', '♦'],
  'Trust': ['🛡️', '🔒', '✔️', '👍', '💪', '🤝', '👑', '🎖️', '🏅', '📋', '📦', '🚚', '⚡', '🔥', '❤️', '💯'],
  'Business': ['🏢', '🏠', '📊', '📈', '💼', '🎨', '🔨', '⚙️', '🪧', '📱', '💻', '🌟', '🌍', '🌎', '♻️', '🌱'],
  'Vehicles': ['🚙', '🚘', '🏍️', '🛻', '🚐', '🔩', '🛠️', '🧰', '🪛', '🔋', '⛽', '🧽', '🧹', '💧', '✨', '🫧'],
};

// SVG icon paths (16x16 viewBox) — stored as {id, path, label}
const SVG_ICONS = [
  { id: 'icon:check', label: 'Check', path: 'M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z' },
  { id: 'icon:shield', label: 'Shield', path: 'M8 1l6 2.5v4c0 3.5-2.5 6.5-6 7.5-3.5-1-6-4-6-7.5v-4L8 1z' },
  { id: 'icon:star', label: 'Star', path: 'M8 1.5l2 4.5 4.5.5-3.25 3 1 4.5L8 11.5 3.75 14l1-4.5L1.5 6.5 6 6z' },
  { id: 'icon:clock', label: 'Clock', path: 'M8 14A6 6 0 108 2a6 6 0 000 12zm0-1A5 5 0 118 3a5 5 0 010 10zM8 4.5v4l2.5 1.5' },
  { id: 'icon:phone', label: 'Phone', path: 'M5.5 1.5c-.3 0-.6.2-.7.4L3.5 4.5c-.1.3 0 .6.2.8l2 2-2.5 2.5 2 2c.2.2.5.3.8.2l2.6-1.3c.2-.1.4-.4.4-.7v-1.5l3 3v2c0 .6-.4 1-1 1C5.5 14.5 1.5 10.5 1.5 5c0-.6.4-1 1-1h2l3 3H6z' },
  { id: 'icon:location', label: 'Location', path: 'M8 1C5.2 1 3 3.2 3 6c0 4 5 9 5 9s5-5 5-9c0-2.8-2.2-5-5-5zm0 7a2 2 0 110-4 2 2 0 010 4z' },
  { id: 'icon:heart', label: 'Heart', path: 'M8 14s-5.5-3.5-5.5-7.5C2.5 4 4 2.5 5.5 2.5c1 0 2 .5 2.5 1.5.5-1 1.5-1.5 2.5-1.5C12 2.5 13.5 4 13.5 6.5 13.5 10.5 8 14 8 14z' },
  { id: 'icon:bolt', label: 'Bolt', path: 'M7 1l-5 8h5l-1 6 5-8H6l1-6z' },
  { id: 'icon:car', label: 'Car', path: 'M3 10.5v1a1 1 0 001 1h1a1 1 0 001-1v-1m4 0v1a1 1 0 001 1h1a1 1 0 001-1v-1M3.5 7l1-3.5h7L12.5 7m-9 0h9m-9 0a1.5 1.5 0 00-1.5 1.5v2h12v-2A1.5 1.5 0 0012.5 7' },
  { id: 'icon:wrench', label: 'Wrench', path: 'M10.5 2A3.5 3.5 0 007.3 6L2.5 10.8a1.5 1.5 0 002.1 2.1L9.4 8.1A3.5 3.5 0 0010.5 2z' },
  { id: 'icon:cog', label: 'Settings', path: 'M8 10a2 2 0 100-4 2 2 0 000 4zm5.7-1.3l-1-.6a4.8 4.8 0 000-1.2l1-.6c.2-.1.3-.3.2-.5l-1-1.7c-.1-.2-.3-.3-.5-.2l-1 .6a4.8 4.8 0 00-1-.6l-.2-1.2c0-.2-.2-.3-.4-.3H7.2c-.2 0-.4.1-.4.3L6.6 4a4.8 4.8 0 00-1 .6l-1-.6c-.2-.1-.4 0-.5.2l-1 1.7c-.1.2 0 .4.2.5l1 .6a4.8 4.8 0 000 1.2l-1 .6c-.2.1-.3.3-.2.5l1 1.7c.1.2.3.3.5.2l1-.6a4.8 4.8 0 001 .6l.2 1.2c0 .2.2.3.4.3h1.6c.2 0 .4-.1.4-.3l.2-1.2a4.8 4.8 0 001-.6l1 .6c.2.1.4 0 .5-.2l1-1.7c.1-.2 0-.4-.2-.5z' },
  { id: 'icon:truck', label: 'Truck', path: 'M1 3h9v7H1V3zm9 3h3l2 3v4h-2m-3 0H6m-3 0H1m12 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-9 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z' },
  { id: 'icon:dollar', label: 'Dollar', path: 'M8 1v14m3-10.5c0-1.4-1.3-2.5-3-2.5S5 3.1 5 4.5 6.3 7 8 7s3 1.1 3 2.5S9.7 12 8 12s-3-1.1-3-2.5' },
  { id: 'icon:award', label: 'Award', path: 'M8 10a4 4 0 100-8 4 4 0 000 8zm-2.5 1L4 15l4-2 4 2-1.5-4' },
  { id: 'icon:globe', label: 'Globe', path: 'M8 14A6 6 0 108 2a6 6 0 000 12zM2 8h12M8 2c2 2 2.5 4 2.5 6S10 12 8 14M8 2C6 4 5.5 6 5.5 8S6 12 8 14' },
  { id: 'icon:home', label: 'Home', path: 'M2 8l6-6 6 6m-1 0v5a1 1 0 01-1 1H9V10H7v4H4a1 1 0 01-1-1V8' },
  { id: 'icon:mail', label: 'Mail', path: 'M2 3h12a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V4a1 1 0 011-1zm0 1l6 4 6-4' },
  { id: 'icon:calendar', label: 'Calendar', path: 'M3 4h10a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1zm2-2v3m6-3v3M2 7h12' },
];

// Render an icon value — if it starts with "icon:" render SVG, otherwise render as text/emoji
function IconOrEmoji({ value, size = 16, color = 'currentColor' }) {
  if (!value) return null;
  const icon = value.startsWith?.('icon:') && SVG_ICONS.find(i => i.id === value);
  if (icon) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d={icon.path} stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return <span>{value}</span>;
}

// Section nav icons for the rail. Separate from SVG_ICONS above (which
// are user-content icons like service icons). 16×16 viewBox, line style.
const NAV_ICON_PATHS = {
  visibility:   <path d="M2 4h12M2 8h12M2 12h12" />,
  hero:         <><rect x="2" y="3" width="12" height="10" rx="1" /><path d="M2 11l3-3 2.5 2.5 3-3L14 11" /><circle cx="11" cy="6" r="1" /></>,
  services:     <><path d="M9.5 3.5a3 3 0 014 4l-7 7a1.5 1.5 0 01-2-2l7-7z" /><path d="M9.5 3.5l-2-2H4l-2 2v3.5l2 2h3.5" /></>,
  howItWorks:   <><path d="M3 4h2v2H3zM3 8h2v2H3zM3 12h2v2H3z" fill="currentColor" stroke="none" /><path d="M7 5h6M7 9h6M7 13h4" /></>,
  whyUs:        <><circle cx="8" cy="8" r="6" /><path d="M5 8L7.5 10.5 11 6" /></>,
  products:     <><rect x="3" y="3" width="10" height="10" rx="1" /><path d="M3 7h10" /><path d="M5 5h.01M9 5h.01" /></>,
  brands:       <><path d="M2 7l5 5 7-7-5-5H4a2 2 0 00-2 2v5z" /><circle cx="6" cy="6" r="1" fill="currentColor" stroke="none" /></>,
  filmBrands:   <><path d="M2 7l5 5 7-7-5-5H4a2 2 0 00-2 2v5z" /><circle cx="6" cy="6" r="1" fill="currentColor" stroke="none" /></>,
  shadeGuide:   <><circle cx="8" cy="8" r="6" /><path d="M8 2v12M2 8h12" /></>,
  trustBar:     <path d="M8 1l6 2.5v4c0 3.5-2.5 6.5-6 7.5-3.5-1-6-4-6-7.5v-4L8 1z" />,
  ticker:       <><path d="M2 8h12" /><path d="M11 5l3 3-3 3M5 5L2 8l3 3" /></>,
  about:        <><circle cx="8" cy="5.5" r="2.5" /><path d="M3 14a5 5 0 0110 0" /></>,
  gallery:      <><rect x="2" y="3" width="12" height="10" rx="1" /><circle cx="6" cy="7" r="1" /><path d="M2 12l4-4 3 3 2-2 3 3" /></>,
  testimonials: <path d="M8 2l1.8 4 4.2.6-3 2.9.8 4.2L8 11.7l-3.8 2 .8-4.2-3-2.9 4.2-.6z" />,
  contact:      <path d="M3 3.5C3 3 3.4 2.5 4 2.5h2.5l1 3-1.5 1c.8 2 2.5 3.7 4.5 4.5l1-1.5 3 1V13c0 .5-.5 1-1 1A11 11 0 013 3.5z" />,
  colors:       <><path d="M8 2a6 6 0 100 12c.6 0 1-.4 1-1 0-.4-.2-.7-.4-1-.2-.3-.3-.6-.3-1 0-.6.4-1 1-1H10a4 4 0 100-8z" /><circle cx="5" cy="7" r="0.8" fill="currentColor" stroke="none" /><circle cx="8" cy="5" r="0.8" fill="currentColor" stroke="none" /><circle cx="11.5" cy="7.5" r="0.8" fill="currentColor" stroke="none" /></>,
  footer:       <><rect x="2" y="3" width="12" height="10" rx="1" /><path d="M2 10.5h12" /><path d="M5 12.5h2M9 12.5h2" /></>,
  business:     <><path d="M3 14V6l5-3 5 3v8" /><path d="M2 14h12" /><path d="M6.5 14v-3h3v3" /><path d="M6 8h.01M10 8h.01" /></>,
  template:     <><rect x="2" y="2" width="5" height="5" rx="0.5" /><rect x="9" y="2" width="5" height="5" rx="0.5" /><rect x="2" y="9" width="5" height="5" rx="0.5" /><rect x="9" y="9" width="5" height="5" rx="0.5" /></>,
  headings:     <><path d="M3 3v10M9 3v10M3 8h6" /><path d="M12 7l1.5-1v7" /></>,
  featured:     <><circle cx="8" cy="6" r="4" /><path d="M5.5 9.3L4.5 14 8 12.3l3.5 1.7-1-4.7" /></>,
  makes:        <path d="M3 10.5v1a1 1 0 001 1h1a1 1 0 001-1v-1m4 0v1a1 1 0 001 1h1a1 1 0 001-1v-1M3.5 7l1-3.5h7L12.5 7m-9 0h9m-9 0a1.5 1.5 0 00-1.5 1.5v2h12v-2A1.5 1.5 0 0012.5 7" />,
  google:       <><rect x="1.5" y="4.5" width="13" height="7" rx="3.5" /><path d="M5 8h.01M8 8h.01M11 8h.01" /></>,
};

function NavIcon({ id, className = 'w-[18px] h-[18px]' }) {
  const inner = NAV_ICON_PATHS[id];
  if (!inner) {
    return <span className={`${className} flex items-center justify-center text-[10px] font-bold leading-none`}>{(id || '?').slice(0, 1).toUpperCase()}</span>;
  }
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {inner}
    </svg>
  );
}

// The rail scrolls once its tabs outgrow the window (a 13" laptop shows
// about a dozen): a soft shadow at its top / bottom edge says more tabs are
// there. Pure CSS (scrolling shadows): the gray-50 covers move with the
// tabs ('local') and hide each shadow ('scroll') once that end is reached.
const RAIL_SCROLL_SHADOWS = {
  background: [
    'linear-gradient(#f9fafb 30%, rgba(249,250,251,0)) center top / 100% 28px no-repeat local',
    'linear-gradient(rgba(249,250,251,0), #f9fafb 70%) center bottom / 100% 28px no-repeat local',
    'radial-gradient(farthest-side at 50% 0, rgba(0,0,0,.22), rgba(0,0,0,0)) center top / 100% 14px no-repeat scroll',
    'radial-gradient(farthest-side at 50% 100%, rgba(0,0,0,.22), rgba(0,0,0,0)) center bottom / 100% 14px no-repeat scroll',
    '#f9fafb',
  ].join(', '),
};

// Shown under a section in the Sections list when it is switched on but
// the preview has nothing of it (its data is empty), so the switch never
// looks broken.
const EMPTY_SECTION_HINTS = {
  awards: 'Not on your page yet: add awards in Business Info.',
  gallery: 'Not on your page yet: add photos in Gallery.',
  testimonials: 'Not on your page yet: add a review in Reviews.',
  statsBar: 'Not on your page yet: add stats in About > Stats Box, or details like years in business in Business Info.',
  featured: 'Not on your page yet: pick a service in Featured Service.',
  locations: 'Not on your page yet: add your city, areas or hours in Business Info.',
};
const EMPTY_SECTION_HINT = 'Not on your page yet: this section has nothing to show.';

// TintObsidian's starter shades (its DEFAULT_SHADES): what the Shades tab
// starts from, so a first edit saves the shades the preview already shows.
// No legal notes: tint law differs by state, only the owner writes those.
const STARTER_SHADES = [
  { vlt: '5', name: 'Limo Black', legal: '' },
  { vlt: '15', name: 'Midnight', legal: '' },
  { vlt: '25', name: 'Dark Smoke', legal: '' },
  { vlt: '35', name: 'Medium', legal: '' },
  { vlt: '50', name: 'Light Smoke', legal: '' },
];

// Old seeded trust-bar items WheelApex refuses to publish (its
// SEEDED_TRUST): flagged in the Trust Bar tab so the owner knows why.
const SEEDED_TRUST = new Set([
  'fitment guaranteed|or free return',
  'finance available|0% for 12 months',
  '4.9 star rating|customer reviews',
]);

const LEVEL_STYLE = {
  AAA: 'bg-green-50 text-green-800 border-green-200',
  AA: 'bg-green-50 text-green-800 border-green-200',
  large: 'bg-amber-50 text-amber-800 border-amber-200',
  fail: 'bg-red-50 text-red-700 border-red-200',
};
const LEVEL_LABEL = { AAA: 'AAA', AA: 'AA', large: 'Low', fail: 'Fail' };

function EmojiPicker({ value, onChange, placeholder = '⭐' }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('emoji');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isIcon = value?.startsWith?.('icon:');

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-400 hover:border-gray-400 transition"
        style={{ width: 52, height: 38, fontSize: isIcon ? 14 : 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {value ? <IconOrEmoji value={value} size={18} color="#555" /> : <span style={{ opacity: 0.3, fontSize: 18 }}>{placeholder}</span>}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.15)', width: 260 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #eee', padding: '6px 10px 0' }}>
            {['emoji', 'icons'].map(t => (
              <button key={t} type="button" onClick={() => setTab(t)}
                style={{ flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: tab === t ? '#111' : '#999', borderBottom: tab === t ? '2px solid #111' : '2px solid transparent', background: 'none', border: 'none', borderBottomStyle: 'solid', cursor: 'pointer' }}>
                {t === 'emoji' ? '😀 Emoji' : '◇ Icons'}
              </button>
            ))}
          </div>
          <div style={{ padding: 10, maxHeight: 240, overflowY: 'auto' }}>
            {tab === 'emoji' ? (
              <>
                {Object.entries(EMOJI_GROUPS).map(([group, emojis]) => (
                  <div key={group} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#999', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, padding: '0 2px' }}>{group}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      {emojis.map((emoji) => (
                        <button key={emoji} type="button" onClick={() => { onChange(emoji); setOpen(false); }}
                          style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: value === emoji ? '#f3f4f6' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseOut={(e) => e.currentTarget.style.background = value === emoji ? '#f3f4f6' : 'transparent'}
                        >{emoji}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {SVG_ICONS.map((icon) => (
                  <button key={icon.id} type="button" title={icon.label} onClick={() => { onChange(icon.id); setOpen(false); }}
                    style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: value === icon.id ? '#f3f4f6' : 'transparent', border: value === icon.id ? '1px solid #d1d5db' : '1px solid transparent', borderRadius: 8, cursor: 'pointer' }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f3f4f6'}
                    onMouseOut={(e) => e.currentTarget.style.background = value === icon.id ? '#f3f4f6' : 'transparent'}
                  >
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d={icon.path} stroke="#555" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid #eee', padding: '6px 10px' }}>
            <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)}
              placeholder="Or type any emoji/text"
              className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-[12px] text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
        </div>
      )}
    </div>
  );
}

const SECTION_ICON = {
  hero: '✦',
  services: '⚙',
  about: '◎',
  testimonials: '❝',
  footer: '◻',
};

function Field({ label, value, onChange, multiline = false, rows = 3, placeholder, help }) {
  const base = 'w-full text-[13px] text-gray-800 border border-gray-200 rounded-lg px-3 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition resize-none';
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</label>
      {multiline ? (
        <textarea rows={rows} value={value || ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={base} />
      ) : (
        <input type="text" value={value || ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={base} />
      )}
      {help && <p className="mt-1 text-[11px] text-gray-500 leading-snug">{help}</p>}
    </div>
  );
}

// A comma-separated list (brands, ticker items). Keeps the raw text while
// the field has focus: re-deriving it from the saved list on every key
// would swallow the comma the owner just typed. Saves null when emptied,
// so the template falls back to what Business Info has.
function ListField({ label, value, onChange, placeholder, help, rows = 2 }) {
  const toText = (v) => (Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : '');
  const [draft, setDraft] = useState(null);
  const base = 'w-full text-[13px] text-gray-800 border border-gray-200 rounded-lg px-3 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition resize-none';
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</label>
      <textarea
        rows={rows}
        value={draft ?? toText(value)}
        placeholder={placeholder}
        onFocus={() => setDraft(toText(value))}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          setDraft(e.target.value);
          const items = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
          onChange(items.length > 0 ? items : null);
        }}
        className={base}
      />
      {help && <p className="mt-1 text-[11px] text-gray-500 leading-snug">{help}</p>}
    </div>
  );
}

// An on/off switch with a visible label (the Sections list, Show Products,
// Show Shade Guide, social icons).
function Switch({ on, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${on ? 'bg-gray-900' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}

function PhoneField({ label, value, onChange }) {
  const base = 'w-full text-[13px] text-gray-800 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition';
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</label>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        maxLength={14}
        value={formatPhone(value)}
        onChange={(e) => onChange(formatPhone(e.target.value))}
        className={base}
      />
    </div>
  );
}

function ImageSlot({ label, value, onChange, siteId, uploadKey }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      const url = await uploadSiteImage(file, { siteId, imageKey: uploadKey });
      onChange(url);
    } catch (ex) {
      setErr(ex.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = ''; // allow re-selecting the same file
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</label>
      <label className="block cursor-pointer">
        {value ? (
          <div className="relative group rounded-lg overflow-hidden border border-gray-200">
            <img src={value} alt={label} className="w-full h-28 object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <span className="text-white text-[12px] font-medium">{uploading ? 'Uploading…' : 'Change Image'}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-20 border-2 border-dashed border-gray-200 rounded-lg hover:border-gray-400 transition text-gray-400 hover:text-gray-600">
            {uploading ? (
              <span className="text-[12px]">Uploading…</span>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="mb-1">
                  <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span className="text-[12px]">Upload {label}</span>
              </>
            )}
          </div>
        )}
        <input type="file" accept="image/*" onChange={handleFile} className="sr-only" disabled={uploading} />
      </label>
      {err && <p className="mt-1 text-[11px] text-red-500">{err}</p>}
      {value && !uploading && (
        <button onClick={() => onChange(null)} className="mt-1 text-[11px] text-red-400 hover:text-red-600 transition">
          Remove
        </button>
      )}
    </div>
  );
}

// Gallery slot list with "Add another photo" — unlimited up to MAX_GALLERY.
// Always shows at least 3 slots so the editor matches the original UX.
// When >3 photos are uploaded, the published gallery auto-switches to a
// swipeable carousel (see GallerySection in templates/ImageLayers.jsx).
const MAX_GALLERY = 12;
function GallerySlots({ images, setImage, siteId, gridNote = null }) {
  // Lowest slot count we always show, expanded by either an existing high
  // slot in `images` or the user clicking "Add another photo".
  const usedKeys = Object.keys(images || {}).filter((k) => /^gallery\d+$/.test(k) && images[k]);
  const maxUsedIndex = usedKeys.reduce(
    (m, k) => Math.max(m, parseInt(k.replace('gallery', ''), 10)),
    -1,
  );
  const minSlots = Math.max(3, maxUsedIndex + 1);
  const [extraSlots, setExtraSlots] = useState(0);
  const slotCount = Math.min(MAX_GALLERY, minSlots + extraSlots);
  const filledCount = usedKeys.length;
  const willCarousel = filledCount > 3;

  return (
    <>
      <p className="text-[11px] text-gray-400 mb-1">
        Upload photos for your gallery section.
      </p>
      <p className="text-[11px] text-gray-400 mb-4">
        {gridNote || (willCarousel
          ? `${filledCount} photos · gallery is in carousel mode (swipeable on the live site).`
          : 'Add up to 3 photos for a grid. A 4th photo turns the gallery into a swipeable carousel.')}
      </p>
      {Array.from({ length: slotCount }, (_, i) => (
        <ImageSlot
          key={`gallery${i}`}
          label={`Gallery Photo ${i + 1}`}
          value={images?.[`gallery${i}`]}
          onChange={(v) => setImage(`gallery${i}`, v)}
          siteId={siteId}
          uploadKey={`gallery${i}`}
        />
      ))}
      {slotCount < MAX_GALLERY && (
        <button
          type="button"
          onClick={() => setExtraSlots((n) => n + 1)}
          className="w-full mt-1 mb-2 py-2 rounded-lg border border-dashed border-gray-300 text-[12px] font-medium text-gray-500 hover:border-gray-500 hover:text-gray-700 transition-colors"
        >
          + Add another photo
        </button>
      )}
      {slotCount >= MAX_GALLERY && (
        <p className="text-[11px] text-gray-400 mt-1">Maximum {MAX_GALLERY} gallery photos.</p>
      )}
    </>
  );
}

function Toggle({ value, onChange, options }) {
  return (
    <div className="flex gap-1 mb-4">
      {options.map(opt => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={`flex-1 py-1.5 px-2 rounded-lg text-[12px] font-medium border transition ${value === opt.value ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function ContentEditor({ isOpen, onClose, topOffset = 0, siteId, copy, images, onCopyChange, onImagesChange, templateMeta, templateId, customColors = {}, onCustomColors, customFonts = {}, onCustomFonts, businessType, onSwitchTemplate, businessInfo, onBusinessInfoChange }) {
  const { confirm: confirmDialog } = useAlert();
  const setBiz = (key, val) => {
    if (!onBusinessInfoChange) return;
    onBusinessInfoChange((prev) => ({ ...(prev || {}), [key]: val }));
  };
  const [selectedSection, setActiveSection] = useState('visibility');

  const setCopy = (path, value) => {
    const parts = path.split('.');
    const next = structuredClone(copy || {});
    let obj = next;
    for (let i = 0; i < parts.length - 1; i++) {
      // Create a missing parent (e.g. servicesSection on a thin AI draft).
      if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    onCopyChange(next);
  };

  const setTestimonial = (index, field, value) => {
    const next = structuredClone(copy);
    next.testimonialPlaceholders[index][field] = value;
    onCopyChange(next);
  };
  const removeTestimonial = (index) => {
    const next = structuredClone(copy);
    next.testimonialPlaceholders = (next.testimonialPlaceholders || []).filter((_, i) => i !== index);
    onCopyChange(next);
  };
  // Several fields of one review in one write (Google source + rating):
  // two setTestimonial calls would each clone the same copy, and the second
  // would drop the first.
  const setTestimonialFields = (index, patch) => {
    const next = structuredClone(copy);
    next.testimonialPlaceholders[index] = { ...next.testimonialPlaceholders[index], ...patch };
    onCopyChange(next);
  };
  const addTestimonial = () => {
    const next = structuredClone(copy);
    next.testimonialPlaceholders = [...(next.testimonialPlaceholders || []), { text: '', name: '' }];
    onCopyChange(next);
  };

  const setImage = (key, value) => {
    onImagesChange((prev) => ({ ...prev, [key]: value }));
  };

  // Services tab: per row, the name the hero picks / featured service still
  // point at while that row's Name field is empty or matches another
  // service (serviceRefs.followServiceRename).
  const pendingServiceNames = useRef({});

  // Controls only for what this template reads (editorCapabilities.js).
  const has = (key) => templateReads(templateId, key);
  const bizType = businessType || businessInfo?.businessType;
  const fb = getFallbacks(businessKind(bizType));

  // Sections list: the template module's own `sections` manifest (legacy
  // templates: the ids their buildSectionOrder call uses), stored as before
  // in copy.sectionOrder / copy.hiddenSections. A saved order is fitted to
  // the manifest: missing ids take their default slot. The list shows only
  // this template's ids, but what is saved keeps the other templates' ids
  // where they were (savedOrder), so switching designs and back restores
  // the owner's order.
  const templateInfo = useTemplateInfo(templateId);
  const themeReady = templateInfo ? templateInfo.themeReady : true;
  const toggleableSections = templateInfo?.sections || [];
  const defaultOrder = toggleableSections.map((s) => s.id);
  const hiddenSections = Array.isArray(copy?.hiddenSections) ? copy.hiddenSections : [];
  const orderedIds = mergeSectionOrder(copy?.sectionOrder, defaultOrder);
  const savedOrder = mergeSectionOrder(copy?.sectionOrder, defaultOrder, { keepForeign: true });
  const orderedSections = orderedIds.map((id) => toggleableSections.find((s) => s.id === id)).filter(Boolean);
  const hasCustomOrder = Array.isArray(copy?.sectionOrder) && copy.sectionOrder.length > 0 && !sameOrder(orderedIds, defaultOrder);

  // A saved order that leaves out some of this template's sections (a
  // template switch, or a site saved before the template had them) would
  // render those at order 999, piled up above the footer (audit 4.2). Save
  // the fitted order once the panel is open: the missing ids are slotted in
  // and every other id stays put, so a round trip through other templates
  // adds their ids once and never reorders the owner's. Runs a render after
  // a switch, so App's autosave already sees the new template id.
  useEffect(() => {
    if (!isOpen || !templateInfo || templateInfo.templateId !== templateId) return;
    if (!orderNeedsRepair(copy?.sectionOrder, defaultOrder)) return;
    setCopy('sectionOrder', mergeSectionOrder(copy.sectionOrder, defaultOrder, { keepForeign: true }));
  }, [isOpen, templateId, templateInfo, copy?.sectionOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSectionHidden = (id) => hiddenSections.includes(id);
  const toggleSection = (id) => {
    const next = isSectionHidden(id)
      ? hiddenSections.filter(s => s !== id)
      : [...hiddenSections, id];
    setCopy('hiddenSections', next);
  };
  // Moves within the visible list, then puts the other templates' ids back
  // at their old positions before saving.
  const moveSectionTo = (from, to) => {
    const next = moveSection(orderedIds, from, to);
    if (next !== orderedIds) setCopy('sectionOrder', placeSectionOrder(savedOrder, next));
  };
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const handleDragStart = (idx) => { setDragIdx(idx); };
  const handleDragOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDrop = (idx) => {
    if (dragIdx !== null && dragIdx !== idx) moveSectionTo(dragIdx, idx);
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  const sections = editorTabs(templateId, {
    canEditBusiness: Boolean(onBusinessInfoChange),
    canSwitchTemplate: Boolean(onSwitchTemplate),
  });
  // After a template switch the open tab may not exist any more.
  const activeSection = sections.some((s) => s.id === selectedSection) ? selectedSection : 'visibility';

  // Which sections the preview actually shows (theme-ready templates tag
  // each with data-section), so a switched-on section with nothing to show
  // says so instead of looking like a dead switch. Editor-only hint blocks
  // don't count: they never reach the published page.
  const [presentIds, setPresentIds] = useState(null);
  useEffect(() => {
    const watching = isOpen && activeSection === 'visibility' && templateInfo?.themeReady && typeof document !== 'undefined';
    const root = watching ? document.querySelector('.preview-wrap') : null;
    if (!root) {
      setPresentIds((prev) => (prev === null ? prev : null));
      return undefined;
    }
    // A section counts when something in it besides editor-only hints
    // would publish: text, an image or an embed.
    const publishes = (el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => {
          if (n.nodeType === 3) return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
          if (n.hasAttribute('data-acg-editor-only') || n.tagName === 'STYLE' || n.tagName === 'SCRIPT') return NodeFilter.FILTER_REJECT;
          return /^(IMG|IFRAME|VIDEO|svg)$/.test(n.tagName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        },
      });
      return walker.nextNode() !== null;
    };
    let frame = 0;
    const read = () => {
      frame = 0;
      const ids = new Set();
      root.querySelectorAll('[data-section]').forEach((el) => {
        if (!el.closest('[data-acg-editor-only]') && publishes(el)) ids.add(el.getAttribute('data-section'));
      });
      setPresentIds((prev) => (prev && prev.size === ids.size && [...ids].every((id) => prev.has(id)) ? prev : ids));
    };
    read();
    const observer = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(read); });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [isOpen, activeSection, templateInfo]);

  if (!isOpen) return null;

  return (
    <>
      {/* No backdrop: the preview stays undimmed and usable while editing
          (colors especially). The panel closes from its X or the toolbar. */}

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-80 bg-white border-l border-gray-200 flex flex-col shadow-2xl" style={{ top: 52 + topOffset, zIndex: 9999 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-[13px] font-semibold text-gray-900">Edit Content</p>
            <p className="text-[11px] text-gray-400">Changes apply live</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Section nav rail + content pane */}
        <div className="flex-1 flex min-h-0">
          {/* Rail: full tab names at 11px, wrapping onto a second line
              ("Colors & Fonts"), so each reads as the templates' hints
              name it ("Edit > How It Works"). */}
          <div data-tour="section-rail" className="w-[72px] shrink-0 border-r border-gray-100 bg-gray-50 px-1 py-2 overflow-y-auto" style={{ position: 'relative', zIndex: 2, ...RAIL_SCROLL_SHADOWS }}>
            {(() => {
              const groups = { top: [], content: [], design: [], settings: [] };
              for (const s of sections) groups[s.group || 'content'].push(s);
              const order = ['top', 'content', 'design', 'settings'];
              const groupLabels = { content: 'Content', design: 'Design', settings: 'Settings' };
              return order.map((g, gi) => {
                if (!groups[g].length) return null;
                return (
                  <div key={g} data-tour={`group-${g}`} className={gi > 0 ? 'mt-3' : ''}>
                    {g !== 'top' && (
                      <p className="text-[11px] font-semibold text-gray-500 text-center mb-1 leading-tight">{groupLabels[g]}</p>
                    )}
                    {groups[g].map(s => (
                      <button
                        key={s.id}
                        type="button"
                        data-tour={`tab-${s.id}`}
                        onClick={(e) => { e.stopPropagation(); setActiveSection(s.id); }}
                        aria-current={activeSection === s.id ? 'page' : undefined}
                        className={`w-full flex flex-col items-center gap-1 px-0.5 py-2 rounded-lg transition mb-0.5 ${
                          activeSection === s.id
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                        title={s.label}
                      >
                        <NavIcon id={s.id} />
                        <span className="block w-full text-center text-[11px] font-semibold leading-[1.15] break-words">
                          {s.label}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              });
            })()}
          </div>

          {/* Content pane */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Active section sub-header */}
            <div className="px-4 py-2.5 border-b border-gray-100 shrink-0 flex items-center gap-2">
              <NavIcon id={activeSection} className="w-4 h-4 text-gray-700" />
              <p className="text-[13px] font-semibold text-gray-900">
                {(sections.find(s => s.id === activeSection) || {}).label}
              </p>
            </div>

        {/* Scrollable fields */}
        <div className="flex-1 overflow-y-auto px-4 py-2">

          {activeSection === 'visibility' && (
            <>
              <p className="text-[11px] text-gray-500 mb-3 leading-snug">Drag a section or use its arrows to reorder. Switch it off to hide it.</p>
              {!templateInfo && <p className="text-[12px] text-gray-400 py-3">Loading sections…</p>}
              {orderedSections.map(({ id, label }, idx) => {
                const hidden = isSectionHidden(id);
                const absent = !hidden && presentIds && !presentIds.has(id);
                const arrow = 'w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition shrink-0';
                return (
                  <div
                    key={id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={handleDragEnd}
                    className="py-2 border-b border-gray-100 select-none"
                    style={{
                      opacity: dragIdx === idx ? 0.35 : 1,
                      borderTop: dragOverIdx === idx && dragIdx !== idx ? '2px solid #3b82f6' : '2px solid transparent',
                      transition: 'opacity 0.15s',
                    }}
                  >
                    <div className="flex items-center gap-1">
                      {/* Drag handle */}
                      <span className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 text-[14px] leading-none mr-1" title="Drag to reorder" aria-hidden="true">⠿</span>
                      <span className={`flex-1 min-w-0 text-[13px] font-medium ${hidden ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{label}</span>
                      <button type="button" className={arrow} disabled={idx === 0} onClick={() => moveSectionTo(idx, idx - 1)} aria-label={`Move ${label} up`} title="Move up">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 7.5L6 4.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                      <button type="button" className={arrow} disabled={idx === orderedSections.length - 1} onClick={() => moveSectionTo(idx, idx + 1)} aria-label={`Move ${label} down`} title="Move down">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.5L6 7.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                      <span className="ml-1 flex">
                        <Switch on={!hidden} onChange={() => toggleSection(id)} label={`Show ${label}`} />
                      </span>
                    </div>
                    {absent && (
                      <p className="mt-1 ml-5 text-[11px] text-gray-500 leading-snug">{EMPTY_SECTION_HINTS[id] || EMPTY_SECTION_HINT}</p>
                    )}
                  </div>
                );
              })}
              {hasCustomOrder && (
                <button type="button" onClick={() => setCopy('sectionOrder', null)}
                  className="mt-3 text-[12px] text-gray-500 hover:text-red-500 border border-gray-200 rounded-lg px-3 py-1.5 w-full transition">
                  Reset order
                </button>
              )}
            </>
          )}

          {activeSection === 'hero' && (
            <>
              <ImageSlot label="Hero Background" value={images?.hero} onChange={(v) => setImage('hero', v)} siteId={siteId} uploadKey="hero" />
              <ImageSlot label="Business Logo" value={images?.logo} onChange={(v) => setImage('logo', v)} siteId={siteId} uploadKey="logo" />
              <hr className="my-3 border-gray-100" />
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Hero Layout</p>
              <Toggle
                value={copy?.heroLayout || 'full'}
                onChange={(v) => setCopy('heroLayout', v)}
                options={[{ value: 'full', label: '⬛ Full Background' }, { value: 'split', label: '▥ Split (Image Right)' }]}
              />
              <Field label="Headline" value={copy.headline} onChange={(v) => setCopy('headline', v)} help={has('sectionTitles') ? 'Highlighted words and the small label above it: Edit > Headings.' : undefined} />
              <Field label="Subheadline" value={copy.subheadline} onChange={(v) => setCopy('subheadline', v)} multiline rows={2} />
              <Field label="Primary Button" value={copy.ctaPrimary} onChange={(v) => setCopy('ctaPrimary', v)} />
              <Field label="Secondary Button" value={copy.ctaSecondary} onChange={(v) => setCopy('ctaSecondary', v)} />
              {has('ctaPrimaryUrl') && (
                <Field label="Button 1 URL (optional)" value={copy?.ctaPrimaryUrl} onChange={(v) => setCopy('ctaPrimaryUrl', v)} />
              )}
              {has('ctaSecondaryUrl') && (
                <Field
                  label={templateHelp(templateId, 'button2Url') || 'Button 2 URL (default: calls phone)'}
                  value={copy?.ctaSecondaryUrl}
                  onChange={(v) => setCopy('ctaSecondaryUrl', v)}
                  help={has('ctaSecondaryText') ? 'Also the link of the second button in Contact.' : undefined}
                />
              )}
              {has('heroServices') && (
                <>
                  <hr className="my-3 border-gray-100" />
                  <HeroServicesPanel copy={copy} setCopy={setCopy} businessInfo={businessInfo} />
                </>
              )}
            </>
          )}

          {activeSection === 'services' && (() => {
            // Source of truth: the wizard writes packages-with-prices to
            // businessInfo.services (as {name, price, description} objects). The
            // normalize layer mirrors services -> packages for template rendering.
            // Fall back to businessInfo.packages (legacy) and finally to
            // copy.servicesSection.items so the editor never opens blank.
            // Object items keep their other keys (includes, badge, summary, image, ...):
            // some templates read them, and saving this tab must not wipe them.
            const toObj = (p) => typeof p === 'string'
              ? { name: p, price: '', description: '' }
              : { ...p, name: p?.name || '', price: p?.price || '', description: p?.description || '' };
            const rawServices = Array.isArray(businessInfo?.services) ? businessInfo.services.map(toObj) : [];
            const rawPackages = Array.isArray(businessInfo?.packages) ? businessInfo.packages.map(toObj) : [];
            const seedFromCopy = (copy.servicesSection?.items || []).map((item) => ({
              name: item?.name || '',
              price: '',
              description: item?.description || '',
            }));
            const packages = rawServices.length > 0
              ? rawServices
              : rawPackages.length > 0
                ? rawPackages
                : seedFromCopy;
            // Write to both `services` (wizard's canonical key) and `packages`
            // (used by some templates and the normalize fallback), so edits
            // always show up regardless of which field a template reads.
            const writePackages = (next) => {
              if (!onBusinessInfoChange) return;
              onBusinessInfoChange((prev) => ({ ...(prev || {}), services: next, packages: next }));
            };
            const updatePackage = (i, field, value) => {
              writePackages(packages.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
              // Hero services and the featured service name services: follow a
              // rename, also through an emptied field (select-all + retype).
              if (field === 'name') {
                const others = packages.filter((_, idx) => idx !== i).map((p) => p.name);
                const r = followServiceRename(copy, packages[i]?.name, value, others, pendingServiceNames.current[i]);
                pendingServiceNames.current[i] = r.pending;
                if (r.copy) onCopyChange(r.copy);
              }
            };
            // Package details write one field into the latest list: a photo
            // upload lands seconds later, after other edits (patchServiceList).
            const patchService = (i, key, value, at) => {
              if (!onBusinessInfoChange) return;
              onBusinessInfoChange((prev) => {
                const base = Array.isArray(prev?.services) && prev.services.length ? prev.services
                  : Array.isArray(prev?.packages) && prev.packages.length ? prev.packages : packages;
                const next = patchServiceList(base.map(toObj), i, key, value, at);
                return next ? { ...(prev || {}), services: next, packages: next } : prev;
              });
            };
            const removePackage = (i) => {
              const removed = packages[i]?.name || pendingServiceNames.current[i] || '';
              writePackages(packages.filter((_, idx) => idx !== i));
              pendingServiceNames.current = {};
              // A removed service leaves the hero picks, and stops being featured.
              const next = removeServiceRefs(copy, removed, packages.filter((_, idx) => idx !== i).map((p) => p.name));
              if (next) onCopyChange(next);
            };
            // Card order decides the hero's automatic picks and the cards' order.
            const movePackage = (from, to) => {
              writePackages(moveItem(packages, from, to));
              pendingServiceNames.current = {};
            };
            const addPackage = () => {
              writePackages([...packages, { name: '', price: '', description: '' }]);
            };
            return (
              <>
                {has('servicesTitle') && (
                  <Field
                    label="Services Heading"
                    value={copy.servicesSection?.title}
                    onChange={(v) => setCopy('servicesSection.title', v)}
                    placeholder="Leave empty for the design's own heading"
                  />
                )}
                <Field label="Services Intro" value={copy.servicesSection?.intro} onChange={(v) => setCopy('servicesSection.intro', v)} multiline rows={2} />
                {packages.map((pkg, i) => (
                  <div key={i} className="mb-5 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Service {i + 1}</p>
                      <span className="flex items-center gap-1">
                        <MoveButtons index={i} count={packages.length} onMove={movePackage} label={`service ${i + 1}`} />
                        <button type="button" onClick={() => removePackage(i)} className="ml-1 text-[11px] text-red-400 hover:text-red-600 transition">Remove</button>
                      </span>
                    </div>
                    <Field label="Name" value={pkg.name} onChange={(v) => updatePackage(i, 'name', v)} />
                    <div className="mb-4">
                      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Price</label>
                      <input
                        type="text"
                        value={String(pkg.price || '').replace(/^\$/, '')}
                        onChange={(e) => updatePackage(i, 'price', e.target.value)}
                        onBlur={(e) => {
                          const formatted = formatPrice(e.target.value);
                          if (formatted !== pkg.price) updatePackage(i, 'price', formatted);
                        }}
                        placeholder="e.g. $99"
                        className="w-full text-[13px] text-gray-800 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
                      />
                    </div>
                    <Field label="Description" value={pkg.description} onChange={(v) => updatePackage(i, 'description', v)} multiline rows={2} />
                    {has('serviceDetails') && (
                      <ServiceDetailsFields service={pkg} index={i} siteId={siteId} onPatch={(key, value) => patchService(i, key, value, { name: pkg.name, count: packages.length })} />
                    )}
                  </div>
                ))}
                <button type="button" onClick={addPackage} className="w-full py-2 text-[12px] font-semibold text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-700 transition mb-2">+ Add Service</button>
              </>
            );
          })()}

          {activeSection === 'howItWorks' && (() => {
            // Until the owner saves steps, the template shows its own
            // starters. Seed from the template's exported defaults when it
            // has them (exactly what the preview shows), else from the
            // business type's defaults (templateFallbacks.js), never one
            // business's steps for every type (audit arch-5).
            const own = Array.isArray(copy?.howSteps);
            const exact = Boolean(templateInfo?.defaultHowSteps);
            const steps = own
              ? copy.howSteps
              : exact ? templateInfo.defaultHowSteps(bizType) : defaultHowSteps(bizType);
            const restore = async () => {
              const ok = await confirmDialog('Remove your steps and show the starter steps again?', { title: 'Use starter steps?', confirmText: 'Use starter steps' });
              if (ok) setCopy('howSteps', null);
            };
            const updateStep = (i, key, val) => {
              const current = [...steps];
              current[i] = { ...current[i], [key]: val };
              setCopy('howSteps', current);
            };
            const removeStep = (i) => {
              const current = [...steps];
              current.splice(i, 1);
              setCopy('howSteps', current);
            };
            const addStep = () => {
              setCopy('howSteps', [...steps, { emoji: '✨', title: '', desc: '' }]);
            };
            return (
              <>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">How It Works Steps</p>
                {!own && (
                  <p className="text-[11px] text-gray-500 mb-3 leading-snug">
                    {exact
                      ? 'These are the starter steps on your site. Edit any of them to make them your own.'
                      : "Suggested steps for your type of business. Until you edit one, your site shows this design's own starter steps."}
                  </p>
                )}
                {steps.map((step, i) => (
                  <div key={i} className="mb-4 p-3 bg-gray-50 rounded-lg relative">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Step {i + 1}</p>
                      {steps.length > 1 && (
                        <button type="button" onClick={() => removeStep(i)} className="text-[11px] text-red-400 hover:text-red-600 transition">Remove</button>
                      )}
                    </div>
                    <div className="grid grid-cols-[60px_1fr] gap-2 mb-2">
                      <EmojiPicker value={step.emoji ?? ''} onChange={(v) => updateStep(i, 'emoji', v)} placeholder="📱" />
                      <input type="text" value={step.title ?? ''} onChange={(e) => updateStep(i, 'title', e.target.value)} placeholder="Step title" className="min-w-0 w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </div>
                    <textarea rows={2} value={step.desc ?? ''} onChange={(e) => updateStep(i, 'desc', e.target.value)} placeholder="Step description" className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
                  </div>
                ))}
                <button type="button" onClick={addStep} className="w-full py-2 text-[12px] font-semibold text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-700 transition mb-2">+ Add Step</button>
                {own && (
                  <button type="button" onClick={restore} className="w-full py-1.5 text-[12px] text-gray-500 hover:text-red-500 transition mb-2">Use the starter steps instead</button>
                )}
              </>
            );
          })()}

          {activeSection === 'whyUs' && (() => {
            // Same seeding rule as How It Works above.
            const own = Array.isArray(copy?.whyCards);
            const exact = Boolean(templateInfo?.defaultWhyCards);
            const cards = own
              ? copy.whyCards
              : exact ? templateInfo.defaultWhyCards(bizType) : defaultWhyCards(bizType);
            const restore = async () => {
              const ok = await confirmDialog('Remove your cards and show the starter cards again?', { title: 'Use starter cards?', confirmText: 'Use starter cards' });
              if (ok) setCopy('whyCards', null);
            };
            const updateCard = (i, key, val) => {
              const current = [...cards];
              current[i] = { ...current[i], [key]: val };
              setCopy('whyCards', current);
            };
            const removeCard = (i) => {
              const current = [...cards];
              current.splice(i, 1);
              setCopy('whyCards', current);
            };
            const addCard = () => {
              setCopy('whyCards', [...cards, { icon: '✨', title: '', desc: '' }]);
            };
            return (
              <>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Why Choose Us Cards</p>
                {!own && (
                  <p className="text-[11px] text-gray-500 mb-3 leading-snug">
                    {exact
                      ? 'These are the starter cards on your site. Edit any of them to make them your own.'
                      : "Suggested cards for your type of business. Until you edit one, your site shows this design's own starter cards."}
                  </p>
                )}
                {cards.map((card, i) => (
                  <div key={i} className="mb-4 p-3 bg-gray-50 rounded-lg relative">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Card {i + 1}</p>
                      {cards.length > 1 && (
                        <button type="button" onClick={() => removeCard(i)} className="text-[11px] text-red-400 hover:text-red-600 transition">Remove</button>
                      )}
                    </div>
                    <div className="grid grid-cols-[60px_1fr] gap-2 mb-2">
                      <EmojiPicker value={card.icon ?? ''} onChange={(v) => updateCard(i, 'icon', v)} placeholder="🏠" />
                      <input type="text" value={card.title ?? ''} onChange={(e) => updateCard(i, 'title', e.target.value)} placeholder="Card title" className="min-w-0 w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </div>
                    <textarea rows={2} value={card.desc ?? ''} onChange={(e) => updateCard(i, 'desc', e.target.value)} placeholder="Card description" className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
                  </div>
                ))}
                <button type="button" onClick={addCard} className="w-full py-2 text-[12px] font-semibold text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-700 transition mb-2">+ Add Card</button>
                {own && (
                  <button type="button" onClick={restore} className="w-full py-1.5 text-[12px] text-gray-500 hover:text-red-500 transition mb-2">Use the starter cards instead</button>
                )}
              </>
            );
          })()}

          {activeSection === 'products' && (() => {
            const products = Array.isArray(copy?.products) ? copy.products : [];
            const showProducts = copy?.showProducts !== false;
            const updateProduct = (i, key, val) => {
              const current = [...products];
              current[i] = { ...current[i], [key]: val };
              setCopy('products', current);
            };
            const removeProduct = (i) => {
              const current = [...products];
              current.splice(i, 1);
              setCopy('products', current);
            };
            const addProduct = () => {
              setCopy('products', [...products, { name: '', price: '', description: '', badge: '' }]);
            };
            return (
              <>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Show Products</p>
                  <Switch on={showProducts} onChange={(v) => setCopy('showProducts', v)} label="Show products" />
                </div>
                <p className="text-[11px] text-gray-500 mb-3 leading-snug">Off hides these products only; your services still show. To hide the whole block, use Sections.</p>
                {showProducts && (
                  <>
                    <p className="text-[11px] text-gray-500 mb-3">Products appear first in the grid, before your services.</p>
                    {products.map((prod, i) => (
                      <div key={i} className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Product {i + 1}</p>
                          <button type="button" onClick={() => removeProduct(i)} className="text-[11px] text-red-400 hover:text-red-600 transition">Remove</button>
                        </div>
                        <div className="mb-3">
                          <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Product Image</label>
                          <label className="block cursor-pointer">
                            {prod.image ? (
                              <div className="relative group rounded-lg overflow-hidden border border-gray-200">
                                <img src={prod.image} alt="Product" className="w-full h-24 object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                  <span className="text-white text-[11px] font-medium">Change</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-16 border-2 border-dashed border-gray-200 rounded-lg hover:border-gray-400 transition text-gray-400 hover:text-gray-600">
                                <span className="text-[11px]">+ Upload Image</span>
                              </div>
                            )}
                            <input type="file" accept="image/*" onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const url = await uploadSiteImage(file, { siteId, imageKey: `product${i}` });
                                updateProduct(i, 'image', url);
                              } catch (ex) {
                                console.error('Product image upload failed:', ex.message);
                              } finally {
                                e.target.value = '';
                              }
                            }} className="sr-only" />
                          </label>
                          {prod.image && (
                            <button onClick={() => updateProduct(i, 'image', null)} className="mt-1 text-[11px] text-red-400 hover:text-red-600 transition">Remove image</button>
                          )}
                        </div>
                        <Field label="Name" value={prod.name ?? ''} onChange={(v) => updateProduct(i, 'name', v)} />
                        <Field label="Price" value={prod.price ?? ''} onChange={(v) => updateProduct(i, 'price', v)} />
                        <Field label="Description" value={prod.description ?? ''} onChange={(v) => updateProduct(i, 'description', v)} />
                        <Field label="Badge (e.g. Bestseller, New, Sale)" value={prod.badge ?? ''} onChange={(v) => updateProduct(i, 'badge', v)} />
                      </div>
                    ))}
                    <button type="button" onClick={addProduct} className="w-full py-2 text-[12px] font-semibold text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-700 transition mb-2">+ Add Product</button>
                  </>
                )}
              </>
            );
          })()}

          {activeSection === 'brands' && (() => {
            // Empty means "use Business Info": the template falls back to
            // the wizard's brands when these are unset.
            const bizList = (v) => (Array.isArray(v) ? v.filter(Boolean).join(', ') : typeof v === 'string' ? v : '');
            const wheelFallback = bizList(businessInfo?.brands);
            const tireFallback = bizList(businessInfo?.tireBrands);
            return (
              <>
                <ListField
                  label="Wheel Brands (comma-separated)"
                  value={copy?.wheelBrands}
                  onChange={(v) => setCopy('wheelBrands', v)}
                  placeholder={wheelFallback || 'e.g. BBS, Enkei, Vossen'}
                  help={wheelFallback ? 'Leave empty to use the brands from Business Info.' : 'Only brands you actually sell or fit.'}
                />
                <ListField
                  label="Tire Brands (comma-separated)"
                  value={copy?.tireBrandsList}
                  onChange={(v) => setCopy('tireBrandsList', v)}
                  placeholder={tireFallback || 'e.g. Michelin, Pirelli'}
                  help={tireFallback ? 'Leave empty to use the tire brands from Business Info.' : undefined}
                />
              </>
            );
          })()}

          {activeSection === 'filmBrands' && (() => {
            const bizFilm = Array.isArray(businessInfo?.filmBrands)
              ? businessInfo.filmBrands.filter(Boolean).join(', ')
              : typeof businessInfo?.filmBrands === 'string' ? businessInfo.filmBrands : '';
            return (
              <ListField
                label="Film Brands (comma-separated)"
                value={copy?.filmBrandsList}
                onChange={(v) => setCopy('filmBrandsList', v)}
                placeholder={bizFilm || 'e.g. XPEL, LLumar, 3M'}
                help={bizFilm ? 'Leave empty to use the film brands from Business Info.' : 'Only brands you actually install.'}
              />
            );
          })()}

          {activeSection === 'shadeGuide' && (() => {
            // Mirrors TintObsidian: starter shades show only for a business
            // that sells tint; the owner's own shades or the switch show the
            // guide anywhere (editorCapabilities.js shadeGuideState).
            const state = shadeGuideState(copy, businessInfo);
            const own = Array.isArray(copy?.shadeGuide) && copy.shadeGuide.length > 0;
            const shades = own ? copy.shadeGuide : STARTER_SHADES.map((s) => ({ ...s }));
            const showShades = !state.switchedOff && (state.hasOwnShades || state.sellsTint || copy?.showShadeGuide === true);
            const updateShade = (i, key, val) => {
              const current = [...shades];
              current[i] = { ...current[i], [key]: val };
              setCopy('shadeGuide', current);
            };
            const removeShade = (i) => {
              const current = [...shades];
              current.splice(i, 1);
              setCopy('shadeGuide', current);
            };
            const addShade = () => {
              setCopy('shadeGuide', [...shades, { vlt: '', name: '', legal: '' }]);
            };
            return (
              <>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Show Shade Guide</p>
                  <Switch on={showShades} onChange={(v) => setCopy('showShadeGuide', v)} label="Show shade guide" />
                </div>
                {!showShades && !state.switchedOff && (
                  <p className="text-[11px] text-gray-500 mb-3 leading-snug">Off because neither your business type nor your services mention window tint. Switch it on if you offer tint.</p>
                )}
                {state.hiddenInSections && (
                  <p className="text-[11px] text-amber-700 mb-3 leading-snug">This section is switched off in Sections, so it won&apos;t show until you switch it on there too.</p>
                )}
                {showShades && (
                  <>
                    <p className="text-[11px] text-gray-500 mb-3 leading-snug">
                      {own
                        ? 'Tint laws vary by state: only add legal notes you know are right for your area.'
                        : 'Starter shades are showing. Edit one to set your own shades, legal notes and photos.'}
                    </p>
                    {shades.map((shade, i) => (
                      <div key={i} className="mb-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Shade {i + 1}</p>
                          {shades.length > 1 && (
                            <button type="button" onClick={() => removeShade(i)} className="text-[11px] text-red-400 hover:text-red-600 transition">Remove</button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <input type="text" value={shade.vlt ?? ''} onChange={(e) => updateShade(i, 'vlt', e.target.value)} placeholder="VLT %" className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          <input type="text" value={shade.name ?? ''} onChange={(e) => updateShade(i, 'name', e.target.value)} placeholder="Name" className="col-span-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                        <input type="text" value={shade.legal ?? ''} onChange={(e) => updateShade(i, 'legal', e.target.value)} placeholder="Legal note (optional)" className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        <div className="mt-2">
                          <ImageSlot label={`Shade ${i + 1} Photo`} value={images?.[`shade${i}`]} onChange={(v) => setImage(`shade${i}`, v)} siteId={siteId} uploadKey={`shade${i}`} />
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={addShade} className="w-full py-2 text-[12px] font-semibold text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-700 transition mb-2">+ Add Shade</button>
                  </>
                )}
              </>
            );
          })()}

          {activeSection === 'trustBar' && (() => {
            // No stock items: with none saved, WheelApex builds the bar from
            // Business Info facts. (The old seeds promised fitment
            // guarantees, 0% finance and a 4.9 rating nobody entered.)
            const items = Array.isArray(copy?.trustBar) ? copy.trustBar : [];
            const isSeeded = (item) => SEEDED_TRUST.has(`${String(item?.label || '').trim().toLowerCase()}|${String(item?.sub || '').trim().toLowerCase()}`);
            const updateItem = (i, key, val) => {
              const current = [...items];
              current[i] = { ...current[i], [key]: val };
              setCopy('trustBar', current);
            };
            const removeItem = (i) => {
              const current = [...items];
              current.splice(i, 1);
              setCopy('trustBar', current);
            };
            const addItem = () => {
              setCopy('trustBar', [...items, { emoji: '', label: '', sub: '' }]);
            };
            return (
              <>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Trust Bar Items</p>
                <p className="text-[11px] text-gray-500 mb-3 leading-snug">
                  {items.length === 0
                    ? (templateHelp(templateId, 'trustBar') || 'Your trust bar shows facts from Business Info (years in business, service area, hours, payment, warranty). Add your own items to replace them.')
                    : 'Only facts you can stand behind. Remove every item to go back to the facts from Business Info.'}
                </p>
                {items.map((item, i) => (
                  <div key={i} className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Item {i + 1}</p>
                      <button type="button" onClick={() => removeItem(i)} className="text-[11px] text-red-400 hover:text-red-600 transition">Remove</button>
                    </div>
                    {isSeeded(item) && (
                      <p className="text-[11px] text-amber-700 mb-2 leading-snug">An old sample item: not shown on your site. Rewrite or remove it.</p>
                    )}
                    <div className="grid grid-cols-[60px_1fr] gap-2 mb-2">
                      <EmojiPicker value={item.emoji ?? ''} onChange={(v) => updateItem(i, 'emoji', v)} placeholder="🕐" />
                      <input type="text" value={item.label ?? ''} onChange={(e) => updateItem(i, 'label', e.target.value)} placeholder="Label text" className="min-w-0 w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </div>
                    <input type="text" value={item.sub ?? ''} onChange={(e) => updateItem(i, 'sub', e.target.value)} placeholder="Sub-text" className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>
                ))}
                <button type="button" onClick={addItem} className="w-full py-2 text-[12px] font-semibold text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-700 transition mb-2">+ Add Item</button>
              </>
            );
          })()}

          {activeSection === 'ticker' && (
            <>
              <p className="text-[11px] text-gray-500 mb-3 leading-snug">Short items that scroll across the ticker band.</p>
              <ListField
                label="Ticker items (comma-separated)"
                value={copy?.tickerItems}
                onChange={(v) => setCopy('tickerItems', v)}
                placeholder="e.g. Custom wheels, Tire mounting, Wheel repair"
                help="Leave empty to use your specialties from Business Info, or else the names of your services."
                rows={3}
              />
            </>
          )}

          {activeSection === 'about' && (
            <>
              {/* Always offered: templates fall back to the photo when the
                  Stats Box has no stats, and PhotoSlot's hint points here. */}
              <ImageSlot label="About Photo" value={images?.about} onChange={(v) => setImage('about', v)} siteId={siteId} uploadKey="about" />
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Left Panel Style</p>
              <Toggle
                value={copy?.aboutLayout || 'image'}
                onChange={(v) => setCopy('aboutLayout', v)}
                options={[{ value: 'stats', label: '📊 Stats Box' }, { value: 'image', label: '🖼 Photo' }]}
              />
              {has('aboutStats') && ((copy?.aboutLayout || 'image') === 'stats' || themeReady) && (
                <div className="mt-3 mb-2 space-y-3">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Stats (value + label)</p>
                  <p className="text-[11px] text-gray-500 leading-snug">
                    {(copy?.aboutLayout || 'image') === 'stats'
                      ? (themeReady ? 'Only numbers you can back up. Until you fill one in, the About Photo shows here.' : 'Only numbers you can back up.')
                      : 'Only numbers you can back up. With the Photo style they show elsewhere on your page (a stats strip, the hero, or under your About text).'}
                  </p>
                  {/* The Google badge brings the real rating: typed Google
                      numbers would drift from it. */}
                  {has('googleBadge') && <TypedRatingNote copy={copy} />}
                  {[0, 1, 2].map((i) => {
                    const stat = copy?.aboutStats?.[i] || {};
                    const updateStat = (key, val) => {
                      const current = [...(copy?.aboutStats || [{ value: '', label: '' }, { value: '', label: '' }, { value: '', label: '' }])];
                      current[i] = { ...current[i], [key]: val };
                      setCopy('aboutStats', current);
                    };
                    return (
                      <div key={i} className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={stat.value || ''}
                          onChange={(e) => updateStat('value', e.target.value)}
                          placeholder={['e.g. 12', 'e.g. 2,000', has('googleBadge') ? 'e.g. 3' : 'e.g. 4.9'][i]}
                          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <input
                          type="text"
                          value={stat.label || ''}
                          onChange={(e) => updateStat('label', e.target.value)}
                          placeholder={['Years in business', fb.statLabel, has('googleBadge') ? 'Team members' : 'Google rating'][i]}
                          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              <Field label="About Text" value={copy.aboutText} onChange={(v) => setCopy('aboutText', v)} multiline rows={8} />
            </>
          )}

          {activeSection === 'testimonials' && (() => {
            // Only TintElite lets the owner pick the source (copy.reviewMode).
            // Every other template shows a connected Google widget in place
            // of the quotes, so there a source switch would do nothing.
            const googleKey = copy?.googleWidgetKey;
            // Templates with per-review sources (From Google labels + the
            // Google Rating listing) offer the widget/quotes switch only when
            // a widget is connected: without one, a "Google" choice there
            // would read like the listing and change nothing.
            const sourcesTemplate = has('reviewSources');
            const choosesSource = has('reviewMode') && (!sourcesTemplate || Boolean(googleKey));
            const mode = copy?.reviewMode === 'google' ? 'google' : 'testimonials';
            const showsGoogle = Boolean(googleKey) && (!choosesSource || mode === 'google');
            const quotes = Array.isArray(copy?.testimonialPlaceholders) ? copy.testimonialPlaceholders : [];
            return (
              <>
                {choosesSource && (
                  <>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Review Source</p>
                    <Toggle
                      value={mode}
                      onChange={(v) => setCopy('reviewMode', v)}
                      options={sourcesTemplate
                        ? [{ value: 'google', label: 'Live Google widget' }, { value: 'testimonials', label: 'Written quotes' }]
                        : [{ value: 'google', label: 'Google Reviews' }, { value: 'testimonials', label: 'Customer Quotes' }]}
                    />
                  </>
                )}

                {showsGoogle && (
                  <>
                    <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 mb-3">
                      <p className="text-[12px] font-semibold text-green-700">✓ Google Reviews connected</p>
                      <p className="text-[11px] text-green-700 leading-snug">
                        Your site shows your live Google reviews{choosesSource ? '.' : ' in place of written quotes.'}
                      </p>
                      <p className="text-[11px] text-green-600 break-all">Widget key: {googleKey}</p>
                    </div>
                    <Field label="Google Reviews Section Title" value={copy?.googleReviewsTitle ?? ''} onChange={(v) => setCopy('googleReviewsTitle', v)} />
                    <div className="mb-4">
                      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Widget Theme</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { value: '', label: 'Light', preview: 'bg-white border-gray-200' },
                          { value: 'dark', label: 'Dark', preview: 'bg-[#1a1f2e] border-[#252d42]' },
                          { value: 'gray', label: 'Gray', preview: 'bg-gray-100 border-gray-300' },
                          { value: 'colorful', label: 'Colorful', preview: 'bg-gradient-to-r from-blue-50 to-purple-50 border-purple-200' },
                          { value: 'minimal', label: 'Minimal', preview: 'bg-white border-gray-100' },
                          { value: 'warm', label: 'Warm', preview: 'bg-amber-50 border-amber-200' },
                        ].map(t => (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => setCopy('googleReviewsTheme', t.value)}
                            className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-[11px] font-medium transition-all ${
                              (copy?.googleReviewsTheme || '') === t.value
                                ? 'border-gray-900 bg-gray-50 text-gray-900'
                                : 'border-gray-200 text-gray-500 hover:border-gray-400'
                            }`}
                          >
                            <div className={`w-8 h-5 rounded border ${t.preview}`} />
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {!choosesSource && quotes.length > 0 && (
                      <p className="text-[11px] text-gray-500 mb-3 leading-snug">Your written quotes are kept, but not shown while Google Reviews are connected.</p>
                    )}
                  </>
                )}

                {!googleKey && choosesSource && mode === 'google' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-3">
                    <p className="text-[12px] font-semibold text-amber-700">No Google Reviews connected</p>
                    <p className="text-[11px] text-amber-700 leading-snug">Connect Google Reviews in the Finalize step. Until then your site shows the quotes below.</p>
                  </div>
                )}

                {!showsGoogle && (
                  <>
                    {!googleKey && !choosesSource && !sourcesTemplate && (
                      <p className="text-[11px] text-gray-500 mb-2 leading-snug">Connect Google Reviews in the Finalize step to show your live Google reviews here instead.</p>
                    )}
                    {!googleKey && sourcesTemplate && (
                      <p className="text-[11px] text-gray-500 mb-2 leading-snug">{'These written quotes are what your site shows. Your Google listing (Edit > Google Rating) adds the rating badge and links the quotes you mark From Google. A live Google reviews widget is a separate add-on, set up in the site wizard\'s Finalize step.'}</p>
                    )}
                    <p className="text-[11px] text-gray-500 mb-3 leading-snug">Use real quotes from real customers, with their permission. Replace or remove any sample text.</p>
                    {has('reviewSources') && <ReviewSourcesIntro googlePlace={businessInfo?.googlePlace} />}
                    {quotes.map((t, i) => (
                      <div key={i} className="mb-5 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Review {i + 1}</p>
                          <button type="button" onClick={() => removeTestimonial(i)} className="text-[11px] text-red-400 hover:text-red-600 transition">Remove</button>
                        </div>
                        <Field label="Review Text" value={t?.text} onChange={(v) => setTestimonial(i, 'text', v)} multiline rows={3} />
                        <Field label="Customer Name" value={t?.name} onChange={(v) => setTestimonial(i, 'name', v)} />
                        {has('reviewSources') && (
                          <TestimonialSourceFields testimonial={t} googlePlace={businessInfo?.googlePlace} onPatch={(patch) => setTestimonialFields(i, patch)} compact />
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={addTestimonial} className="w-full py-2 text-[12px] font-semibold text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-700 transition mb-2">+ Add Review</button>
                  </>
                )}
              </>
            );
          })()}

          {activeSection === 'headings' && (
            <HeadingsPanel copy={copy} setCopy={setCopy} sections={orderedSections} headingFields={templateInfo?.headingFields || null} hiddenSections={hiddenSections} businessInfo={businessInfo} headingDefaults={templateInfo?.headingDefaults || null} />
          )}

          {activeSection === 'featured' && (
            <FeaturedServicePanel copy={copy} setCopy={setCopy} businessInfo={businessInfo} images={images} setImage={setImage} siteId={siteId} hasHeadingsTab={has('sectionTitles')} headingDefaults={templateInfo?.headingDefaults || null} />
          )}

          {activeSection === 'makes' && (
            <Suspense fallback={<p className="text-[12px] text-gray-400 py-3">Loading makes…</p>}>
              <VehicleMakesPanel copy={copy} setCopy={setCopy} />
            </Suspense>
          )}

          {activeSection === 'google' && (
            <GoogleRatingPanel businessInfo={businessInfo} setBiz={setBiz} copy={copy} setCopy={setCopy} defaultPlacements={googleBadgeDefaults(templateId)} canEditBusiness={Boolean(onBusinessInfoChange)} />
          )}

          {activeSection === 'gallery' && (
            <GallerySlots images={images} setImage={setImage} siteId={siteId} gridNote={templateHelp(templateId, 'gallery')} />
          )}

          {activeSection === 'colors' && templateMeta && (
            <>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Colors</p>
              <p className="text-[11px] text-gray-400 mb-4">Click a swatch to change it. Changes apply live across the site.</p>
              {[
                { key: 'bg', label: 'Page Background', helper: 'Main color behind everything on the page' },
                { key: 'accent', label: 'Primary Brand Color', helper: 'Buttons, highlights, links, and featured icons' },
                { key: 'text', label: 'Main Text Color', helper: 'Headings and body paragraph color' },
                { key: 'secondary', label: 'Card & Section Background', helper: 'Panels, cards, and alternating section color' },
                { key: 'muted', label: 'Muted / Subtle Text', helper: 'Captions, labels, and metadata' },
              ].map(({ key, label, helper }) => {
                const base = templateMeta.colors[key] || '#000000';
                const val = customColors?.[key] ?? base;
                const isOverridden = Boolean(customColors?.[key]);
                return (
                  <div key={key} className="flex items-start justify-between gap-3 mb-3 pb-3 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-800 leading-tight">{label}</p>
                      <p className="text-[11px] text-gray-400 leading-snug mt-0.5">{helper}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      {isOverridden && (
                        <button onClick={() => onCustomColors(prev => { const n = { ...prev }; delete n[key]; return n; })}
                          className="text-[11px] text-gray-400 hover:text-red-500 transition">reset</button>
                      )}
                      <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-200 cursor-pointer shadow-sm" title={val}>
                        <div className="absolute inset-0" style={{ background: val }} />
                        <input type="color" value={val}
                          onChange={(e) => onCustomColors(prev => ({ ...prev, [key]: e.target.value }))}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                      </div>
                    </div>
                  </div>
                );
              })}
              {Object.keys(customColors || {}).length > 0 && (
                <button onClick={() => onCustomColors({})}
                  className="mt-2 text-[12px] text-gray-500 hover:text-red-500 border border-gray-200 rounded-lg px-3 py-1.5 w-full transition">
                  Reset to template colors
                </button>
              )}

              {/* Readability of what the site paints with these colors
                  (colorChecks.js), WCAG AA = 4.5:1 for body text. */}
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-5 mb-2">Readability</p>
              <div className="rounded-lg border border-gray-100 divide-y divide-gray-100 mb-1">
                {colorChecks(templateMeta.colors, { themeReady }).map((check) => (
                  <div key={check.id} className="flex items-start gap-2.5 px-2.5 py-2">
                    <span
                      className="shrink-0 w-9 h-7 rounded-md border border-gray-200 flex items-center justify-center text-[13px] font-bold"
                      style={{ background: check.bg, color: check.fg }}
                      aria-hidden="true"
                    >
                      Aa
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-medium text-gray-800 leading-tight">{check.label}</p>
                        <span className={`shrink-0 text-[11px] font-semibold border rounded px-1.5 py-px ${LEVEL_STYLE[check.level]}`}>
                          {LEVEL_LABEL[check.level]} {formatRatio(check.ratio)}
                        </span>
                      </div>
                      {check.adjustedFrom && (
                        <p className="text-[11px] text-gray-500 leading-snug mt-0.5">Your pick {check.adjustedFrom} is adjusted to {check.fg} on the site so it stays readable.</p>
                      )}
                      {!check.adjustedFrom && check.level !== 'AA' && check.level !== 'AAA' && (
                        <p className="text-[11px] text-gray-500 leading-snug mt-0.5">
                          {check.id === 'button'
                            ? 'Button labels will be hard to read. Pick a darker or lighter brand color.'
                            : 'Hard to read. Pick a color with more contrast against the background.'}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {onCustomFonts && (
                <>
                  <hr className="my-5 border-gray-100" />
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Fonts</p>
                  <p className="text-[11px] text-gray-400 mb-4">Pick a typeface for headings and body text. Changes apply live.</p>
                  {FONT_SLOTS.filter((slot) => templateMeta[slot.key] !== undefined).map((slot) => {
                    const base = templateMeta[slot.key];
                    const val = customFonts?.[slot.key] ?? base;
                    const isOverridden = Boolean(customFonts?.[slot.key]);
                    return (
                      <div key={slot.key} className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[13px] font-semibold text-gray-800">{slot.label}</label>
                          {isOverridden && (
                            <button onClick={() => onCustomFonts(prev => { const n = { ...prev }; delete n[slot.key]; return n; })}
                              className="text-[11px] text-gray-400 hover:text-red-500 transition">reset</button>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 mb-1.5 leading-snug">{slot.helper}</p>
                        <select
                          value={val}
                          onChange={(e) => onCustomFonts(prev => ({ ...prev, [slot.key]: e.target.value }))}
                          className="w-full text-[13px] text-gray-800 border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
                          style={{ fontFamily: val }}
                        >
                          {!slot.options.some((o) => o.family === val) && (
                            <option value={val}>Current ({val.replace(/'/g, '').split(',')[0]})</option>
                          )}
                          {slot.options.map((opt) => (
                            <option key={opt.family} value={opt.family} style={{ fontFamily: opt.family }}>{opt.label}</option>
                          ))}
                        </select>
                        <p className="text-[13px] mt-2 px-2 py-1.5 bg-gray-50 rounded border border-gray-100 truncate" style={{ fontFamily: val }}>
                          The quick brown fox jumps over the lazy dog
                        </p>
                      </div>
                    );
                  })}
                  {Object.keys(customFonts || {}).length > 0 && (
                    <button onClick={() => onCustomFonts({})}
                      className="mt-2 text-[12px] text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg px-3 py-1.5 w-full transition">
                      Reset all fonts to default
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {activeSection === 'contact' && (
            <>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Contact / CTA Section</p>
              {has('ctaImage') && <CtaPhotoField images={images} setImage={setImage} siteId={siteId} hidden={hiddenSections.includes('cta')} />}
              <Field label="Headline" value={copy?.ctaHeadline} onChange={(v) => setCopy('ctaHeadline', v)} help={has('sectionTitles') ? 'Highlighted words: Edit > Headings.' : undefined} />
              <Field label="Subtext" value={copy?.ctaSubtext} onChange={(v) => setCopy('ctaSubtext', v)} multiline rows={2} />
              <hr className="my-3 border-gray-100" />
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Primary Button</p>
              <Field label="Button Text" value={copy?.ctaButtonText} onChange={(v) => setCopy('ctaButtonText', v)} />
              <Field label="Button URL" value={copy?.ctaUrl} onChange={(v) => setCopy('ctaUrl', v)} />
              {has('ctaSecondaryText') && (
                <>
                  <hr className="my-3 border-gray-100" />
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Phone / Secondary Button</p>
                  <Field label="Button Text (default: phone number)" value={copy?.ctaSecondaryText} onChange={(v) => setCopy('ctaSecondaryText', v)} />
                  {has('ctaSecondaryUrl') && (
                    <Field
                      label="Button URL (default: tel:phone)"
                      value={copy?.ctaSecondaryUrl}
                      onChange={(v) => setCopy('ctaSecondaryUrl', v)}
                      help="Also the link of Button 2 in Hero."
                    />
                  )}
                </>
              )}
            </>
          )}

          {activeSection === 'footer' && (
            <>
              <Field label="Footer Tagline" value={copy.footerTagline} onChange={(v) => setCopy('footerTagline', v)} />
              <div className="mt-4 mb-2">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Social Icons</p>
                <p className="text-[11px] text-gray-500 mb-3">Choose which social icons appear on your site.</p>
                {[
                  { key: 'hideInstagram', label: 'Instagram', handle: businessInfo?.instagram },
                  { key: 'hideFacebook', label: 'Facebook', handle: businessInfo?.facebook },
                  { key: 'hideTiktok', label: 'TikTok', handle: businessInfo?.tiktok },
                ].map(({ key, label, handle }) => {
                  // An icon only shows with a handle to link to, so without
                  // one the switch would do nothing.
                  const hasHandle = typeof handle === 'string' && handle.trim() !== '';
                  return (
                    <div key={key} className="py-2 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className={`text-[13px] ${hasHandle ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
                        <Switch on={hasHandle && !images?.[key]} onChange={() => setImage(key, !images?.[key])} label={`Show ${label} icon`} disabled={!hasHandle} />
                      </div>
                      {!hasHandle && <p className="text-[11px] text-gray-500 mt-0.5">Add your {label} {label === 'Facebook' ? 'page URL' : 'handle'} in Business Info first.</p>}
                    </div>
                  );
                })}
              </div>
              {has('footerBuilder') && <FooterBuilderPanel copy={copy} setCopy={setCopy} hasGoogleTab={has('googleBadge')} businessInfo={businessInfo} />}
            </>
          )}

          {activeSection === 'business' && onBusinessInfoChange && (
            <>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Business Details</p>
              <p className="text-[11px] text-gray-400 mb-4 leading-snug">
                Changes save automatically. Hit Republish on the dashboard once done so live visitors see them.
              </p>
              <Field label="Business Name" value={businessInfo?.businessName} onChange={(v) => setBiz('businessName', v)} />
              <PhoneField label="Phone" value={businessInfo?.phone} onChange={(v) => setBiz('phone', v)} />
              <Field label="Email" value={businessInfo?.email} onChange={(v) => setBiz('email', v)} />
              <Field label="Street Address" value={businessInfo?.address} onChange={(v) => setBiz('address', v)} />
              <Field label="City" value={businessInfo?.city} onChange={(v) => setBiz('city', v)} />
              <Field label="State" value={businessInfo?.state} onChange={(v) => setBiz('state', v)} />
              <BusinessExtrasPanel businessInfo={businessInfo} setBiz={setBiz} showAreas={has('serviceAreas')} showInsured={has('insured')} />
              <Field label="Tagline" value={businessInfo?.tagline} onChange={(v) => setBiz('tagline', v)} />
              <DayHoursEditor label="Business Hours" value={businessInfo?.hours} onChange={(v) => setBiz('hours', v)} />
              <Field label="Years in Business" value={businessInfo?.yearsInBusiness} onChange={(v) => setBiz('yearsInBusiness', v)} />
              <Field label="Awards" value={businessInfo?.awards} onChange={(v) => setBiz('awards', v)} />
              <Field label="Instagram Handle" value={businessInfo?.instagram} onChange={(v) => setBiz('instagram', v)} />
              <Field label="Facebook Page URL" value={businessInfo?.facebook} onChange={(v) => setBiz('facebook', v)} />
              <Field label="TikTok Handle" value={businessInfo?.tiktok} onChange={(v) => setBiz('tiktok', v)} />
            </>
          )}

          {activeSection === 'template' && onSwitchTemplate && (() => {
            const typeInfo = BUSINESS_TYPES.find((t) => t.id === businessType);
            const recommendedIds = new Set([
              ...(typeInfo?.templates || []),
              ...(typeInfo?.premiumTemplates || []),
            ]);
            const templates = Object.values(TEMPLATES)
              .filter((t) => t && !t.hidden)
              .sort((a, b) => {
                const aRec = recommendedIds.has(a.id) ? 0 : 1;
                const bRec = recommendedIds.has(b.id) ? 0 : 1;
                return aRec - bRec;
              });

            const handlePick = async (newId) => {
              if (newId === templateId) return;
              const ok = await confirmDialog(
                `Switch to "${TEMPLATES[newId]?.label || newId}"? Your text, images, and content stay the same — only the design changes. Custom colors and fonts will reset to the new template's defaults.`,
                { title: 'Switch template?', confirmText: 'Switch' }
              );
              if (!ok) return;
              onSwitchTemplate(newId);
            };

            return (
              <>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Switch Template</p>
                <p className="text-[11px] text-gray-400 mb-4 leading-snug">
                  Pick a different design — your content stays the same. Custom colors/fonts reset to the new template's defaults.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {templates.map((t) => {
                    const [c1, c2, c3] = t.previewColors || ['#111', '#cc0000', '#222'];
                    const isCurrent = t.id === templateId;
                    const isRecommended = recommendedIds.has(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handlePick(t.id)}
                        disabled={isCurrent}
                        className={`relative flex flex-col rounded-lg border overflow-hidden transition-all text-left ${
                          isCurrent
                            ? 'border-[#cc0000] ring-2 ring-[#cc0000]/30 cursor-default'
                            : 'border-gray-200 hover:border-[#cc0000]/40 cursor-pointer'
                        }`}
                      >
                        {isCurrent && (
                          <span className="absolute top-1.5 right-1.5 z-10 bg-[#cc0000] text-white text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded">
                            Current
                          </span>
                        )}
                        {!isCurrent && isRecommended && (
                          <span className="absolute top-1.5 right-1.5 z-10 bg-[#1a1a1a] text-white text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded">
                            ★
                          </span>
                        )}
                        <div className="h-16 flex flex-col" style={{ background: c1 }}>
                          <div className="flex items-center px-2 py-1 gap-1.5">
                            <div className="w-1 h-1 rounded-full" style={{ background: c2, opacity: 0.9 }} />
                            <div className="h-0.5 rounded-full w-8" style={{ background: c2, opacity: 0.5 }} />
                          </div>
                          <div className="flex-1 flex flex-col justify-center px-2 gap-0.5">
                            <div className="h-0.5 rounded-full w-3/4" style={{ background: c2, opacity: 0.8 }} />
                            <div className="h-0.5 rounded-full w-1/2" style={{ background: c2, opacity: 0.4 }} />
                          </div>
                          <div className="flex gap-0.5 px-2 pb-1">
                            {[0,1,2].map((i) => <div key={i} className="flex-1 h-2 rounded-sm" style={{ background: c3, opacity: 0.85 }} />)}
                          </div>
                        </div>
                        <div className="p-2 border-t border-gray-100 bg-white">
                          <p className="text-[11px] font-semibold text-gray-800 leading-tight truncate">{t.label}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            );
          })()}

        </div>
          </div>
        </div>
      </div>
    </>
  );
}
