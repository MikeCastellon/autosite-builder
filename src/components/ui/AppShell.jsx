import AppHeader from './AppHeader.jsx';
import HelpChrome from '../help/HelpChrome.jsx';

// Authenticated app shell. Renders the ONE shared header + help chrome around a
// page body so every dashboard-family view has an identical nav, with the active
// item driven by the `active` prop (not by which handler a page happens to omit).
//
// Pages render only their own content (their <main> and any modals); they no
// longer render AppHeader or an outer page wrapper themselves.
export default function AppShell({ active, nav, userEmail, profile, children }) {
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <AppHeader active={active} userEmail={userEmail} profile={profile} {...nav} />
      {children}
      <HelpChrome profile={profile} />
    </div>
  );
}
