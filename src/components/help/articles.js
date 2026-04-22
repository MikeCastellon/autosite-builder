// src/components/help/articles.js
//
// v1 content is placeholder text. Real prose + screenshot paths + annotations
// are filled in Task 11 after screenshots are captured in Task 10.

export const ARTICLES = [
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description: 'Zero to published site in 5 minutes.',
    icon: '🚀',
    readTime: '5 min read',
    schedulerOnly: false,
    steps: Array.from({ length: 7 }, (_, i) => ({
      heading: `Step ${i + 1}`,
      body: `Placeholder body for getting-started step ${i + 1}.`,
      screenshot: null,
    })),
  },
  {
    slug: 'business-type-and-template',
    title: 'Choosing a Business Type & Template',
    description: 'Pick what fits your business and customize colors.',
    icon: '🎨',
    readTime: '3 min read',
    schedulerOnly: false,
    steps: Array.from({ length: 6 }, (_, i) => ({
      heading: `Step ${i + 1}`,
      body: `Placeholder body for business-type-and-template step ${i + 1}.`,
      screenshot: null,
    })),
  },
  {
    slug: 'the-edit-menu',
    title: 'The Edit Menu',
    description: 'Edit text, images, colors, and fonts on your site.',
    icon: '✏️',
    readTime: '4 min read',
    schedulerOnly: false,
    steps: Array.from({ length: 10 }, (_, i) => ({
      heading: `Step ${i + 1}`,
      body: `Placeholder body for the-edit-menu step ${i + 1}.`,
      screenshot: null,
    })),
  },
  {
    slug: 'google-reviews',
    title: 'Adding Google Reviews',
    description: 'Show live Google reviews on your site.',
    icon: '⭐',
    readTime: '2 min read',
    schedulerOnly: false,
    steps: Array.from({ length: 4 }, (_, i) => ({
      heading: `Step ${i + 1}`,
      body: `Placeholder body for google-reviews step ${i + 1}.`,
      screenshot: null,
    })),
  },
  {
    slug: 'publishing',
    title: 'Publishing Your Site',
    description: 'Publish to a live URL and update later.',
    icon: '🌐',
    readTime: '3 min read',
    schedulerOnly: false,
    steps: Array.from({ length: 5 }, (_, i) => ({
      heading: `Step ${i + 1}`,
      body: `Placeholder body for publishing step ${i + 1}.`,
      screenshot: null,
    })),
  },
  {
    slug: 'managing-sites',
    title: 'Managing Your Sites',
    description: 'Edit, republish, or delete from your dashboard.',
    icon: '📁',
    readTime: '2 min read',
    schedulerOnly: false,
    steps: Array.from({ length: 4 }, (_, i) => ({
      heading: `Step ${i + 1}`,
      body: `Placeholder body for managing-sites step ${i + 1}.`,
      screenshot: null,
    })),
  },
  {
    slug: 'bookings',
    title: 'Bookings',
    description: 'Accept appointments directly from your site.',
    icon: '📅',
    readTime: '3 min read',
    schedulerOnly: true,
    steps: Array.from({ length: 6 }, (_, i) => ({
      heading: `Step ${i + 1}`,
      body: `Placeholder body for bookings step ${i + 1}.`,
      screenshot: null,
    })),
  },
];
