// Reference theme-ready template used by templates.render.test.jsx to prove
// the contract checks work before any real template is converted. Not
// registered in src/data/templates.js and never shown to owners. It is also
// the smallest complete example of the kit: tokens from deriveTheme() as CSS
// variables, one prefixed <style> block, @container layout, hover behind
// (hover:hover), reveal via data-acg-reveal, CSS-only phone menu + action
// bar, PhotoSlot, data-section on every orderable block, data-acg-awards.
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import { deriveTheme } from '../kit/theme.js';
import { PhotoSlot } from '../kit/PhotoSlot.jsx';
import { MobileMenu, MobileActionBar } from '../kit/MobileMenu.jsx';
import { EditorOnly } from '../kit/EditorMode.jsx';

export const themeReady = true;

export const sections = [
  { id: 'hero', label: 'Hero' },
  { id: 'services', label: 'Services' },
  { id: 'about', label: 'About' },
  { id: 'awards', label: 'Awards' },
  { id: 'cta', label: 'Contact / CTA' },
];

export const extraFonts = [];

// Stand-in for this template's TEMPLATES registry entry.
export const SAMPLE_META = {
  id: '__kit_sample__',
  colors: { bg: '#0f1115', accent: '#e4572e', text: '#f5f5f4', secondary: '#171a21', muted: '#a1a1aa' },
  font: "'Inter', sans-serif",
  bodyFont: "'Inter', sans-serif",
};

const CSS = `
.ks-nav{position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px clamp(16px,5cqi,48px);background:var(--ks-bg);border-bottom:1px solid transparent;transition:border-color .2s ease,box-shadow .2s ease}
html[data-acg-scrolled] .ks-nav{border-bottom-color:var(--ks-border);box-shadow:0 8px 24px rgba(0,0,0,.18)}
.ks-links{display:flex;gap:28px;align-items:center}
.ks-links a{color:var(--ks-text);text-decoration:none;font-weight:600;font-size:15px}
.ks-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;border-radius:10px;font-weight:700;text-decoration:none;background:var(--ks-accent);color:var(--ks-on-accent)}
.ks-hero{position:relative;display:grid;place-items:center;min-height:min(80vh,720px);padding:96px clamp(16px,6cqi,64px);text-align:center;color:var(--ks-text);background:var(--ks-surface);overflow:clip}
.ks-hero.ks-has-media{color:var(--ks-on-hero)}
.ks-hero-media{position:absolute;inset:0}
.ks-hero-media::after{content:'';position:absolute;inset:0;background:var(--ks-scrim)}
.ks-hero h1{position:relative;margin:0 0 16px;font-size:clamp(36px,7cqi,76px);line-height:1.05}
.ks-hero p{position:relative;margin:0 auto 28px;max-width:560px;font-size:clamp(16px,2cqi,20px);opacity:.92}
.ks-hero .ks-btn{position:relative}
.ks-section{padding:clamp(56px,9cqi,112px) clamp(16px,6cqi,64px)}
.ks-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.ks-card{padding:28px;border-radius:14px;background:var(--ks-surface);border:1px solid var(--ks-border)}
.ks-card h3{margin:0 0 8px;font-size:20px}
.ks-card p{margin:0;color:var(--ks-muted);line-height:1.6}
.ks-about{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}
.ks-about p{color:var(--ks-muted);line-height:1.7;white-space:pre-line}
.ks-eyebrow{color:var(--ks-accent-text);font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:13px}
.ks-awards{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
.ks-award{padding:10px 18px;border-radius:999px;border:1px solid var(--ks-border);background:var(--ks-accent-soft)}
.ks-footer{padding:32px clamp(16px,6cqi,64px);color:var(--ks-muted);border-top:1px solid var(--ks-border);font-size:14px}
@media (hover:hover){.ks-links a:hover{color:var(--ks-accent-text)}.ks-btn:hover{filter:brightness(1.08)}.ks-card:hover{border-color:var(--ks-accent)}}
@media (prefers-reduced-motion: no-preference){.ks-card{transition:border-color .2s ease}}
@container (max-width: 600px){
  .ks-links{display:none}
  .ks-grid,.ks-about{grid-template-columns:1fr}
}
`;

