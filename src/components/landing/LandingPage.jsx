export default function LandingPage({ onGetStarted }) {
  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#1a1a1a]">
      <Nav onGetStarted={onGetStarted} />
      <Hero onGetStarted={onGetStarted} />
      <CoreStrip />
      <FeatureSection
        eyebrow="Customer CRM"
        title="Your customers in one place"
        lede="Every booking becomes a customer record automatically. Add notes, tag your VIPs, and export whenever you need to."
        bullets={[
          'Booking history per customer',
          'Tags and notes, searchable across the list',
          'CSV export of your full customer list',
          'Email any customer from inside the app',
        ]}
        visual={<CrmVisual />}
      />
      <FeatureSection
        reverse
        eyebrow="Payments"
        title="Get paid. Actually paid."
        lede="Onboard as a merchant in minutes with our partner Stripe. Take cards in person, online, or at booking."
        bullets={[
          'Tap to Pay — accept cards with just your phone',
          'Card-not-present for invoices and deposits',
          'Payouts land in your bank, not an app wallet',
          'No monthly fees — pay only per transaction',
        ]}
        visual={<StripeVisual />}
      />
      <FeatureSection
        eyebrow="Booking deposits"
        title="Stop the no-shows"
        lede="Require a deposit when a customer books. They show up — or you keep the deposit."
        bullets={[
          'Set a deposit amount per service',
          'Link to your cancellation policy on every booking',
          'Shareable booking link for Instagram bio, email, or SMS',
          'Deposits apply to the final bill automatically',
        ]}
        visual={<BookingVisual />}
      />
      <SocialProof />
      <CloserCTA onGetStarted={onGetStarted} />
      <Footer />
    </div>
  );
}

function Nav({ onGetStarted }) {
  return (
    <nav className="sticky top-0 z-40 bg-[#faf9f7]/90 backdrop-blur border-b border-black/5">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="font-black text-lg tracking-tight">Genius Websites</div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={onGetStarted}
            className="hidden sm:inline text-sm text-[#1a1a1a] hover:text-[#cc0000] transition-colors"
          >
            Sign in
          </button>
          <button
            onClick={onGetStarted}
            className="px-4 py-2 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold text-sm transition-colors"
          >
            Get Started
          </button>
        </div>
      </div>
    </nav>
  );
}

function Hero({ onGetStarted }) {
  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundImage: 'radial-gradient(circle at 85% 10%, rgba(204,0,0,0.08), transparent 55%)' }}
    >
      <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 text-center">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] max-w-4xl mx-auto">
          Free AI-built websites for auto shops —
          <br className="hidden md:block" />
          <span className="text-[#cc0000]"> now with payments, booking &amp; a CRM</span>
        </h1>
        <p className="text-[#555] text-base md:text-lg mt-6 max-w-2xl mx-auto">
          Detailers, tint shops, wheel shops, mechanics &amp; mobile pros. Launch a site in minutes,
          take deposits, and manage customers — all in one place.
        </p>
        <div className="mt-8 flex items-center justify-center">
          <button
            onClick={onGetStarted}
            className="px-6 py-3.5 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold text-base transition-colors"
          >
            Build my site free
          </button>
        </div>
        <p className="text-[#888] text-xs mt-4">Free forever · No credit card required</p>
      </div>
    </section>
  );
}

