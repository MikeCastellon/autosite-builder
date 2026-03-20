import { useState, useEffect } from 'react';
import { SocialRow } from '../SocialIcons.jsx';
import { HeroImage, AboutImage, GallerySection } from '../ImageLayers.jsx';

// Template: Wheel Apex -- White & electric blue (#ffffff bg, #1A5CFF accent)
// Industrial editorial layout: Barlow Condensed headings, grid-ruled sections,
// brand strip, alloy hero panel, services grid, fitment band, process steps,
// testimonials, CTA band, contact info row, dark footer.

export default function WheelApex({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.textContent = "@import url('https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,300;0,400;0,500;0,600;0,700;0,900;1,400&family=Barlow+Condensed:wght@400;500;600;700;900&display=swap');";
    document.head.appendChild(styleEl);
    return () => document.head.removeChild(styleEl);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const c = templateMeta?.colors || { bg: '#ffffff', accent: '#1A5CFF', text: '#111827', secondary: '#f0f4ff', muted: '#6b7280' };
  const font = templateMeta?.font || "'Barlow Condensed', sans-serif";
  const bodyFont = templateMeta?.bodyFont || "'Barlow', sans-serif";
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const services = copy.servicesSection?.items || [];
  const svcCols = services.length >= 6 ? Math.ceil(services.length / 2) : services.length || 1;
  const testimonials = copy.testimonialPlaceholders || [];

  const normalize = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') return val.split(/,\s*/).map(v => v.trim()).filter(Boolean);
    return [];
  };

  const brandsList      = normalize(biz.brands);
  const tireBrandsList  = normalize(biz.tireBrands);
  const serviceNames    = normalize(biz.services);
  const specialtiesList = normalize(biz.specialties);

  // Design-system tokens from the mockup CSS variables
  const D = {
    white:    '#FFFFFF',
    offwhite: '#F5F6F8',
    fog:      '#ECEEF1',
    mist:     '#E0E3E8',
    alloy:    '#C8CDD6',
    alloy2:   '#A8ADB8',
    steel:    '#7A8292',
    slate:    '#4A5264',
    dark:     '#1E2330',
    blue:     c.accent,
    bluedark: '#0F3FCC',
    border:   'rgba(0,0,0,0.08)',
    border2:  'rgba(0,0,0,0.05)',
  };

  const processSteps = [
    { num: '01', title: 'Consult', desc: 'Tell us your vehicle, goals, and budget. We ask the right questions upfront so there are no surprises at the end.' },
    { num: '02', title: 'Select',  desc: 'We show you wheel options that actually fit -- size, offset, and finish dialed to your build. No guesswork.' },
    { num: '03', title: 'Source',  desc: 'In-stock wheels go straight to the bay. Special orders ship fast. Every wheel is inspected before a tire goes on it.' },
    { num: '04', title: 'Install', desc: 'Roadforce balance, torque to spec, final fitment check. You leave with a car that looks exactly how you planned it.' },
  ];

  const svcIcons = ['O', '#', 'W', 'P', 'R', 'T', 'B', 'C', 'A', '*'];

  const statsRow = [
    { val: String(biz.yearsInBusiness || '10'), unit: '+', label: 'Years in Business' },
    { val: '100', unit: '%', label: 'Satisfaction' },
    { val: String(serviceNames.length || services.length || 6), unit: '', label: 'Services' },
    { val: biz.city || 'Local', unit: '', label: biz.state || 'Service Area' },
  ];

  const nameInitials = (name) =>
    (name || 'C').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  const wrap = { maxWidth: 1320, margin: '0 auto', padding: '0 clamp(20px,4%,48px)' };

  const Eyebrow = ({ label }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, fontWeight: 600, letterSpacing: "3px", textTransform: "uppercase", color: D.blue, marginBottom: 12, fontFamily: bodyFont }}>
      <span style={{ display: "inline-block", width: 20, height: 2, background: D.blue, flexShrink: 0 }} />
      {label}
    </div>
  );

  const SecTitle = ({ children }) => (
    <h2 style={{ fontFamily: font, fontWeight: 900, fontSize: "clamp(36px, 4vw, 58px)", lineHeight: 0.95, letterSpacing: "-0.5px", color: D.dark, margin: 0 }}>
      {children}
    </h2>
  );

  return (
    <div style={{ fontFamily: bodyFont, background: D.white, color: D.dark, minHeight: "100vh", overflowX: "hidden", WebkitFontSmoothing: "antialiased", containerType: 'inline-size' }}>
      <style>{`@container(max-width:600px){.tp-nav-links a[href^="#"]{display:none!important}.tp-nav-links{gap:12px!important}.tp-2col{grid-template-columns:1fr!important}.tp-4col{grid-template-columns:1fr 1fr!important}}`}</style>

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 500, height: 68, background: "rgba(255,255,255,0.96)", borderBottom: `1px solid ${D.border}`, backdropFilter: "blur(20px)", display: "flex", alignItems: "center", boxShadow: scrolled ? "0 2px 20px rgba(0,0,0,0.08)" : "none", transition: "box-shadow 0.3s ease" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, background: D.dark, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: font, fontWeight: 900, fontSize: 14, letterSpacing: 1, color: "#fff" }}>
                {(biz.businessName || "WS").substring(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              {images.logo ? (
                <img src={images.logo} alt={biz.businessName || 'Logo'} style={{ height: 36, objectFit: 'contain' }} />
              ) : (
                <>
                  <span style={{ fontFamily: font, fontWeight: 700, fontSize: 18, letterSpacing: "3px", textTransform: "uppercase", color: D.dark, display: "block", lineHeight: 1 }}>
                    {biz.businessName || "Wheel Shop"}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "2px", textTransform: "uppercase", color: D.steel, display: "block", marginTop: 1 }}>
                    {[biz.city, biz.state].filter(Boolean).join(", ")}
                  </span>
                </>
              )}
            </div>
          </div>
          <ul className="tp-nav-links" style={{ display: "flex", gap: 32, listStyle: "none", margin: 0, padding: 0 }}>
            {["Brands", "Services", "Process", "Contact"].map(link => (
              <li key={link}>
                <a href={`#${link.toLowerCase()}`} style={{ fontSize: 13, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: D.slate, textDecoration: "none" }}>
                  {link}
                </a>
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {biz.phone && (
              <a href={`tel:${biz.phone}`} style={{ fontSize: 13, fontWeight: 600, color: D.slate, textDecoration: "none" }}>{biz.phone}</a>
            )}
            <a href="#contact" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#fff", background: D.blue, textDecoration: "none", padding: "10px 24px" }}>
              {copy.ctaPrimary || "Get a Quote"}
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="tp-2col" style={{ paddingTop: 68, minHeight: "92vh", background: D.offwhite, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", alignItems: "stretch", overflow: "hidden", position: "relative" }}>

        <HeroImage src={images.hero} />
        {/* Hero Left */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "clamp(48px,6vw,80px) clamp(24px,5vw,64px) clamp(48px,6vw,80px) clamp(24px,6vw,80px)", position: "relative", zIndex: 2 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 11, fontWeight: 600, letterSpacing: "3px", textTransform: "uppercase", color: D.blue, marginBottom: 24, fontFamily: bodyFont }}>
            <span style={{ width: 24, height: 2, background: D.blue, flexShrink: 0, display: "inline-block" }} />
            {biz.city ? `${biz.city}'s Premier Wheel Studio` : "Custom Wheel Specialists"}
          </span>

          <h1 style={{ fontFamily: font, fontSize: "clamp(28px, 5.5vw, 84px)", fontWeight: 900, lineHeight: 0.95, letterSpacing: "-0.5px", color: D.dark, marginBottom: 24 }}>
            {copy.headline
              ? (() => {
                  const words = copy.headline.trim().split(" ");
                  const mid = Math.ceil(words.length / 2);
                  return (<>{words.slice(0, mid).join(" ")}<span style={{ color: D.blue, display: "block" }}>{words.slice(mid).join(" ")}</span></>);
                })()
              : (<>THE RIGHT WHEEL.<span style={{ color: D.blue, display: "block" }}>PERFECT FIT.</span></>)
            }
            {biz.yearsInBusiness && (
              <span style={{ display: "block", color: D.alloy2, fontWeight: 300, letterSpacing: "2px", fontStyle: "italic", fontSize: "0.62em", marginTop: 6 }}>
                Est. {new Date().getFullYear() - Number(biz.yearsInBusiness)} &middot; {[biz.city, biz.state].filter(Boolean).join(", ")}
              </span>
            )}
          </h1>

          <p style={{ fontSize: 17, fontWeight: 400, lineHeight: 1.7, color: D.steel, maxWidth: 420, marginBottom: 44, fontFamily: bodyFont }}>
            {copy.subheadline || `Custom wheels, precision fitment, and professional service for every vehicle${biz.city ? ` in ${biz.city}` : ""}.`}
          </p>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 60 }}>
            <a href="#brands" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "#fff", background: D.blue, padding: "15px 36px", textDecoration: "none" }}>
              {copy.ctaPrimary || "Browse Our Brands"}
            </a>
            <a href="#contact" style={{ fontSize: 13, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: D.slate, padding: "14px 32px", border: `1.5px solid ${D.alloy}`, textDecoration: "none" }}>
              {copy.ctaSecondary || "Get a Free Quote"}
            </a>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 0, borderTop: `1px solid ${D.border}`, paddingTop: 32 }}>
            {statsRow.map((s, i) => (
              <div key={i} style={{ paddingRight: 28, marginRight: 28, borderRight: i < statsRow.length - 1 ? `1px solid ${D.border}` : "none", marginBottom: 8 }}>
                <div style={{ fontFamily: font, fontWeight: 900, fontSize: 34, letterSpacing: "-0.5px", lineHeight: 1, color: D.dark }}>
                  {s.val}<span style={{ fontSize: 18, color: D.blue }}>{s.unit}</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: D.steel, marginTop: 4, fontFamily: bodyFont }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hero Right - brushed alloy panel */}
        <div style={{ position: "relative", overflow: "hidden", background: D.mist, minHeight: 400 }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(110deg, #E8EAED 0%, #D8DCE3 20%, #ECEEF2 35%, #C8CDD6 50%, #E2E5EA 65%, #D0D4DD 80%, #E8EAED 100%)" }} />
          <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.35) 3px, rgba(255,255,255,0.35) 4px)", opacity: 0.6 }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, transparent 20%, rgba(255,255,255,0.25) 45%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.2) 55%, transparent 75%)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: font, fontWeight: 900, fontSize: "clamp(100px, 14vw, 190px)", letterSpacing: "-4px", lineHeight: 0.85, color: "rgba(74,82,100,0.12)", userSelect: "none", pointerEvents: "none" }}>
              {(biz.businessName || "APEX").split(" ")[0].toUpperCase().substring(0, 5)}
            </span>
          </div>
          <div style={{ position: "absolute", top: 40, left: 40, background: D.blue, color: "#fff", padding: "8px 18px", fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", fontFamily: bodyFont }}>
            {biz.city ? `${biz.city}'s #1 Wheel Shop` : "Premier Wheel Studio"}
          </div>
          <div style={{ position: "absolute", bottom: 48, right: 48, background: "#fff", padding: "20px 28px", borderLeft: `4px solid ${D.blue}`, boxShadow: "0 8px 40px rgba(0,0,0,0.1)" }}>
            <div style={{ fontFamily: font, fontWeight: 700, fontSize: 13, letterSpacing: "2.5px", textTransform: "uppercase", color: D.dark, marginBottom: 4 }}>Brands In Stock</div>
            <div style={{ fontSize: 12, color: D.steel, fontWeight: 500, fontFamily: bodyFont }}>Ready to mount today</div>
            <div style={{ fontFamily: font, fontWeight: 900, fontSize: 36, color: D.blue, lineHeight: 1, marginTop: 8, letterSpacing: "-1px" }}>
              {brandsList.length > 0 ? `${brandsList.length}+` : "80+"}
            </div>
          </div>
        </div>
      </section>

      {/* BRAND STRIP */}
      {brandsList.length > 0 && (
        <div style={{ background: D.dark, padding: "24px 0", overflow: "hidden" }}>
          <div style={{ ...wrap, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", color: D.alloy2, whiteSpace: "nowrap", paddingRight: 32, borderRight: "1px solid rgba(255,255,255,0.1)", marginRight: 32, flexShrink: 0, fontFamily: bodyFont }}>
              Brands We Carry
            </span>
            <div style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
              {brandsList.map((brand, i) => (
                <span key={i} style={{ fontFamily: font, fontWeight: 700, fontSize: 15, letterSpacing: "3px", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>
                  {brand}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AWARDS */}
      {biz.awards && (
        <div style={{ background: "#fefce8", borderTop: "1px solid #fef08a", borderBottom: "1px solid #fef08a", padding: "18px clamp(20px,4%,48px)" }}>
          <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 20 }}>&#127942;</span>
            <div>
              <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: "#92400e", fontFamily: bodyFont }}>RECOGNITION: </span>
              <span style={{ color: "#92400e", fontSize: 14, fontWeight: 500, fontFamily: bodyFont }}>{biz.awards}</span>
            </div>
          </div>
        </div>
      )}

      {/* BRANDS SECTION */}
      <section id="brands" style={{ padding: "100px 0", background: D.white, borderTop: `1px solid ${D.border2}` }}>
        <div style={wrap}>
          <div className="tp-2col" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(24px,6vw,80px)", alignItems: "end", marginBottom: 56 }}>
            <div>
              <Eyebrow label="Featured Brands" />
              <SecTitle>Wheels built<br />to <span style={{ color: D.blue }}>perform.</span></SecTitle>
            </div>
            {generatedCopy?.aboutLayout === 'image' ? (
              images.about
                ? <img src={images.about} alt="About" style={{ width: '100%', height: '360px', objectFit: 'cover', borderRadius: '4px', display: 'block', marginBottom: '16px' }} />
                : <div style={{ width: '100%', height: '360px', background: D.fog, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.steel, fontSize: '0.85rem', marginBottom: '16px' }}>Upload a photo in Images tab</div>
            ) : (
              images.about && (
                <img src={images.about} alt="About" style={{ width: '100%', height: '360px', objectFit: 'cover', borderRadius: '4px', display: 'block', marginBottom: '16px' }} />
              )
            )}
            <p style={{ fontSize: 16, color: D.steel, lineHeight: 1.75, fontFamily: bodyFont, margin: 0 }}>
              {copy.aboutText
                ? copy.aboutText.substring(0, 200) + (copy.aboutText.length > 200 ? "..." : "")
                : "We carry the brands that matter -- from forged JDM legends to European luxury to American custom. Every brand we stock is one we would put on our own car."}
            </p>
          </div>

          {brandsList.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 1, background: D.border }}>
              {brandsList.slice(0, 8).map((brand, i) => (
                <div key={i} style={{ background: D.white, padding: "40px 32px", position: "relative", overflow: "hidden" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "2.5px", textTransform: "uppercase", color: D.blue, marginBottom: 10, fontFamily: bodyFont }}>Wheel Brand</div>
                  <div style={{ fontFamily: font, fontWeight: 900, fontSize: 28, letterSpacing: "1.5px", color: D.dark, marginBottom: 14, lineHeight: 1 }}>{brand.toUpperCase()}</div>
                  <p style={{ fontSize: 13, color: D.steel, lineHeight: 1.65, fontFamily: bodyFont, margin: 0 }}>
                    Premium wheels available in multiple finishes and sizes, specced to fit your vehicle and build goals.
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 20 }}>
                    {["Performance", "Custom", "Precision"].map(chip => (
                      <span key={chip} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", padding: "4px 10px", background: D.fog, color: D.slate, fontFamily: bodyFont }}>{chip}</span>
                    ))}
                  </div>
                  <div style={{ position: "absolute", bottom: 28, right: 28, width: 32, height: 32, background: D.fog, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>&#8594;</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: D.fog, border: `1px solid ${D.border}`, padding: "40px 48px", textAlign: "center" }}>
              <p style={{ fontSize: 16, color: D.slate, fontFamily: bodyFont, margin: 0 }}>
                We stock a wide selection of premium wheel brands. Contact us to find the right fit for your vehicle.
              </p>
            </div>
          )}

          {(brandsList.length > 0 || tireBrandsList.length > 0) && (
            <div style={{ marginTop: 1, padding: "24px 32px", background: D.fog, border: `1px solid ${D.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <p style={{ fontSize: 14, color: D.slate, fontWeight: 500, margin: 0, fontFamily: bodyFont }}>
                {tireBrandsList.length > 0
                  ? <><strong style={{ color: D.dark }}>Tire brands:</strong> {tireBrandsList.join(" · ")}</>
                  : <><strong style={{ color: D.dark }}>More brands available</strong> -- If you have seen it online, we can source it.</>
                }
              </p>
              <a href="#contact" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: D.blue, textDecoration: "none", fontFamily: bodyFont }}>
                Request a Brand &#8594;
              </a>
            </div>
          )}
        </div>
      </section>

      {/* GALLERY */}
      <GallerySection images={images} colors={c} font={font} bodyFont={bodyFont} />

      {/* SERVICES */}
      <section id="services" style={{ padding: "100px 0", background: D.offwhite, borderTop: `1px solid ${D.border2}` }}>
        <div style={wrap}>
          <div style={{ marginBottom: 56 }}>
            <Eyebrow label="Our Services" />
            <SecTitle>Everything your<br />wheels <span style={{ color: D.blue }}>need.</span></SecTitle>
          </div>
          {biz.packages?.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 1, background: D.border }}>
              {biz.packages.map((pkg, i) => (
                <div key={i} style={{ background: i === 1 ? D.blue : D.offwhite, padding: "48px 36px", position: "relative", borderTop: `3px solid ${i === 1 ? D.blue : 'transparent'}` }}>
                  <div style={{ fontFamily: font, fontWeight: 700, fontSize: 20, letterSpacing: "0.5px", color: i === 1 ? '#fff' : D.dark, marginBottom: 8 }}>{pkg.name || pkg}</div>
                  {pkg.price && <div style={{ fontFamily: font, fontWeight: 700, fontSize: '1.8rem', color: i === 1 ? '#fff' : D.blue, margin: '0.4rem 0 0.75rem' }}>{pkg.price}</div>}
                  {pkg.description && <p style={{ fontSize: 14, color: i === 1 ? 'rgba(255,255,255,0.8)' : D.steel, lineHeight: 1.75, margin: 0, fontFamily: bodyFont }}>{pkg.description}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${svcCols}, 1fr)`, gap: 1, background: D.border }}>
              {(services.length > 0
                ? services.map((svc, i) => ({ name: svc.name, desc: svc.description, num: String(i + 1).padStart(2, "0") }))
                : serviceNames.length > 0
                  ? serviceNames.map((name, i) => ({ name, desc: null, num: String(i + 1).padStart(2, "0") }))
                  : ["Wheel Sales", "Mount & Balance", "Wheel Repair", "Powder Coating", "Fitment Consulting", "Show Builds"].map((name, i) => ({ name, desc: null, num: String(i + 1).padStart(2, "0") }))
              ).map((svc, i) => (
                <div key={i} style={{ background: D.offwhite, padding: "48px 36px", position: "relative" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "2px", color: D.blue, marginBottom: 24, display: "flex", alignItems: "center", gap: 10, fontFamily: bodyFont }}>
                    {svc.num}
                    <span style={{ flex: 1, height: 1, background: D.alloy, display: "block" }} />
                  </div>
                  <div style={{ fontFamily: font, fontWeight: 700, fontSize: 22, letterSpacing: "0.5px", color: D.dark, marginBottom: svc.desc ? 12 : 0 }}>{svc.name}</div>
                  {svc.desc && <p style={{ fontSize: 14, color: D.steel, lineHeight: 1.75, margin: 0, fontFamily: bodyFont }}>{svc.desc}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FITMENT BAND */}
      <div id="fitment" style={{ background: D.dark, padding: "80px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: D.blue }} />
        <div style={wrap}>
          <div className="tp-2col" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(32px,6vw,100px)", alignItems: "center" }}>
            <div>
              <h2 style={{ fontFamily: font, fontWeight: 900, fontSize: "clamp(38px,4vw,60px)", lineHeight: 0.95, letterSpacing: "-0.5px", color: "#fff", marginBottom: 20 }}>
                {specialtiesList.length > 0
                  ? (<>{specialtiesList[0].split(" ").slice(0, 3).join(" ")}.<br /><span style={{ color: D.blue }}>{specialtiesList[0].split(" ").slice(3, 7).join(" ") || "Done right."}</span></>)
                  : (<>Flush isn't luck.<br /><span style={{ color: D.blue }}>It's math.</span></>)
                }
              </h2>
              <p style={{ fontSize: 16, color: D.alloy2, lineHeight: 1.75, marginBottom: 36, fontFamily: bodyFont }}>
                {copy.aboutText
                  ? copy.aboutText.substring(0, 220)
                  : "We run your exact vehicle through our fitment database to find the wheel and tire combo that gets you flush without rubbing. Thousands of successful fitments."}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(255,255,255,0.08)" }}>
                {[
                  ["Diameter", "15” – 26”"], ["Width", "6.5” – 12”"],
                  ["Offset (ET)", "−25 to +55"], ["Bolt Patterns", "4×100 – 6×139.7"],
                  ["Center Bore", "Hubcentric Rings Incl."], ["Finishes", "200+ Options"],
                ].map(([key, val], i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.04)", padding: "20px 24px" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: D.alloy2, marginBottom: 6, fontFamily: bodyFont }}>{key}</div>
                    <div style={{ fontFamily: font, fontWeight: 700, fontSize: 18, letterSpacing: "0.5px", color: "#fff" }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alloy panel */}
            <div style={{ position: "relative", height: 380, background: "linear-gradient(135deg, #C8CDD6 0%, #E0E3E8 30%, #D0D4DD 50%, #E8EAED 70%, #C0C5CE 100%)", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.3) 3px, rgba(255,255,255,0.3) 4px)" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)" }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <div style={{ fontFamily: font, fontWeight: 900, fontSize: 100, letterSpacing: "-3px", color: "rgba(74,82,100,0.15)", lineHeight: 1, userSelect: "none" }}>FIT</div>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "4px", textTransform: "uppercase", color: "rgba(74,82,100,0.5)", fontFamily: bodyFont }}>Precision Fitment &middot; Every Build</div>
              </div>
              <div style={{ position: "absolute", bottom: 28, left: 28, background: "#fff", padding: "14px 20px", borderLeft: `3px solid ${D.blue}` }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: D.steel, margin: 0, fontFamily: bodyFont }}>Fitment Accuracy</p>
                <span style={{ fontFamily: font, fontWeight: 900, fontSize: 22, color: D.dark }}>99.8%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PROCESS */}
      <section id="process" style={{ padding: "100px 0", background: D.white, borderTop: `1px solid ${D.border2}` }}>
        <div style={wrap}>
          <div style={{ marginBottom: 56 }}>
            <Eyebrow label="How It Works" />
            <SecTitle>Consult to curb<br />in <span style={{ color: D.blue }}>four steps.</span></SecTitle>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 1, background: D.border }}>
            {processSteps.map((step, i) => (
              <div key={i} style={{ background: D.white, padding: "44px 32px", position: "relative", borderTop: `3px solid ${D.blue}` }}>
                <div style={{ fontFamily: font, fontWeight: 900, fontSize: 52, letterSpacing: "-2px", lineHeight: 1, color: D.mist, marginBottom: 16 }}>{step.num}</div>
                <h3 style={{ fontFamily: font, fontWeight: 700, fontSize: 20, letterSpacing: "0.5px", color: D.dark, marginBottom: 10 }}>{step.title}</h3>
                <p style={{ fontSize: 13, color: D.steel, lineHeight: 1.7, margin: 0, fontFamily: bodyFont }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      {testimonials.length > 0 && (
        <section style={{ padding: "100px 0", background: D.offwhite, borderTop: `1px solid ${D.border2}` }}>
          <div style={wrap}>
            <div style={{ marginBottom: 56 }}>
              <Eyebrow label="Customer Reviews" />
              <SecTitle>Built right.<br /><span style={{ color: D.blue }}>Every time.</span></SecTitle>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 1, background: D.border }}>
              {testimonials.map((t, i) => (
                <div key={i} style={{ background: D.offwhite, padding: "40px 36px", position: "relative", borderBottom: `3px solid ${D.blue}` }}>
                  <div style={{ marginBottom: 16, color: D.blue, fontSize: 13, letterSpacing: "2px" }}>&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                  <p style={{ fontSize: 15, color: D.slate, lineHeight: 1.75, fontStyle: "italic", marginBottom: 24, fontFamily: bodyFont }}>
                    <span style={{ fontFamily: font, fontWeight: 900, fontSize: 44, color: D.alloy, lineHeight: 0, verticalAlign: "-16px", marginRight: 4 }}>&ldquo;</span>
                    {t.text}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, borderTop: `1px solid ${D.border}`, paddingTop: 20, marginTop: 20 }}>
                    <div style={{ width: 40, height: 40, background: D.dark, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, fontWeight: 700, fontSize: 14, color: "#fff" }}>
                      {nameInitials(t.name)}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: D.dark, fontFamily: bodyFont }}>{t.name}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: D.blue, marginTop: 2, fontFamily: bodyFont }}>
                        {[biz.city, biz.state].filter(Boolean).join(", ") || "Satisfied Customer"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA BAND */}
      <div style={{ background: D.blue, padding: "72px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "40%", background: "linear-gradient(to left, rgba(255,255,255,0.06), transparent)", pointerEvents: "none" }} />
        <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontFamily: font, fontWeight: 900, fontSize: "clamp(32px,4vw,52px)", letterSpacing: "-0.5px", color: "#fff", lineHeight: 0.95, margin: 0 }}>
              Ready to build<br />your set?
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", marginTop: 10, maxWidth: 480, fontFamily: bodyFont }}>
              {copy.subheadline || "Tell us your car and goals. We will come back with a full recommendation -- brand, size, offset, tire combo, and real pricing."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", flexShrink: 0 }}>
            <a href="#contact" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: D.blue, background: "#fff", padding: "15px 36px", textDecoration: "none" }}>
              {copy.ctaPrimary || "Request a Quote"}
            </a>
            {biz.phone && (
              <a href={`tel:${biz.phone}`} style={{ fontSize: 13, fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: "#fff", padding: "14px 32px", border: "1.5px solid rgba(255,255,255,0.4)", textDecoration: "none" }}>
                Call {biz.phone}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* CONTACT */}
      <section id="contact" style={{ padding: "100px 0", background: D.white, borderTop: `1px solid ${D.border2}` }}>
        <div style={wrap}>
          <div style={{ marginBottom: 56 }}>
            <Eyebrow label="Get In Touch" />
            <SecTitle>Let's talk<br /><span style={{ color: D.blue }}>your build.</span></SecTitle>
          </div>
          <div className="tp-2col" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(32px,6vw,80px)", alignItems: "start" }}>
            <div>
              <p style={{ fontSize: 16, color: D.steel, lineHeight: 1.75, marginBottom: 32, fontFamily: bodyFont }}>
                {copy.footerTagline || "Reach out and we will get back to you with a full recommendation -- no obligation, no pressure. Just the right wheels for your car."}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {biz.phone && (
                  <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 24px", background: D.fog, borderLeft: "3px solid transparent" }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>&#128222;</span>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: D.blue, fontFamily: bodyFont }}>Call or Text</div>
                      <a href={`tel:${biz.phone}`} style={{ fontSize: 15, fontWeight: 600, color: D.dark, textDecoration: "none", display: "block", marginTop: 2, fontFamily: bodyFont }}>{biz.phone}</a>
                    </div>
                  </div>
                )}
                {biz.address && (
                  <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 24px", background: D.fog, borderLeft: "3px solid transparent" }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>&#128205;</span>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: D.blue, fontFamily: bodyFont }}>Location</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: D.dark, marginTop: 2, fontFamily: bodyFont }}>
                        {[biz.address, biz.city, biz.state].filter(Boolean).join(", ")}
                      </div>
                    </div>
                  </div>
                )}
                {biz.hours && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "20px 24px", background: D.fog, borderLeft: "3px solid transparent" }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>&#128336;</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: D.blue, marginBottom: 4, fontFamily: bodyFont }}>Hours</div>
                      {typeof biz.hours === "string"
                        ? <div style={{ fontSize: 15, fontWeight: 600, color: D.dark, fontFamily: bodyFont }}>{biz.hours}</div>
                        : Object.entries(biz.hours).map(([day, hrs], i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: i === 0 ? 0 : 4 }}>
                              <span style={{ color: D.steel, fontWeight: 500, fontSize: 14, fontFamily: bodyFont }}>{day}</span>
                              <span style={{ color: D.dark, fontWeight: 600, fontSize: 14, fontFamily: bodyFont }}>{hrs}</span>
                            </div>
                          ))
                      }
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: D.offwhite, border: `1px solid ${D.border}`, borderTop: `3px solid ${D.blue}`, padding: "clamp(24px,4vw,48px)" }}>
              <div style={{ fontFamily: font, fontWeight: 700, fontSize: 24, letterSpacing: "0.5px", color: D.dark, marginBottom: 28 }}>Visit Our Shop</div>
              {specialtiesList.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: D.blue, marginBottom: 12, fontFamily: bodyFont }}>Our Specialties</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {specialtiesList.map((s, i) => (
                      <span key={i} style={{ background: D.fog, color: D.slate, border: `1px solid ${D.border}`, padding: "6px 14px", fontSize: 13, fontWeight: 600, fontFamily: bodyFont }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
              <a href={biz.phone ? `tel:${biz.phone}` : "#contact"} style={{ display: "block", width: "100%", padding: 15, background: D.blue, color: "#fff", fontSize: 14, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", textDecoration: "none", textAlign: "center", fontFamily: bodyFont, boxSizing: "border-box" }}>
                {copy.ctaPrimary || "Request a Quote"}
              </a>
              {biz.phone && (
                <p style={{ fontSize: 13, color: D.steel, textAlign: "center", marginTop: 16, marginBottom: 0, fontFamily: bodyFont }}>
                  Or call{" "}
                  <a href={`tel:${biz.phone}`} style={{ color: D.blue, fontWeight: 700, textDecoration: "none" }}>{biz.phone}</a>
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: D.dark, padding: "72px 0 32px", borderTop: `3px solid ${D.blue}` }}>
        <div style={wrap}>
          <div className="tp-4col" style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", gap: "clamp(24px,4vw,60px)", marginBottom: 56 }}>

            {/* Brand col */}
            <div>
              {/* Footer logo */}
              {images.logo ? (
                <img src={images.logo} alt={biz.businessName} style={{ height: 48, maxWidth: 180, objectFit: 'contain', marginBottom: '0.75rem', display: 'block' }} />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, background: D.blue, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontFamily: font, fontWeight: 900, fontSize: 14, letterSpacing: 1, color: "#fff" }}>
                      {(biz.businessName || "WS").substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontFamily: font, fontWeight: 700, fontSize: 18, letterSpacing: "3px", textTransform: "uppercase", color: "#fff", display: "block", lineHeight: 1 }}>
                      {biz.businessName || "Wheel Shop"}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "2px", textTransform: "uppercase", color: D.alloy2, display: "block", marginTop: 1 }}>
                      {[biz.city, biz.state].filter(Boolean).join(", ")}
                    </span>
                  </div>
                </div>
              )}
              <p style={{ fontSize: 14, color: D.alloy2, lineHeight: 1.8, maxWidth: 270, fontFamily: bodyFont, margin: 0 }}>
                {copy.footerTagline || "Premier custom wheel studio. Fitment specialists, repair experts, and enthusiasts committed to getting your build exactly right."}
              </p>
            </div>

            {/* Services col */}
            <div>
              <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: D.alloy, marginBottom: 20, marginTop: 0, fontFamily: bodyFont }}>Services</h4>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {(services.length > 0
                  ? services.slice(0, 6).map(s => s.name)
                  : serviceNames.length > 0
                    ? serviceNames.slice(0, 6)
                    : ["Wheel Sales", "Mount & Balance", "Wheel Repair", "Powder Coating", "Show Builds", "Fleet Orders"]
                ).map((name, i) => (
                  <li key={i}><a href="#services" style={{ fontSize: 14, color: D.alloy2, textDecoration: "none", fontFamily: bodyFont }}>{name}</a></li>
                ))}
              </ul>
            </div>

            {/* Brands col */}
            <div>
              <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: D.alloy, marginBottom: 20, marginTop: 0, fontFamily: bodyFont }}>Brands</h4>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {(brandsList.length > 0 ? brandsList.slice(0, 6) : ["Rays / Volk", "HRE Wheels", "Vossen", "Work Wheels", "BBS / Enkei", "All Brands"]).map((brand, i) => (
                  <li key={i}><a href="#brands" style={{ fontSize: 14, color: D.alloy2, textDecoration: "none", fontFamily: bodyFont }}>{brand}</a></li>
                ))}
              </ul>
            </div>

            {/* Contact col */}
            <div>
              <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: D.alloy, marginBottom: 20, marginTop: 0, fontFamily: bodyFont }}>Contact</h4>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {biz.phone && <li><a href={`tel:${biz.phone}`} style={{ fontSize: 14, color: D.alloy2, textDecoration: "none", fontFamily: bodyFont }}>{biz.phone}</a></li>}
                {biz.address && <li><span style={{ fontSize: 14, color: D.alloy2, fontFamily: bodyFont }}>{biz.address}</span></li>}
                <li><a href="#contact" style={{ fontSize: 14, color: D.alloy2, textDecoration: "none", fontFamily: bodyFont }}>Get a Quote</a></li>
                <li><SocialRow biz={biz} color={D.alloy2} size={20} images={images} /></li>
              </ul>
            </div>
          </div>

          {/* Footer bottom */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 28, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <p style={{ fontSize: 12, color: D.alloy2, margin: 0, fontFamily: bodyFont }}>
              &copy; {new Date().getFullYear()} {biz.businessName || "Wheel Shop"} &middot; {[biz.city, biz.state].filter(Boolean).join(", ")} &middot; All rights reserved
            </p>
            <span style={{ fontFamily: font, fontWeight: 700, fontSize: 14, letterSpacing: "4px", textTransform: "uppercase", color: "#3A78FF" }}>
              {copy.footerTagline ? copy.footerTagline.split(" ").slice(0, 3).join(" ") + "." : "Built to Perform."}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
