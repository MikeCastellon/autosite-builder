// The Design Studio's live preview: the custom site as the setup page has it
// configured, built into the same HTML a publish produces (exportHtml.js),
// before Claude has written anything or before a rewrite runs.
//
// buildPreviewInput() mirrors custom-site-design-background.js: business
// details go through sanitizeDesign + siteBusinessInfo (the shape the sites
// row stores), and leverPatch() (designLevers.js) lands where the run puts
// it: copy keys into the copy, info into business_info, colors over the
// brand accent, fonts into _customFonts. So the preview cannot show a design
// the run would not write.
//
// Browser-side only: it imports siteRender.js and exportHtml.js, which load
// the template registry. The background function must not import this file
// (its bundle may not include the React templates); it uses leverPatch
// directly.
import { buildTemplateMeta } from '../../../lib/siteRender.js';
import { exportHtmlString } from '../../../lib/exportHtml.js';
import { TEMPLATES } from '../../../data/templates.js';
import { COLOR_ROLES, leverPatch } from '../../../lib/designLevers.js';
import {
  DESIGN_OWNED_INFO, fillPackageDescriptions, sanitizeDesign, schemaTypeFor, siteBusinessInfo,
} from '../../../lib/customSiteDesign.js';

// Marks every placeholder paragraph the preview invents before Claude has
// written the copy, so nobody mistakes it for the real text.
export const SAMPLE_TAG = '[Sample text]';

// The frames' sandbox: scripts run (Tailwind CDN, the site runtime) in an
// opaque origin, so neither they nor anything the page loads can read the
// admin's session. Never add allow-same-origin: a srcdoc frame with it IS
// the admin app's origin. Popups may escape so external links (maps,
// Instagram) open as normal tabs.
export const PREVIEW_SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox';

// postMessage type the framed page reports its scroll position with, so a
// re-render can reopen at the same spot.
export const PREVIEW_SCROLL_MESSAGE = 'acg-design-preview-scroll';

const HEX = /^#[0-9a-f]{6}$/i;
const TEXT_KEYS = ['headline', 'subheadline', 'aboutText'];

function line(v) {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
}

// Has Claude (or the editor) written this copy? Lever-only keys such as
// sectionOrder don't count.
export function hasWrittenCopy(copy) {
  return !!copy && typeof copy === 'object' && TEXT_KEYS.some((k) => line(copy[k]));
}

// Placeholder copy from the business details alone, in the shape
// normalizeDesignCopy returns. Facts only (name, place, the services the
// customer gave); no ratings, years, awards, prices or reviews, and every
// invented sentence starts with SAMPLE_TAG. The "why us" answer stays out:
// templates that show it already do so as its own fact.
export function sampleCopy(businessInfo) {
  const bi = businessInfo && typeof businessInfo === 'object' ? businessInfo : {};
  const name = line(bi.businessName) || 'Business name';
  const place = [line(bi.city), line(bi.state)].filter(Boolean).join(', ');
  const area = line(bi.serviceArea) || place;
  const services = (Array.isArray(bi.services) ? bi.services : [])
    .map((s) => line(typeof s === 'string' ? s : s?.name))
    .filter(Boolean);
  return {
    headline: name,
    subheadline: `${SAMPLE_TAG} The real headline and text are written from the customer's brief.`,
    aboutText: `${SAMPLE_TAG} ${name}${area ? `, serving ${area}` : ''}. The about story is written from the customer's answers.`,
    servicesSection: {
      intro: `${SAMPLE_TAG} The services from the business details.`,
      items: services.map((n) => ({ name: n, description: '' })),
    },
    // normalizeDesignCopy's own defaults for the two buttons.
    ctaPrimary: 'Book Now',
    ctaSecondary: 'Call Us',
    ctaHeadline: `Contact ${name}`,
    ctaSubtext: `${SAMPLE_TAG} This section's text is written with the rest of the site.`,
    // Only reviews the customer pasted ever become testimonials.
    testimonialPlaceholders: [],
    metaTitle: `${SAMPLE_TAG} ${name}`,
    metaDescription: '',
    keywords: [],
    footerTagline: '',
    schemaType: schemaTypeFor(bi.businessType),
  };
}

