export const HEADING_FONTS = [
  { label: 'Inter — Modern Clean', family: "'Inter', sans-serif" },
  { label: 'Montserrat — Clean Geometric', family: "'Montserrat', sans-serif" },
  { label: 'Poppins — Friendly Geometric', family: "'Poppins', sans-serif" },
  { label: 'Playfair Display — Elegant Serif', family: "'Playfair Display', Georgia, serif" },
  { label: 'DM Serif Display — Editorial Serif', family: "'DM Serif Display', serif" },
  { label: 'Cormorant Garamond — Luxury Serif', family: "'Cormorant Garamond', serif" },
  { label: 'Bebas Neue — Bold Display', family: "'Bebas Neue', sans-serif" },
  { label: 'Oswald — Strong Condensed', family: "'Oswald', sans-serif" },
  { label: 'Syne — Modern Geometric', family: "'Syne', sans-serif" },
  { label: 'Righteous — Retro Display', family: "'Righteous', cursive" },
  { label: 'Boogaloo — Casual & Fun', family: "'Boogaloo', cursive" },
];

export const BODY_FONTS = [
  { label: 'Inter — Modern Clean', family: "'Inter', sans-serif" },
  { label: 'DM Sans — Neutral Reader', family: "'DM Sans', sans-serif" },
  { label: 'Nunito — Rounded Friendly', family: "'Nunito', sans-serif" },
  { label: 'Lato — Humanist Neutral', family: "'Lato', sans-serif" },
  { label: 'Open Sans — Classic Web', family: "'Open Sans', sans-serif" },
  { label: 'Barlow — Technical Clean', family: "'Barlow', sans-serif" },
  { label: 'Outfit — Geometric Modern', family: "'Outfit', sans-serif" },
  { label: 'Manrope — Rounded Modern', family: "'Manrope', sans-serif" },
  { label: 'Source Sans 3 — Professional', family: "'Source Sans 3', sans-serif" },
  { label: 'Roboto — System Neutral', family: "'Roboto', sans-serif" },
];

export const FONT_SLOTS = [
  {
    key: 'font',
    label: 'Heading Font',
    helper: 'Used for titles, hero text, and section headings',
    options: HEADING_FONTS,
  },
  {
    key: 'bodyFont',
    label: 'Body Font',
    helper: 'Used for paragraphs, descriptions, and most readable text',
    options: BODY_FONTS,
  },
];
