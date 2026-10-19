// Tiny runtime + base CSS injected into every published page by
// exportHtml.js. Published pages are renderToStaticMarkup output with no
// React on the client, so the handful of behaviors templates need after
// load live here as plain DOM code (ES5, no dependencies, < 2 KB):
//   - html.acg-js marks "JS ran" so reveal styles can hide content safely
//   - html[data-acg-scrolled] once scrollY > 20 (style scrolled navs in CSS)
//   - [data-acg-reveal] gets .acg-in when it scrolls into view
//   - details.acg-menu closes on link click, outside click or Escape
//   - [data-acg-year] shows the current year
// acg-js is set in <head>, so init must not wait for DOMContentLoaded (that
// waits for every deferred widget script): it runs at readyState
// 'interactive', right after parsing. It also fails open: without a working
// IntersectionObserver every reveal target is shown, and any other error
// removes acg-js, so reveal content is never left hidden.
// The editor preview (WebsitePreview.jsx) injects SITE_BASE_CSS and mirrors
// the scrolled flag itself; it never adds acg-js, so reveals stay visible.
// Opt-in scripts sit next to it: exportHtml.js adds SITE_BA_JS (Before &
// After sliders) and SITE_SCROLL_JS (prev/next buttons on a horizontal
// scroller) only to a page whose markup uses them, so every other page's
// <head> stays byte-identical. Each has an editor twin in
// src/components/preview (beforeAfterPreview.js, scrollerPreview.js).

export const SITE_RUNTIME_JS = `(function(){
var d=document,h=d.documentElement,w=window,s=null,ran=0;
h.className+=' acg-js';
function onScroll(){var v=(w.scrollY||w.pageYOffset||0)>20;if(v===s)return;s=v;
if(v)h.setAttribute('data-acg-scrolled','');else h.removeAttribute('data-acg-scrolled');}
function all(q){return Array.prototype.slice.call(d.querySelectorAll(q));}
function closeMenus(except){all('details.acg-menu[open]').forEach(function(m){if(m!==except)m.removeAttribute('open');});}
function reveal(){
var els=all('[data-acg-reveal]');
try{
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('acg-in');io.unobserve(e.target);}});},{rootMargin:'0px 0px -8% 0px',threshold:0.08});
els.forEach(function(el){io.observe(el);});
}catch(e){els.forEach(function(el){el.classList.add('acg-in');});}
}
function init(){
reveal();
onScroll();
w.addEventListener('scroll',onScroll,{passive:true});
all('[data-acg-year]').forEach(function(el){el.textContent=String(new Date().getFullYear());});
d.addEventListener('click',function(e){var t=e.target;if(!t||!t.closest)return;
var m=t.closest('details.acg-menu');
if(m&&t.closest('a'))m.removeAttribute('open');
closeMenus(m);});
d.addEventListener('keydown',function(e){if(e.key==='Escape')closeMenus(null);});
}
function start(){if(ran||d.readyState==='loading')return;ran=1;
try{init();}catch(e){h.className=h.className.replace(/(^|\\s)acg-js(?!\\S)/g,'');}}
d.addEventListener('readystatechange',start);
d.addEventListener('DOMContentLoaded',start);
start();
})();`;

