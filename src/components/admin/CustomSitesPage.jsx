import { useEffect, useState } from 'react';
import AdminCustomSitesTab from './AdminCustomSitesTab.jsx';
import { useAuth } from '../../lib/AuthContext.jsx';

// "Custom websites" in the header nav (super admins only): customers getting
// a custom-built site, from their form link to launch. The links in the
// custom website emails (/?admin=custom-sites&project=<id>) open a project.
export default function CustomSitesPage({ onExit }) {
  const { profile } = useAuth();
  const [projectId] = useState(() => new URLSearchParams(window.location.search).get('project'));

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('admin')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  if (!profile) return <div className="p-10 text-gray-500">Loading…</div>;
  if (!profile.is_super_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
        <div className="text-center">
          <p className="text-gray-600 mb-3">You don't have access to this area.</p>
          <button onClick={onExit} className="text-sm text-[#1a1a1a] hover:text-[#cc0000] underline">Back to dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-3 py-10">
      <h1 className="text-3xl sm:text-4xl font-black text-[#1a1a1a] tracking-tight mb-3">Custom websites</h1>
      <AdminCustomSitesTab initialProjectId={projectId} />
    </main>
  );
}
