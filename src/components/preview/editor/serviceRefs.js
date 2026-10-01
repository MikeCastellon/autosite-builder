// Copy keys that point at a service by its name (copy.heroServices, the
// featured service's copy.featuredService.serviceName). Shared by the Hero
// services and Featured Service panels, and by ContentEditor's Services tab,
// which follows a rename so those references keep pointing at the service.
// Pure: no React, never mutates its input.

// Same rule as MobileRedline's nameKey: "Premium Detail", "premium-detail"
// and " PREMIUM detail " are one service.
export const nameKey = (s) => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

const toItem = (s) => (typeof s === 'string' ? { name: s } : s && typeof s === 'object' ? s : {});
const text = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

// The owner's services as the Services tab lists them: businessInfo.services
// (the wizard's key; an old free-text list is split like
// normalizeBusinessInfo does), else businessInfo.packages, else the AI
// draft's copy.servicesSection.items. Nameless rows are dropped, because
// nothing can point at them.
export function serviceList(businessInfo, copy) {
  const biz = businessInfo && typeof businessInfo === 'object' ? businessInfo : {};
  let raw = [];
  if (typeof biz.services === 'string' && biz.services.trim()) raw = biz.services.split(/[·,;|]+/);
  else if (Array.isArray(biz.services) && biz.services.length) raw = biz.services;
  else if (Array.isArray(biz.packages) && biz.packages.length) raw = biz.packages;
  else if (Array.isArray(copy?.servicesSection?.items)) raw = copy.servicesSection.items;
  return raw
    .map(toItem)
    .map((s) => ({ name: text(s.name), price: String(s.price ?? ''), summary: text(s.summary) }))
    .filter((s) => s.name);
}

// The owner renamed a service from `from` to `to`: point the hero services
// and the featured service at the new name. remainingNames are the other
// services' names: while one of them still carries the old name, the
// references keep meaning that one and stay as they are. An empty `to`
// (the owner cleared the field to retype it) changes nothing.
// Returns the next copy, or null when nothing changes.
export function renameServiceRefs(copy, from, to, remainingNames = []) {
  const oldKey = nameKey(from);
  const nextName = String(to ?? '').trim();
  if (!copy || typeof copy !== 'object' || !oldKey || !nextName || nameKey(nextName) === oldKey) return null;
  if ((Array.isArray(remainingNames) ? remainingNames : []).some((n) => nameKey(n) === oldKey)) return null;

  const patch = {};
  if (Array.isArray(copy.heroServices) && copy.heroServices.some((n) => typeof n === 'string' && nameKey(n) === oldKey)) {
    patch.heroServices = copy.heroServices.map((n) => (typeof n === 'string' && nameKey(n) === oldKey ? nextName : n));
  }
  const fs = copy.featuredService;
  if (fs && typeof fs === 'object' && typeof fs.serviceName === 'string' && nameKey(fs.serviceName) === oldKey) {
    patch.featuredService = { ...fs, serviceName: nextName };
  }
  return Object.keys(patch).length ? { ...copy, ...patch } : null;
}

// One change of a service's Name field, as the Services tab sees it: `prev`
// is the field before the change, `pending` what the previous call returned
// for this row. renameServiceRefs alone only follows a change from one
// non-empty name to another, so clearing the field and retyping it (or
// backspacing to one letter and typing a new name) would leave the hero
// picks and the featured service on the old name, or on a single letter.
// Here, while the field is empty or holds another service's name, the
// references wait on the last name they followed (`pending`), and the next
// real name moves them from there.
// Returns { copy: the next copy or null, pending: the name the references
// still hold for this row, or null when they follow the field }.
export function followServiceRename(copy, prev, value, remainingNames = [], pending = null) {
  const others = Array.isArray(remainingNames) ? remainingNames : [];
  const taken = (n) => Boolean(nameKey(n)) && others.some((o) => nameKey(o) === nameKey(n));
  const waiting = nameKey(pending) ? pending : null;
  // A waiting name only stands in while the field shows nothing the
  // references could point at; any other value is the name they hold.
  const from = waiting && (!nameKey(prev) || taken(prev)) ? waiting : prev;
  if (!nameKey(value) || taken(value)) {
    return { copy: null, pending: nameKey(from) ? from : waiting };
  }
  return { copy: renameServiceRefs(copy, from, value, others), pending: null };
}

// The owner removed a service: drop it from the hero picks, and stop
// featuring it. The featured settings (price, benefits, button) all
// described that service, so they go with it and the band is automatic
// again. Nothing changes while another service still carries the name.
// Returns the next copy, or null when nothing changes.
export function removeServiceRefs(copy, name, remainingNames = []) {
  const key = nameKey(name);
  if (!copy || typeof copy !== 'object' || !key) return null;
  if ((Array.isArray(remainingNames) ? remainingNames : []).some((n) => nameKey(n) === key)) return null;
  const patch = {};
  if (Array.isArray(copy.heroServices) && copy.heroServices.some((n) => typeof n === 'string' && nameKey(n) === key)) {
    const left = copy.heroServices.filter((n) => !(typeof n === 'string' && nameKey(n) === key));
    patch.heroServices = left.length ? left : null;
  }
  const fs = copy.featuredService;
  if (fs && typeof fs === 'object' && !Array.isArray(fs) && typeof fs.serviceName === 'string' && nameKey(fs.serviceName) === key) {
    patch.featuredService = null;
  }
  return Object.keys(patch).length ? { ...copy, ...patch } : null;
}
