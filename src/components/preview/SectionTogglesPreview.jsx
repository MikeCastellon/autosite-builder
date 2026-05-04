import { useState } from 'react';

// Local-only preview of three redesigns for the section visibility panel
// in src/components/preview/ContentEditor.jsx. Mounted at /dev/section-toggles.
// Delete this file (and the route guard in App.jsx) once a direction is picked.

const MOCK_SECTIONS = [
  { id: 'hero',         label: 'Hero',         icon: '🏞️', summary: 'Headline, sub-copy, two CTA buttons' },
  { id: 'statsBar',     label: 'Stats Bar',    icon: '📊', summary: '4 quick numbers — years, jobs, ratings' },
  { id: 'services',     label: 'Services',     icon: '🛠️', summary: 'List of services with descriptions' },
  { id: 'about',        label: 'About',        icon: '👤', summary: 'Owner bio + photo' },
  { id: 'gallery',      label: 'Gallery',      icon: '🖼️', summary: '6-photo grid' },
  { id: 'testimonials', label: 'Reviews',      icon: '⭐', summary: 'Pulled from Google or AI testimonials' },
  { id: 'cta',          label: 'Contact / CTA', icon: '📞', summary: 'Phone, hours, contact form' },
  { id: 'awards',       label: 'Awards',       icon: '🏆', summary: 'Certifications & recognition' },
];

