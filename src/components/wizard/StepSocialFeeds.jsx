import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../lib/AuthContext.jsx';

const SOCIALFEEDS_URL = import.meta.env.VITE_SOCIALFEEDS_URL || 'https://social-feeds-app.netlify.app';
const PLACES_SEARCH_URL = '/.netlify/functions/places-search';

export default function StepSocialFeeds({ selectedWidgetIds, onWidgetIdsChange, onNext, onBack, onWidgetKeysChange }) {
  const { session } = useAuth();
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadWidgets();
  }, []);

  async function loadWidgets() {
    setLoading(true);
    const { data } = await supabase
      .from('widget_configs')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    setWidgets(data || []);
    setLoading(false);
  }

  const toggleWidget = (id) => {
    const next = selectedWidgetIds.includes(id)
      ? selectedWidgetIds.filter((x) => x !== id)
      : [...selectedWidgetIds, id];
    onWidgetIdsChange(next);
  };

  const handleConnectInstagram = () => {
    if (!session?.user?.id) return;
    const fbAppId = import.meta.env.VITE_FB_APP_ID;
    if (!fbAppId) {
      setError('Instagram connection is not configured. Please contact support.');
      return;
    }
    const state = session.user.id;
    const redirectUrl = encodeURIComponent(`${SOCIALFEEDS_URL}/.netlify/functions/instagram-auth-callback`);
    const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${fbAppId}&redirect_uri=${redirectUrl}&scope=instagram_business_basic,instagram_business_manage_messages&response_type=code&state=${state}`;
    window.open(authUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSearchGoogle = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`${PLACES_SEARCH_URL}?q=${encodeURIComponent(searchQuery)}`);
      const json = await res.json();
      setSearchResults(json.results || []);
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectGoogleBusiness = async (result) => {
    if (!session?.user?.id) return;

    // Check for existing widget with same place_id
    const existing = widgets.find((w) => w.type === 'google-reviews' && w.place_id === result.place_id);
    if (existing) {
      if (!selectedWidgetIds.includes(existing.id)) {
        onWidgetIdsChange([...selectedWidgetIds, existing.id]);
      }
      setSearchResults([]);
      setSearchQuery('');
      return;
    }

    setSavingGoogle(true);
    setError(null);
    try {
      const widgetKey = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
      const { data, error } = await supabase
        .from('widget_configs')
        .insert({
          user_id: session.user.id,
          type: 'google-reviews',
          widget_key: widgetKey,
          place_id: result.place_id,
          label: result.name,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      await loadWidgets();
      onWidgetIdsChange([...selectedWidgetIds, data.id]);
      setSearchResults([]);
      setSearchQuery('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingGoogle(false);
    }
  };

  const instagramWidgets = widgets.filter((w) => w.type === 'instagram-feed');
  const googleWidgets = widgets.filter((w) => w.type === 'google-reviews');

  // Sync widget keys back to parent whenever selection or widgets change
  useEffect(() => {
    if (!onWidgetKeysChange || widgets.length === 0) return;
    const selectedWidgets = widgets.filter((w) => selectedWidgetIds.includes(w.id));
    const googleWidget = selectedWidgets.find((w) => w.type === 'google-reviews');
    const instaWidget = selectedWidgets.find((w) => w.type === 'instagram-feed');
    onWidgetKeysChange({
      googleWidgetKey: googleWidget?.widget_key || null,
      instagramWidgetKey: instaWidget?.widget_key || null,
    });
  }, [selectedWidgetIds, widgets]);

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-2xl font-black text-[#1a1a1a] mb-1 tracking-tight">Add Social Feeds</h2>
      <p className="text-[#888] text-sm mb-6">Optional — embed live Instagram posts or Google Reviews on your site.</p>

      {loading ? (
        <p className="text-sm text-[#888]">Loading...</p>
      ) : (
        <>
          {/* Instagram section */}
          <div className="border border-black/[0.07] rounded-xl p-4 mb-4 bg-white">
            <p className="text-xs font-semibold text-[#1a1a1a] uppercase tracking-wider mb-3">Instagram Feed</p>
            {instagramWidgets.length > 0 ? (
              <div className="space-y-2 mb-3">
                {instagramWidgets.map((w) => (
                  <label key={w.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedWidgetIds.includes(w.id)}
                      onChange={() => toggleWidget(w.id)}
                      className="accent-[#cc0000]"
                    />
                    <span className="text-sm text-[#1a1a1a]">@{w.instagram_username}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#888] mb-3">No Instagram accounts connected yet.</p>
            )}
            <button
              onClick={handleConnectInstagram}
              className="text-sm text-[#cc0000] font-medium hover:underline"
            >
              + Connect Instagram
            </button>
          </div>

          {/* Google Reviews section */}
          <div className="border border-black/[0.07] rounded-xl p-4 mb-6 bg-white">
            <p className="text-xs font-semibold text-[#1a1a1a] uppercase tracking-wider mb-3">Google Reviews</p>
            {googleWidgets.length > 0 && (
              <div className="space-y-2 mb-3">
                {googleWidgets.map((w) => (
                  <label key={w.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedWidgetIds.includes(w.id)}
                      onChange={() => toggleWidget(w.id)}
                      className="accent-[#cc0000]"
                    />
                    <span className="text-sm text-[#1a1a1a]">{w.label || w.place_id}</span>
                  </label>
                ))}
              </div>
            )}
            <form onSubmit={handleSearchGoogle} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your business name"
                className="flex-1 border border-black/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#cc0000]/30"
              />
              <button
                type="submit"
                disabled={searching}
                className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#cc0000] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {searching ? '...' : 'Search'}
              </button>
            </form>
            {searchResults.length > 0 && (
              <div className="mt-2 border border-black/[0.07] rounded-lg divide-y divide-black/[0.05]">
                {searchResults.map((r) => (
                  <button
                    key={r.place_id}
                    onClick={() => handleSelectGoogleBusiness(r)}
                    disabled={savingGoogle}
                    className="w-full text-left px-3 py-2.5 hover:bg-[#faf9f7] transition-colors"
                  >
                    <p className="text-sm font-medium text-[#1a1a1a]">{r.name}</p>
                    <p className="text-xs text-[#888]">{r.address}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {error && (
        <p className="text-xs text-[#cc0000] mb-4">{error}</p>
      )}

      <div className="flex gap-2.5">
        <button
          onClick={onBack}
          className="flex-1 py-2.5 px-4 rounded-xl border border-black/[0.07] text-[#555] hover:border-[#cc0000]/30 hover:text-[#cc0000] font-medium transition-colors text-[13px]"
        >
          Back to Preview
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-2.5 px-4 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-semibold transition-colors text-[13px]"
        >
          {selectedWidgetIds.length > 0 ? `Continue with ${selectedWidgetIds.length} widget${selectedWidgetIds.length > 1 ? 's' : ''}` : 'Skip'}
        </button>
      </div>
    </div>
  );
}