// Before & After sliders (kit/BeforeAfter.jsx). exportHtml.js adds this
// after SITE_RUNTIME_JS only to a page that has one (a range input with
// data-acg-ba-range), so every other page stays exactly as it was and the
// runtime above keeps its 2 KB budget. Its listeners sit on document
// (delegation), so it needs no init and can run from <head>:
//   - input on a [data-acg-ba-range] sets --acg-ba (the divider) to its
//     value% on the closest [data-acg-ba] figure;
//   - a click on [data-acg-ba-prev] / [data-acg-ba-next] scrolls the
//     [data-acg-ba-track] of its [data-acg-ba-slider] one slide back / on,
//     wrapping round at the ends (the band's CSS makes it smooth where
//     motion is allowed);
//   - a track's scroll (captured: scroll events do not bubble) writes
//     "02 / 03" into the slider's [data-acg-ba-count].
// Slides are the track's children, each as wide as the track. Fails open:
// without it, or on any error, every pair stays split 50/50 and the track
// still swipes. The editor preview's twin is beforeAfterPreview.js.
export const SITE_BA_JS = `(function(){
var d=document;
function pad(n){return (n<10?'0':'')+n;}
function step(w,k){var r=w&&w.querySelector('[data-acg-ba-track]'),c,n,x,i;if(!r)return;
n=r.children.length;x=r.clientWidth;if(!n||!x)return;
i=Math.min(Math.round(r.scrollLeft/x),n-1);
if(k){r.scrollLeft=(i+k+n)%n*x;return;}
c=w.querySelector('[data-acg-ba-count]');if(c)c.textContent=pad(i+1)+' / '+pad(n);}
d.addEventListener('input',function(e){var t=e.target,f;
if(t&&t.closest&&t.hasAttribute('data-acg-ba-range')&&(f=t.closest('[data-acg-ba]')))f.style.setProperty('--acg-ba',t.value+'%');});
d.addEventListener('click',function(e){var t=e.target,b;if(!t||!t.closest)return;
b=t.closest('[data-acg-ba-prev],[data-acg-ba-next]');
if(b)step(b.closest('[data-acg-ba-slider]'),b.hasAttribute('data-acg-ba-next')?1:-1);});
d.addEventListener('scroll',function(e){var t=e.target;
if(t&&t.closest&&t.hasAttribute('data-acg-ba-track'))step(t.closest('[data-acg-ba-slider]'),0);},true);
})();`;

// Prev/next buttons for a horizontal scroller (a row of review cards, say).
// exportHtml.js adds this after SITE_RUNTIME_JS (and SITE_BA_JS) only to a
// page whose markup has such a button, so every other page stays exactly as
// it was. The contract, for any template:
//   <div id="xx-rev-track">...cards...</div>   (overflow-x: auto)
//   <button type="button" data-acg-scroll="prev" aria-controls="xx-rev-track"
//     aria-label="Previous review">  (and the same with "next")
//   - a click on the button (or on its icon) scrolls the element whose id
//     is in aria-controls by one card pitch: the distance between its first
//     two children's offsetLeft (gap included), or its clientWidth when it
//     has one child;
//   - it steps from the card nearest the current position, so a half-swiped
//     row lands on a card, and wraps round: next at the end goes back to
//     the start, prev at the start goes to the end;
//   - it does nothing when the id names no element, the track is not laid
//     out (no width, pitch 0) or nothing overflows.
// It assigns scrollLeft (never scrollBy/scrollTo with a behavior), so the
// track's own CSS scroll-behavior decides smooth or instant: put
// scroll-behavior:smooth inside @media (prefers-reduced-motion:
// no-preference) and reduced motion is respected. No init and no state:
// one click listener on document (delegation), so it can run from <head>
// and serves tracks rendered later too. ES5, under 1 KB. Without it the
// track still swipes and the buttons do nothing. The editor preview's twin
// is scrollerPreview.js.
export const SITE_SCROLL_JS = `(function(){
var d=document;
d.addEventListener('click',function(e){var t=e.target,b,r,c,k,p,m,x,i;if(!t||!t.closest)return;
b=t.closest('button[data-acg-scroll]');if(!b)return;
k=b.getAttribute('data-acg-scroll');k=k==='next'?1:k==='prev'?-1:0;
i=b.getAttribute('aria-controls');r=k&&i&&d.getElementById(i);if(!r)return;
c=r.children;m=r.scrollWidth-r.clientWidth;
p=c.length>1?c[1].offsetLeft-c[0].offsetLeft:r.clientWidth;
if(!(m>=1)||!(p>0))return;
x=r.scrollLeft;i=Math.round(x/p)+k;
r.scrollLeft=k>0?(x>=m-1?0:Math.min(i*p,m)):(x<1?m:Math.max(i*p,0));});
})();`;

