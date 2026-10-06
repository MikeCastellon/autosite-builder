// Custom website projects: the intake form a customer fills in at
// /custom-site?t=<token> and the stages an admin moves the build through
// (Admin > Custom websites).
//
// Pure module. The form page, the admin tab and the Netlify functions
// (custom-site-form, custom-site-admin) all import it, so the fields the
// customer sees, the fields the server keeps and the labels the admin reads
// come from one list. Adding a question = adding a field here.

// ─── Build stages ─────────────────────────────────────────────────────

// The main pipeline, in order. The first three move on their own: the
// welcome email moves 'new' to 'invited', the customer's first save moves it
// to 'form_started', submitting moves it to 'form_received'. The rest are
// set by an admin.
export const STAGES = [
  { id: 'new',            label: 'Not sent',            hint: 'Added, form link not emailed yet' },
  { id: 'invited',        label: 'Form sent',           hint: 'Welcome email sent, waiting on the customer' },
  { id: 'form_started',   label: 'Filling out form',    hint: 'The customer has started the form' },
  { id: 'form_received',  label: 'Form received',       hint: 'Everything is in, ready to design' },
  { id: 'designing',      label: 'Designing',           hint: 'We are building the first draft' },
  { id: 'in_review',      label: 'Draft with customer', hint: 'Waiting on the customer\'s feedback' },
  { id: 'revisions',      label: 'Revisions',           hint: 'Working through the customer\'s changes' },
  { id: 'live',           label: 'Live',                hint: 'Launched' },
];

// Off to the side of the pipeline.
export const SIDE_STAGES = [
  { id: 'on_hold',  label: 'On hold',  hint: 'Paused' },
  { id: 'archived', label: 'Archived', hint: 'Closed; the form link no longer works' },
];

export const ALL_STAGES = [...STAGES, ...SIDE_STAGES];
export const STAGE_IDS = ALL_STAGES.map((s) => s.id);

export function stageLabel(id) {
  return ALL_STAGES.find((s) => s.id === id)?.label || id;
}

const BEFORE_FORM = ['new', 'invited'];

// Stage after the welcome email goes out.
export function stageAfterInvite(stage) {
  return stage === 'new' ? 'invited' : stage;
}

// Stage after the customer saves the form. Only moves forward from the
// stages before the form: a save never pulls a project back from design.
export function stageAfterSave(stage) {
  return BEFORE_FORM.includes(stage) ? 'form_started' : stage;
}

// Stage after the customer submits. A resubmit while the site is being
// designed keeps the stage; the admin gets the "updated" email instead.
export function stageAfterSubmit(stage) {
  return [...BEFORE_FORM, 'form_started'].includes(stage) ? 'form_received' : stage;
}

// ─── Form fields ──────────────────────────────────────────────────────

export const BUSINESS_TYPE_OPTIONS = [
  { value: 'detailing_shop',   label: 'Detailing shop' },
  { value: 'mobile_detailing', label: 'Mobile detailing' },
  { value: 'tint_shop',        label: 'Tint / PPF' },
  { value: 'wheel_shop',       label: 'Wheels & tires' },
  { value: 'mechanic_shop',    label: 'Mechanic / repair' },
  { value: 'car_wash',         label: 'Car wash' },
  { value: 'other',            label: 'Something else' },
];

const STYLE_OPTIONS = [
  'Bold & sporty', 'Clean & minimal', 'Luxury & high-end', 'Dark & moody',
  'Bright & friendly', 'Rugged & industrial', 'Modern & techy', 'Classic & trusted',
].map((label) => ({ value: label, label }));

const FEATURE_OPTIONS = [
  'Online booking', 'Services & prices', 'Photo gallery', 'Before & after photos',
  'Google reviews', 'FAQ', 'Contact form', 'Service area map', 'Gift cards',
  'Financing info', 'Fleet / commercial services',
].map((label) => ({ value: label, label }));

