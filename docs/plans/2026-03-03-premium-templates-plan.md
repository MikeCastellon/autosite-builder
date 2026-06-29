# Premium Templates Tab — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separate the 7 mockup-based templates into a "Premium" tab in the template picker, distinct from the regular "Themes" tab.

**Architecture:** Add a `tier` field to template metadata, split business type template arrays into regular/premium, and add a tabbed UI to StepTemplatePicker. No changes to template components, AI generation, preview, or export.

**Tech Stack:** React 19, Vite, TailwindCSS (utility classes via className strings)

---

### Task 1: Add `tier` field to premium template entries

**Files:**
- Modify: `src/data/templates.js` (lines for each of the 7 premium entries)

**Step 1: Add `tier: 'premium'` to all 7 mockup-based template entries**

Add the field after the `mood` line in each entry:

```js
// In detailing_autosync_dark (around line 232):
  detailing_autosync_dark: {
    id: 'detailing_autosync_dark',
    businessType: 'detailing_shop',
    // ... existing fields ...
    mood: 'luxury, premium, sophisticated, dark, exclusive',
    tier: 'premium',
  },
```

Do the same for these 7 entries:
- `detailing_autosync_dark` (line ~232)
- `detailing_autosync_white` (line ~244)
- `carwash_bubble` (line ~269)
- `mechanic_ironclad` (line ~256)
- `tint_obsidian` (line ~193)
- `wheel_apex` (line ~219)
- `mobile_sudsy` (line ~206)

**Step 2: Verify no syntax errors**

Run: `npm run lint` from project root
Expected: No new errors

**Step 3: Commit**

```bash
git add src/data/templates.js
git commit -m "feat: add tier field to premium template entries"
```

---

### Task 2: Split business type template arrays into regular + premium

**Files:**
- Modify: `src/data/businessTypes.js` (lines 1-44, the BUSINESS_TYPES array)

**Step 1: Update each business type to have separate `templates` and `premiumTemplates` arrays**

Replace the current BUSINESS_TYPES array entries with:

```js
export const BUSINESS_TYPES = [
  {
    id: 'detailing_shop',
    label: 'Car Detailing Shop',
    icon: '✨',
    description: 'Fixed-location detailing studio',
    templates: ['detailing_premium', 'detailing_sporty', 'detailing_minimal', 'detailing_coastal'],
    premiumTemplates: ['detailing_autosync_dark', 'detailing_autosync_white'],
  },
  {
    id: 'mobile_detailing',
    label: 'Mobile Detailing',
    icon: '🚐',
    description: 'On-the-go mobile detailing service',
    templates: ['mobile_bold', 'mobile_modern', 'mobile_rugged', 'mobile_chrome'],
    premiumTemplates: ['mobile_sudsy'],
  },
  {
    id: 'wheel_shop',
    label: 'Wheel Shop',
    icon: '🔧',
    description: 'Custom wheels, tires & fitment',
    templates: ['wheel_edge', 'wheel_clean'],
    premiumTemplates: ['wheel_apex'],
  },
  {
    id: 'tint_shop',
    label: 'Tint Shop',
    icon: '🌑',
    description: 'Window tint & paint protection film',
    templates: ['tint_dark', 'tint_sleek', 'tint_elite'],
    premiumTemplates: ['tint_obsidian'],
  },
  {
    id: 'mechanic_shop',
    label: 'Mechanic Shop',
    icon: '🔩',
    description: 'Auto repair & maintenance',
    templates: ['mechanic_industrial', 'mechanic_friendly', 'mechanic_garage'],
    premiumTemplates: ['mechanic_ironclad'],
  },
  {
    id: 'car_wash',
    label: 'Car Wash',
    icon: '🫧',
    description: 'Automated or hand car wash',
    templates: [],
    premiumTemplates: ['carwash_bubble'],
  },
];
```

**Step 2: Verify no syntax errors**

Run: `npm run lint` from project root
Expected: No new errors

**Step 3: Commit**

```bash
git add src/data/businessTypes.js
git commit -m "feat: split template arrays into regular and premium per business type"
```

---

### Task 3: Add tabbed UI to StepTemplatePicker

**Files:**
- Modify: `src/components/wizard/StepTemplatePicker.jsx`

**Step 1: Add `useState` import and tab state**

Add `useState` to the React import at the top of the file. The file currently has no React import (it uses JSX transform), so add:

```js
import { useState } from 'react';
```

**Step 2: Replace the component logic to support tabs**

Replace the entire `StepTemplatePicker` function (lines 33-113) with:

