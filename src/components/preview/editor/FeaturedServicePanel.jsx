// Edit > Featured Service: the spotlight band for one service
// (copy.featuredService + images.featured). Without a chosen service the
// template features the first ceramic / coating service, so the select's
// first option says which one that is. The band's heading is in
// Edit > Headings (copy.sectionTitles.featured), not here.
import { useId, useState } from 'react';
import { formatPrice } from '../../../lib/formatPrice.js';
import { Label, Help, Note, Field, ImageSlot, TextListEditor, inputClass, linkButtonClass } from './fields.jsx';
import { serviceList, nameKey } from './serviceRefs.js';
import { MAX_BULLETS, featuredMatch, setFeaturedField, leftoverFields, clearLeftovers, COPY_LEFTOVERS } from './featuredService.js';
import { designDefaults } from './sectionHeadings.js';
import { normalizeLink, linkProblem } from './links.js';

const OTHER = '__other';

// copy.sectionTitles without one section's entry (null when nothing is left).
function withoutSection(titles, id) {
  if (!titles || typeof titles !== 'object' || Array.isArray(titles)) return null;
  const { [id]: _drop, ...rest } = titles;
  return Object.keys(rest).length ? rest : null;
}

export function FeaturedServicePanel({ copy, setCopy, businessInfo, images, setImage, siteId, hasHeadingsTab = false, headingDefaults = null }) {
  const services = serviceList(businessInfo, copy);
  const fs = copy?.featuredService && typeof copy.featuredService === 'object' && !Array.isArray(copy.featuredService) ? copy.featuredService : {};
  const own = typeof fs.serviceName === 'string' ? fs.serviceName : '';
  const ownService = own.trim() ? services.find((s) => nameKey(s.name) === nameKey(own)) : null;
  const match = featuredMatch(copy, services);
  // What "Automatic" would feature, whatever is chosen now.
  const auto = featuredMatch({ ...(copy || {}), featuredService: null }, services);

  // "Something else…" stays selected while the owner types a name, even
  // one that happens to match a service; a saved name that is no service
  // opens on it.
  const [other, setOther] = useState(Boolean(own.trim()) && !ownService);
  const selectValue = other || (own.trim() && !ownService) ? OTHER : ownService ? ownService.name : '';
  // The service featured before the owner picked another one in this
  // session: its price, benefits, button text and heading stay saved and
  // would now describe the new service, so the panel offers to clear them.
  const [pickedFrom, setPickedFrom] = useState('');

  const priceId = useId();
  const selectId = useId();

  // One write per action.
  const write = (key, value) => setCopy('featuredService', setFeaturedField(copy, key, value));

  const onSelect = (value) => {
    const before = match.name;
    if (before && nameKey(before) !== nameKey(value === OTHER ? '' : value)) setPickedFrom(before);
    if (value === OTHER) {
      setOther(true);
      // Start the name empty rather than with a service's name.
      if (ownService) write('serviceName', '');
      return;
    }
    setOther(false);
    write('serviceName', value);
  };

  const name = match.name;
  const servicePrice = match.service && /\S/.test(match.service.price) ? formatPrice(match.service.price) : '';
  const hidden = Array.isArray(copy?.hiddenSections) && copy.hiddenSections.includes('featured');
  const hasSettings = Boolean(copy?.featuredService);
  const priceText = typeof fs.priceFrom === 'string' ? fs.priceFrom : '';
  // What the band's heading says now: the owner's (Edit > Headings), else
  // the design's own for this service.
  const ownHeading = copy?.sectionTitles?.featured && typeof copy.sectionTitles.featured === 'object' ? copy.sectionTitles.featured : {};
  const heading = (typeof ownHeading.title === 'string' && ownHeading.title.trim()) || designDefaults(headingDefaults, businessInfo, copy)?.featured?.title || '';
  const leftovers = pickedFrom && nameKey(pickedFrom) !== nameKey(name) ? leftoverFields(copy, images) : [];

  return (
    <>
      {hidden && <Note tone="warn" title="This band is switched off in Sections." />}

      <div className="mb-4">
        <Label htmlFor={selectId}>Service to feature</Label>
        <select id={selectId} aria-label="Service to feature" value={selectValue} onChange={(e) => onSelect(e.target.value)} className={inputClass}>
          <option value="">{`Automatic (${auto.name || 'none found'})`}</option>
          {services.map((s, i) => (
            <option key={`${i}-${s.name}`} value={s.name}>{s.name}</option>
          ))}
          <option value={OTHER}>Something else…</option>
        </select>
        {!name && <Help>Pick a service to feature. Until then this band only shows when one of your services is a ceramic coating.</Help>}
      </div>

      {leftovers.length > 0 && (
        <Note tone="warn" title={`Still written for ${pickedFrom}`}>
          <p>{leftovers.map((f) => f.label).join(', ')}. Check them, or clear them to start fresh for {name || 'the new service'}.</p>
          <div className="flex flex-wrap gap-x-3 mt-1">
            {leftovers.some((f) => COPY_LEFTOVERS.includes(f.key)) && (
              <button type="button" className={linkButtonClass} onClick={() => setCopy('featuredService', clearLeftovers(copy))}>
                Clear price, benefits &amp; button
              </button>
            )}
            {leftovers.some((f) => f.key === 'heading') && (
              <button type="button" className={linkButtonClass} onClick={() => setCopy('sectionTitles', withoutSection(copy?.sectionTitles, 'featured'))}>
                Clear the heading
              </button>
            )}
            {leftovers.some((f) => f.key === 'photo') && (
              <button type="button" className={linkButtonClass} onClick={() => setImage('featured', null)}>
                Remove the photo
              </button>
            )}
          </div>
        </Note>
      )}

      {selectValue === OTHER && (
        <Field
          label="Name"
          value={own}
          onChange={(v) => write('serviceName', v)}
          placeholder="e.g. Ceramic Coating"
          maxLength={40}
          help="A service you offer that is not in your Services list."
        />
      )}

      <div className="mb-4">
        <Label htmlFor={priceId}>Starting price</Label>
        <input
          id={priceId}
          type="text"
          value={typeof fs.priceFrom === 'string' ? fs.priceFrom : ''}
          placeholder={servicePrice || 'e.g. $600'}
          onChange={(e) => write('priceFrom', e.target.value)}
          onBlur={(e) => {
            const formatted = formatPrice(e.target.value);
            if (formatted !== (fs.priceFrom || '')) write('priceFrom', formatted);
          }}
          className={inputClass}
        />
        {priceText.trim() && !/\d/.test(priceText) ? (
          <Help tone="warn">No number in it, so the band shows it as written, without &apos;Starting at&apos;. Use a number, e.g. $450.</Help>
        ) : (
          <Help>Shown as &apos;Starting at $600&apos;. Leave empty to show the service&apos;s own price.</Help>
        )}
      </div>

      <Label>Benefits</Label>
      <TextListEditor
        items={Array.isArray(fs.bullets) ? fs.bullets : []}
        onChange={(next) => write('bullets', next)}
        max={MAX_BULLETS}
        itemLabel="benefit"
        addLabel="+ Add benefit"
        placeholder="e.g. Long-lasting protection"
      />
      <Help className="-mt-1 mb-4">Short points that are true for this service. Leave empty to use its What&apos;s Included list.</Help>

      <Field label="Button text" value={fs.buttonText} onChange={(v) => write('buttonText', v)} placeholder={`Book ${name || 'Now'}`} maxLength={30} />
      <Field
        label="Button link"
        value={fs.buttonUrl}
        onChange={(v) => write('buttonUrl', v)}
        onBlur={(v) => { if (normalizeLink(v) !== v.trim() || v !== v.trim()) write('buttonUrl', normalizeLink(v)); }}
        placeholder="Leave empty for your booking form"
        help={linkProblem(fs.buttonUrl) || 'A full link (https://…) or a section like #contact. Left empty, it opens your booking form, or calls you while booking is off.'}
        helpTone={linkProblem(fs.buttonUrl) ? 'error' : undefined}
      />

      <ImageSlot
        label="Featured Photo"
        value={images?.featured}
        onChange={(v) => setImage('featured', v)}
        siteId={siteId}
        uploadKey="featured"
        help="A photo of this service. Leave empty for a text-only band."
      />

      {hasHeadingsTab && (
        <Help className="mb-3">
          {heading ? <>Heading on the page: <span className="text-gray-700">&ldquo;{heading}&rdquo;</span>. </> : null}
          Set the small label and the heading in Edit &gt; Headings.
        </Help>
      )}

      {hasSettings && (
        <button
          type="button"
          className={linkButtonClass}
          onClick={() => {
            setOther(false);
            setPickedFrom('');
            setCopy('featuredService', null);
          }}
        >
          Clear featured settings
        </button>
      )}
    </>
  );
}

export default FeaturedServicePanel;
