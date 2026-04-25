// src/components/help/articles.js
//
// Help Center articles. Each article renders as a list of steps in the help drawer.
//
// Field reference:
//   slug          — unique URL-safe key, used for deep links (?help=<slug>)
//   title         — shown in the list + as the article heading
//   description   — 1-line summary in the list
//   icon          — emoji
//   readTime      — display-only string
//   isPro         — true to show a Pro badge next to the title (article still visible to all)
//   hiddenUnlessPro — true to hide entirely from non-Pro users
//   steps[]       — rendered in order
//     heading     — step title
//     body        — inline formatting: **bold**, *italic*, `code`, \n\n for paragraph breaks
//     screenshot  — optional path like '/help/filename.png'
//     callout     — optional { type: 'tip' | 'heads-up', text: '...' }

export const ARTICLES = [
  // -----------------------------------------------------------------------
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description: 'From sign-up to a live website in about 5 minutes.',
    icon: '🚀',
    readTime: '4 min read',
    steps: [
      {
        heading: 'Welcome',
        body: "Genius Websites turns a few details about your business into a live website — copy, images, colors, everything. No coding, no designers. You'll go from sign-up to a shareable URL in about 5 minutes.",
      },
      {
        heading: 'Sign up',
        body: 'On the landing page, click **Start Building — Free**. Enter your email and a password. You\'ll get a verification email — click the link to activate your account. Sign in and you\'re dropped into your **Dashboard**.',
        callout: { type: 'heads-up', text: "Didn't get the email in 2 minutes? Check spam, or request another from the login page." },
      },
      {
        heading: 'Build your site',
        body: 'On the Dashboard, click **Build My Site** (or if you already have a draft, **Continue Where You Left Off**). The wizard asks for your business type, your details, and a template. Fill it all in, or click **Fill Demo** to try the flow with example data first.',
      },
      {
        heading: 'AI generates your content',
        body: 'When you click **Generate Site**, the AI writes every section — hero, services, about, FAQ, contact — using the details you entered. It takes about 30 seconds.',
        callout: { type: 'tip', text: "Not thrilled with what it wrote? You can edit any part in the editor, or regenerate sections individually." },
      },
      {
        heading: 'Edit in the preview',
        body: 'You land in the editor with your live site front and center. Click any text to rewrite it. Click any image to replace it. Tweak colors, fonts, and sections from the sidebar. Read **Editing Your Site** for the full tour.',
      },
      {
        heading: 'Publish',
        body: 'When it looks right, click **Continue** → **Publish**. Pick a slug (e.g. `mycarwash` → `mycarwash.autocaregeniushub.com`) and publish. Your site is live in a few seconds.',
      },
      {
        heading: "What's next",
        body: "From the Dashboard you can edit your site anytime, republish after changes, connect your own domain (Pro), and — once you upgrade to Pro — accept bookings and collect customer info right from your site.",
      },
    ],
  },

  // -----------------------------------------------------------------------
  {
    slug: 'editing-your-site',
    title: 'Editing Your Site',
    description: 'Text, images, colors, fonts, sections — all live-editable.',
    icon: '✏️',
    readTime: '5 min read',
    steps: [
      {
        heading: 'Open the editor',
        body: 'From the **Dashboard**, click **Edit** on your site card. You land in the editor — the center shows a live preview of your site, and the sidebar on the left has tabs for the different things you can change.',
        callout: { type: 'tip', text: 'Everything auto-saves 1.5 seconds after your last change. No Save button to click.' },
      },
      {
        heading: 'Edit any text',
        body: 'Hover over any heading, paragraph, or list item in the preview. An edit outline appears. Click to open the inline editor and rewrite the text.',
      },
      {
        heading: 'Replace images',
        body: "Click any image to open the image editor. Upload a file, paste a URL, or pick from your previous uploads. For icons, you can also search for an emoji or Lucide icon.",
      },
      {
        heading: 'Colors',
        body: 'Open the **Colors** tab in the sidebar. Adjust primary, accent, background, and text colors. Changes apply instantly to the whole site.',
      },
      {
        heading: 'Fonts',
        body: 'Open the **Fonts** tab. Pick a heading font and a body font. The font pairings are curated for readability.',
      },
      {
        heading: 'Business Info',
        body: "Open the **Business Info** tab to update your business name, hours, phone, address, or description. Changes flow through to every section on the site — you don't have to re-edit text that references these details.",
      },
      {
        heading: 'Switch template',
        body: "Open the **Switch Template** tab to try a different layout without losing your content. The AI-generated copy carries over; colors and fonts reset to the new template's defaults. You can always switch back.",
        callout: { type: 'heads-up', text: 'Switching templates will reset any custom colors or fonts you picked. Content stays intact.' },
      },
      {
        heading: 'Sections',
        body: 'Each section on the page has a hide/show toggle. Remove what you don\'t need — leave what matters to visitors.',
      },
      {
        heading: 'Preview on mobile',
        body: "The site is automatically responsive. Resize your browser window, or open the published URL on your phone, to see the mobile layout.",
      },
      {
        heading: 'When done',
        body: "Click **Back to Dashboard** (top-left), or click **Continue** to move on to publishing.",
      },
    ],
  },

  // -----------------------------------------------------------------------
  {
    slug: 'publishing',
    title: 'Publishing Your Site',
    description: 'Push your site live and update it anytime.',
    icon: '🌐',
    readTime: '2 min read',
    steps: [
      {
        heading: 'Open the Export step',
        body: 'From the editor, click **Continue** until you reach the **Publish** step (step 6 in the wizard).',
      },
      {
        heading: 'Pick a slug',
        body: 'Your site publishes at `<your-slug>.autocaregeniushub.com`. Pick something short and memorable — your business name usually works well. Slugs are one-per-account for free plans.',
      },
      {
        heading: 'Publish',
        body: 'Click **Publish**. It takes a few seconds. You get a live URL to share — Google Business Profile, social media, business cards, email signature, anywhere.',
      },
      {
        heading: 'Update later',
        body: 'To push changes to your live site: on the Dashboard, click **Edit**, make changes, then click **Republish** on the site card. The live URL stays the same.',
        callout: { type: 'heads-up', text: 'Republishing overwrites the live version immediately. If you want to experiment privately first, just edit — your edits are saved but not live until you republish.' },
      },
      {
        heading: 'Custom domain (Pro)',
        body: 'On Pro, you can connect your own domain like `www.mybusiness.com`. Read **Custom Domains** for the DNS setup walkthrough.',
      },
    ],
  },

  // -----------------------------------------------------------------------
  {
    slug: 'managing-sites',
    title: 'Managing Your Sites',
    description: 'The Dashboard is your home base.',
    icon: '📁',
    readTime: '2 min read',
    steps: [
      {
        heading: 'Your Dashboard',
        body: 'Click **Dashboard** in the top nav from anywhere. It lists your sites and is the jumping-off point for everything else — editing, publishing, custom domains, and upgrades.',
      },
      {
        heading: 'Edit a site',
        body: "Click **Edit** on a site card to open the editor. Your changes auto-save every 1.5 seconds.",
      },
      {
        heading: 'Business Info shortcut',
        body: "Click **Business Info** on a site card to update your hours, phone, address, or description without opening the full editor. Quick updates stay quick.",
      },
      {
        heading: 'Republish after edits',
        body: 'When you\'ve made changes to a published site, click **Republish** to push them live. The URL stays the same.',
      },
      {
        heading: 'Draft recovery',
        body: "If you start building a site and leave before generating, we save your progress locally. Next time you sign in, the Dashboard offers **Continue Where You Left Off**.",
      },
      {
        heading: 'Delete',
        body: 'Click **Delete** on a site card to remove it permanently. If the site is published, this also unpublishes it — the live URL will stop working.',
        callout: { type: 'heads-up', text: 'Deletion is permanent. Free accounts are limited to 1 site at a time — deleting frees the slot for a new one.' },
      },
    ],
  },

  // -----------------------------------------------------------------------
  {
    slug: 'going-pro',
    title: 'Going Pro',
    description: 'What Pro unlocks and how to upgrade.',
    icon: '⭐',
    readTime: '2 min read',
    steps: [
      {
        heading: "What Pro gives you",
        body: "Pro unlocks the features that turn your site from a brochure into a business tool:\n\n**Bookings** — accept appointments directly on your site. Customers pick a service and time; you get an email, they get a confirmation.\n\n**Booking deposits** — optionally collect a percentage deposit when customers book, right through Stripe. Reduces no-shows and secures your calendar.\n\n**Accept card payments (Stripe)** — connect your Stripe account in one click and take payments from anywhere. Use Tap to Pay on your phone to charge customers in person, or send payment links for remote charges.\n\n**Customers CRM** — every booking creates a customer record. Add manual customers too. See full history, add notes and tags, upload photos, export to CSV, send email and book appointments right from the dashboard.\n\n**Custom domain** — use your own `www.yourbusiness.com` instead of an `autocaregeniushub.com` subdomain.\n\n**No Powered by bar** — your published site shows your brand, not ours.",
      },
      {
        heading: 'How to upgrade',
        body: "Click the **Free plan** pill on the Dashboard, or the **Upgrade to Pro** button. You'll see exactly what Pro includes and a **Subscribe** button that takes you to Shopify checkout. It's $19.99/month, billed through Shopify.",
      },
      {
        heading: 'After you subscribe',
        body: "You're upgraded immediately once Shopify confirms payment (usually under a minute). Refresh the Dashboard — the **Free plan** pill is gone, **Bookings** and **Customers** nav items appear, and the **Powered by** bar disappears from your published site.",
      },
      {
        heading: 'Cancel anytime',
        body: "Cancel through the link in any Shopify receipt email. You keep Pro access until the end of your current billing period, then revert to Free. Your site stays up; Bookings and Customers go read-only until you renew.",
      },
    ],
  },

  // -----------------------------------------------------------------------
  {
    slug: 'custom-domains',
    title: 'Custom Domains',
    description: 'Connect your own domain like www.yourbusiness.com.',
    icon: '🔗',
    readTime: '3 min read',
    isPro: true,
    steps: [
      {
        heading: 'Register a domain first',
        body: 'You need to own the domain already. If you don\'t, register one at Namecheap, GoDaddy, Google Domains, Cloudflare — any registrar. `yourbusiness.com` is typically $10–15/year.',
        callout: { type: 'heads-up', text: 'We use `www.yourbusiness.com` — not the bare `yourbusiness.com`. Most registrars let you redirect the bare domain to www automatically.' },
      },
      {
        heading: 'Click Add Domain',
        body: 'On the Dashboard, your published site has an **Add Domain** button. Click it to open the Custom Domain panel.',
      },
      {
        heading: 'Enter your domain',
        body: 'Type your domain (e.g. `yourbusiness.com`) and click **Connect**. We\'ll generate the DNS records you need to add at your registrar.',
      },
      {
        heading: 'Update your DNS',
        body: "Log in to your domain registrar's DNS settings. Add the **CNAME** record we show you, pointing `www` to our load balancer. Click the copy button next to each value — no typing.",
        callout: { type: 'tip', text: "DNS takes anywhere from 1 minute to 48 hours to propagate. Most domains are live in 10 minutes." },
      },
      {
        heading: 'Wait for SSL',
        body: "Once DNS propagates, we automatically issue an SSL certificate. The Dashboard shows **Connected** with a green checkmark when ready. Your site is now live at your custom domain.",
      },
      {
        heading: 'Manage or disconnect',
        body: 'Click **Manage Domain** on the Dashboard to re-see DNS records or disconnect the domain. Disconnecting is non-destructive — your site stays live at its `autocaregeniushub.com` subdomain, and you can reconnect anytime.',
      },
    ],
  },

  // -----------------------------------------------------------------------
  {
    slug: 'bookings',
    title: 'Bookings',
    description: 'Accept appointments directly from your site.',
    icon: '📅',
    readTime: '4 min read',
    isPro: true,
    steps: [
      {
        heading: 'Open Booking Settings',
        body: "Once you're Pro, each site card has a **Booking Settings** button. Click it to configure availability, services, and appearance.",
      },
      {
        heading: 'Set your weekly availability',
        body: 'Open the **Availability** tab. Set which days and hours you accept appointments — e.g. Mon–Fri 9am–5pm, Sat 9am–12pm, closed Sunday. Timezone is set automatically.',
      },
      {
        heading: 'Add services',
        body: "Open the **Services** tab. Each service needs a name, a duration (15 min, 30 min, 1 hour, etc.), and an optional price. Customers pick a service first, then see only time slots long enough for it.",
      },
      {
        heading: 'Pick a modal theme',
        body: "Open the **Appearance** tab. Choose from 10+ booking modal themes — Light, Dark, Gold, Silver, Neon, Rust, and more. The modal is what customers see when they click **Book an Appointment** on your site.",
        callout: { type: 'tip', text: 'Pick the theme that matches your site\'s color palette. Dark themes work well for luxury/premium brands; Light themes feel friendly and approachable.' },
      },
      {
        heading: "Customers book on your site",
        body: "A **Book an Appointment** button appears automatically on your published site. Customers click it, pick a service, pick a time, fill in their contact info, and confirm. You get an email; they get a confirmation receipt.",
      },
      {
        heading: 'Manage incoming bookings',
        body: "Click **Bookings** in the top nav to see every upcoming (and past) appointment. Click a booking for full details, customer info, and status controls — confirm, reschedule, cancel, or mark complete. Email notifications go out automatically on every status change.",
      },
      {
        heading: 'Collect a deposit',
        body: "Want customers to pay a percentage upfront when they book? Connect your Stripe account (see **Accepting Payments**) and set a **Deposit %** in Booking Settings → General. Read the **Booking Deposits** article for the full walkthrough.",
      },
    ],
  },

  // -----------------------------------------------------------------------
  {
    slug: 'payments',
    title: 'Accepting Payments',
    description: 'Take card payments anywhere via Stripe + Tap to Pay.',
    icon: '💳',
    readTime: '4 min read',
    isPro: true,
    steps: [
      {
        heading: "What this unlocks",
        body: "We've partnered with **Stripe** as the payment processor for your business. Once you connect a Stripe account, you can:\n\n- Collect **deposits on bookings** automatically when customers book through your site (see the **Booking Deposits** article)\n- Accept card payments in person using **Tap to Pay** on your own phone — no card reader needed\n- Send **payment links** by text or email for remote charges\n\nYou keep 100% of the money (minus Stripe's standard processing fees and our $2 per-transaction platform fee). Funds land in your bank account on Stripe's normal payout schedule.",
      },
      {
        heading: "Connect your Stripe account",
        body: "Click **Payments** in the top nav (Pro users only), then click **Start Stripe setup**. The Stripe onboarding form opens right inside our dashboard — walk through it with your business info, tax ID, and bank account. The whole thing takes about 5 minutes.",
        callout: { type: 'heads-up', text: "Stripe requires a real ID document (driver's license or passport) to verify your identity. This is standard for any payment processor and keeps your account compliant." },
      },
      {
        heading: "Check your status",
        body: "Back on the **Payments** page, your status badge should flip from **Not connected** to **Connected** (green) once Stripe finishes verification — usually instant, sometimes up to a few minutes. If you see **Setup incomplete**, click **Start Stripe setup** again and finish whatever step is missing.",
      },
      {
        heading: "Tap to Pay on your phone",
        body: "Once your account is connected, install Stripe's free **Stripe Dashboard** mobile app from the App Store or Google Play. Sign in with the email you onboarded with. Inside the app, tap **Collect Payment** → enter the amount → tap the customer's card against the back of your phone. That's it.\n\nTap to Pay works on most modern iPhones (iPhone XS or newer) and Android phones (NFC-enabled, Android 11+). No card reader, no extra hardware.",
        callout: { type: 'tip', text: "Apple Pay, Google Pay, and contactless cards all work. If your phone supports tapping to pay, your phone supports accepting a tap to pay." },
      },
      {
        heading: "Remote charges (coming soon)",
        body: "For customers you can't see in person, a **Charge customer** button is coming that generates a secure Stripe payment link. Text or email it to them; they pay in their browser. The charge lands in your Stripe account the same way.",
      },
      {
        heading: "Payouts + fees",
        body: "Stripe handles payouts automatically — typically 2 business days after a charge. You can change the payout schedule (daily, weekly, monthly) from Stripe's Dashboard app.\n\n**Fees:** Stripe's standard processing is 2.9% + 30¢ per charge for online payments, 2.7% + 5¢ for Tap to Pay in-person. On top of that, we take a **$2 flat platform fee** per transaction to keep the lights on here.",
      },
      {
        heading: "Manage your Stripe account",
        body: "Use the **Stripe Dashboard** mobile app or `dashboard.stripe.com` in a browser for everything payment-related: payout history, refunds, disputes, updating your bank account, downloading tax documents. Our **Payments** page just gets you connected and shows the high-level status.",
      },
    ],
  },

  // -----------------------------------------------------------------------
  {
    slug: 'booking-deposits',
    title: 'Booking Deposits',
    description: 'Collect a deposit when customers book. Secure your calendar.',
    icon: '💰',
    readTime: '3 min read',
    isPro: true,
    steps: [
      {
        heading: "Why deposits",
        body: "A deposit is a percentage of the service price that the customer pays at booking. It's a small commitment that dramatically reduces no-shows — people who've already paid $20 tend to actually show up. And if you charge a non-refundable deposit, a last-minute cancel still covers part of the slot.",
      },
      {
        heading: "Connect Stripe first",
        body: "Deposits run through Stripe, so you need your Stripe account connected. See the **Accepting Payments** article. Without a connected Stripe account, deposits are silently skipped and bookings flow normally.",
      },
      {
        heading: "Set your deposit percentage",
        body: "Click **Bookings** → **Settings** tab → **General**. Find the **Deposit %** field. Enter a number between 0 and 100 — common values are 20, 25, or 50. Set to **0** to turn deposits off entirely. Click **Save**.\n\nThe same percentage applies to every service (for simplicity). Per-service overrides may come later.",
      },
      {
        heading: "Make sure your services have prices",
        body: "Deposits are calculated as a percentage of each service's price. If a service has a price like `$99`, `199`, or `1,299.00`, the deposit will be computed automatically. Services with non-numeric prices like `Call for quote` silently skip the deposit — the booking still works, just with no payment collected.",
        callout: { type: 'tip', text: "The minimum deposit Stripe will accept is 50¢. If your percentage × price comes out under that, the deposit is skipped for that booking." },
      },
      {
        heading: "What customers see",
        body: "When a customer fills out the booking form on your site and clicks Submit, they're redirected to a Stripe Checkout page showing the deposit amount. They pay with any card, Apple Pay, Google Pay. On success, they're redirected back to your site with a confirmation.\n\nIf they abandon Checkout without paying, the booking is still saved with status **pending** and deposit status **pending** — you can follow up with them or just let it expire.",
      },
      {
        heading: "Tracking deposits in your dashboard",
        body: "On the **Bookings** page, each row shows a deposit pill next to the status — **Deposit paid** (green), **Deposit pending** (amber), or nothing if no deposit was required. Click into any booking for the full deposit details: amount required, amount paid, paid timestamp.",
      },
      {
        heading: "Refunds",
        body: "Refund a deposit by opening the charge in your **Stripe Dashboard** (mobile app or web) and clicking Refund. We'll surface a Refund button inside the app in a future update, but for now Stripe is the source of truth for all payment actions.",
      },
    ],
  },

  // -----------------------------------------------------------------------
  {
    slug: 'customers',
    title: 'Customers',
    description: 'Track everyone who\'s booked with you.',
    icon: '👥',
    readTime: '3 min read',
    isPro: true,
    steps: [
      {
        heading: 'Open the Customers page',
        body: 'Click **Customers** in the top nav (visible when you\'re Pro). You\'ll see everyone who has ever booked with you, automatically.',
      },
      {
        heading: 'Add a customer manually',
        body: "Click **+ Add customer** in the top-right. Fill in their name, email, phone, vehicle info, notes, and tags. Manually-added customers get a **Manual** badge so you can tell them apart from booking-derived ones. They'll merge automatically if they later book through the scheduler with the same email or phone.",
      },
      {
        heading: 'Customer detail',
        body: "Click any customer to open their detail page. You see their full booking history, contact info, and totals — how many appointments, total spent, first and last visit.",
      },
      {
        heading: 'Upload a photo',
        body: "On the customer detail page, click the pencil icon on the avatar to upload a photo (JPG or PNG, up to 500 KB). The photo shows on the customer list and the detail page. Helpful for quickly recognizing regulars.",
      },
      {
        heading: 'Book a customer from the dashboard',
        body: "On any customer's detail page, click **+ Book this customer**. Pick a service, date, and time — vehicle info is pre-filled from their profile. The booking is created as **confirmed** (no availability or lead-time checks — you're the owner, you override). The customer gets a confirmation email unless you uncheck the box.",
      },
      {
        heading: 'Notes',
        body: "Add private notes on any customer — allergy to wax, prefers morning appointments, drives a blue Civic. Notes are visible only to you, from the customer detail page.",
      },
      {
        heading: 'Tags',
        body: "Tag customers with labels like **VIP**, **First-time**, **Referral**. Filter the Customers page by tag to see just that group.",
      },
      {
        heading: 'Email a customer',
        body: "From the customer detail page, click **Send Email**. Compose your message inside the app — it sends from your business email and is logged in the customer's timeline.",
      },
      {
        heading: 'Export to CSV',
        body: "Click **Export CSV** on the Customers page to download the full list. Useful for importing into an email tool (Mailchimp, Klaviyo) or for offline record-keeping.",
      },
    ],
  },

  // -----------------------------------------------------------------------
  {
    slug: 'profile',
    title: 'Your Profile',
    description: 'Update your account details and password.',
    icon: '👤',
    readTime: '1 min read',
    steps: [
      {
        heading: 'Open your profile',
        body: "Click your avatar in the top-right corner, then **Profile**. You can edit your first name, last name, business name, and phone.",
      },
      {
        heading: 'Upload a profile photo',
        body: "At the top of the Account details card, click **Upload photo** to add a picture of yourself or your logo (JPG or PNG, up to 500 KB). Your photo appears in the top-right nav avatar anywhere you go in the app. Click **Replace** to swap it or **Remove** to go back to the default initial letter.",
      },
      {
        heading: 'Change password',
        body: 'On the Profile page, click **Change Password**. Enter your current password, then the new one. You stay signed in.',
      },
      {
        heading: 'Signed-out? Use the forgot-password link',
        body: "If you're signed out and can't remember your password, click **Forgot password?** on the login page. We'll email you a reset link.",
      },
    ],
  },
];
