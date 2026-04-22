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

  it('renders `code` as <code>', () => {
    expect(render(formatInline('open `/dashboard`'))).toBe('open <code>/dashboard</code>');
  });

  it('renders paragraph breaks from \\n\\n', () => {
    expect(render(formatInline('one\n\ntwo'))).toBe('<p>one</p><p>two</p>');
  });

  it('escapes HTML to prevent injection', () => {
    expect(render(formatInline('<script>alert(1)</script>'))).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('combines multiple formats in one string', () => {
    expect(render(formatInline('Use **bold** and *italic* with `code`')))
      .toBe('Use <strong>bold</strong> and <em>italic</em> with <code>code</code>');
  });

  it('returns empty array for empty string', () => {
    expect(formatInline('')).toEqual([]);
  });
});
