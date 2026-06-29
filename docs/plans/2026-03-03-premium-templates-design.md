# Premium Templates Tab — Design Document

**Date:** 2026-03-03
**Status:** Approved

## Summary

Separate the 7 mockup-based templates from the regular themes by introducing a **tabbed UI** ("Themes" / "Premium") in the template picker. Premium templates are the high-fidelity designs ported from the `WebsiteMockups/` HTML files. Regular themes are the simpler, color-driven layouts.

## Motivation

The mockup-based templates have significantly more visual polish (custom fonts, animations, advanced layouts) compared to the standard themes. Presenting them as "Premium" options creates a clear value tier and keeps the template picker organized.

## Design

### Data Layer Changes

#### `templates.js`
Add `tier: 'premium'` to these 7 template entries:
- `detailing_autosync_dark`
- `detailing_autosync_white`
- `carwash_bubble`
- `mechanic_ironclad`
- `tint_obsidian`
- `wheel_apex`
- `mobile_sudsy`

All other templates default to `tier: undefined` (treated as regular).

#### `businessTypes.js`
Split each business type's template list into two arrays:

```js
{
  id: 'detailing_shop',
  templates: ['detailing_premium', 'detailing_sporty', 'detailing_minimal', 'detailing_coastal'],
  premiumTemplates: ['detailing_autosync_dark', 'detailing_autosync_white'],
}
```

Full mapping:

| Business Type    | Regular Themes                              | Premium Templates                              |
|------------------|---------------------------------------------|------------------------------------------------|
| detailing_shop   | premium, sporty, minimal, coastal           | autosync_dark, autosync_white                  |
| mobile_detailing | bold, modern, rugged, chrome                | sudsy                                          |
| wheel_shop       | edge, clean                                 | apex                                           |
| tint_shop        | dark, sleek, elite                          | obsidian                                       |
| mechanic_shop    | industrial, friendly, garage                | ironclad                                       |
| car_wash         | *(none)*                                    | bubble                                         |

**Car wash edge case:** Since car_wash has 0 regular themes, either:
- Hide the tab bar entirely and just show premium templates, OR
- Show the Themes tab with a "More themes coming soon" message

### UI Changes (`StepTemplatePicker.jsx`)

Add a tab bar below the heading, above the template grid:

```
┌──────────────────────────────────────────┐
│  Choose a website style                  │
│  AI will write all the copy...           │
│                                          │
│  ┌──────────┐ ┌───────────────┐          │
│  │  Themes  │ │  Premium ✨   │          │
│  └──────────┘ └───────────────┘          │
│                                          │
│  ┌────┐ ┌────┐ ┌────┐                   │
│  │    │ │    │ │    │  (template grid)   │
│  └────┘ └────┘ └────┘                   │
│                                          │
│  [ Customize Colors ]                    │
│  [ Generate My Website ]                 │
└──────────────────────────────────────────┘
```

**Tab behavior:**
- Default to "Themes" tab (or "Premium" if no regular themes exist)
- Selecting a template from either tab works identically
- Tab selection is local state only
- If user selects a template then switches tabs, the selection persists (highlighted if visible)
- Color customizer and Generate button remain below, unchanged

**Tab styling:**
- Pill-style tabs matching the existing gray/white aesthetic
- Active tab: `bg-gray-900 text-white`
- Inactive tab: `bg-gray-100 text-gray-600 hover:bg-gray-200`
- Premium tab gets a subtle ✨ emoji or sparkle icon

### What Does NOT Change

- Template React components (no modifications)
- `TEMPLATE_COMPONENT_MAP` in `templates.js` (no changes)
- AI generation flow (prompt, API call, response handling)
- Preview system (`WebsitePreview.jsx`, `PreviewToolbar.jsx`, `ContentEditor.jsx`)
- HTML export (`exportHtml.js`)
- Business info forms
- Demo data / Fill Demo button

## Files Modified

1. `src/data/templates.js` — Add `tier: 'premium'` to 7 entries
2. `src/data/businessTypes.js` — Split `templates` into `templates` + `premiumTemplates`
3. `src/components/wizard/StepTemplatePicker.jsx` — Add tab UI, filter templates by active tab

## Implementation Estimate

~30 minutes. Three files, minimal logic changes, purely additive UI.
