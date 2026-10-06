import { useState } from 'react';
import AdminDashboard from './AdminDashboard.jsx';
import AdminCustomSitesTab from './AdminCustomSitesTab.jsx';
import AdminAccountsTab from './AdminAccountsTab.jsx';
import AdminAllBookingsTab from './AdminAllBookingsTab.jsx';
import AdminAllInquiriesTab from './AdminAllInquiriesTab.jsx';
import SiteUpgradesTab from './SiteUpgradesTab.jsx';
import PipelineTab from './pipeline/PipelineTab.jsx';
import LeadsTab from './leads/LeadsTab.jsx';
import { useAuth } from '../../lib/AuthContext.jsx';
import { ADMIN_SECTIONS, DEFAULT_ADMIN_SECTION, isAdminSection } from '../../lib/adminWorkspace.js';

// One line under each section title, so a section says what it is for.
// Custom websites, Leads, All inquiries and Site upgrades are left out:
// their tabs open with their own line.
const SECTION_INTROS = {
  dashboard: 'Who is paying, custom websites in progress and what needs a look.',
  accounts: 'Every account, its plan and its sites. Open one to see details or view as that user.',
  pipeline: 'Sales leads by stage.',
  bookings: 'Bookings across every shop.',
};

// The body of the Admin workspace (AdminShell draws the header above it).
// `section` lives in App so the editor, booking settings and the URL can
// send the admin back to the right place; the state that only matters
// between sections (the lead to open, the Customers filter) lives here.
// `navKey` changes on every Admin tab click, so clicking "Custom websites"
// while a project is open goes back to the list.
export default function AdminPage({
  section,
  onSection,
  navKey = 0,
  projectId,
  onOpenProject,
  onOpenSiteEditor,
  onOpenBookingSettings,
  onOpenDemo,
}) {
  const { profile } = useAuth();
  // Held here rather than in the Pipeline tab, so "Open lead" on the Leads
  // tab can switch sections and open the lead in one go.
  const [openLeadId, setOpenLeadId] = useState(null);
  // Set by the dashboard's cards ("Paying customers" opens Customers on the
  // Paying chip). It only holds until the next tab click (navKey), so the
  // Customers tab always starts on All.
  const [accountsLink, setAccountsLink] = useState({ filter: 'all', navKey });
  const accountsFilter = accountsLink.navKey === navKey ? accountsLink.filter : 'all';

  if (!profile) return <div className="p-10 text-gray-500">Loading…</div>;
  // App only renders this for super admins; this guards a stale cached
  // profile until the fresh one arrives (RLS guards the data either way).
  if (!profile.is_super_admin) {
    return <div className="p-10 text-gray-600">You don't have access to this area.</div>;
  }

  const current = isAdminSection(section) ? section : DEFAULT_ADMIN_SECTION;
  const meta = ADMIN_SECTIONS.find((s) => s.id === current);
  const openAccounts = (filter) => { setAccountsLink({ filter: filter || 'all', navKey }); onSection('accounts'); };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-black text-[#1a1a1a] tracking-tight">{meta.label}</h1>
        {SECTION_INTROS[current] && <p className="text-sm text-[#555] mt-1.5">{SECTION_INTROS[current]}</p>}
      </header>

      {current === 'dashboard' && (
        <AdminDashboard
          onSection={onSection}
          onOpenAccounts={openAccounts}
          onOpenProject={onOpenProject}
          onOpenDemo={onOpenDemo}
        />
      )}
      {current === 'custom-sites' && (
        <AdminCustomSitesTab
          key={`${projectId || 'list'}:${navKey}`}
          initialProjectId={projectId}
          onOpenSiteEditor={onOpenSiteEditor}
          onOpenBookingSettings={onOpenBookingSettings}
        />
      )}
      {current === 'accounts' && <AdminAccountsTab key={`${accountsFilter}:${navKey}`} initialFilter={accountsFilter} />}
      {current === 'pipeline' && <PipelineTab userId={profile.id} openLeadId={openLeadId} onOpenLead={setOpenLeadId} />}
      {current === 'leads' && (
        <LeadsTab userId={profile.id} onOpenLead={(id) => { setOpenLeadId(id); onSection('pipeline'); }} />
      )}
      {current === 'bookings' && <AdminAllBookingsTab />}
      {current === 'inquiries' && <AdminAllInquiriesTab />}
      {current === 'site-upgrades' && <SiteUpgradesTab />}
    </main>
  );
}