export default function KitSampleTemplate({ businessInfo: biz, generatedCopy: copy, templateMeta, images = {} }) {
  const t = deriveTheme(templateMeta?.colors);
  const font = templateMeta?.font;
  const body = templateMeta?.bodyFont;
  const hiddenIds = copy?.hiddenSections || [];
  const show = (id) => !hiddenIds.includes(id);
  const order = buildSectionOrder(copy, sections.map((s) => s.id));
  const services = copy?.servicesSection?.items || [];
  const awards = (biz?.awards || []).filter(Boolean);
  const phone = biz?.phone;

  const vars = {
    '--ks-bg': t.bg,
    '--ks-surface': t.surface,
    '--ks-text': t.text,
    '--ks-muted': t.textMuted,
    '--ks-accent': t.accent,
    '--ks-accent-text': t.accentText,
    '--ks-accent-soft': t.accentSoft,
    '--ks-on-accent': t.onAccent,
    '--ks-border': t.border,
    '--ks-scrim': t.heroScrim,
    '--ks-on-hero': t.onHero,
  };

  return (
    <div style={{ ...vars, containerType: 'inline-size', display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'clip', background: t.bg, color: t.text, fontFamily: body }}>
      <style>{CSS}</style>

      <nav className="ks-nav" style={{ order: -1 }}>
        <strong style={{ fontFamily: font, fontSize: 20 }}>{biz?.businessName}</strong>
        <div className="ks-links">
          <a href="#services">Services</a>
          <a href="#about">About</a>
          <a className="ks-btn" href="#contact">Get in touch</a>
        </div>
        <MobileMenu
          links={[{ href: '#services', label: 'Services' }, { href: '#about', label: 'About' }, { href: '#contact', label: 'Contact' }]}
          cta={phone ? { href: `tel:${phone}`, label: `Call ${phone}` } : undefined}
          colors={t}
          font={body}
        />
      </nav>

      {show('hero') && (
        <header data-section="hero" className={`ks-hero${images.hero ? ' ks-has-media' : ''}`} style={{ order: order('hero') }}>
          {images.hero && (
            <div className="ks-hero-media">
              <PhotoSlot src={images.hero} alt="" loading="eager" fetchPriority="high" />
            </div>
          )}
          <div>
            <h1 style={{ fontFamily: font }}>{copy?.headline}</h1>
            <p>{copy?.subheadline}</p>
            <a className="ks-btn" href="#contact">{copy?.ctaPrimary || 'Get in touch'}</a>
          </div>
        </header>
      )}

      {show('services') && services.length > 0 && (
        <section data-section="services" id="services" className="ks-section" style={{ order: order('services') }}>
          <div data-acg-reveal="" className="ks-eyebrow">Services</div>
          <div className="ks-grid" style={{ marginTop: 24 }}>
            {services.map((s, i) => (
              <div key={s.name || i} className="ks-card" data-acg-reveal="" style={{ '--acg-delay': `${i * 80}ms` }}>
                <h3 style={{ fontFamily: font }}>{s.name}</h3>
                <p>{s.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {show('about') && (
        <section data-section="about" id="about" className="ks-section ks-about" style={{ order: order('about'), background: t.surface }}>
          <div>
            <div className="ks-eyebrow">About</div>
            <p>{copy?.aboutText}</p>
          </div>
          <PhotoSlot src={images.about} slot="about" alt={`${biz?.businessName || ''} at work`} style={{ aspectRatio: '4 / 3', height: 'auto', borderRadius: 14 }} />
        </section>
      )}

      {show('awards') && awards.length > 0 && (
        <section data-section="awards" className="ks-section" style={{ order: order('awards') }}>
          <div className="ks-awards" data-acg-awards="">
            {awards.map((a) => <span key={a} className="ks-award">{a}</span>)}
          </div>
        </section>
      )}

      {show('cta') && (
        <section data-section="cta" id="contact" className="ks-section" style={{ order: order('cta'), textAlign: 'center' }}>
          <h2 style={{ fontFamily: font, fontSize: 'clamp(28px,5cqi,48px)', margin: '0 0 20px' }}>{copy?.ctaHeadline || 'Ready when you are'}</h2>
          {phone && <a className="ks-btn" href={`tel:${phone}`}>Call {phone}</a>}
          <EditorOnly>
            {!phone && <p data-acg-editor-only="" style={{ color: t.textMuted }}>Add a phone number in Edit &gt; Business Info.</p>}
          </EditorOnly>
        </section>
      )}

      <footer className="ks-footer" style={{ order: 9999 }}>
        <p style={{ margin: 0 }}>© <span data-acg-year="">{new Date().getFullYear()}</span> {biz?.businessName}</p>
      </footer>

      <MobileActionBar phone={phone} bookHref="#contact" colors={t} font={body} />
    </div>
  );
}
