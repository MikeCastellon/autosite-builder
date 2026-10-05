// Loads render.js through Vite's SSR module loader, so the JSX templates
// render in Node the way the theme tests render them, with:
//   - window.location.origin = the production app while exportHtml.js and
//     bookingPageHtml.js load: they bake it into the widget script URLs at
//     import, exactly as the production app's bundle does. It is removed
//     again before any template loads (templates never read window during a
//     static render; theme:check enforces that for the new designs).
//   - src/lib/supabase.js replaced by supabase-stub.js.
//   - no env files read and no file watcher.
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTION_APP_ORIGIN } from '../../src/lib/siteUpgrade.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const APP_ROOT = path.resolve(HERE, '../..');

export async function startRenderer({ root = APP_ROOT } = {}) {
  const { createServer } = await import('vite');
  const realSupabase = realpathSync(path.join(root, 'src/lib/supabase.js'));
  const stub = path.join(root, 'scripts/site-upgrade/supabase-stub.js');
  const isRealSupabase = (id) => {
    if (path.basename(id) !== 'supabase.js') return false;
    try { return realpathSync(id) === realSupabase; } catch { return false; }
  };
  const server = await createServer({
    root,
    configFile: false,
    envDir: path.join(root, 'scripts/site-upgrade'),
    logLevel: 'error',
    appType: 'custom',
    esbuild: { jsx: 'automatic' },
    server: { middlewareMode: true, hmr: false, watch: null, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [{
      name: 'site-upgrade-supabase-stub',
      enforce: 'pre',
      async resolveId(source, importer, options) {
        const r = await this.resolve(source, importer, { ...options, skipSelf: true });
        return r && isRealSupabase(r.id) ? stub : r;
      },
    }],
  });

  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const prevWindow = globalThis.window;
  let mod;
  try {
    globalThis.window = { location: { origin: PRODUCTION_APP_ORIGIN } };
    mod = await server.ssrLoadModule('/scripts/site-upgrade/render.js');
  } catch (e) {
    await server.close();
    throw e;
  } finally {
    if (hadWindow) globalThis.window = prevWindow;
    else delete globalThis.window;
  }

  const origin = mod.widgetOrigin();
  if (origin !== PRODUCTION_APP_ORIGIN) {
    await server.close();
    throw new Error(`Pages would load their widgets from ${origin || 'nowhere'}, not ${PRODUCTION_APP_ORIGIN}`);
  }
  return { mod, close: () => server.close() };
}
