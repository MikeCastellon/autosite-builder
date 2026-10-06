// How a customer's reference site shapes their custom site's design
// (design.reference.mode): 'inspire' (the default: Claude reads it for
// taste only) or 'match' ("Suggest a design" mirrors its layout; colors,
// logo, photos and words still come from the customer's side).
//
// Its own module because designSuggest.js (which owns "Match its layout")
// imports customSiteDesign.js (which sanitizes design.reference): defining
// the list in either one and importing it into the other would make an
// import cycle. Both import it from here and re-export it.
export const REFERENCE_MODES = Object.freeze(['inspire', 'match']);
