// Edit > Hero > Logo size: a range input over the kit's LOGO_SIZE, the
// current percent beside the label, Reset only off the design size, and
// what each change saves (null back at 100%, so the site stays as it was).
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LogoSizeField } from './LogoSizeField.jsx';

// The field has no hooks: calling it gives its element tree, whose input
// and Reset button can be driven through their own props.
function find(node, test) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) { const hit = find(n, test); if (hit) return hit; }
    return null;
  }
  if (test(node)) return node;
  return find(node.props?.children, test);
}

describe('LogoSizeField', () => {
  it('renders a 80-200% slider in steps of 5 at the saved size', () => {
    const html = renderToStaticMarkup(createElement(LogoSizeField, { value: 150, onChange: () => {} }));
    for (const a of ['type="range"', 'min="80"', 'max="200"', 'step="5"', 'value="150"', 'aria-valuetext="150%"', 'id="logo-size"', 'for="logo-size"']) {
      expect(html).toContain(a);
    }
    expect(html).toContain('>150%<');
    expect(html).toContain('>Reset<');
  });

  it('shows 100% and no Reset without a saved size', () => {
    for (const value of [undefined, null, 100, 'junk']) {
      const html = renderToStaticMarkup(createElement(LogoSizeField, { value, onChange: () => {} }));
      expect(html).toContain('value="100"');
      expect(html).toContain('>100%<');
      expect(html).not.toContain('>Reset<');
    }
  });

  it('saves the slider position, and nothing at 100%', () => {
    const saved = [];
    const tree = LogoSizeField({ value: 150, onChange: (v) => saved.push(v) });
    const input = find(tree, (n) => n.type === 'input');
    for (const v of ['165', '100', '80', '200']) input.props.onChange({ target: { value: v } });
    expect(saved).toEqual([165, null, 80, 200]);
  });

  it('Reset saves nothing', () => {
    const saved = [];
    const tree = LogoSizeField({ value: 180, onChange: (v) => saved.push(v) });
    const reset = find(tree, (n) => n.type === 'button');
    reset.props.onClick();
    expect(saved).toEqual([null]);
  });
});