// Field types: text | email | tel | url | textarea | select | radio | chips
// (multi-select) | checkbox | colors | sites | files. 'files' fields hold no
// value in `form`: they show the uploads of their `kind` (see ASSET_KINDS).
// `showIf` hides a field until another field has a given value; a hidden
// field's answer is still kept, so switching back restores it.
export const FORM_SECTIONS = [
  {
    id: 'business',
    title: 'Your business',
    intro: 'The basics, so your site has the right name and details.',
    fields: [
      { id: 'contactName',  type: 'text',  label: 'Your name', required: true, autoComplete: 'name' },
      { id: 'contactEmail', type: 'email', label: 'Your email', required: true, autoComplete: 'email' },
      { id: 'contactPhone', type: 'tel',   label: 'Your phone', autoComplete: 'tel' },
      { id: 'businessName', type: 'text',  label: 'Business name', required: true, autoComplete: 'organization' },
      { id: 'businessType', type: 'select', label: 'What do you do?', options: BUSINESS_TYPE_OPTIONS },
      { id: 'sitePhone',    type: 'tel',   label: 'Phone number for the website', hint: 'Leave blank to use your phone above.' },
      { id: 'serviceArea',  type: 'text',  label: 'City or area you serve', placeholder: 'e.g. Tampa, St. Pete and Clearwater' },
      { id: 'address',      type: 'text',  label: 'Shop address', hint: 'Leave blank if you\'re mobile only.', autoComplete: 'street-address' },
      { id: 'hours',        type: 'textarea', rows: 2, label: 'Business hours', placeholder: 'Mon–Fri 8am–6pm, Sat 9am–2pm' },
      { id: 'currentWebsite', type: 'url', label: 'Current website', placeholder: 'yourbusiness.com', group: 'Where to find you online' },
      { id: 'googleProfile',  type: 'url', label: 'Google Business Profile link', hint: 'We use it to find your reviews and details.', group: 'Where to find you online' },
      { id: 'instagram', type: 'text', label: 'Instagram', placeholder: '@yourbusiness', group: 'Where to find you online' },
      { id: 'facebook',  type: 'text', label: 'Facebook',  placeholder: 'facebook.com/yourbusiness', group: 'Where to find you online' },
      { id: 'tiktok',    type: 'text', label: 'TikTok',    placeholder: '@yourbusiness', group: 'Where to find you online' },
      { id: 'youtube',   type: 'text', label: 'YouTube',   placeholder: 'youtube.com/@yourbusiness', group: 'Where to find you online' },
    ],
  },
  {
    id: 'brand',
    title: 'Your brand',
    intro: 'Your logo, your colors and the feel you\'re going for.',
    fields: [
      { id: 'logos', type: 'files', kind: 'logo', label: 'Logo',
        hint: 'Upload the best version you have: SVG, AI, EPS, PDF or a PNG with a see-through background. Extra versions (icon only, white) help too.' },
      { id: 'noLogo', type: 'checkbox', label: 'I don\'t have a logo yet' },
      { id: 'colorMode', type: 'radio', label: 'Brand colors', options: [
        { value: 'mine', label: 'I have brand colors' },
        { value: 'logo', label: 'Match my logo' },
        { value: 'pick', label: 'Not sure, pick for me' },
      ] },
      { id: 'colors', type: 'colors', max: 6, label: 'Your colors', hint: 'Main color first. Type a hex code (like #CC0000) or pick one.', showIf: { field: 'colorMode', equals: 'mine' } },
      { id: 'fonts', type: 'text', label: 'Fonts you use', hint: 'Only if you know them.' },
      { id: 'styles', type: 'chips', label: 'Which styles fit your business?', hint: 'Pick as many as you like.', options: STYLE_OPTIONS },
      { id: 'brandFiles', type: 'files', kind: 'brand', label: 'Other brand files',
        hint: 'Brand guide, business card, flyer, van or truck wrap: anything that shows your look.' },
      { id: 'brandNotes', type: 'textarea', rows: 3, label: 'Anything else about your look?', placeholder: 'Colors to avoid, a look you\'re known for…' },
    ],
  },
  {
    id: 'inspiration',
    title: 'Inspiration',
    intro: 'Show us sites and designs you like. It\'s the fastest way to a design you\'ll love.',
    fields: [
      { id: 'referenceSites', type: 'sites', max: 8, label: 'Websites you like',
        hint: 'Any business, any industry. Tell us what caught your eye: the colors, the layout, the photos…' },
      { id: 'referenceImages', type: 'files', kind: 'reference', notes: true, label: 'Screenshots and images',
        hint: 'Screenshots of websites, Instagram posts, designs. Add a note to each one saying what you like about it.' },
      { id: 'dislikes', type: 'textarea', rows: 3, label: 'Anything you don\'t want?', placeholder: 'Styles, colors or sites you don\'t like' },
    ],
  },
  {
    id: 'content',
    title: 'Services & photos',
    intro: 'What you offer, your story, and photos of your work.',
    fields: [
      { id: 'services', type: 'textarea', rows: 6, label: 'Services and prices',
        hint: 'One per line. Prices are optional.',
        placeholder: 'Full interior + exterior detail: from $250\nCeramic coating (5 year): $1,200\nWindow tint, full car: from $299' },
      { id: 'about', type: 'textarea', rows: 4, label: 'Your story', placeholder: 'How you started, how long you\'ve been doing this, what you care about' },
      { id: 'whyUs', type: 'textarea', rows: 3, label: 'Why do customers choose you?' },
      { id: 'testimonials', type: 'textarea', rows: 4, label: 'Reviews to feature', hint: 'Paste them with the customer\'s name, or tell us where to find them.' },
      { id: 'photos', type: 'files', kind: 'photo', label: 'Photos of your work',
        hint: 'Finished cars, before and after, your shop, van or team. Originals straight from your phone are perfect.' },
      { id: 'stockPhotos', type: 'checkbox', label: 'It\'s OK to use stock photos where we need more' },
    ],
  },
  {
    id: 'launch',
    title: 'Features & launch',
    intro: 'What your site needs to do, and when you need it.',
    fields: [
      { id: 'features', type: 'chips', label: 'What should your site have?', options: FEATURE_OPTIONS },
      { id: 'domainStatus', type: 'radio', label: 'Website address (domain)', options: [
        { value: 'have', label: 'I already own one' },
        { value: 'need', label: 'I need one' },
        { value: 'unsure', label: 'Not sure' },
      ] },
      { id: 'domainName', type: 'text', label: 'Your domain', placeholder: 'yourbusiness.com', showIf: { field: 'domainStatus', equals: 'have' } },
      { id: 'deadline', type: 'text', label: 'Any deadline?', placeholder: 'e.g. before our grand opening on Nov 15' },
      { id: 'notes', type: 'textarea', rows: 4, label: 'Anything else we should know?' },
    ],
  },
];

