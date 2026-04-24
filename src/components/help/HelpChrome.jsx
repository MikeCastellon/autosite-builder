import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import HelpButton from './HelpButton.jsx';
import HelpDrawer from './HelpDrawer.jsx';

export default function HelpChrome({ profile }) {
  const [open, setOpen] = useState(false);
  const [initialSlug, setInitialSlug] = useState(null);

  // Deep link: ?help=<slug> opens drawer on that article once per mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('help');
    if (slug) {
      setInitialSlug(slug);
      setOpen(true);
      params.delete('help');
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <HelpButton open={open} onToggle={() => setOpen(v => !v)} />
      <HelpDrawer
        open={open}
        onClose={() => setOpen(false)}
        profile={profile}
        initialSlug={initialSlug}
      />
    </>,
    document.body
  );
}
