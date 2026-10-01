// Edit > Contact > CTA Background: an optional photo behind the
// call-to-action band (images.cta). The template darkens it so the
// headline and buttons keep their contrast. Mounted under the Contact tab's
// "Contact / CTA Section" heading, the band it belongs to.
import { ImageSlot, Note } from './fields.jsx';

export function CtaPhotoField({ images, setImage, siteId, hidden = false }) {
  return (
    <>
      {hidden && <Note tone="warn" title="This band is switched off in Sections." />}
      <ImageSlot
        label="CTA Background"
        value={images?.cta}
        onChange={(v) => setImage('cta', v)}
        siteId={siteId}
        uploadKey="cta"
        help="A photo behind your call-to-action band, darkened so the text stays readable. Leave empty for a plain band."
      />
    </>
  );
}

export default CtaPhotoField;