// The image map for the preview from the setup's photo picks (the slots
// designFromIntake / DesignSetup keep: asset paths). A slot already copied
// into the site from the same upload shows that public URL; otherwise the
// upload's signed link from project.files (it expires an hour after the
// project was loaded). Keys follow the run: logo, hero, about, gallery0..11.
export function slotImages({ slots, files, images, imported } = {}) {
  const s = slots && typeof slots === 'object' ? slots : {};
  const wanted = { logo: s.logo, hero: s.hero, about: s.about };
  (Array.isArray(s.gallery) ? s.gallery : []).slice(0, 12).forEach((p, i) => { wanted[`gallery${i}`] = p; });
  const signed = new Map((Array.isArray(files) ? files : [])
    .filter((f) => f && typeof f.path === 'string' && typeof f.url === 'string' && f.url)
    .map((f) => [f.path, f.url]));
  const out = {};
  for (const [key, path] of Object.entries(wanted)) {
    if (!path) continue;
    const url = imported?.[key] === path && images?.[key] ? images[key] : signed.get(path);
    if (url) out[key] = url;
  }
  return out;
}

// Everything exportHtmlString needs to render the configured site:
//   templateId    the setup's template (null result when it's unknown)
//   businessInfo  the setup's details (design.businessInfo shape)
//   copy          written copy to show, e.g. the existing site's copy
//                 (unpackGeneratedContent(site.generated_content).copy);
//                 without headline/subheadline/aboutText the preview uses
//                 sampleCopy() and returns sample: true
//   images        flat image map (slotImages())
//   customColors  colors before levers (the brand accent, brandAccent())
//   customFonts   { font, bodyFont } stacks before levers (optional)
//   levers        design.levers (designLevers.js), sanitized here
//   projectId     sets customProjectId like the run (optional)
//   existingInfo  the site's current business_info for a rewrite (optional):
//                 like rewriteSite, keys the Design step doesn't own stay
// Returns { templateId, businessInfo, generatedCopy, templateMeta, images,
// customColors, customFonts, sample } or null.
export function buildPreviewInput({
  templateId, businessInfo, copy, images, customColors, customFonts, levers, projectId = '', existingInfo = null,
} = {}) {
  // Own keys only: TEMPLATES['constructor'] is Object's, and would get as far
  // as the renderer before failing.
  if (typeof templateId !== 'string' || !Object.prototype.hasOwnProperty.call(TEMPLATES, templateId)) return null;

  const patch = leverPatch(levers, templateId);
  // The saved design's shape, so the details are trimmed and capped as the
  // run sees them.
  const design = { ...sanitizeDesign({ businessInfo, templateId }), levers };
  let info = siteBusinessInfo(design, projectId);
  if (existingInfo && typeof existingInfo === 'object') {
    const kept = { ...existingInfo };
    for (const k of DESIGN_OWNED_INFO) delete kept[k];
    info = { ...kept, ...info };
  }
  info = { ...info, ...patch.info };

  const sample = !hasWrittenCopy(copy);
  const base = sample ? { ...(copy && typeof copy === 'object' ? copy : {}), ...sampleCopy(design.businessInfo) } : copy;
  const generatedCopy = { ...base, ...patch.copy };
  if (!sample) info = fillPackageDescriptions(info, generatedCopy);

  const colors = {};
  for (const role of COLOR_ROLES) {
    const v = customColors?.[role];
    if (typeof v === 'string' && HEX.test(v)) colors[role] = v.toLowerCase();
  }
  Object.assign(colors, patch.colors);
  const fonts = {};
  for (const slot of ['font', 'bodyFont']) {
    if (typeof customFonts?.[slot] === 'string' && customFonts[slot]) fonts[slot] = customFonts[slot];
  }
  Object.assign(fonts, patch.fonts);

  const imageMap = {};
  for (const [k, v] of Object.entries(images && typeof images === 'object' ? images : {})) {
    if (typeof v === 'string' && v) imageMap[k] = v;
  }

  return {
    templateId,
    businessInfo: info,
    generatedCopy,
    templateMeta: buildTemplateMeta(templateId, colors, fonts),
    images: imageMap,
    customColors: colors,
    customFonts: fonts,
    sample,
  };
}

