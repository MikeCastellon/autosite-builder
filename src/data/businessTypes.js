export const BUSINESS_TYPES = [
  {
    id: 'detailing_shop',
    label: 'Car Detailing Shop',
    icon: '✨',
    description: 'Fixed-location detailing studio',
    templates: ['detailing_sporty'],
    premiumTemplates: [],
  },
  {
    id: 'mobile_detailing',
    label: 'Mobile Detailing',
    icon: '🚐',
    description: 'On-the-go mobile detailing service',
    templates: ['mobile_chrome', 'mobile_sudsy'],
    premiumTemplates: [],
  },
  {
    id: 'wheel_shop',
    label: 'Wheel Shop',
    icon: '🔧',
    description: 'Custom wheels, tires & fitment',
    templates: ['wheel_apex'],
    premiumTemplates: [],
  },
  {
    id: 'tint_shop',
    label: 'Tint Shop',
    icon: '🌑',
    description: 'Window tint & paint protection film',
    templates: ['tint_elite', 'tint_obsidian'],
    premiumTemplates: [],
  },
  {
    id: 'mechanic_shop',
    label: 'Mechanic Shop',
    icon: '🔩',
    description: 'Auto repair & maintenance',
    templates: ['mechanic_industrial', 'mechanic_garage', 'mechanic_ironclad'],
    premiumTemplates: [],
  },
  {
    id: 'car_wash',
    label: 'Car Wash',
    icon: '🚿',
    description: 'Automated or hand car wash',
    templates: ['carwash_bubble'],
    premiumTemplates: [],
  },
];

export const COMMON_FIELDS = [
  { key: 'businessName',    label: 'Business Name',        type: 'text',     required: true,  placeholder: 'e.g. Elite Auto Detail' },
  { key: 'phone',           label: 'Phone Number',         type: 'tel',      required: true,  placeholder: '(555) 555-5555' },
  { key: 'city',            label: 'City',                 type: 'text',     required: true,  placeholder: 'e.g. Las Vegas' },
  { key: 'state',           label: 'State',                type: 'text',     required: true,  placeholder: 'e.g. NV' },
  { key: 'address',         label: 'Street Address',       type: 'text',     required: false, placeholder: '123 Main St (optional)' },
  { key: 'tagline',         label: 'Your Tagline or Vibe', type: 'text',     required: false, placeholder: 'e.g. Where Every Detail Matters' },
  { key: 'yearsInBusiness', label: 'Years in Business',    type: 'number',   required: false, placeholder: 'e.g. 8' },
  { key: 'hours',           label: 'Business Hours',       type: 'text',     required: false, placeholder: 'e.g. Mon–Sat 8am–6pm' },
  { key: 'instagram',       label: 'Instagram Handle',     type: 'text',     required: false, placeholder: '@yourbusiness' },
  { key: 'facebook',        label: 'Facebook Page URL',    type: 'text',     required: false, placeholder: 'facebook.com/yourbusiness' },
  { key: 'tiktok',          label: 'TikTok Handle',        type: 'text',     required: false, placeholder: '@yourbusiness' },
];

export const COMMON_EXTRA_FIELDS = [
  {
    key: 'paymentMethods',
    label: 'Payment Methods Accepted',
    type: 'multicheck',
    required: false,
    options: ['Cash', 'Credit Card', 'Debit Card', 'Venmo', 'Zelle', 'CashApp', 'Financing Available'],
  },
  { key: 'awards', label: 'Awards / Recognition', type: 'text', required: false, placeholder: 'e.g. Best Detail Shop 2024 — Miami Herald' },
  { key: 'certifications', label: 'Certifications', type: 'text', required: false, placeholder: 'e.g. IDA Certified, 3M Authorized, XPEL Certified Installer' },
];

export const TYPE_SPECIFIC_FIELDS = {
  detailing_shop: [
    { key: 'services',    label: 'Services & Pricing',          type: 'packages', required: true },
    { key: 'specialties', label: 'What makes you stand out?',   type: 'textarea', required: false, placeholder: 'e.g. We specialize in luxury & exotic vehicles' },
  ],
  mobile_detailing: [
    { key: 'services',    label: 'Services & Pricing',          type: 'packages', required: true },
    { key: 'serviceArea', label: 'Service Area / Radius',       type: 'text',     required: false, placeholder: 'e.g. 30-mile radius from Las Vegas' },
    { key: 'specialties', label: 'What makes you stand out?',   type: 'textarea', required: false, placeholder: 'e.g. We come to you — home, office, or lot' },
  ],
  wheel_shop: [
    {
      key: 'services',
      label: 'Services Offered',
      type: 'multicheck',
      required: true,
      options: ['Custom Wheels', 'Tire Sales', 'Wheel Repair', 'Powder Coating', 'Chrome Dipping', 'Spacers & Adapters', 'Alignment', 'Balancing', 'Lowering Kits'],
    },
    { key: 'brands',      label: 'Wheel Brands Carried',        type: 'text',     required: false, placeholder: 'e.g. Forgiato, Vossen, ADV.1, HRE' },
    { key: 'tireBrands',  label: 'Tire Brands Carried',         type: 'text',     required: false, placeholder: 'e.g. Michelin, Nitto, Toyo, Continental' },
    { key: 'specialties', label: 'What makes you stand out?',   type: 'textarea', required: false, placeholder: '' },
  ],
  tint_shop: [
    { key: 'services',    label: 'Services & Pricing',          type: 'packages', required: true },
    { key: 'filmBrands',  label: 'Film Brands Used',            type: 'text',     required: false, placeholder: 'e.g. XPEL, LLumar, 3M, Ceramic Pro' },
    { key: 'warranty',    label: 'Warranty Offered',            type: 'text',     required: false, placeholder: 'e.g. Lifetime warranty on all ceramic tint' },
    { key: 'specialties', label: 'What makes you stand out?',   type: 'textarea', required: false, placeholder: '' },
  ],
  mechanic_shop: [
    {
      key: 'services',
      label: 'Services Offered',
      type: 'multicheck',
      required: true,
      options: ['Oil Change', 'Brakes', 'Transmission', 'Engine Repair', 'Diagnostics', 'A/C Service', 'Tires', 'Suspension', 'Exhaust', 'Tune-Up', 'Electrical', 'State Inspection'],
    },
    { key: 'specialties',     label: 'Vehicle Specialties',            type: 'text',     required: false, placeholder: 'e.g. Honda & Toyota specialists, European cars' },
    { key: 'warrantyOffered', label: 'Parts & Labor Warranty',         type: 'text',     required: false, placeholder: 'e.g. 12-month / 12,000-mile warranty on all repairs' },
  ],
  car_wash: [
    { key: 'services',    label: 'Wash Packages & Pricing',    type: 'packages', required: true },
    { key: 'specialties', label: 'What makes you stand out?',  type: 'textarea', required: false, placeholder: 'e.g. Eco-friendly soap, unlimited monthly membership' },
  ],
};

export const BUSINESS_TYPE_LABELS = {
  detailing_shop:    'Auto Detailing',
  mobile_detailing:  'Mobile Detailing',
  wheel_shop:        'Wheel & Tire Shop',
  tint_shop:         'Tint & PPF Shop',
  mechanic_shop:     'Auto Repair Shop',
  car_wash:          'Car Wash',
};
