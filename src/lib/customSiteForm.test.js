import { describe, it, expect } from 'vitest';
import {
  FORM_FIELDS, STAGES, ASSET_KINDS, answerText, assetPath, checkUpload, describeEvent, isFieldShown,
  missingRecommended, missingRequired, safeHref, sanitizeAssets, sanitizeForm, stageAfterInvite,
  stageAfterSave, stageAfterSubmit,
} from './customSiteForm.js';

const PROJECT = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-2222-4333-8444-555555555555';
const FILE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('form fields', () => {
  it('have unique ids, and every option-based field lists its options', () => {
    const ids = FORM_FIELDS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FORM_FIELDS) {
      if (['select', 'radio', 'chips'].includes(f.type)) expect(f.options.length).toBeGreaterThan(1);
      if (f.type === 'files') expect(ASSET_KINDS[f.kind]).toBeTruthy();
      if (f.showIf) expect(ids).toContain(f.showIf.field);
    }
  });

  it('hide a conditional field until its trigger has the right value', () => {
    const colors = FORM_FIELDS.find((f) => f.id === 'colors');
    expect(isFieldShown(colors, {})).toBe(false);
    expect(isFieldShown(colors, { colorMode: 'pick' })).toBe(false);
    expect(isFieldShown(colors, { colorMode: 'mine' })).toBe(true);
  });
});

describe('sanitizeForm', () => {
  it('keeps known fields in their shapes and drops everything else', () => {
    const out = sanitizeForm({
      contactName: '  Mike  ',
      businessType: 'mobile_detailing',
      colorMode: 'mine',
      colors: ['#cc0000', 'red', '#1a1a1a', '#CC0000'],
      styles: ['Dark & moody', 'Made up style'],
      referenceSites: [{ url: ' https://a.com ', note: 'the hero' }, { url: '', note: '' }, 'junk'],
      noLogo: 'yes',
      stockPhotos: true,
      services: 'Full detail: $250',
      evil: '<script>',
      logos: ['should not be here'],
    });
    expect(out).toEqual({
      contactName: 'Mike',
      businessType: 'mobile_detailing',
      colorMode: 'mine',
      colors: ['#CC0000', '#1A1A1A'],
      styles: ['Dark & moody'],
      referenceSites: [{ url: 'https://a.com', note: 'the hero' }],
      stockPhotos: true,
      services: 'Full detail: $250',
    });
  });

  it('refuses options that are not on the list', () => {
    expect(sanitizeForm({ businessType: 'bakery', domainStatus: 'maybe' })).toEqual({});
  });

  it('caps text lengths', () => {
    const out = sanitizeForm({ contactName: 'x'.repeat(1000), notes: 'y'.repeat(9000) });
    expect(out.contactName).toHaveLength(300);
    expect(out.notes).toHaveLength(5000);
  });

  it('returns an empty object for junk input', () => {
    expect(sanitizeForm(null)).toEqual({});
    expect(sanitizeForm('text')).toEqual({});
    expect(sanitizeForm([1, 2])).toEqual({});
  });
});

describe('missingRequired', () => {
  it('names the required fields that are empty', () => {
    expect(missingRequired({}).map((m) => m.id)).toEqual(['contactName', 'contactEmail', 'businessName']);
  });

  it('flags an email that does not look like one', () => {
    const missing = missingRequired({ contactName: 'A', contactEmail: 'nope', businessName: 'B' });
    expect(missing).toEqual([{ id: 'contactEmail', label: 'A valid email', section: 'business' }]);
  });

  it('is empty once name, email and business are in', () => {
    expect(missingRequired({ contactName: 'A', contactEmail: 'a@b.co', businessName: 'B' })).toEqual([]);
  });
});

describe('missingRecommended', () => {
  it('lists what the build still needs', () => {
    expect(missingRecommended({}, []).map((m) => m.id)).toEqual(['logos', 'colorMode', 'referenceSites', 'services', 'photos']);
  });

  it('accepts the "I don\'t have one" answers as complete', () => {
    const form = { noLogo: true, colorMode: 'pick', referenceSites: [{ url: 'a.com' }], services: 'Wash', stockPhotos: true };
    expect(missingRecommended(form, [])).toEqual([]);
  });

  it('still asks for colors when "I have brand colors" has none', () => {
    expect(missingRecommended({ colorMode: 'mine' }, []).map((m) => m.id)).toContain('colorMode');
  });

  it('counts uploads', () => {
    const assets = [{ kind: 'logo' }, { kind: 'reference' }, { kind: 'photo' }];
    expect(missingRecommended({ colorMode: 'logo', services: 'x' }, assets)).toEqual([]);
  });
});

