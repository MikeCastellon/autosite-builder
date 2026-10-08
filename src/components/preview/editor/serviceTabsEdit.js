// Pure helpers behind the Services tab's tab controls (ServiceTabsPanel.jsx):
// the "Show services in tabs" switch (copy.serviceTabs = { enabled: true,
// all?: true }) and each service's Category (businessInfo.services[i]
// .category, also mirrored to .packages), which the tabs group by
// (kit/serviceTabs.js). The page shows tabs only while the switch is on and
// the services name two categories or more, so the tab says, with the kit's
// own reading, which tabs the page shows or why it shows none.
import {
  SERVICE_CATEGORY_MAX, SERVICE_TABS_HINTS, serviceGroups, serviceTabsStatus, serviceTabsWanted,
} from '../templates/kit/serviceTabs.js';
import { SERVICE_TABS_LABELS } from '../templates/kit/ServiceTabs.jsx';

export const CATEGORY_MAX = SERVICE_CATEGORY_MAX;

// The switch as the tab shows it: { enabled, all }.
export function tabsState(copy) {
  const v = copy?.serviceTabs;
  const enabled = serviceTabsWanted(v);
  return { enabled, all: enabled && v.all === true };
}

// copy.serviceTabs for a state: null while off (nothing saved: the
// services show as the one grid they always were), else { enabled: true }
// with all: true when the owner wants the "All" tab.
export function tabsValue({ enabled, all } = {}) {
  if (enabled !== true) return null;
  return all === true ? { enabled: true, all: true } : { enabled: true };
}

// The categories the services name, in first-seen order and as first
// written (what the Category fields suggest, so a second service lands on
// the same tab).
export function categoryNames(services) {
  return serviceGroups(services).groups.filter((g) => !g.other).map((g) => g.label);
}

// What the tab says under the switch: { status, text, tone } (status as
// serviceTabsStatus; text '' while the switch is off).
export function tabsSummary(services, serviceTabs) {
  const status = serviceTabsStatus(services, serviceTabs);
  if (status === 'off') return { status, text: '', tone: null };
  if (status !== 'on') return { status, text: SERVICE_TABS_HINTS[status], tone: 'warn' };
  const { groups } = serviceGroups(services);
  const names = [
    ...(tabsState({ serviceTabs }).all ? [SERVICE_TABS_LABELS.all] : []),
    ...groups.map((g) => (g.other ? SERVICE_TABS_LABELS.other : g.label)),
  ];
  const other = groups.some((g) => g.other) ? ` Services without a category share the ${SERVICE_TABS_LABELS.other} tab.` : '';
  return { status, text: `Tabs on your site: ${names.join(', ')}.${other}`, tone: 'ok' };
}
