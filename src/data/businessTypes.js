export const BUSINESS_TYPES = [
  {
    id: 'detailing_shop',
    label: 'Car Detailing Shop',
    icon: '✨',
    description: 'Fixed-location detailing studio',
    templates: ['detailing_premium', 'detailing_sporty', 'detailing_minimal'],
  },
  {
    id: 'mobile_detailing',
    label: 'Mobile Detailing',
    icon: '🚐',
    description: 'On-the-go mobile detailing service',
    templates: ['mobile_bold', 'mobile_modern', 'mobile_rugged'],
  },
  {
    id: 'wheel_shop',
    label: 'Wheel Shop',
    icon: '🔧',
    description: 'Custom wheels, tires & fitment',
    templates: ['wheel_edge', 'wheel_clean'],
  },
  {
    id: 'tint_shop',
    label: 'Tint Shop',
    icon: '🌑',
    description: 'Window tint & paint protection film',
    templates: ['tint_dark', 'tint_sleek'],
  },
  {
    id: 'mechanic_shop',
    label: 'Mechanic Shop',
    icon: '🔩',
    description: 'Auto repair & maintenance',
    templates: ['mechanic_industrial', 'mechanic_friendly'],
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
];

export const TYPE_SPECIFIC_FIELDS = {
  detailing_shop: [
    {
      key: 'services',
      label: 'Services Offered',
      type: 'multicheck',
      required: true,
      options: ['Full Detail', 'Wash & Wax', 'Interior Only', 'Paint Correction', 'Ceramic Coating', 'PPF', 'Engine Bay'],
    },
    { key: 'priceRange',  label: 'Starting Price',              type: 'text',     required: false, placeholder: 'e.g. Starting at $150' },
    { key: 'specialties', label: 'What makes you stand out?',   type: 'textarea', required: false, placeholder: 'e.g. We specialize in luxury & exotic vehicles' },
  ],
  mobile_detailing: [
    {
      key: 'services',
      label: 'Services Offered',
      type: 'multicheck',
      required: true,
      options: ['Full Detail', 'Wash & Wax', 'Interior Only', 'Ceramic Coating', 'Waterless Wash', 'Fleet Service'],
    },
    { key: 'serviceArea', label: 'Service Area / Radius',       type: 'text',     required: false, placeholder: 'e.g. 30-mile radius from Las Vegas' },
    { key: 'specialties', label: 'What makes you stand out?',   type: 'textarea', required: false, placeholder: 'e.g. We come to you — home, office, or lot' },
  ],
  wheel_shop: [
    {
      key: 'services',
      label: 'Services Offered',
      type: 'multicheck',
      required: true,
      options: ['Custom Wheels', 'Tire Sales', 'Wheel Repair', 'Powder Coating', 'Spacers & Adapters', 'Alignment'],
    },
    { key: 'brands',      label: 'Wheel Brands Carried',        type: 'text',     required: false, placeholder: 'e.g. Forgiato, Vossen, ADV.1' },
    { key: 'specialties', label: 'What makes you stand out?',   type: 'textarea', required: false, placeholder: '' },
  ],
  tint_shop: [
    {
      key: 'services',
      label: 'Services Offered',
      type: 'multicheck',
      required: true,
      options: ['Window Tint', 'Paint Protection Film', 'Ceramic Coating', 'Headlight Tint', 'Vinyl Wrap', 'Detailing'],
    },
    { key: 'filmBrands',  label: 'Film Brands Used',            type: 'text',     required: false, placeholder: 'e.g. XPEL, LLumar, 3M' },
    { key: 'warranty',    label: 'Warranty Offered',            type: 'text',     required: false, placeholder: 'e.g. Lifetime warranty on all ceramic tint' },
    { key: 'specialties', label: 'What makes you stand out?',   type: 'textarea', required: false, placeholder: '' },
  ],
  mechanic_shop: [
    {
      key: 'services',
      label: 'Services Offered',
      type: 'multicheck',
      required: true,
      options: ['Oil Change', 'Brakes', 'Transmission', 'Engine Repair', 'Diagnostics', 'A/C Service', 'Tires', 'Suspension'],
    },
    { key: 'specialties',     label: 'Vehicle Specialties',            type: 'text',     required: false, placeholder: 'e.g. Honda & Toyota specialists' },
    { key: 'certifications',  label: 'Certifications / Affiliations',  type: 'text',     required: false, placeholder: 'e.g. ASE Certified, AAA Approved' },
  ],
};

export const BUSINESS_TYPE_LABELS = {
  detailing_shop:    'Auto Detailing',
  mobile_detailing:  'Mobile Detailing',
  wheel_shop:        'Wheel & Tire Shop',
  tint_shop:         'Tint & PPF Shop',
  mechanic_shop:     'Auto Repair Shop',
};