describe('checkUpload', () => {
  it('accepts images, PDFs and design files up to 25 MB', () => {
    expect(checkUpload({ kind: 'logo', fileName: 'Logo FINAL.AI', size: 1000 })).toEqual({ ext: 'ai' });
    expect(checkUpload({ kind: 'photo', fileName: 'IMG_1.HEIC', size: 25 * 1024 * 1024 })).toEqual({ ext: 'heic' });
  });

  it('refuses other types, empty and oversized files, unknown kinds', () => {
    expect(checkUpload({ kind: 'logo', fileName: 'setup.exe', size: 10 }).error).toMatch(/isn't supported/);
    expect(checkUpload({ kind: 'logo', fileName: 'noext', size: 10 }).error).toBeTruthy();
    expect(checkUpload({ kind: 'logo', fileName: 'a.png', size: 0 }).error).toMatch(/empty/);
    expect(checkUpload({ kind: 'logo', fileName: 'a.png', size: 25 * 1024 * 1024 + 1 }).error).toMatch(/25 MB/);
    expect(checkUpload({ kind: 'video', fileName: 'a.png', size: 10 }).error).toMatch(/Unknown/);
  });
});

describe('sanitizeAssets', () => {
  const good = { path: assetPath(PROJECT, 'logo', FILE, 'png'), kind: 'logo', name: 'logo.png', size: 1234, type: 'image/png' };

  it('keeps uploads in the project\'s own folder', () => {
    expect(sanitizeAssets([good], PROJECT)).toEqual([good]);
  });

  it('drops paths in another project, outside a kind folder, or not minted by us', () => {
    const list = [
      { ...good, path: assetPath(OTHER, 'logo', FILE, 'png') },
      { ...good, path: `${PROJECT}/../${OTHER}/logo/${FILE}.png` },
      { ...good, path: `${PROJECT}/secret/${FILE}.png` },
      { ...good, path: `${PROJECT}/logo/not-a-uuid.png` },
      { name: 'no path' },
      null,
    ];
    expect(sanitizeAssets(list, PROJECT)).toEqual([]);
  });

  it('takes the kind from the path, dedupes and keeps short notes', () => {
    const out = sanitizeAssets([
      { ...good, kind: 'photo', note: '  love the red  ' },
      good,
    ], PROJECT);
    expect(out).toEqual([{ ...good, note: 'love the red' }]);
  });

  it('caps each kind at its limit', () => {
    const many = Array.from({ length: ASSET_KINDS.logo.max + 3 }, (_, i) => ({
      path: assetPath(PROJECT, 'logo', `aaaaaaaa-bbbb-4ccc-8ddd-${String(i).padStart(12, '0')}`, 'png'),
      name: `l${i}.png`,
    }));
    expect(sanitizeAssets(many, PROJECT)).toHaveLength(ASSET_KINDS.logo.max);
  });
});

describe('stages', () => {
  it('move forward on their own only from the stages before them', () => {
    expect(stageAfterInvite('new')).toBe('invited');
    expect(stageAfterInvite('designing')).toBe('designing');
    expect(stageAfterSave('invited')).toBe('form_started');
    expect(stageAfterSave('new')).toBe('form_started');
    expect(stageAfterSave('form_received')).toBe('form_received');
    expect(stageAfterSubmit('form_started')).toBe('form_received');
    expect(stageAfterSubmit('in_review')).toBe('in_review');
  });

  it('match the database check constraint', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['new', 'invited', 'form_started', 'form_received', 'designing', 'in_review', 'revisions', 'live']);
  });
});

describe('safeHref', () => {
  it('turns typed addresses into https links', () => {
    expect(safeHref('mysite.com')).toBe('https://mysite.com/');
    expect(safeHref('www.mysite.com/about')).toBe('https://www.mysite.com/about');
    expect(safeHref('http://old.example.com')).toBe('http://old.example.com/');
    expect(safeHref('example.com:8080/x')).toBe('https://example.com:8080/x');
  });

  it('never makes a script or non-web link', () => {
    for (const bad of ['javascript:alert(1)', 'JavaScript:alert(1)', 'javascript://x.com/%0aalert(1)', 'data:text/html,hi', 'mailto:a@b.co', '@handle', 'not a url', '', null]) {
      expect(safeHref(bad)).toBeNull();
    }
  });
});

describe('answerText / describeEvent', () => {
  it('shows option labels and lists', () => {
    const type = FORM_FIELDS.find((f) => f.id === 'businessType');
    const sites = FORM_FIELDS.find((f) => f.id === 'referenceSites');
    expect(answerText(type, 'tint_shop')).toBe('Tint / PPF');
    expect(answerText(sites, [{ url: 'a.com', note: 'colors' }, { url: 'b.com' }])).toBe('a.com: colors\nb.com');
  });

  it('describes activity in plain words', () => {
    expect(describeEvent({ type: 'stage', data: { to: 'designing' } })).toBe('Moved to Designing');
    expect(describeEvent({ type: 'email', data: { template: 'welcome', to: 'a@b.co' } })).toBe('Welcome email sent to a@b.co');
    expect(describeEvent({ type: 'email', data: { template: 'draft', to: 'a@b.co' } })).toBe('Draft link emailed to a@b.co');
  });
});
