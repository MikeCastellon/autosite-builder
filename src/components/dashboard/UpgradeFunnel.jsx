// Long-form upgrade funnel for non-Pro users on the dashboard. Each feature
// gets its own section with a stylized mockup and an Upgrade Now CTA.

function BrowserChrome({ url, children }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-xl border border-black/[0.06] bg-white">
      <div className="bg-[#f1f1f1] px-3 py-2 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        <div className="flex-1 ml-2 bg-white border border-black/[0.06] rounded-md px-3 py-0.5 text-[10px] text-[#888] font-mono truncate">
          {url}
        </div>
      </div>
      <div className="bg-white">{children}</div>
    </div>
  );
}

function CtaButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#cc0000] hover:bg-[#aa0000] text-white font-semibold text-[14px] transition-colors shadow-sm"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1.5l2.78 6.42 6.97.5-5.27 4.6 1.6 6.81L12 16.5l-6.08 3.33 1.6-6.81L2.25 8.42l6.97-.5L12 1.5z" />
      </svg>
      Upgrade Now
    </button>
  );
}

function Section({ eyebrow, title, body, mockup, reverse, onUpgrade }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-14 items-center ${reverse ? 'md:[&>*:first-child]:order-2' : ''}`}>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[2px] text-[#cc0000] mb-3">{eyebrow}</p>
        <h3 className="text-[clamp(24px,3vw,32px)] font-[900] text-[#1a1a1a] tracking-[-0.7px] leading-[1.1] mb-4">
          {title}
        </h3>
        <p className="text-[15px] text-[#555] leading-[1.6] mb-6">{body}</p>
        <CtaButton onClick={onUpgrade} />
      </div>
      <div>{mockup}</div>
    </div>
  );
}

// ─── Mockups ──────────────────────────────────────────────────────────────

function BookingMockup() {
  return (
    <BrowserChrome url="yourshop.com/book">
      <div className="p-5 bg-[#1a1a1a] text-white">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-[#cc0000] flex items-center justify-center text-[11px] font-bold">A</div>
          <div>
            <p className="text-[11px] font-bold leading-tight">AutoSite Demo Shop</p>
            <p className="text-[9px] opacity-70 leading-tight">Book an appointment</p>
          </div>
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-2">Pick a date and time</p>
        <div className="bg-white rounded-md p-2">
          <div className="grid grid-cols-7 gap-0.5 text-[8px] text-center text-[#999] mb-1">
            {['S','M','T','W','T','F','S'].map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: 35 }, (_, i) => {
              const day = i - 2;
              const today = day === 17;
              const past = day < 14 || day > 31;
              return (
                <div
                  key={i}
                  className={`text-[8px] text-center py-1 rounded ${
                    today ? 'bg-[#cc0000] text-white font-bold'
                    : past ? 'text-[#bbb]'
                    : 'text-[#1a1a1a] bg-[#fafafa]'
                  }`}
                >
                  {day > 0 && day <= 31 ? day : ''}
                </div>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 mt-3">
          {['9:00am', '10:30am', '12:00pm'].map((t, i) => (
            <div key={t} className={`text-[9px] text-center py-1.5 rounded font-semibold ${
              i === 1 ? 'bg-[#cc0000] text-white' : 'bg-white/10 text-white'
            }`}>{t}</div>
          ))}
        </div>
      </div>
    </BrowserChrome>
  );
}

function ReviewsMockup() {
  const reviews = [
    { name: 'Carlos M.', stars: 5, text: 'Fastest detail in town. My Tesla looks brand new.' },
    { name: 'Jasmine R.', stars: 5, text: 'Booked online in 30 seconds. They came to my house.' },
    { name: 'Derek T.',   stars: 5, text: 'Best ceramic coat I\'ve ever had. Worth every penny.' },
  ];
  return (
    <BrowserChrome url="yourshop.com">
      <div className="p-5 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-bold tracking-tight">
              <span style={{ color: '#4285F4' }}>G</span><span style={{ color: '#EA4335' }}>o</span><span style={{ color: '#FBBC05' }}>o</span><span style={{ color: '#4285F4' }}>g</span><span style={{ color: '#34A853' }}>l</span><span style={{ color: '#EA4335' }}>e</span> Reviews
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[14px] font-bold text-[#1a1a1a]">5.0</span>
            <span className="text-[#fbbc05] text-[12px]">★★★★★</span>
            <span className="text-[10px] text-[#888]">(178)</span>
          </div>
        </div>
        <div className="space-y-2">
          {reviews.map((r) => (
            <div key={r.name} className="border border-black/[0.06] rounded-lg p-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-[#1a1a1a]">{r.name}</span>
                <span className="text-[#fbbc05] text-[10px]">{'★'.repeat(r.stars)}</span>
              </div>
              <p className="text-[10px] text-[#555] leading-snug">"{r.text}"</p>
            </div>
          ))}
        </div>
      </div>
    </BrowserChrome>
  );
}

function DomainMockup() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-black/[0.06] bg-white shadow-sm overflow-hidden">
        <div className="bg-[#f1f1f1] px-3 py-2 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          <div className="flex-1 ml-2 bg-white border border-black/[0.06] rounded-md px-3 py-1 text-[11px] text-[#888] font-mono truncate flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="8" height="6" rx="1"/><path d="M4 5V3.5a2 2 0 014 0V5"/></svg>
            yourshop.autocaregeniushub.com
          </div>
        </div>
        <div className="px-3 py-2 text-[10px] text-[#888]">Free subdomain</div>
      </div>
      <div className="text-center text-[20px] font-bold text-[#cc0000]">↓</div>
      <div className="rounded-xl border-2 border-[#cc0000]/30 bg-white shadow-md overflow-hidden">
        <div className="bg-[#f1f1f1] px-3 py-2 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          <div className="flex-1 ml-2 bg-white border border-[#cc0000]/30 rounded-md px-3 py-1 text-[11px] text-[#1a1a1a] font-mono truncate font-semibold flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#cc0000" strokeWidth="1.5"><rect x="2" y="5" width="8" height="6" rx="1"/><path d="M4 5V3.5a2 2 0 014 0V5"/></svg>
            yourshop.com
          </div>
        </div>
        <div className="px-3 py-2 text-[10px] text-[#cc0000] font-semibold">Your custom domain — Pro</div>
      </div>
    </div>
  );
}

function ChatMockup() {
  return (
    <div className="rounded-2xl bg-white border border-black/[0.06] shadow-xl overflow-hidden max-w-sm mx-auto">
      <div className="bg-[#cc0000] text-white px-4 py-3 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[12px] font-bold">G</div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold leading-tight">Genius Websites Support</p>
          <p className="text-[10px] opacity-90 leading-tight">Online — replies in minutes</p>
        </div>
        <div className="w-2 h-2 rounded-full bg-green-400" />
      </div>
      <div className="p-4 bg-[#fafafa] space-y-2.5 min-h-[180px]">
        <div className="bg-white border border-black/[0.05] rounded-2xl rounded-bl-sm px-3 py-2 max-w-[80%] text-[11px]">
          Hey 👋 anything I can help with?
        </div>
        <div className="bg-[#1a1a1a] text-white rounded-2xl rounded-br-sm px-3 py-2 max-w-[80%] text-[11px] ml-auto">
          How do I add a service to my booking calendar?
        </div>
        <div className="bg-white border border-black/[0.05] rounded-2xl rounded-bl-sm px-3 py-2 max-w-[85%] text-[11px]">
          Easy — open Booking Settings → Services → Add Service. Want me to walk you through it?
        </div>
      </div>
      <div className="px-4 py-2.5 border-t border-black/[0.06] flex items-center gap-2">
        <div className="flex-1 text-[10px] text-[#aaa]">Type a message...</div>
        <div className="w-7 h-7 rounded-full bg-[#cc0000] flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="white"><path d="M11 6L1 1l2 5-2 5z"/></svg>
        </div>
      </div>
    </div>
  );
}

function BrandingMockup() {
  return (
    <div className="space-y-3">
      <div className="relative rounded-xl border border-black/[0.06] bg-white shadow-sm overflow-hidden">
        <div className="aspect-[16/9] bg-gradient-to-br from-[#1a1a1a] to-[#3a3a3a] relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white opacity-80">
              <p className="text-[10px] font-semibold uppercase tracking-[2px] opacity-70">Your Site</p>
              <p className="text-[16px] font-bold mt-1">Premium Auto Detailing</p>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur px-3 py-2 flex items-center justify-center gap-2 text-[9px] text-[#666]">
            <span>Powered by</span>
            <span className="font-bold text-[#1a1a1a]">Auto Care Genius</span>
          </div>
        </div>
        <div className="px-3 py-2 text-[10px] text-[#888]">Free — branded footer always visible</div>
      </div>
      <div className="text-center text-[20px] font-bold text-[#cc0000]">↓</div>
      <div className="relative rounded-xl border-2 border-[#cc0000]/30 bg-white shadow-md overflow-hidden">
        <div className="aspect-[16/9] bg-gradient-to-br from-[#1a1a1a] to-[#3a3a3a] relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white opacity-80">
              <p className="text-[10px] font-semibold uppercase tracking-[2px] opacity-70">Your Site</p>
              <p className="text-[16px] font-bold mt-1">Premium Auto Detailing</p>
            </div>
          </div>
        </div>
        <div className="px-3 py-2 text-[10px] text-[#cc0000] font-semibold">Pro — 100% your brand, no footer</div>
      </div>
    </div>
  );
}

// ─── Funnel ───────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    eyebrow: '24/7 Online Booking',
    title: 'Customers book themselves while you work.',
    body: 'A live calendar on your site lets customers pick a service and time slot — no phone calls, no DMs. Bookings land straight in your dashboard with email confirmations sent automatically.',
    mockup: <BookingMockup />,
  },
  {
    eyebrow: 'Live Google Reviews',
    title: 'Real reviews, pulled from Google in real time.',
    body: 'Connect your Google Business profile and the latest 5-star reviews appear on your site automatically. New reviews show up the moment customers leave them.',
    mockup: <ReviewsMockup />,
    reverse: true,
  },
  {
    eyebrow: 'Custom Domain',
    title: 'Use your own domain instead of a subdomain.',
    body: 'Connect mybusiness.com (or anything you own) so your site looks like a fully independent business — not a free subdomain. We handle the SSL automatically.',
    mockup: <DomainMockup />,
  },
  {
    eyebrow: 'Priority Live Chat',
    title: 'Direct line to our team. Answers in minutes.',
    body: 'Hit a snag? Skip the support queue. Pro customers get a private chat with our team — typical reply time is under 5 minutes during business hours.',
    mockup: <ChatMockup />,
    reverse: true,
  },
  {
    eyebrow: 'Remove Branding',
    title: 'Your site, 100% your brand.',
    body: 'Free sites show a small "Powered by Auto Care Genius" bar at the bottom. Pro removes it entirely so visitors only see your business — never ours.',
    mockup: <BrandingMockup />,
  },
];

export default function UpgradeFunnel({ onUpgrade }) {
  return (
    <div className="mt-10 space-y-12">
      {/* Section divider */}
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[3px] text-[#cc0000] mb-3">Here's what you'll get</p>
        <h2 className="text-[clamp(28px,4vw,40px)] font-[900] text-[#1a1a1a] tracking-[-1px] leading-[1.05]">
          Every feature, with a real preview.
        </h2>
        <p className="text-[15px] text-[#666] mt-3 max-w-xl mx-auto">
          Scroll through the toolkit. Upgrade when you're ready — $19.99/month, cancel anytime.
        </p>
      </div>

      {SECTIONS.map((s, i) => (
        <div
          key={i}
          className="bg-white border border-black/[0.07] rounded-2xl shadow-sm p-8 sm:p-12"
        >
          <Section
            eyebrow={s.eyebrow}
            title={s.title}
            body={s.body}
            mockup={s.mockup}
            reverse={s.reverse}
            onUpgrade={onUpgrade}
          />
        </div>
      ))}

      {/* Final CTA block */}
      <div className="bg-gradient-to-br from-[#cc0000] to-[#6a0000] rounded-2xl p-10 sm:p-14 text-center text-white">
        <p className="text-[11px] font-bold uppercase tracking-[3px] opacity-80 mb-3">Genius Websites Pro</p>
        <h2 className="text-[clamp(28px,4vw,40px)] font-[900] tracking-[-1px] leading-[1.05] mb-4">
          Ready to get booked?
        </h2>
        <p className="text-[16px] opacity-90 mb-6 max-w-md mx-auto">
          Unlock all five features for $19.99/month. Cancel anytime in your Shopify account.
        </p>
        <button
          type="button"
          onClick={onUpgrade}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-[#cc0000] hover:bg-[#1a1a1a] hover:text-white font-bold text-[15px] transition-colors shadow-lg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1.5l2.78 6.42 6.97.5-5.27 4.6 1.6 6.81L12 16.5l-6.08 3.33 1.6-6.81L2.25 8.42l6.97-.5L12 1.5z" />
          </svg>
          Upgrade Now
        </button>
      </div>
    </div>
  );
}
