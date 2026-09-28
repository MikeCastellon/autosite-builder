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
