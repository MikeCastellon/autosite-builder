// The vehicle-makes band's content (copy.vehicleMakes, kit/vehicleMakes.js),
// Redline's markup shared by every theme that offers it: a line of text, then
// a row of make logos that scrolls as a marquee where motion is allowed and is
// a swipe strip / centered wrap without it. Each logo's path is written once,
// as a <symbol> in a hidden sprite; both copies of the scrolling row point at
// it with <use>. A short owner list is repeated inside each copy (.<ns>-mq-rep,
// shown only while it scrolls) so the moving row spans the band.
// The template renders the section around it:
//   <section data-section="brands" id="makes" className={`${ns}-makes`}
//     aria-label="Vehicle makes" tabIndex={0} style={{ order }}>
// (focusable: focusing it pauses the marquee, WCAG 2.2.2). Every class / id is
// `${ns}-<name>`: Redline passes ns="rl"; other themes pass "<prefix>-mk" and
// append makesBandCss(ns) while the band renders. No hooks.
import { makesRepeats } from './features.js';

// makes: vehicleMakesFor() output, [{ id, name, d }] (d = null: the name
// shows as text).
export function MakesBand({ ns, eyebrow, makes }) {
  const list = Array.isArray(makes) ? makes : [];
  const reps = makesRepeats(list.length);
  return (
    <>
      <p className={`${ns}-makes-eye`}>{eyebrow}</p>
      <svg className={`${ns}-sprite`} aria-hidden="true" focusable="false">
        <defs>
          {list.filter((m) => m.d).map((m) => (
            <symbol key={m.id} id={`${ns}-mk-${m.id}`} viewBox="0 0 24 24"><path d={m.d} /></symbol>
          ))}
        </defs>
      </svg>
      <div className={`${ns}-mq`}>
        <div className={`${ns}-mq-track`}>
          {[0, 1].map((copyIdx) => (
            <ul key={copyIdx} className={`${ns}-mq-set`} {...(copyIdx ? { 'aria-hidden': 'true' } : {})}>
              {Array.from({ length: reps }, (_, rep) => list.map((m) => (
                <li key={`${m.id}-${rep}`} className={`${ns}-mq-item${rep ? ` ${ns}-mq-rep` : ''}`} {...(rep && !copyIdx ? { 'aria-hidden': 'true' } : {})}>
                  {m.d ? (
                    <>
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href={`#${ns}-mk-${m.id}`} /></svg>
                      <span className={`${ns}-mq-l`}>{m.name}</span>
                    </>
                  ) : (
                    <span className={`${ns}-mq-t`}>{m.name}</span>
                  )}
                </li>
              )))}
            </ul>
          ))}
        </div>
      </div>
    </>
  );
}

// CSS for a theme other than Redline (Redline's rules, `rl-` -> `${ns}-`).
// Block variables (fallbacks in parentheses):
//   --ns-bg / -text / -muted / -line / -focus   band, hovered logo, logos + line, rules, focus ring
//   --ns-speed (55s) one marquee loop   --ns-gap (56px) between logos while scrolling
//   --ns-logo (32px) logo size   --ns-eye-font (inherit) the line's font   --ns-case (uppercase)
export function makesBandCss(ns) {
  const p = `.${ns}`;
  const v = (name, fb) => (fb === undefined ? `var(--${ns}-${name})` : `var(--${ns}-${name},${fb})`);
  const tcase = v('case', 'uppercase');
  return `
${p}-makes{padding:28px 20px;border-top:1px solid ${v('line')};border-bottom:1px solid ${v('line')};background:${v('bg')};text-align:center}
${p}-makes-eye{margin:0;font-family:${v('eye-font', 'inherit')};font-size:12px;line-height:16px;font-weight:500;text-transform:${tcase};color:${v('muted')}}
${p}-sprite{position:absolute;width:0;height:0;overflow:hidden}
${p}-mq{margin-top:20px}
${p}-mq-track{display:flex;justify-content:center}
${p}-mq-set{display:flex;flex:1;min-width:0;flex-wrap:nowrap;justify-content:flex-start;gap:32px;overflow-x:auto;margin:0;padding:0 8px 6px;list-style:none;scroll-snap-type:x proximity;scrollbar-width:thin}
${p}-mq-set+${p}-mq-set{display:none}
${p}-mq-item{display:flex;flex:none;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:55px;scroll-snap-align:start;color:${v('muted')}}
${p}-mq-rep{display:none}
${p}-mq-item svg{width:${v('logo', '32px')};height:${v('logo', '32px')};fill:currentColor}
${p}-mq-l{font-size:10px;line-height:15px;font-weight:600;letter-spacing:.05em;text-transform:${tcase};white-space:nowrap}
${p}-mq-t{font-size:14px;line-height:20px;font-weight:700;letter-spacing:.05em;text-transform:${tcase};white-space:nowrap}
@keyframes ${ns}-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
${p}-makes:focus-within ${p}-mq-track{animation-play-state:paused}
${p}-makes:focus-visible{outline:2px solid ${v('focus')};outline-offset:-4px}
@container (min-width:640px){
${p}-mq-set{flex-wrap:wrap;justify-content:center;gap:20px 40px;overflow:visible;padding:0}
}
@media (hover:hover){
${p}-mq:hover ${p}-mq-track{animation-play-state:paused}
${p}-mq-item:hover{color:${v('text')}}
}
@media (prefers-reduced-motion:no-preference){
${p}-mq{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent);mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent)}
${p}-mq-track{justify-content:flex-start;width:max-content;animation:${ns}-scroll ${v('speed', '55s')} linear infinite}
${p}-mq-set,${p}-mq-set+${p}-mq-set{display:flex;flex:none;flex-wrap:nowrap;gap:0;overflow:visible;padding:0}
${p}-mq-set ${p}-mq-rep{display:flex}
${p}-mq-item{margin-right:${v('gap', '56px')}}
${p}-mq-item{transition:color .2s}
}
`;
}
