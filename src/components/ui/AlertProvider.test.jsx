import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConfirmDialog, initialFocus, trapFocusTarget } from './AlertProvider.jsx';

describe('initialFocus', () => {
  it('focuses Cancel on destructive dialogs, so Enter never deletes', () => {
    expect(initialFocus(true)).toBe('cancel');
    expect(initialFocus(false)).toBe('confirm');
  });
});

describe('trapFocusTarget', () => {
  const cancel = { name: 'cancel' };
  const ok = { name: 'ok' };
  const panel = { name: 'panel' };
  const items = [cancel, ok];

  it('wraps Tab from the last button to the first', () => {
    expect(trapFocusTarget({ items, active: ok, inside: true, shiftKey: false })).toBe(cancel);
  });
  it('wraps Shift+Tab from the first button (or the panel) to the last', () => {
    expect(trapFocusTarget({ items, active: cancel, inside: true, shiftKey: true })).toBe(ok);
    expect(trapFocusTarget({ items, active: panel, inside: true, shiftKey: true })).toBe(ok);
  });
  it('lets the browser move focus between buttons inside the dialog', () => {
    expect(trapFocusTarget({ items, active: cancel, inside: true, shiftKey: false })).toBeNull();
    expect(trapFocusTarget({ items, active: ok, inside: true, shiftKey: true })).toBeNull();
  });
  it('pulls focus that escaped the dialog back in', () => {
    const outside = { name: 'page' };
    expect(trapFocusTarget({ items, active: outside, inside: false, shiftKey: false })).toBe(cancel);
    expect(trapFocusTarget({ items, active: outside, inside: false, shiftKey: true })).toBe(ok);
  });
  it('does nothing without focusable items', () => {
    expect(trapFocusTarget({ items: [], active: panel, inside: true, shiftKey: false })).toBeNull();
  });
});

describe('ConfirmDialog markup', () => {
  const html = renderToStaticMarkup(
    <ConfirmDialog
      state={{ id: 1, title: 'Delete site?', message: 'This cannot be undone.', confirmText: 'Delete', cancelText: 'Cancel', danger: true }}
      onResult={() => {}}
    />,
  );

  it('is a labelled, modal alertdialog', () => {
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('aria-modal="true"');
    const labelledby = /aria-labelledby="([^"]+)"/.exec(html)[1];
    const describedby = /aria-describedby="([^"]+)"/.exec(html)[1];
    expect(html).toContain(`<h3 id="${labelledby}"`);
    expect(html).toContain(`<p id="${describedby}"`);
  });

  it('puts Cancel first and never autofocuses the destructive button', () => {
    expect(html.indexOf('>Cancel<')).toBeLessThan(html.indexOf('>Delete<'));
    expect(html).not.toMatch(/autofocus/i);
    expect(html.match(/type="button"/g)).toHaveLength(2);
  });
});
