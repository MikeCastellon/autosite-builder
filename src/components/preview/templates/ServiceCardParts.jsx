// src/components/preview/templates/ServiceCardParts.jsx
// Shared service-card parts used by every site template's services section.
// Published pages are renderToStaticMarkup output — no React handlers run —
// so the Read More toggle is a hidden checkbox + CSS sibling selectors
// (same no-JS principle as ImageLayers' gallery), and the Book Now link is
// a plain anchor the scheduler widget binds to via [data-scheduler-trigger].

// Styles for equal-height cards + clamped descriptions. Mount once per
// services section; duplicate mounts are harmless.
export function ServiceCardCss() {
  return (
    <style>{`
.acg-svc-card{display:flex;flex-direction:column;height:100%;box-sizing:border-box}
.acg-svc-toggle{position:absolute;opacity:0;pointer-events:none;width:1px;height:1px}
.acg-svc-desc{display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden}
.acg-svc-toggle:checked~.acg-svc-desc{display:block;-webkit-line-clamp:none}
.acg-svc-more{cursor:pointer;display:inline-block;margin-top:8px;font-size:12px;font-weight:700;text-decoration:underline;text-underline-offset:2px}
.acg-svc-more .acg-svc-less-txt{display:none}
.acg-svc-toggle:checked~.acg-svc-more .acg-svc-more-txt{display:none}
.acg-svc-toggle:checked~.acg-svc-more .acg-svc-less-txt{display:inline}
.acg-svc-foot{margin-top:auto;padding-top:14px}
`}</style>
  );
}

// Clamped description with an in-place Read more / Show less toggle.
// The checkbox, paragraph, and label MUST stay siblings in this order —
// the ~ combinator depends on it. `id` must be unique per page.
export function ServiceDescription({ id, text, style, accentColor }) {
  if (!text) return null;
  const p = <p className="acg-svc-desc" style={{ margin: 0, ...style }}>{text}</p>;
  if (String(text).trim().length <= 200) {
    return <p style={{ margin: 0, ...style }}>{text}</p>;
  }
  return (
    <>
      <input type="checkbox" id={id} className="acg-svc-toggle" />
      {p}
      <label htmlFor={id} className="acg-svc-more" style={{ color: accentColor }}>
        <span className="acg-svc-more-txt">Read more</span>
        <span className="acg-svc-less-txt">Show less</span>
      </label>
    </>
  );
}

// Per-card Book Now anchor. The scheduler widget binds every
// [data-scheduler-trigger] element and reads data-scheduler-service to
// pre-select the service; when booking is disabled the widget never loads
// and the link falls back to a phone call (or the contact section).
export function BookNowLink({ serviceName, phone, style, label }) {
  return (
    <a
      href={phone ? `tel:${phone}` : '#contact'}
      data-scheduler-trigger=""
      data-scheduler-service={serviceName}
      className="acg-svc-book"
      style={style}
    >
      {label || 'Book Now'}
    </a>
  );
}