// The published page for a preview input. No site id, so the booking and
// contact widget scripts stay out (they need a live site), and no widget
// configs (custom sites never borrow the admin's review widgets). `isPro`
// drops the free-plan "Powered by" bar; that depends on the owner's plan
// at publish time, not on the design.
export async function renderPreviewHtml(input, { isPro = true } = {}) {
  if (!input) return '';
  return exportHtmlString(input.templateId, input.businessInfo, input.generatedCopy, input.templateMeta, input.images, [], null, isPro);
}

// The framed page's helper script:
// - Fragment links ("#services") would resolve against the admin page's
//   URL inside a srcdoc frame and load the app in the frame: scroll to the
//   target instead. http(s) links open in a new tab; other relative links
//   (nothing to load them from) do nothing.
// - Reports the scroll position to the parent and reopens at `y`.
function previewShimJs(y) {
  return `(function(){var w=window,d=document,last=-1,queued=false;
d.addEventListener('click',function(e){var t=e.target,a=t&&t.closest?t.closest('a[href]'):null;if(!a)return;
var h=a.getAttribute('href')||'';
if(h.charAt(0)==='#'){e.preventDefault();var id=h.slice(1),el=null;try{el=id?d.getElementById(decodeURIComponent(id)):null;}catch(x){}
if(el)el.scrollIntoView();else if(!id)w.scrollTo(0,0);return;}
if(/^https?:/i.test(h)){a.target='_blank';a.rel='noopener noreferrer';return;}
if(!/^(tel|mailto|sms):/i.test(h))e.preventDefault();},true);
function report(){queued=false;var v=Math.round(w.scrollY||0);if(v===last)return;last=v;
try{w.parent.postMessage({type:'${PREVIEW_SCROLL_MESSAGE}',y:v},'*');}catch(x){}}
w.addEventListener('scroll',function(){if(!queued){queued=true;setTimeout(report,120);}},{passive:true});
${y ? `w.addEventListener('load',function(){try{w.scrollTo({top:${y},behavior:'instant'});}catch(x){w.scrollTo(0,${y});}});` : ''}
})();`;
}

// The published HTML prepared for an iframe srcdoc: the helper script goes
// first in <head>. `scrollY` reopens the page at that position.
export function framePreviewHtml(html, { scrollY = 0 } = {}) {
  const page = typeof html === 'string' ? html : '';
  const y = Math.max(0, Math.round(Number(scrollY) || 0));
  const shim = `<script>${previewShimJs(y)}</script>`;
  // A function replacement, so "$" in the page is never read as a pattern.
  // The lookahead keeps a <header> from passing for <head>.
  const HEAD = /<head(?=[\s>])[^>]*>/i;
  return HEAD.test(page) ? page.replace(HEAD, (m) => m + shim) : shim + page;
}

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// A page for "Open as published": the site full-window in a sandboxed
// frame. Opening the HTML itself from a blob: URL would run it in the admin
// app's origin, where the page's third-party scripts could read the
// admin's session; this wrapper has no script of its own.
export function publishedTabHtml(html) {
  const page = typeof html === 'string' ? html : '';
  // exportHtml escapes the title, so it can be reused as-is.
  const title = /<title>([^<]*)<\/title>/i.exec(page)?.[1] || '';
  const icon = /<link rel="icon"[^>]*>/i.exec(page)?.[0] || '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Preview${title ? ` · ${title}` : ''}</title>
${icon}
<style>html,body{margin:0;height:100%;background:#fff}iframe{display:block;border:0;width:100%;height:100%}</style>
</head>
<body>
<iframe title="Site preview" sandbox="${PREVIEW_SANDBOX}" srcdoc="${escapeAttr(framePreviewHtml(page))}"></iframe>
</body>
</html>`;
}