// Reveal styles apply only on screens, when JS ran (html.acg-js) AND the
// visitor has not asked for reduced motion, so content is never hidden
// without the runtime (or on paper).
// Stagger with style="--acg-delay: 120ms"; data-acg-reveal="fade" skips the
// upward slide.
export const SITE_BASE_CSS = `@media screen and (prefers-reduced-motion: no-preference) {
  html { scroll-behavior: smooth; }
  html.acg-js [data-acg-reveal] {
    opacity: 0;
    transform: translateY(18px);
    transition: opacity 0.7s ease, transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1);
    transition-delay: var(--acg-delay, 0ms);
  }
  html.acg-js [data-acg-reveal="fade"] { transform: none; }
  html.acg-js [data-acg-reveal].acg-in { opacity: 1; transform: none; }
}`;

// Old-browser fallback for container queries, published pages only (the
// editor runs on current browsers). Theme-ready templates lay out with
// @container rules and cq units against their root (container-type:
// inline-size) and clip sideways overflow with overflow:clip. iOS/Safari 15
// and older, Chrome 104 and older and Firefox 109 and older drop all of it,
// so a page lays out 500-1,560px wide on a phone, with the desktop nav
// (docs/audits/2026-10-02-pr10-merge-impact.md, XB-1).
//
// CQ_REWRITE_FN is the pure CSS-text rewrite, kept as ES5 source text so the
// page runs exactly the code siteRuntime.test.js compiles and tests (a real
// function would go through the minifier, which may emit newer syntax):
//   rewrite(css, cq, clip) -> css
//   cq:   "@container [name] <query> {" -> "@media <query> {", and container
//         units -> viewport units (cqw/cqi -> vw, cqh/cqb -> vh, cqmin ->
//         vmin, cqmax -> vmax). On a published page the root spans the
//         viewport, so its width is the viewport's (less a desktop
//         scrollbar). "and" stays; a top-level "or" becomes a comma and
//         "not (q)" becomes "not all and (q)", which mean the same to engines
//         older than Media Queries 4. style() / scroll-state() queries have
//         no media equivalent: those rules are left alone.
//   clip: "overflow:clip" -> "overflow:hidden", the two-axis form only (one
//         axis hidden turns the other axis into a scroller).
// Strings, comments and url() are never touched, nor digits+cq inside
// identifiers or escaped selectors (.w-\[5cqi\]).
export const CQ_REWRITE_FN = String.raw`function(css,cq,clip){
var U={cqw:'vw',cqi:'vw',cqh:'vh',cqb:'vh',cqmin:'vmin',cqmax:'vmax'};
function query(q){
q=q.replace(/^\s+|\s+$/g,'');
if(/(style|scroll-state)\(/i.test(q))return null;
var n=/^([^\s(]+)\s+/.exec(q),o='',b='',d=0,i,c;
if(n&&!/^not$/i.test(n[1]))q=q.slice(n[0].length);
q=q.replace(/(^|[^\w-])((?:min-|max-)?)inline-size(?![\w-])/gi,'$1$2width').replace(/(^|[^\w-])((?:min-|max-)?)block-size(?![\w-])/gi,'$1$2height');
if(/^not[\s(]/i.test(q))return 'not all and '+q.replace(/^not\s*/i,'');
for(i=0;i<q.length;i++){c=q.charAt(i);
if(!d&&c!=='('){b+=c;continue;}
if(!d){o+=/^\s*or\s*$/i.test(b)?', ':b;b='';}
if(c==='(')d++;else if(c===')')d--;
o+=c;}
return o+b||'all';
}
var p=String(css).split(/("(?:[^"\\\n]|\\[\s\S])*"|'(?:[^'\\\n]|\\[\s\S])*'|\/\*[\s\S]*?\*\/|url\(\s*(?:"(?:[^"\\\n]|\\[\s\S])*"|'(?:[^'\\\n]|\\[\s\S])*'|[^)]*)\s*\))/i),i,s;
for(i=0;i<p.length;i+=2){s=p[i];
if(cq)s=s.replace(/@container(?![\w-])\s*([^{};]*)\{/gi,function(m,q){q=query(q);return q===null?m:'@media '+q+'{';})
.replace(/(^|[^\w.\-\\\[])(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(cq(?:min|max|[iwhb]))(?![\w\-\\])/gi,function(m,a,n,u){return a+n+U[u.toLowerCase()];});
if(clip)s=s.replace(/(^|[^\w\-\\])(overflow\s*:\s*)clip(?![\w\-\\])(?!\s+[\w-])/gi,'$1$2hidden');
p[i]=s;}
return p.join('');
}`;

