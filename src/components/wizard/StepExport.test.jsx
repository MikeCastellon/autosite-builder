import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Static rendering runs no effects and no clicks: this checks the page
// before publishing. The publish client and auth stay out of the test.
vi.mock('../../lib/publishSite.js', () => ({ publishSite: vi.fn() }));
vi.mock('../../lib/AuthContext.jsx', () => ({ useAuth: () => ({ profile: { id: 'admin-1', is_super_admin: true } }) }));
vi.mock('../ui/UpgradeProPanel.jsx', () => ({ default: () => null }));

const { default: StepExport } = await import('./StepExport.jsx');

const base = {
  siteId: 'site-1',
  businessInfo: { businessName: 'Sample Detail Co', city: 'Austin', state: 'TX' },
  generatedCopy: {},
  templateId: 'detailing_sporty',
  templateMeta: {},
  images: {},
  selectedWidgetIds: [],
  onBack: () => {},
  onStartOver: () => {},
};
const render = (props) => renderToStaticMarkup(createElement(StepExport, { ...base, ...props }));

describe('StepExport', () => {
  it('lets an admin building a free website leave without publishing', () => {
    const html = render({ freeSite: { onHandover: () => {}, onLater: () => {} } });
    expect(html).toContain('Publish Website');
    expect(html).toContain('Save and finish later (back to Free websites)');
  });

  it('is unchanged for everyone else', () => {
    const html = render();
    expect(html).toContain('Publish Website');
    expect(html).not.toContain('Free websites');
  });
});