```jsx
export default function StepTemplatePicker({ businessType, selected, onSelect, onGenerate, onPreview, error, customColors, onCustomColors }) {
  const typeInfo = BUSINESS_TYPES.find((t) => t.id === businessType);
  const regularIds = typeInfo?.templates || [];
  const premiumIds = typeInfo?.premiumTemplates || [];
  const hasRegular = regularIds.length > 0;
  const hasPremium = premiumIds.length > 0;
  const hasBothTabs = hasRegular && hasPremium;

  // Default to 'themes' if regular templates exist, otherwise 'premium'
  const [activeTab, setActiveTab] = useState(hasRegular ? 'themes' : 'premium');

  const activeIds = activeTab === 'themes' ? regularIds : premiumIds;
  const activeTemplates = activeIds.map((id) => TEMPLATES[id]).filter(Boolean);
  const selectedTpl = selected ? TEMPLATES[selected] : null;

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{typeInfo?.label}</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Choose a website style</h1>
        <p className="text-gray-500 text-[15px]">
          AI will write all the copy — just pick the look and feel that fits your brand.
        </p>
      </div>

      {/* Tab bar — only show if both tabs have templates */}
      {hasBothTabs && (
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('themes')}
            className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${
              activeTab === 'themes'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Themes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('premium')}
            className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${
              activeTab === 'premium'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Premium ✨
          </button>
        </div>
      )}

      {/* Template grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {activeTemplates.map((template) => (
          <div key={template.id} className="flex flex-col gap-1.5">
            <TemplateCard
              template={template}
              selected={selected}
              onClick={onSelect}
            />
            <button
              type="button"
              onClick={() => onPreview(template.id)}
              className="w-full text-[12px] font-medium text-gray-500 hover:text-gray-900 py-1.5 border border-gray-200 hover:border-gray-400 rounded-lg transition-colors"
            >
              Preview Demo
            </button>
          </div>
        ))}
      </div>

      {/* Color customizer — shown when a template is selected */}
      {selectedTpl && (
        <div className="mb-6 p-4 border border-gray-200 rounded-xl bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[13px] font-semibold text-gray-800">Customize Colors</p>
              <p className="text-[12px] text-gray-500">Click any swatch to change it</p>
            </div>
            {Object.keys(customColors).length > 0 && (
              <button
                onClick={() => onCustomColors({})}
                className="text-[12px] text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-400 rounded-lg px-3 py-1 transition-colors"
              >
                Reset all
              </button>
            )}
          </div>
          <div className="flex items-start gap-5 flex-wrap">
            <ColorSwatch label="Background" colorKey="bg" baseColor={selectedTpl.colors.bg} customColors={customColors} onCustomColors={onCustomColors} />
            <ColorSwatch label="Accent / Brand" colorKey="accent" baseColor={selectedTpl.colors.accent} customColors={customColors} onCustomColors={onCustomColors} />
            <ColorSwatch label="Text" colorKey="text" baseColor={selectedTpl.colors.text} customColors={customColors} onCustomColors={onCustomColors} />
            <ColorSwatch label="Surface" colorKey="secondary" baseColor={selectedTpl.colors.secondary} customColors={customColors} onCustomColors={onCustomColors} />
            <ColorSwatch label="Muted Text" colorKey="muted" baseColor={selectedTpl.colors.muted} customColors={customColors} onCustomColors={onCustomColors} />
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error} — please try again.
        </div>
      )}

      <button
        onClick={onGenerate}
        disabled={!selected}
        className={`w-full font-semibold py-3.5 px-6 rounded-lg transition-all text-[15px]
          ${selected
            ? 'bg-gray-900 hover:bg-gray-800 text-white cursor-pointer'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
      >
        {selected ? 'Generate My Website' : 'Select a style to continue'}
      </button>
    </div>
  );
}
```

**Step 3: Verify no lint errors**

Run: `npm run lint` from project root
Expected: No new errors

**Step 4: Commit**

```bash
git add src/components/wizard/StepTemplatePicker.jsx
git commit -m "feat: add Themes/Premium tab UI to template picker"
```

---

### Task 4: Visual verification

**Step 1: Start the dev server**

Run: `npm run dev` from project root
Expected: Vite dev server starts on http://localhost:5173

**Step 2: Walk through the wizard for each business type**

For each of the 6 business types:
1. Select the business type
2. Click "Fill Demo" to populate form fields
3. Advance to template picker step
4. Verify:
   - **Detailing Shop:** Two tabs visible. Themes tab shows 4 templates (Premium Luxury, Bold & Sporty, Clean & Minimal, Coastal Fresh). Premium tab shows 2 (AutoSync Dark, AutoSync White).
   - **Mobile Detailing:** Two tabs. Themes: 4 (Bold & Mobile, Modern & Clean, Rugged & Tough, Chrome Elite). Premium: 1 (Bright & Bubbly).
   - **Wheel Shop:** Two tabs. Themes: 2 (Sharp Edge, Clean & Pro). Premium: 1 (Apex Modern).
   - **Tint Shop:** Two tabs. Themes: 3 (Dark & Sleek, Modern Sleek, Elite Gold). Premium: 1 (Obsidian Studio).
   - **Mechanic Shop:** Two tabs. Themes: 3 (Industrial, Friendly & Local, Raw Garage). Premium: 1 (Ironclad).
   - **Car Wash:** NO tabs (only premium exists). Shows 1 template (Bubble Rush) directly.
5. Select a template from Premium tab, verify color customizer appears
6. Click "Generate My Website" or "Preview Demo" — verify it works the same as before

**Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address any issues found during visual verification"
```