function CoreStrip() {
  const tiles = [
    { title: 'AI site generation', body: 'Describe your shop. We generate your site in about 30 seconds.' },
    { title: '23 industry templates', body: 'Designs built for detailers, tint, wheels, mechanics, and car washes.' },
    { title: 'Custom domain', body: 'Bring your own, or connect one for free.' },
    { title: 'Google Reviews', body: 'Pull your 5-star reviews into any template.' },
  ];
  return (
    <section className="border-t border-b border-black/5 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {tiles.map((t) => (
          <div key={t.title} className="p-5 rounded-2xl border border-black/5 bg-[#faf9f7]">
            <div className="font-black text-[#1a1a1a] text-base">{t.title}</div>
            <div className="text-sm text-[#555] mt-1">{t.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeatureSection({ eyebrow, title, lede, bullets, visual, reverse }) {
  return (
    <section className="border-b border-black/5">
      <div
        className={`max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 md:grid-cols-2 gap-10 items-center ${
          reverse ? 'md:[&>*:first-child]:order-2' : ''
        }`}
      >
        <div>
          {eyebrow && (
            <div className="text-xs font-bold tracking-widest uppercase text-[#cc0000] mb-3">{eyebrow}</div>
          )}
          <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">{title}</h2>
          <p className="text-[#555] text-base md:text-lg mt-4">{lede}</p>
          <ul className="mt-6 space-y-2">
            {bullets.map((b) => (
              <li key={b} className="flex gap-3 text-[#1a1a1a]">
                <span className="text-[#cc0000] font-bold">✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>{visual}</div>
      </div>
    </section>
  );
}

function CrmVisual() {
  const rows = [
    { name: 'Marcus Reyes', note: 'VIP · Monthly detail', tag: 'VIP' },
    { name: 'Jordan Smith', note: 'Booked 3 times', tag: 'Repeat' },
    { name: 'Sam Okafor', note: 'Last: tint removal', tag: 'New' },
    { name: 'Lia Chen', note: 'Needs follow-up', tag: 'Flag' },
  ];
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="font-black">Customers</div>
        <div className="text-xs text-[#888]">248 total</div>
      </div>
      <div className="divide-y divide-black/5">
        {rows.map((r) => (
          <div key={r.name} className="py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm">{r.name}</div>
              <div className="text-xs text-[#888]">{r.note}</div>
            </div>
            <div className="text-[11px] px-2 py-1 rounded-full bg-[#faf0f0] text-[#cc0000] font-semibold">
              {r.tag}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StripeVisual() {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-[#888] font-semibold uppercase tracking-wider">Tap to Pay</div>
        <div className="text-xs font-bold" style={{ color: '#635bff' }}>Stripe</div>
      </div>
      <div className="rounded-xl bg-[#1a1a1a] text-white p-5">
        <div className="text-sm text-white/70">Deposit</div>
        <div className="text-3xl font-black mt-1">$75.00</div>
        <div className="text-xs text-white/50 mt-3">Full Detail · Marcus R.</div>
      </div>
      <button className="mt-4 w-full py-3 rounded-xl bg-[#cc0000] text-white text-sm font-semibold">
        Tap card to charge
      </button>
      <div className="text-[11px] text-[#888] mt-3 text-center">
        Funds land in your bank — not an app wallet
      </div>
    </div>
  );
}

function BookingVisual() {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="text-xs text-[#888] font-semibold uppercase tracking-wider mb-3">New Booking</div>
      <div className="font-black text-lg">Ceramic Coating — Full</div>
      <div className="text-sm text-[#555] mt-1">Sat, May 2 · 10:00 AM</div>
      <div className="mt-4 divide-y divide-black/5 border-y border-black/5">
        <div className="py-3 flex justify-between text-sm">
          <span className="text-[#555]">Service total</span>
          <span className="font-semibold">$600.00</span>
        </div>
        <div className="py-3 flex justify-between text-sm bg-[#faf0f0] -mx-6 px-6">
          <span className="font-semibold text-[#cc0000]">Deposit today</span>
          <span className="font-black text-[#cc0000]">$100.00</span>
        </div>
      </div>
      <div className="text-[11px] text-[#888] mt-3">
        Cancellation policy · Deposit applies to final bill
      </div>
    </div>
  );
}

function SocialProof() {
  const quotes = [
    {
      quote: 'Went from a piece of paper to a real business. The CRM alone changed how I run my weekends.',
      who: 'Jake R.',
      biz: 'Mobile Detailer',
    },
    {
      quote: 'My no-show rate dropped to zero after I turned on deposits. Built the site in 20 minutes.',
      who: 'Mira S.',
      biz: 'Tint Shop Owner',
    },
    {
      quote: 'I was paying $200/mo for a clunky site builder. This was free and looked better.',
      who: 'Danny L.',
      biz: 'Auto Mechanic',
    },
  ];
  return (
    <section className="border-b border-black/5 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-6">
        {quotes.map((q) => (
          <div key={q.who} className="p-6 rounded-2xl border border-black/5 bg-[#faf9f7]">
            <div className="text-[#1a1a1a] text-base leading-relaxed">&ldquo;{q.quote}&rdquo;</div>
            <div className="mt-4 text-sm font-semibold">{q.who}</div>
            <div className="text-xs text-[#888]">{q.biz}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CloserCTA({ onGetStarted }) {
  return (
    <section>
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-black tracking-tight">
          Ready to get paid on time and booked up?
        </h2>
        <p className="text-[#555] text-base md:text-lg mt-4 max-w-xl mx-auto">
          Build your free site in minutes. Turn on deposits and payments when you&apos;re ready.
        </p>
        <button
          onClick={onGetStarted}
          className="mt-8 px-6 py-3.5 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold text-base transition-colors"
        >
          Get Started Free
        </button>
      </div>
    </section>
  );
}

function Footer() {
  const links = [
    { label: 'Help', href: '#' },
    { label: 'Contact', href: '#' },
    { label: 'Terms', href: '#' },
    { label: 'Privacy', href: '#' },
  ];
  return (
    <footer className="border-t border-black/5 bg-[#faf9f7]">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-[#888]">© 2026 Auto Care Genius</div>
        <div className="flex items-center gap-5 text-xs">
          {links.map((l) => (
            <a key={l.label} href={l.href} className="text-[#888] hover:text-[#1a1a1a] transition-colors">
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
