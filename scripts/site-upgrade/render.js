// Builds and checks one site's new page exactly as Admin > Site upgrades
// does in the admin's browser (SiteUpgradesTab.jsx buildAndCheck): the
// same helpers, called the same way, in the same order. Only where the
// inputs come from differs: the tab reads the row, owner and widget keys
// from Supabase and the live page from admin-site-upgrade; the CLI passes
// them in from the --inputs file and its own live read.
// tests/site-upgrade/parity.test.js runs the tab's own buildAndCheck and
// this module on the same inputs and expects identical pages and verdicts.
//
// Loaded through Vite (load-render.js), because the templates are JSX, with
// window.location.origin set to the production app while exportHtml.js and
// bookingPageHtml.js load, as on the production app.
import { resolveSiteRender, applyWidgetKeys } from '../../src/lib/siteRender.js';
import { exportHtmlString } from '../../src/lib/exportHtml.js';
import { buildBookingPageHtml } from '../../src/lib/bookingPageHtml.js';
import { isEffectiveSchedulerActive } from '../../src/lib/subscriptionGating.js';
import { PRODUCTION_APP_ORIGIN, checkUpgradedContent, eligibility } from '../../src/lib/siteUpgrade.js';

// The new page (and /book shell) for `row` (the sites row with
// generated_content), its owner's profile (null when unknown) and the
// owner's widget rows (newest first).
export async function buildSitePage({ row, owner, widgets }) {
  // The dashboard Republish inputs: owner images, colors, fonts, widget keys.
  const render = resolveSiteRender(row, row.generated_content);
  const generatedCopy = applyWidgetKeys(render.generatedCopy, widgets);
  // The OWNER's plan decides the "Powered by" bar.
  const isPro = isEffectiveSchedulerActive(owner || null);
  const newHtml = render.templateMeta
    ? await exportHtmlString(render.templateId, render.businessInfo, generatedCopy, render.templateMeta, render.images, render.selectedWidgetIds, row.id, isPro)
    : null;
  // publishSite sends the /book shell whenever the site takes bookings.
  const bookingPageHtml = row.scheduler_enabled
    ? buildBookingPageHtml({ siteId: row.id, businessName: render.businessInfo.businessName })
    : null;
  return { render, generatedCopy, isPro, newHtml, bookingPageHtml };
}

// The tab's verdict for a built page against the live one. `live` has the
// shape of admin-site-upgrade's `live` answer: { shared, index: { found,
// size, html | tooLarge }, book, hold }.
export function checkSitePage({ row, owner, built, live, appOrigin = PRODUCTION_APP_ORIGIN }) {
  const { render, generatedCopy, newHtml } = built;
  const liveHtml = live.index?.html || null;
  const check = newHtml && liveHtml ? checkUpgradedContent(liveHtml, newHtml, row, { appOrigin }) : null;
  const verdict = eligibility(row, liveHtml, check, owner || null, {
    sharedSlug: !!live.shared,
    liveTooLarge: !!live.index?.tooLarge,
    renderCopy: generatedCopy,
    draftColors: render.templateMeta?.colors,
    templateKnown: !!render.templateMeta,
    hold: live.hold,
  });
  if (!newHtml && !verdict.reasons.length) verdict.reasons.push({ code: 'no_page', text: 'The new page could not be built' });
  if (!newHtml) verdict.status = 'flagged';
  return { liveHtml, check, verdict, intended: check?.intended || [] };
}

// Where this build's widget scripts load from (the CLI refuses to go on
// unless it is the production app).
export function widgetOrigin() {
  const html = buildBookingPageHtml({ siteId: 'origin-probe', businessName: '' });
  const m = /<script src="([^"]+)\/scheduler\.js"/.exec(html);
  return m ? m[1] : null;
}