// exportHtml.js puts this in <head>, before SITE_RUNTIME_JS. It does nothing
// when CSS.supports says container queries and overflow:clip both work.
// Otherwise it rewrites every <style> and style="" attribute that needs it
// as the parser inserts them: the template's <style> sits in <body>, and a
// MutationObserver callback runs before the browser paints what it just
// parsed (the parser inserts nodes one at a time, each with its own record).
// A <style> is rewritten once complete (some node follows it), never
// half-parsed. One sweep at readyState 'interactive' catches anything else
// (a subtree a script inserted), then the observer stops; widgets load later
// and use no container queries.
// Without overflow:clip, the rewrite to overflow:hidden keeps sections from
// spilling sideways, and overflow-x:hidden on <body> clips anything else at
// the viewport. <body> alone: on html AND body, body becomes a scroller and
// the sticky nav and action bar stop sticking. The root keeps its
// overflow-x:clip (dropped by these browsers) for the same reason.
// Fails open: an error leaves the page (or that one element) as parsed.
export const SITE_CQ_FALLBACK_JS = `(function(){
var w=window,d=document,C,cq,clip,rw,st,pend=[],mo=null,ran=0;
function ok(p,v){return !!(C&&C.supports&&C.supports(p,v));}
function attr(el){try{var v=el.getAttribute('style');if(v&&/cq|clip/i.test(v)){var u=rw(v,cq,clip);if(u!==v)el.setAttribute('style',u);}}catch(e){}}
function sheet(s){if(s.acgCq)return;s.acgCq=1;try{var t=s.textContent,u=rw(t,cq,clip);if(u!==t)s.textContent=u;}catch(e){}}
function closed(n){for(;n;n=n.parentNode)if(n.nextSibling)return 1;return 0;}
function flush(all){for(var i=0,k=[];i<pend.length;i++)if(all||closed(pend[i]))sheet(pend[i]);else k.push(pend[i]);pend=k;}
function scan(r){var i,l=r.getElementsByTagName('style');for(i=0;i<l.length;i++)pend.push(l[i]);l=r.querySelectorAll('[style*="cq"],[style*="clip"]');for(i=0;i<l.length;i++)attr(l[i]);}
function add(rs){for(var i=0;i<rs.length;i++)for(var a=rs[i].addedNodes,j=0;j<a.length;j++){var n=a[j];if(n.nodeType!==1)continue;if(/^style$/i.test(n.tagName))pend.push(n);else attr(n);}flush(0);}
function done(){if(ran||d.readyState==='loading')return;ran=1;try{if(mo){add(mo.takeRecords());mo.disconnect();}scan(d);flush(1);}catch(e){}}
try{
C=w.CSS;cq=!ok('container-type','inline-size');clip=!ok('overflow-x','clip');
if(!cq&&!clip)return;
rw=${CQ_REWRITE_FN};
if(clip){st=d.createElement('style');st.acgCq=1;st.textContent='body{overflow-x:hidden}';(d.head||d.documentElement).appendChild(st);}
if(w.MutationObserver){mo=new w.MutationObserver(function(rs){try{add(rs);}catch(e){}});mo.observe(d.documentElement,{childList:true,subtree:true});}
d.addEventListener('readystatechange',done);d.addEventListener('DOMContentLoaded',done);done();
}catch(e){}
})();`;
