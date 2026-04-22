// src/components/help/articles.js
//
// v1 ships text-only: great prose, callouts, and inline formatting,
// but no screenshots yet. To add screenshots later, drop PNGs into
// public/help/ and add `screenshot: '/help/<filename>.png'` to any step.
//
// Inline formatting supported in `body` and `callout.text`:
//   **bold**    *italic*    `code`    \n\n (paragraph break)
// Callouts: { type: 'tip' | 'heads-up', text: '...' }

export const ARTICLES = [
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description: 'Zero to published site in 5 minutes.',
    icon: '🚀',
    readTime: '5 min read',
    schedulerOnly: false,
    steps: [
      {
        heading: 'Welcome',
        body: "This site builder turns a few details about your business into a live website — copy, images, colors, and all. No coding, no design skills. You'll finish in about 5 minutes.\n\nHere's the full flow, start to finish.",
      },
      {
        heading: 'Sign up',
        body: 'Click **Sign In** in the top-right corner of the landing page, then switch to sign-up. Enter your email and a password. You\'ll get a verification email — click the link inside to activate your account.',
        callout: { type: 'heads-up', text: 'Check your spam folder if the email doesn\'t arrive within 2 minutes.' },
      },
      {
        heading: 'Pick your business type',
        body: 'Once signed in, click **New Site** on the dashboard. Pick the option that best matches your business — this shapes the templates and copy the AI generates.',
      },
      {
        heading: 'Fill in the details',
        body: 'Add your business name, a short description, hours, and contact info. The more specific you are, the better the AI output. Short on time? Click **Fill Demo** to see how the form should look.',
      },
      {
        heading: 'Pick a template',
        body: 'Browse the template grid and pick one that matches the vibe you want. You can tweak colors and fonts before generation — or after, in the edit menu.',
      },
      {
        heading: 'Generate',
        body: 'Click **Generate Site**. The AI writes headlines, services, about-us copy, and more — tailored to the details you entered. This takes about 30 seconds.',
        callout: { type: 'tip', text: 'You can regenerate any section later from the edit menu if you don\'t love the first draft.' },
      },
      {
        heading: 'Edit, publish, share',
        body: "That's it — you're in the editor. Read **The Edit Menu** article to learn how to tweak text, images, colors, and fonts. When you're ready, publish from the **Export** step and share your live URL.",
      },
    ],
  },
  {
    slug: 'business-type-and-template',
    title: 'Choosing a Business Type & Template',
    description: 'Pick what fits your business and customize colors.',
    icon: '🎨',
    readTime: '3 min read',
    schedulerOnly: false,
    steps: [
      {
        heading: 'Start a new site',
        body: 'From the dashboard, click **New Site** to open the wizard. Step 1 asks what type of business you run.',
      },
      {
        heading: 'Pick the closest match',
        body: "If your exact business isn't listed, pick the closest option. The business type mostly shapes the default copy tone and which templates appear — you can override everything later.",
      },
      {
        heading: 'Fill in your details',
        body: 'Step 2 collects your business name, tagline, hours, contact info, and a brief description. Be specific — the AI uses these verbatim in headlines and body copy.',
        callout: { type: 'tip', text: 'Click **Fill Demo** to auto-populate with example data if you want to preview the flow first.' },
      },
      {
        heading: 'Browse templates',
        body: 'Step 3 shows a grid of templates filtered to your business type. Each template has a distinct layout, font pairing, and mood. Click one to select it.',
      },
      {
        heading: 'Customize colors and fonts',
        body: 'After selecting, a customization panel appears. Tweak primary and accent colors, switch between serif or sans-serif fonts, and preview changes live.',
      },
      {
        heading: 'Generate',
        body: 'When you\'re happy with the template and colors, click **Generate Site**. The AI fills in all the text, sections, and structure using your details.',
      },
    ],
  },
  {
    slug: 'the-edit-menu',
    title: 'The Edit Menu',
    description: 'Edit text, images, colors, and fonts on your site.',
    icon: '✏️',
    readTime: '4 min read',
    schedulerOnly: false,
    steps: [
      {
        heading: 'Open the preview',
        body: 'After generating, you land directly in the preview. This is your live site — what you see here is what your visitors will see.',
        callout: { type: 'tip', text: 'All changes save automatically as you work — there\'s no Save button to click.' },
      },
      {
        heading: 'Click any text to edit',
        body: 'Hover over any heading, paragraph, or list item. You\'ll see an edit outline appear. Click it to open an inline editor where you can rewrite the text.',
      },
      {
        heading: 'Replace an image',
        body: "Click any image on your site to open the image editor. You can upload a new file, paste a URL, or pick from your previous uploads. For icons, you can also pick an emoji or icon name.",
      },
      {
        heading: 'Change colors',
        body: 'Open the **Colors** panel from the top toolbar. Adjust primary, accent, background, and text colors. Changes apply instantly across the whole site.',
      },
      {
        heading: 'Preview color changes',
        body: 'As you change colors, the preview updates live. Try a few combinations — you can always revert to the template\'s default if you want to start over.',
      },
      {
        heading: 'Change fonts',
        body: 'Open the **Fonts** panel. Pick a heading font and a body font — the site applies the pairing immediately. Font pairings are curated for readability.',
      },
      {
        heading: 'Add or remove sections',
        body: 'Each section on your site has controls to hide it or show it. Use these to streamline the page — remove what you don\'t need, keep what\'s most important for your visitors.',
      },
      {
        heading: 'Auto-save',
        body: 'A small indicator in the top toolbar shows when changes are saved. You\'ll see "Saving..." briefly after each edit, then "Saved". You can close the browser without losing work.',
        callout: { type: 'heads-up', text: 'Auto-save runs 1.5 seconds after your last edit. If you\'re making rapid changes, wait a moment before closing the tab.' },
      },
      {
        heading: 'Preview on mobile',
        body: 'Resize your browser or open the preview on your phone to see how your site looks on mobile. The layout adapts automatically — no extra work needed.',
      },
      {
        heading: 'When you\'re done',
        body: 'When the site looks right, click **Continue** to move to Social Feeds (optional), then **Publish** to push it live. You can always come back and edit more from the **My Sites** dashboard.',
      },
    ],
  },
  {
    slug: 'google-reviews',
    title: 'Adding Google Reviews',
    description: 'Show live Google reviews on your site.',
    icon: '⭐',
    readTime: '2 min read',
    schedulerOnly: false,
    steps: [
      {
        heading: 'Get your widget key',
        body: 'Google Reviews are pulled via SocialFeed — you\'ll need a widget key from your SocialFeed account. If you don\'t have one, sign up at `socialfeed.com` and connect your Google Business Profile.',
      },
      {
        heading: 'Open the Social Feeds step',
        body: 'After editing in the preview, click **Continue** to move to the Social Feeds step. You\'ll see a Google Reviews section with an input for the widget key.',
      },
      {
        heading: 'Paste your key',
        body: 'Paste the widget key into the input and click **Save**. The key is stored with your account — you only need to enter it once.',
        callout: { type: 'tip', text: 'Your widget key is saved to your profile. Future sites you create will use the same key automatically.' },
      },
      {
        heading: 'Preview the reviews',
        body: 'Go back to the preview. A new Reviews section now shows your live Google reviews — the 5 most recent, in a carousel on desktop and a stack on mobile.',
      },
    ],
  },
  {
    slug: 'publishing',
    title: 'Publishing Your Site',
    description: 'Publish to a live URL and update later.',
    icon: '🌐',
    readTime: '3 min read',
    schedulerOnly: false,
    steps: [
      {
        heading: 'Open the Export step',
        body: 'From the preview, click **Continue** until you reach the **Export** step. This is where you publish your site to a live URL.',
      },
      {
        heading: 'Pick a slug',
        body: 'Your site will be published at `https://<slug>.autocaregenius.com`. Pick a short, memorable slug (your business name works well). The slug must be unique.',
      },
      {
        heading: 'Publish',
        body: 'Click **Publish**. The site deploys in a few seconds. You\'ll see a confirmation with your live URL — click to open.',
      },
      {
        heading: 'Share your URL',
        body: 'Copy the URL and share it anywhere — social media, email, business cards, Google Business Profile. Your site is live and public.',
      },
      {
        heading: 'Update your site later',
        body: 'To update a published site: go to **My Sites**, click **Edit** on the site card, make your changes, then click **Republish** from the dashboard. The live URL stays the same.',
        callout: { type: 'heads-up', text: 'Republishing overwrites the live version immediately. If you want to preview changes privately first, edit without clicking Republish.' },
      },
    ],
  },
  {
    slug: 'managing-sites',
    title: 'Managing Your Sites',
    description: 'Edit, republish, or delete from your dashboard.',
    icon: '📁',
    readTime: '2 min read',
    schedulerOnly: false,
    steps: [
      {
        heading: 'Open My Sites',
        body: 'Click **My Sites** in the top navigation. You\'ll see a list of every site you\'ve created, with the most recent first.',
      },
      {
        heading: 'Edit a site',
        body: 'Click **Edit** on any site card to jump back into the preview and make changes. Your edits save automatically.',
      },
      {
        heading: 'Republish after editing',
        body: 'After editing a published site, click **Republish** on the site card to push your changes live. The URL stays the same.',
      },
      {
        heading: 'Delete a site',
        body: 'Click **Delete** on the site card to remove a site permanently. If the site is published, this also unpublishes it — the live URL will stop working.',
        callout: { type: 'heads-up', text: 'Deletion is permanent. Free accounts are limited to 1 site — deleting a site lets you create a new one.' },
      },
    ],
  },
  {
    slug: 'bookings',
    title: 'Bookings',
    description: 'Accept appointments directly from your site.',
    icon: '📅',
    readTime: '3 min read',
    schedulerOnly: true,
    steps: [
      {
        heading: 'Enable bookings on a site',
        body: 'Bookings are available when your account has the scheduler feature enabled. If you don\'t see Booking Settings on your dashboard, contact support.',
      },
      {
        heading: 'Configure availability',
        body: 'From the dashboard, click **Booking Settings** on any site card. Set your weekly availability — which days, which hours you\'re open for appointments.',
      },
      {
        heading: 'Define services',
        body: 'Add the services customers can book: name, duration, and buffer time between appointments. Each service becomes a bookable option on your site.',
      },
      {
        heading: 'Embed the booking widget',
        body: 'When bookings are enabled, a booking widget appears in your published site — visitors can pick a service, choose a time slot, and confirm directly.',
      },
      {
        heading: 'View incoming bookings',
        body: 'Open **Bookings** from the top navigation. You\'ll see every upcoming appointment, sortable by date or service. Click a booking for full details and contact info.',
      },
      {
        heading: 'Manage bookings',
        body: 'Confirm, reschedule, or cancel any appointment. The customer receives an email for each status change.',
        callout: { type: 'tip', text: 'Connect Google Calendar to sync confirmed bookings automatically. Settings → Calendar Integrations.' },
      },
    ],
  },
];
