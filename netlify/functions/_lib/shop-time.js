// netlify/functions/_lib/shop-time.js
// The shop's clock (lead time, "today"): see src/lib/shopTimeZone.js, which
// Booking Settings shares so both sides name the same zone for a site.
export {
  DEFAULT_SHOP_TIME_ZONE,
  isValidTimeZone,
  resolveShopTimeZone,
  shopNowWallMs,
  shopTodayISO,
} from '../../../src/lib/shopTimeZone.js';
