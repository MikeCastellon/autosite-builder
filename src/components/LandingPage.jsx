import { TEMPLATES } from '../data/templates.js';

const ACG_LOGO = 'https://www.autocaregenius.com/cdn/shop/files/v11_1.svg?v=1760731533&width=200';

export default function LandingPage({ onSignIn, onSignUp }) {
  const visibleTemplates = Object.values(TEMPLATES).filter((t) => t && !t.hidden);
  const onStart = onSignUp || onSignIn; // backwards compat

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
          Your shop's website<br />
          <span className="text-[#cc0000]">Built in minutes</span>
        </h1>
        <p className="text-[#555] text-[clamp(15px,2vw,18px)] leading-[1.6] max-w-2xl mx-auto mb-10">
          Answer a few questions about your auto shop. Our AI writes every line of copy and ships a fast, mobile‑ready site on your own subdomain — plus payments, booking deposits, and a full customer CRM.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onStart}
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
              'Google Reviews widget',
              'Customer CRM — history, tags, CSV export',
              'Accept payments via Stripe (Tap to Pay)',
              'Booking deposits to stop no-shows',
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

      {/* ──────────────────────── Customer CRM ──────────────────────── */}
      <section className="px-4 sm:px-8 py-20">
        <div className="max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[12px] font-semibold text-[#cc0000] uppercase tracking-[2px] mb-3">Customer CRM</p>
            <h2 className="text-[clamp(28px,4vw,40px)] font-[900] text-[#1a1a1a] tracking-[-1px] leading-[1.1] mb-4">
              Your customers, all in one place.
            </h2>
            <p className="text-[#555] text-[16px] leading-[1.6] mb-6">
              Every booking automatically becomes a customer record. Add notes, tag your VIPs, and pull a full export whenever you need it.
            </p>
            <ul className="space-y-3">
              {['Booking history per customer', 'Tags and notes, searchable across the list', 'CSV export of your full customer list', 'Send email to any customer from inside the app'].map((b) => (
                <li key={b} className="flex items-start gap-3 text-[15px] text-[#1a1a1a]">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[#cc0000] text-white flex items-center justify-center mt-0.5">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-black/[0.07] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="font-[900] text-[#1a1a1a]">Customers</span>
              <span className="text-[12px] text-[#888]">248 total</span>
            </div>
            <div className="divide-y divide-black/[0.06]">
              {[{name:'Marcus Reyes',note:'VIP · Monthly detail',tag:'VIP'},{name:'Jordan Smith',note:'Booked 3 times',tag:'Repeat'},{name:'Sam Okafor',note:'Last: tint removal',tag:'New'},{name:'Lia Chen',note:'Needs follow-up',tag:'Flag'}].map((r) => (
                <div key={r.name} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[14px]">{r.name}</div>
                    <div className="text-[12px] text-[#888]">{r.note}</div>
                  </div>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-red-50 text-[#cc0000] font-semibold">{r.tag}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────── Stripe Payments ──────────────────────── */}
      <section className="px-4 sm:px-8 py-20 bg-[#faf9f7] border-y border-black/[0.07]">
        <div className="max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="rounded-2xl border border-black/[0.07] bg-white p-6 shadow-sm order-last md:order-first">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] text-[#888] font-semibold uppercase tracking-wider">Tap to Pay</span>
              <span className="text-[12px] font-bold" style={{color:'#635bff'}}>Stripe</span>
            </div>
            <div className="rounded-xl bg-[#1a1a1a] text-white p-5">
              <div className="text-[12px] text-white/60">Deposit</div>
              <div className="text-[32px] font-[900] mt-1 tracking-[-1px]">$75.00</div>
              <div className="text-[12px] text-white/40 mt-3">Full Detail · Marcus R.</div>
            </div>
            <button className="mt-4 w-full py-3 rounded-xl bg-[#cc0000] text-white text-[14px] font-semibold">Tap card to charge</button>
            <p className="text-[11px] text-[#888] mt-3 text-center">Funds land in your bank — not an app wallet</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[#cc0000] uppercase tracking-[2px] mb-3">Payments</p>
            <h2 className="text-[clamp(28px,4vw,40px)] font-[900] text-[#1a1a1a] tracking-[-1px] leading-[1.1] mb-4">
              Get paid. Actually paid.
            </h2>
            <p className="text-[#555] text-[16px] leading-[1.6] mb-6">
              Onboard as a merchant in minutes with our partner Stripe. Take cards in person, online, or at booking.
            </p>
            <ul className="space-y-3">
              {['Tap to Pay — accept cards with just your phone', 'Card-not-present for invoices and deposits', 'Payouts land in your bank, not an app wallet', 'No monthly fees — pay only per transaction'].map((b) => (
                <li key={b} className="flex items-start gap-3 text-[15px] text-[#1a1a1a]">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[#cc0000] text-white flex items-center justify-center mt-0.5">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ──────────────────────── Booking Deposits ──────────────────────── */}
      <section className="px-4 sm:px-8 py-20">
        <div className="max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[12px] font-semibold text-[#cc0000] uppercase tracking-[2px] mb-3">Booking deposits</p>
            <h2 className="text-[clamp(28px,4vw,40px)] font-[900] text-[#1a1a1a] tracking-[-1px] leading-[1.1] mb-4">
              Stop the no-shows.
            </h2>
            <p className="text-[#555] text-[16px] leading-[1.6] mb-6">
              Require a deposit when a customer books. They show up — or you keep the deposit.
            </p>
            <ul className="space-y-3">
              {['Set a deposit amount per service', 'Link to your cancellation policy on every booking', 'Shareable booking link for Instagram, email, or SMS', 'Deposits apply to the final bill automatically'].map((b) => (
                <li key={b} className="flex items-start gap-3 text-[15px] text-[#1a1a1a]">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[#cc0000] text-white flex items-center justify-center mt-0.5">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-black/[0.07] bg-white p-6 shadow-sm">
            <div className="text-[11px] text-[#888] font-semibold uppercase tracking-wider mb-3">New Booking</div>
            <div className="font-[900] text-[18px] tracking-[-0.5px]">Ceramic Coating — Full</div>
            <div className="text-[14px] text-[#555] mt-1">Sat, May 2 · 10:00 AM</div>
            <div className="mt-4 divide-y divide-black/[0.06] border-y border-black/[0.06]">
              <div className="py-3 flex justify-between text-[14px]">
                <span className="text-[#555]">Service total</span>
                <span className="font-semibold">$600.00</span>
              </div>
              <div className="py-3 flex justify-between text-[14px] bg-red-50 -mx-6 px-6">
                <span className="font-semibold text-[#cc0000]">Deposit today</span>
                <span className="font-[900] text-[#cc0000]">$100.00</span>
              </div>
            </div>
            <p className="text-[11px] text-[#888] mt-3">Cancellation policy · Deposit applies to final bill</p>
          </div>
        </div>
      </section>

      {/* ──────────────────────── Final CTA ──────────────────────── */}
      <section className="px-4 sm:px-8 py-20 text-center">
        <h2 className="text-[clamp(28px,4vw,44px)] font-[900] text-[#1a1a1a] tracking-[-1px] leading-[1.1] mb-4 max-w-2xl mx-auto">
          Ready to get paid on time and booked up?
        </h2>
        <p className="text-[#555] text-[16px] mb-8">Free website, payments, booking deposits, and a CRM — takes about 5 minutes.</p>
        <button
          onClick={onStart}
          className="bg-[#cc0000] hover:bg-[#aa0000] text-white font-semibold py-4 px-10 rounded-xl text-[16px] transition-colors"
        >
          Start Building — Free
        </button>
      </section>

      {/* ──────────────────────── Pricing Card ──────────────────────── */}
      <section id="pricing" className="px-4 sm:px-8 py-20 bg-[#faf9f7]">
        <div className="max-w-lg mx-auto">
          <p className="text-[12px] font-semibold text-[#cc0000] uppercase tracking-[2px] text-center mb-3">Simple Pricing</p>
          <h2 className="text-[clamp(28px,4vw,40px)] font-[900] text-[#1a1a1a] tracking-[-1px] leading-[1.1] text-center mb-10">
            One plan. Everything included.
          </h2>

          <div className="rounded-2xl border border-black/[0.07] bg-white shadow-sm overflow-hidden">
            {/* Card header */}
            <div className="bg-gradient-to-br from-[#cc0000] to-[#8a0000] px-8 py-8 text-white relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl" aria-hidden="true" />
              <div className="relative">
                <p className="text-[11px] font-bold uppercase tracking-[2px] opacity-80 mb-3">Genius Websites Pro</p>
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-[48px] font-[900] tracking-[-2px] leading-none">$19.99</span>
                  <span className="text-[16px] opacity-70 mb-2">/month</span>
                </div>
                <div className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 mt-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.5l2.78 6.42 6.97.5-5.27 4.6 1.6 6.81L12 16.5l-6.08 3.33 1.6-6.81L2.25 8.42l6.97-.5L12 1.5z"/></svg>
                  <span className="text-[12px] font-bold">30 days free — no charge today</span>
                </div>
              </div>
            </div>

            {/* Feature list */}
            <ul className="px-8 py-6 space-y-3">
              {[
                ['AI-generated website', 'Live in minutes, mobile-ready'],
                ['24/7 Online Booking Calendar', 'Customers self-book any time'],
                ['Booking Deposits via Stripe', 'Lock in appointments with a deposit'],
                ['Customer CRM', 'Track every lead and returning client'],
                ['Stripe Merchant Payments', 'Get paid directly from your website'],
                ['Live Google Reviews Widget', 'Auto-pulls your latest 5-star reviews'],
                ['Custom Domain', 'Connect your own .com'],
                ['Remove "Powered by" Branding', '100% your brand'],
                ['Priority Live Chat Support', 'Replies in minutes'],
              ].map(([title, desc]) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-[#cc0000]/10 text-[#cc0000] flex items-center justify-center shrink-0">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </span>
                  <span>
                    <span className="text-[14px] font-[700] text-[#1a1a1a]">{title}</span>
                    <span className="text-[12px] text-[#888] ml-1.5">{desc}</span>
                  </span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="px-8 pb-8">
              <button
                type="button"
                onClick={onStart}
                className="block w-full py-4 rounded-xl bg-[#cc0000] hover:bg-[#aa0000] text-white text-center font-bold text-[15px] transition-colors shadow-sm"
              >
                ⭐ Start 30-Day Free Trial
              </button>
              <p className="text-[11px] text-[#888] text-center mt-3">
                Create your free account · then activate Pro inside the dashboard · cancel anytime.
              </p>
            </div>
          </div>
        </div>
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
