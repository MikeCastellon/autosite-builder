// Services tab: the controls of the service tabs (kit ServiceTabs), for a
// design that reads them (editorCapabilities 'serviceTabs').
//   ServiceTabsSwitch      "Show services in tabs" and its "All" tab
//                          (copy.serviceTabs), with which tabs the page shows
//                          or why it shows none
//   ServiceCategoryField   one service's Category, suggesting the categories
//                          the other services already name, so a second
//                          service lands on the same tab
// The tabs are opt-in: without the switch the services show as the one grid
// they always were, whatever their categories say.
import { Label, Help, SwitchRow, inputClass } from './fields.jsx';
import { CATEGORY_MAX, tabsState, tabsValue, tabsSummary, categoryNames } from './serviceTabsEdit.js';

// services: the Services tab's own list (objects with name / category).
export function ServiceTabsSwitch({ copy, setCopy, services }) {
  const state = tabsState(copy);
  const summary = tabsSummary(services, copy?.serviceTabs);
  return (
    <div className="mb-4 p-3 border border-gray-200 rounded-lg">
      <SwitchRow
        label="Show services in tabs"
        on={state.enabled}
        onChange={(on) => setCopy('serviceTabs', tabsValue({ enabled: on, all: state.all }))}
        help={state.enabled ? null : 'One tab per Category (below each service), like Cars, Boats & RVs or Pressure Washing.'}
      />
      {state.enabled && (
        <>
          <SwitchRow
            label={'Add an "All" tab first'}
            on={state.all}
            onChange={(all) => setCopy('serviceTabs', tabsValue({ enabled: true, all }))}
            help="Opens on every service, grouped by category."
          />
          <Help tone={summary.tone} className="mt-0">{summary.text}</Help>
        </>
      )}
    </div>
  );
}

// value: the service's category as stored; onChange(text) ('' clears it).
export function ServiceCategoryField({ value, onChange, services, index }) {
  const id = `svc-category-${index}`;
  const listId = `${id}-options`;
  const text = typeof value === 'string' ? value : '';
  const options = categoryNames(services).filter((c) => c !== text.trim());
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>Category</Label>
        <span className="text-[10px] text-gray-400 tabular-nums">{text.length}/{CATEGORY_MAX}</span>
      </div>
      <input id={id} type="text" list={listId} value={text} maxLength={CATEGORY_MAX} placeholder="e.g. Cars" onChange={(e) => onChange(e.target.value)} className={inputClass} />
      <datalist id={listId}>
        {options.map((c) => <option key={c} value={c} />)}
      </datalist>
      <Help>The tab this service sits under while your services show in tabs.</Help>
    </div>
  );
}

export default ServiceTabsSwitch;