export const FORM_FIELDS = FORM_SECTIONS.flatMap((s) => s.fields.map((f) => ({ ...f, section: s.id })));

export function isFieldShown(field, form) {
  if (!field.showIf) return true;
  return form?.[field.showIf.field] === field.showIf.equals;
}

// ─── Uploads ──────────────────────────────────────────────────────────

export const ASSET_BUCKET = 'custom-site-assets';
export const UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

export const ASSET_KINDS = {
  logo:      { label: 'Logo',          max: 10 },
  brand:     { label: 'Brand files',   max: 20 },
  reference: { label: 'Inspiration',   max: 30 },
  photo:     { label: 'Photos',        max: 100 },
};

// Logos and brand files come in design formats (AI, EPS, PSD) as well as
// images and PDFs. Nothing here is ever served to the public: the bucket
// is private and admins open files through short-lived signed URLs.
export const UPLOAD_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'avif', 'svg', 'tif', 'tiff', 'pdf', 'ai', 'eps', 'psd'];
export const UPLOAD_ACCEPT = UPLOAD_EXTENSIONS.map((e) => `.${e}`).join(',');

// Formats an <img> can show; anything else gets a file tile.
const PREVIEWABLE = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg'];

export function fileExtension(name) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(String(name || ''));
  return m ? m[1].toLowerCase() : '';
}

export function isPreviewable(name) {
  return PREVIEWABLE.includes(fileExtension(name));
}

// Server-side check for a requested upload. Returns { ext } or { error }.
export function checkUpload({ kind, fileName, size }) {
  if (!ASSET_KINDS[kind]) return { error: 'Unknown upload type' };
  const ext = fileExtension(fileName);
  if (!UPLOAD_EXTENSIONS.includes(ext)) {
    return { error: 'That file type isn\'t supported. Use an image, PDF, AI, EPS or PSD file.' };
  }
  if (!Number.isFinite(size) || size <= 0) return { error: 'That file looks empty' };
  if (size > UPLOAD_MAX_BYTES) return { error: 'That file is over 25 MB. Try a smaller version.' };
  return { ext };
}

export function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Sanitizing (server) ──────────────────────────────────────────────

const MAX_TEXT = 300;
const MAX_TEXTAREA = 5000;
const MAX_NOTE = 500;
const HEX = /^#[0-9a-f]{6}$/i;

