import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatInline } from '../src/components/help/formatInline.jsx';

function render(nodes) {
  return renderToStaticMarkup(nodes);
}

describe('formatInline', () => {
  it('returns plain text unchanged', () => {
    expect(render(formatInline('hello world'))).toBe('hello world');
  });

  it('renders **bold** as <strong>', () => {
    expect(render(formatInline('click **Save**'))).toBe('click <strong>Save</strong>');
  });

  it('renders *italic* as <em>', () => {
    expect(render(formatInline('*Business name* field'))).toBe('<em>Business name</em> field');
  });

  it('renders `code` with styling', () => {
    const out = render(formatInline('open `/dashboard`'));
    expect(out).toContain('<code');
    expect(out).toContain('/dashboard');
  });

  it('renders paragraph breaks from \\n\\n', () => {
    const out = render(formatInline('one\n\ntwo'));
    expect(out).toContain('<p');
    expect(out).toContain('>one<');
    expect(out).toContain('>two<');
  });

  it('escapes HTML to prevent injection', () => {
    expect(render(formatInline('<script>alert(1)</script>'))).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('combines multiple formats in one string', () => {
    const out = render(formatInline('Use **bold** and *italic* with `code`'));
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<em>italic</em>');
    expect(out).toContain('<code');
  });

  it('returns empty array for empty string', () => {
    expect(formatInline('')).toEqual([]);
  });
});