function ToggleSwitch({ on, onClick }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${on ? 'bg-gray-900' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// VARIANT A — Small: icons + per-row "Edit →" jump button. Same flat
// list, drag-to-reorder, but each row gives a visual + a 1-tap shortcut
// into the section's editing tab.
// ─────────────────────────────────────────────────────────────────────
function VariantA({ hidden, setHidden, jumpedTo, setJumpedTo }) {
  const isHidden = (id) => hidden.includes(id);
  const toggle = (id) => setHidden(isHidden(id) ? hidden.filter(s => s !== id) : [...hidden, id]);
  return (
    <div>
      <p className="text-[11px] text-gray-400 mb-4">Drag to reorder · toggle to show/hide.</p>
      {MOCK_SECTIONS.map(({ id, label, icon }) => (
        <div key={id} className="flex items-center gap-2.5 py-2.5 border-b border-gray-100 select-none group">
          <span className="text-gray-300 hover:text-gray-500 cursor-grab shrink-0 text-[14px] leading-none">⠿</span>
          <span className="text-[14px] shrink-0 w-5 text-center" aria-hidden="true">{icon}</span>
          <span className={`flex-1 text-[13px] font-medium ${isHidden(id) ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{label}</span>
          <button
            type="button"
            onClick={() => setJumpedTo(`A:${label}`)}
            className="opacity-0 group-hover:opacity-100 text-[11px] font-semibold text-blue-600 hover:underline transition-opacity"
          >
            Edit →
          </button>
          <ToggleSwitch on={!isHidden(id)} onClick={() => toggle(id)} />
        </div>
      ))}
      {jumpedTo?.startsWith('A:') && (
        <p className="mt-3 text-[11px] text-blue-600">Would jump to: <span className="font-semibold">{jumpedTo.slice(2)}</span> tab</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// VARIANT B — Medium: split into "Visible" and "Hidden" groups with a
// summary count, icons, jump-to-edit. Toggling moves a row between
// groups so it's obvious what's currently showing on the site.
// ─────────────────────────────────────────────────────────────────────
function VariantB({ hidden, setHidden, jumpedTo, setJumpedTo }) {
  const isHidden = (id) => hidden.includes(id);
  const toggle = (id) => setHidden(isHidden(id) ? hidden.filter(s => s !== id) : [...hidden, id]);
  const visible = MOCK_SECTIONS.filter(s => !isHidden(s.id));
  const hiddenList = MOCK_SECTIONS.filter(s => isHidden(s.id));

  const Row = ({ s, dim }) => (
    <div className="flex items-center gap-2.5 py-2.5 border-b border-gray-100 select-none group">
      <span className="text-gray-300 hover:text-gray-500 cursor-grab shrink-0 text-[14px] leading-none">⠿</span>
      <span className="text-[14px] shrink-0 w-5 text-center" aria-hidden="true">{s.icon}</span>
      <span className={`flex-1 text-[13px] font-medium ${dim ? 'text-gray-400' : 'text-gray-700'}`}>{s.label}</span>
      <button
        type="button"
        onClick={() => setJumpedTo(`B:${s.label}`)}
        className="opacity-0 group-hover:opacity-100 text-[11px] font-semibold text-blue-600 hover:underline transition-opacity"
      >
        Edit →
      </button>
      <ToggleSwitch on={!isHidden(s.id)} onClick={() => toggle(s.id)} />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-gray-400">Drag to reorder · toggle to show/hide</p>
        <p className="text-[11px] font-semibold text-gray-500">
          {visible.length} visible · {hiddenList.length} hidden
        </p>
      </div>

      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 inline-block px-2 py-0.5 rounded mb-1">
          Visible on site
        </p>
        {visible.map(s => <Row key={s.id} s={s} dim={false} />)}
        {visible.length === 0 && (
          <p className="text-[12px] text-gray-400 italic py-3">No visible sections — toggle one on below.</p>
        )}
      </div>

      {hiddenList.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 inline-block px-2 py-0.5 rounded mb-1">
            Hidden
          </p>
          {hiddenList.map(s => <Row key={s.id} s={s} dim={true} />)}
        </div>
      )}

      {jumpedTo?.startsWith('B:') && (
        <p className="mt-3 text-[11px] text-blue-600">Would jump to: <span className="font-semibold">{jumpedTo.slice(2)}</span> tab</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// VARIANT C — Large: card-style rows with icon, label, a one-line
// summary of what the section contains, prominent "Edit" button, and
// a hidden-state visual treatment.
// ─────────────────────────────────────────────────────────────────────
function VariantC({ hidden, setHidden, jumpedTo, setJumpedTo }) {
  const isHidden = (id) => hidden.includes(id);
  const toggle = (id) => setHidden(isHidden(id) ? hidden.filter(s => s !== id) : [...hidden, id]);
  const visible = MOCK_SECTIONS.filter(s => !isHidden(s.id));
  const hiddenList = MOCK_SECTIONS.filter(s => isHidden(s.id));

  const Card = ({ s, dim }) => (
    <div className={`flex items-stretch gap-3 mb-2 rounded-xl border transition ${
      dim
        ? 'bg-gray-50 border-gray-200 opacity-70'
        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
    }`}>
      <div className={`w-1.5 rounded-l-xl shrink-0 ${dim ? 'bg-gray-300' : 'bg-gradient-to-b from-blue-500 to-indigo-500'}`} />
      <div className="flex items-center gap-3 py-2.5 pr-3 flex-1 min-w-0">
        <span className="text-gray-300 hover:text-gray-500 cursor-grab shrink-0 text-[14px] leading-none">⠿</span>
        <span className="text-[18px] shrink-0 w-6 text-center" aria-hidden="true">{s.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-semibold truncate ${dim ? 'text-gray-500' : 'text-gray-900'}`}>{s.label}</p>
          <p className="text-[11px] text-gray-400 truncate">{s.summary}</p>
        </div>
        <button
          type="button"
          onClick={() => setJumpedTo(`C:${s.label}`)}
          className="shrink-0 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition"
        >
          Edit
        </button>
        <ToggleSwitch on={!isHidden(s.id)} onClick={() => toggle(s.id)} />
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-gray-400">Drag to reorder</p>
        <p className="text-[11px] font-semibold text-gray-500">
          {visible.length} visible · {hiddenList.length} hidden
        </p>
      </div>

      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-2">
          Visible on site
        </p>
        {visible.map(s => <Card key={s.id} s={s} dim={false} />)}
      </div>

      {hiddenList.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Hidden</p>
          {hiddenList.map(s => <Card key={s.id} s={s} dim={true} />)}
        </div>
      )}

      {jumpedTo?.startsWith('C:') && (
        <p className="mt-3 text-[11px] text-blue-600">Would jump to: <span className="font-semibold">{jumpedTo.slice(2)}</span> tab</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CURRENT — for reference: the panel exactly as it ships today.
// ─────────────────────────────────────────────────────────────────────
function VariantCurrent({ hidden, setHidden }) {
  const isHidden = (id) => hidden.includes(id);
  const toggle = (id) => setHidden(isHidden(id) ? hidden.filter(s => s !== id) : [...hidden, id]);
  return (
    <div>
      <p className="text-[11px] text-gray-400 mb-4">Drag to reorder · toggle to show/hide.</p>
      {MOCK_SECTIONS.map(({ id, label }) => (
        <div key={id} className="flex items-center gap-2.5 py-2.5 border-b border-gray-100 select-none">
          <span className="text-gray-300 hover:text-gray-500 cursor-grab shrink-0 text-[14px] leading-none">⠿</span>
          <span className={`flex-1 text-[13px] font-medium ${isHidden(id) ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{label}</span>
          <ToggleSwitch on={!isHidden(id)} onClick={() => toggle(id)} />
        </div>
      ))}
    </div>
  );
}

function PanelFrame({ title, children }) {
  return (
    <div className="w-80 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col" style={{ minHeight: 600 }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <p className="text-[13px] font-semibold text-gray-900">{title}</p>
          <p className="text-[11px] text-gray-400">Sections</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {children}
      </div>
    </div>
  );
}

export default function SectionTogglesPreview() {
  const [hiddenA, setHiddenA] = useState([]);
  const [hiddenB, setHiddenB] = useState(['awards']);
  const [hiddenC, setHiddenC] = useState(['awards', 'statsBar']);
  const [hiddenCur, setHiddenCur] = useState([]);
  const [jumpedTo, setJumpedTo] = useState(null);

  return (
    <div className="min-h-screen bg-[#faf9f7] p-8">
      <div className="max-w-[1700px] mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Section Toggles — Design Variants</h1>
        <p className="text-sm text-gray-600 mb-8">
          Mock-up only. Hover a row to reveal the "Edit" jump button. Toggle to see how each variant handles hidden sections.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Current (today)</p>
            <PanelFrame title="Edit Content">
              <VariantCurrent hidden={hiddenCur} setHidden={setHiddenCur} />
            </PanelFrame>
          </div>
          <div>
            <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-2">A · Small</p>
            <p className="text-[12px] text-gray-500 mb-2">Icons + hover "Edit →" jump button</p>
            <PanelFrame title="Edit Content">
              <VariantA hidden={hiddenA} setHidden={setHiddenA} jumpedTo={jumpedTo} setJumpedTo={setJumpedTo} />
            </PanelFrame>
          </div>
          <div>
            <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-2">B · Medium</p>
            <p className="text-[12px] text-gray-500 mb-2">Visible / Hidden groups + count + icons + jump</p>
            <PanelFrame title="Edit Content">
              <VariantB hidden={hiddenB} setHidden={setHiddenB} jumpedTo={jumpedTo} setJumpedTo={setJumpedTo} />
            </PanelFrame>
          </div>
          <div>
            <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-2">C · Large</p>
            <p className="text-[12px] text-gray-500 mb-2">Card rows with summary + colored stripe + prominent Edit</p>
            <PanelFrame title="Edit Content">
              <VariantC hidden={hiddenC} setHidden={setHiddenC} jumpedTo={jumpedTo} setJumpedTo={setJumpedTo} />
            </PanelFrame>
          </div>
        </div>

        <div className="mt-10 p-4 bg-white border border-gray-200 rounded-xl text-[13px] text-gray-700">
          <p className="font-semibold mb-2">How to read these:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Current</strong> — exactly what ships today, for reference.</li>
            <li><strong>A · Small</strong> — minimal change. Adds a section icon and a hover-revealed "Edit →" link that jumps you to that section's edit tab.</li>
            <li><strong>B · Medium</strong> — adds A's improvements, plus splits the list into "Visible on site" and "Hidden" groups with a count, so you instantly see what's showing.</li>
            <li><strong>C · Large</strong> — every row becomes a card with a one-line summary, a colored stripe, and a prominent Edit button. Most polished, biggest visual change.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