function cleanString(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

// Keeps only the known fields, in their expected shapes. Unknown keys,
// wrong types and options that aren't on the list are dropped.
export function sanitizeForm(input) {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const out = {};
  for (const f of FORM_FIELDS) {
    const v = src[f.id];
    if (v === undefined || v === null) continue;
    switch (f.type) {
      case 'files':
        break;
      case 'checkbox':
        if (v === true) out[f.id] = true;
        break;
      case 'select':
      case 'radio': {
        const s = cleanString(v, MAX_TEXT);
        if (f.options.some((o) => o.value === s)) out[f.id] = s;
        break;
      }
      case 'chips': {
        if (!Array.isArray(v)) break;
        const picked = f.options.map((o) => o.value).filter((o) => v.includes(o));
        if (picked.length) out[f.id] = picked;
        break;
      }
      case 'colors': {
        if (!Array.isArray(v)) break;
        const hexes = [...new Set(v.filter((c) => typeof c === 'string' && HEX.test(c.trim())).map((c) => c.trim().toUpperCase()))]
          .slice(0, f.max || 6);
        if (hexes.length) out[f.id] = hexes;
        break;
      }
      case 'sites': {
        if (!Array.isArray(v)) break;
        const rows = v
          .filter((r) => r && typeof r === 'object')
          .map((r) => ({ url: cleanString(r.url, MAX_NOTE), note: cleanString(r.note, MAX_NOTE) }))
          .filter((r) => r.url || r.note)
          .slice(0, f.max || 8);
        if (rows.length) out[f.id] = rows;
        break;
      }
      default: {
        const s = cleanString(v, f.type === 'textarea' ? MAX_TEXTAREA : MAX_TEXT);
        if (s) out[f.id] = s;
      }
    }
  }
  return out;
}

export function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

// Required fields still missing, as { id, label, section }. Checked on
// submit by both the page (to point at the field) and the server.
export function missingRequired(form) {
  const missing = FORM_FIELDS
    .filter((f) => f.required && !cleanString(form?.[f.id], MAX_TEXT))
    .map((f) => ({ id: f.id, label: f.label, section: f.section }));
  if (!missing.some((m) => m.id === 'contactEmail') && !isEmail(form?.contactEmail)) {
    missing.push({ id: 'contactEmail', label: 'A valid email', section: 'business' });
  }
  return missing;
}

// Things the build needs that the customer can still skip. Shown on the
// review step and in the admin, so nobody waits on a missing logo.
export function missingRecommended(form = {}, assets = []) {
  const has = (kind) => assets.some((a) => a.kind === kind);
  const out = [];
  if (!has('logo') && !form.noLogo) out.push({ id: 'logos', section: 'brand', label: 'Your logo' });
  if (!form.colorMode || (form.colorMode === 'mine' && !(form.colors || []).length)) {
    out.push({ id: 'colorMode', section: 'brand', label: 'Your brand colors' });
  }
  if (!(form.referenceSites || []).length && !has('reference')) {
    out.push({ id: 'referenceSites', section: 'inspiration', label: 'A website or design you like' });
  }
  if (!cleanString(form.services, MAX_TEXTAREA)) out.push({ id: 'services', section: 'content', label: 'Your services' });
  if (!has('photo') && !form.stockPhotos) out.push({ id: 'photos', section: 'content', label: 'Photos of your work' });
  return out;
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export function assetPath(projectId, kind, fileId, ext) {
  return `${projectId}/${kind}/${fileId}.${ext}`;
}

// The upload list the customer sends back. Every path must sit in this
// project's folder under the kind it claims (paths are minted by
// custom-site-form's upload-url action), so a customer can't point at
// another project's files.
export function sanitizeAssets(list, projectId) {
  if (!Array.isArray(list) || !projectId) return [];
  const pathRe = new RegExp(`^${projectId}/(logo|brand|reference|photo)/${UUID}\\.([a-z0-9]{1,5})$`);
  const seen = new Set();
  const perKind = {};
  const out = [];
  for (const a of list) {
    if (!a || typeof a !== 'object' || typeof a.path !== 'string') continue;
    const m = pathRe.exec(a.path);
    if (!m || seen.has(a.path)) continue;
    const kind = m[1];
    perKind[kind] = (perKind[kind] || 0) + 1;
    if (perKind[kind] > ASSET_KINDS[kind].max) continue;
    seen.add(a.path);
    const asset = {
      path: a.path,
      kind,
      name: cleanString(a.name, 200) || `${kind}.${m[2]}`,
      size: Number.isFinite(a.size) && a.size > 0 ? Math.round(a.size) : 0,
      type: cleanString(a.type, 100),
    };
    const note = cleanString(a.note, MAX_NOTE);
    if (note) asset.note = note;
    out.push(asset);
  }
  return out;
}

// A link for an address someone typed ("mysite.com", "https://…"), or null.
// Only http(s): a "javascript:" address typed into the form must never
// become a clickable link in the admin.
export function safeHref(input) {
  const s = String(input || '').trim();
  if (!s || /\s/.test(s)) return null;
  let candidate = s;
  if (s.startsWith('//')) candidate = `https:${s}`;
  else if (!/^https?:\/\//i.test(s)) {
    // Any other scheme is refused; "example.com:8080" only looks like one.
    if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^[^:/]+\.[a-z]{2,}:\d+/i.test(s)) return null;
    candidate = `https://${s}`;
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.')) return null;
    return u.href;
  } catch {
    return null;
  }
}

// ─── Reading answers (admin) ──────────────────────────────────────────

// One answer as display text ('' when unanswered). Colors, sites and files
// have their own renderers in the admin; this covers the rest.
export function answerText(field, value) {
  if (value === undefined || value === null || value === '') return '';
  switch (field.type) {
    case 'checkbox': return value ? 'Yes' : '';
    case 'select':
    case 'radio': return field.options.find((o) => o.value === value)?.label || String(value);
    case 'chips': return Array.isArray(value) ? value.join(', ') : '';
    case 'colors': return Array.isArray(value) ? value.join(', ') : '';
    case 'sites': return Array.isArray(value) ? value.map((r) => [r.url, r.note].filter(Boolean).join(': ')).join('\n') : '';
    default: return String(value);
  }
}

export function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

export function fullName(first, last) {
  return [first, last].map((s) => String(s || '').trim()).filter(Boolean).join(' ');
}

// Activity entries, newest first in the admin.
export function describeEvent(evt) {
  const d = evt?.data || {};
  switch (evt?.type) {
    case 'created': return 'Customer added';
    case 'email': {
      const to = d.to || 'the customer';
      if (d.template === 'welcome') return `Welcome email sent to ${to}`;
      if (d.template === 'draft') return `Draft link emailed to ${to}`;
      if (d.template === 'live') return `"You're live" email sent to ${to}`;
      if (d.template === 'handover' || d.template === 'handover_new') return `Access email sent to ${to}`;
      return `Email sent to ${to}`;
    }
    case 'email_failed': return `Email to ${d.to || 'the customer'} failed to send`;
    case 'stage': return `Moved to ${stageLabel(d.to)}`;
    case 'form_started': return 'Customer started the form';
    case 'form_submitted': return 'Customer submitted the form';
    case 'form_resubmitted': return 'Customer updated their answers';
    case 'paid': return d.paid ? 'Marked as paid' : 'Marked as not paid';
    case 'site_url': return d.url ? 'Site link updated' : 'Site link removed';
    case 'details': return 'Customer details edited';
    case 'link_reset': return 'Form link replaced (the old link stopped working)';
    case 'design_started': return 'Started writing the site';
    case 'design_ready': return d.regenerated ? 'Site rewritten' : 'Site written and created';
    case 'design_failed': return `Writing the site failed${d.error ? `: ${d.error}` : ''}`;
    case 'handover': return `Site handed over to ${d.to || 'the customer'}${d.newAccount ? ' (new account)' : ''}${d.compPro ? ', with Pro' : ''}`;
    case 'launch': {
      const parts = [];
      const n = (list) => (Array.isArray(list) ? list.length : 0);
      if (n(d.checked)) parts.push(`${n(d.checked)} launch item${n(d.checked) === 1 ? '' : 's'} ticked`);
      if (n(d.unchecked)) parts.push(`${n(d.unchecked)} unticked`);
      if (d.round) parts.push(`revision round ${d.round.to}${d.round.of ? ` of ${d.round.of}` : ''}`);
      if (d.roundsIncluded) parts.push(`${d.roundsIncluded.to} rounds included`);
      if (d.notes) parts.push('launch notes edited');
      return parts.length ? `Launch: ${parts.join(', ')}` : 'Launch list updated';
    }
    case 'design_suggest_started': return 'Asked Claude to suggest a design';
    case 'design_suggest_ready': return 'Design suggestion ready';
    case 'design_suggest_failed': return `Design suggestion failed${d.error ? `: ${d.error}` : ''}`;
    case 'brand_started': return 'Started building the brand system';
    case 'brand_ready': return 'Brand system ready';
    case 'brand_failed': return `Brand system failed${d.error ? `: ${d.error}` : ''}`;
    // Launch kit runs (custom-site-kit*): the event carries the skill's label.
    case 'kit_started': return `Started building the launch kit's ${d.label || d.skill || 'item'}`;
    case 'kit_ready': return `Launch kit: ${d.label || d.skill || 'item'} ready`;
    case 'kit_failed': return `Launch kit: ${d.label || d.skill || 'item'} failed${d.error ? `: ${d.error}` : ''}`;
    default: return evt?.type || 'Update';
  }
}
