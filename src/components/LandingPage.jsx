import { TEMPLATES } from '../data/templates.js';

const ACG_LOGO = 'https://www.autocaregenius.com/cdn/shop/files/v11_1.svg?v=1760731533&width=200';

export default function LandingPage({ onSignIn }) {
  const visibleTemplates = Object.values(TEMPLATES).filter((t) => t && !t.hidden);

  return (
    <div className="min-h-screen bg-white text-[#1a1a1a] flex flex-col">
      {/* ──────────────────────── Header ──────────────────────── */}
      <header className="border-b border-black/[0.07] bg-white/90 backdrop-blur-xl px-4 sm:px-8 h-16 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <a href="https://www.autocaregenius.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5">
            <img src={ACG_LOGO} alt="Auto Care Genius" className="h-7" />
            <div className="w-px h-6 bg-black/[0.07]" />
            <span className="font-bold text-[#1a1a1a] text-[17px] tracking-[-0.5px]">
              Genius <span className="text-[#cc0000]">Websites</span>
            </span>
          </a>
        </div>
        <button
          onClick={onSignIn}
          className="bg-[#1a1a1a] hover:bg-[#cc0000] text-white text-[13px] font-semibold px-5 py-2 rounded-lg transition-colors"
        >
          Sign In
        </button>
      </header>

      {/* ──────────────────────── Hero ──────────────────────── */}
      <section className="px-4 sm:px-8 pt-16 sm:pt-24 pb-20 max-w-5xl mx-auto w-full text-center">
        <p className="text-[12px] font-semibold text-[#cc0000] uppercase tracking-[2px] mb-5">
          Free for Auto Businesses
        </p>
        <h1 className="text-[clamp(36px,6vw,64px)] font-[900] text-[#1a1a1a] tracking-[-1.5px] leading-[1.02] mb-6">
          A professional website for your shop,<br className="hidden sm:block" />
          <span className="text-[#cc0000]">built in minutes.</span>
        </h1>
        <p className="text-[#555] text-[clamp(15px,2vw,18px)] leading-[1.6] max-w-2xl mx-auto mb-10">
          Answer a few questions about your auto shop. Our AI writes every line of copy and ships a fast, mobile‑ready site on your own subdomain — no designers, no developers, no monthly fee.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onSignIn}
            className="bg-[#cc0000] hover:bg-[#aa0000] text-white font-semibold py-4 px-8 rounded-xl text-[15px] transition-colors"
          >
            Start Building — Free
          </button>
          <a
            href="#how"
            className="border border-black/[0.1] hover:border-[#1a1a1a] text-[#1a1a1a] font-semibold py-4 px-8 rounded-xl text-[15px] transition-colors inline-flex items-center justify-center gap-2"
          >
            See how it works
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
        </div>
        <p className="text-[12px] text-[#888] mt-6">
          No credit card · Publish on your own subdomain · Bring your own domain
        </p>
      </section>

      {/* ──────────────────────── How It Works ──────────────────────── */}
      <section id="how" className="px-4 sm:px-8 py-20 bg-[#faf9f7] border-y border-black/[0.07]">
        <div className="max-w-5xl mx-auto w-full">
          <p className="text-[12px] font-semibold text-[#cc0000] uppercase tracking-[2px] mb-3 text-center">How it works</p>
          <h2 className="text-[clamp(28px,4vw,40px)] font-[900] text-[#1a1a1a] tracking-[-1px] leading-[1.1] mb-14 text-center">
            Three steps to a live site.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                num: '01',
                title: 'Tell us about your shop',
                desc: 'Business name, services, hours, and the vibe of your brand. Fill Demo is available so you can try before you buy (your time).',
              },
              {
                num: '02',
                title: 'Pick a template',
                desc: 'Choose from 10 premium designs tailored to detailers, mechanics, tint shops, wheel shops, mobile detailers, and car washes.',
              },
              {
                num: '03',
                title: 'AI writes & publishes',
                desc: 'Every headline, service description, and SEO tag is written for your shop. Publish in one click to your own subdomain.',
              },
            ].map((step) => (
              <div key={step.num} className="bg-white rounded-2xl border border-black/[0.07] p-6 hover:border-[#cc0000]/30 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-lg bg-[#cc0000] text-white font-[900] text-[14px] flex items-center justify-center mb-4">
                  {step.num}
                </div>
                <h3 className="font-bold text-[#1a1a1a] text-[17px] mb-2 tracking-[-0.3px]">{step.title}</h3>
                <p className="text-[#555] text-[14px] leading-[1.6]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────── Template Gallery ──────────────────────── */}
      <section className="px-4 sm:px-8 py-20">
        <div className="max-w-6xl mx-auto w-full">
          <p className="text-[12px] font-semibold text-[#cc0000] uppercase tracking-[2px] mb-3 text-center">10 templates ready to go</p>
          <h2 className="text-[clamp(28px,4vw,40px)] font-[900] text-[#1a1a1a] tracking-[-1px] leading-[1.1] mb-12 text-center">
            Designed for how car people work.
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {visibleTemplates.map((t) => {
              const [c1, c2, c3] = t.previewColors || ['#111', '#cc0000', '#222'];
              return (
                <div key={t.id} className="rounded-xl border border-black/[0.07] overflow-hidden hover:border-[#cc0000]/30 transition-colors">
                  <div className="h-20 flex flex-col" style={{ background: c1 }}>
                    <div className="flex items-center px-2.5 py-1.5 gap-2" style={{ background: c1 }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: c2, opacity: 0.9 }} />
                      <div className="h-1 rounded-full w-10" style={{ background: c2, opacity: 0.5 }} />
                    </div>
                    <div className="flex-1 flex flex-col justify-center px-2.5 gap-1">
                      <div className="h-1 rounded-full w-3/4" style={{ background: c2, opacity: 0.8 }} />
                      <div className="h-1 rounded-full w-1/2" style={{ background: c2, opacity: 0.4 }} />
                    </div>
                    <div className="flex gap-1 px-2.5 pb-1.5">
                      {[0,1,2].map((i) => <div key={i} className="flex-1 h-3 rounded" style={{ background: c3, opacity: 0.85 }} />)}
                    </div>
                  </div>
                  <div className="p-3 border-t border-black/[0.05]">
                    <p className="font-semibold text-[#1a1a1a] text-[12px] leading-tight truncate">{t.label}</p>
                    <div className="flex gap-1 mt-1.5">
                      {t.previewColors?.map((c) => <div key={c} className="w-2.5 h-2.5 rounded-full border border-black/[0.05]" style={{ background: c }} />)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ──────────────────────── What's Included ──────────────────────── */}
      <section className="px-4 sm:px-8 py-20 bg-[#faf9f7] border-y border-black/[0.07]">
        <div className="max-w-4xl mx-auto w-full">
          <p className="text-[12px] font-semibold text-[#cc0000] uppercase tracking-[2px] mb-3 text-center">Included, free</p>
          <h2 className="text-[clamp(28px,4vw,40px)] font-[900] text-[#1a1a1a] tracking-[-1px] leading-[1.1] mb-12 text-center">
            Everything you need to get found & booked.
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
            {[
              'AI-written copy tailored to your services',
              'Mobile-responsive on every device',
              'Local SEO: schema, meta tags, keywords',
              'Google Reviews + Instagram widgets',
              'Free SSL certificate (HTTPS)',
              'Lightning-fast CDN hosting',
              'Custom subdomain or your own domain',
              'Edit colors, fonts, content in one click',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-[15px] text-[#1a1a1a]">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#cc0000] text-white flex items-center justify-center mt-0.5">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ──────────────────────── Final CTA ──────────────────────── */}
      <section className="px-4 sm:px-8 py-20 text-center">
        <h2 className="text-[clamp(28px,4vw,44px)] font-[900] text-[#1a1a1a] tracking-[-1px] leading-[1.1] mb-4 max-w-2xl mx-auto">
          Ready to launch your shop's website?
        </h2>
        <p className="text-[#555] text-[16px] mb-8">Takes about 5 minutes. Totally free.</p>
        <button
          onClick={onSignIn}
          className="bg-[#cc0000] hover:bg-[#aa0000] text-white font-semibold py-4 px-10 rounded-xl text-[16px] transition-colors"
        >
          Start Building — Free
        </button>
      </section>

      {/* ──────────────────────── Footer ──────────────────────── */}
      <footer className="border-t border-black/[0.07] px-4 sm:px-8 py-6 bg-white">
        <div className="max-w-6xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-[#888]">© {new Date().getFullYear()} Genius Websites · All rights reserved</p>
          <a href="https://www.autocaregenius.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[12px] text-[#888] hover:text-[#1a1a1a] transition-colors">
            <span>Powered by</span>
            <img src={ACG_LOGO} alt="Auto Care Genius" className="h-5" />
          </a>
        </div>
      </footer>
    </div>
  );
}
