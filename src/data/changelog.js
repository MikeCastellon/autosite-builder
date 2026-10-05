// Product changelog — single source of truth for the dashboard "What's New"
// banner and the profile-page changelog archive. Add new entries to the TOP
// so the dashboard banner picks up the newest one automatically.
//
// Entry shape:
//   id    — stable slug used as the per-user dismiss key. Never rename.
//   date  — ISO date the update shipped. Shown in the archive.
//   title — short headline (used as the banner H3).
//   items — array of { strong, text } bullets. `strong` is bolded inline.

export const CHANGELOG = [
  {
    id: '2026-10-site-upgrade',
    // The release day of PR #10; keep SITE_UPGRADE_RELEASE_DATE in
    // src/lib/siteUpgrade.js the same.
    date: '2026-10-05',
    title: 'New designs for every website',
    items: [
      {
        strong: 'A fresh design for every template',
        text: '— cleaner layouts and sharper type, with the photos, services, prices and contact details saved in your editor.',
      },
      {
        strong: 'Built for phones',
        text: '— a real mobile menu, a Call / Book bar that stays in reach, and a booking calendar that fits small screens.',
      },
      {
        strong: 'Your colors and fonts everywhere',
        text: '— the colors and fonts you pick in the editor now apply to every section of your site.',
      },
      {
        strong: 'We\'ll switch your site over for you',
        text: '— we\'re moving live websites to the new design over the coming weeks and checking each one first. Your site card shows "New design live" once yours is done, and if yours needs anything from you, we\'ll get in touch.',
      },
    ],
  },
  {
    id: '2026-05-18-booking-addons',
    date: '2026-05-18',
    title: 'Offer add-ons on your services',
    items: [
      {
        strong: 'Charge for the extras you already do',
        text: '— add optional items like "Pet hair removal" or "Engine bay clean" to any service. Customers tick what they want when they book.',
      },
      {
        strong: 'Set them up in Booking Settings → Services',
        text: '— expand any service with a numeric price and add as many add-ons as you like.',
      },
      {
        strong: 'Totals and deposits update automatically',
        text: '— deposit % is charged against the full booking total (service + add-ons), so what the customer pays upfront matches what they saw.',
      },
    ],
  },
  {
    id: '2026-05-04-editor-refresh',
    date: '2026-05-04',
    title: 'Editor refresh + booking reminders',
    items: [
      {
        strong: 'Send a booking reminder in one tap',
        text: '— open any pending or confirmed booking and use the new Email or Text buttons. Texts open your phone\'s messages app prefilled, sent from your own number.',
      },
      {
        strong: 'Cleaner editor sidebar',
        text: '— sections are now grouped by Content, Design, and Settings with quick-jump icons. Easier to find what you\'re looking for.',
      },
      {
        strong: 'Per-day business hours editor',
        text: '— pick open and close times for each day. Phone numbers also auto-format as you type.',
      },
    ],
  },
];

// Helper for formatting changelog dates consistently.
export function formatChangelogDate(iso) {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}
