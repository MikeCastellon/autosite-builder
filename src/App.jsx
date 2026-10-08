import { useState, useCallback, useRef, useEffect } from 'react';
import WizardShell from './components/wizard/WizardShell.jsx';
import StepBusinessType from './components/wizard/StepBusinessType.jsx';
import StepBusinessInfo from './components/wizard/StepBusinessInfo.jsx';
import StepTemplatePicker from './components/wizard/StepTemplatePicker.jsx';
import StepGenerating from './components/wizard/StepGenerating.jsx';
import WebsitePreview from './components/preview/WebsitePreview.jsx';
import StepExport from './components/wizard/StepExport.jsx';
import StepSocialFeeds from './components/wizard/StepSocialFeeds.jsx';
import { DEMO_BUSINESS_INFO, DEMO_GENERATED_COPY } from './data/demoData.js';
import { useAuth } from './lib/AuthContext.jsx';
import LoginPage from './components/auth/LoginPage.jsx';
import LandingPage from './components/LandingPage.jsx';
import ResetPasswordPage from './components/auth/ResetPasswordPage.jsx';
import DashboardPage from './components/dashboard/DashboardPage.jsx';
import BookingOnlySetup from './components/dashboard/booking-only/BookingOnlySetup.jsx';
import BookingSettingsPage from './components/dashboard/booking-settings/BookingSettingsPage.jsx';
import BookingsPage from './components/dashboard/bookings-page/BookingsPage.jsx';
import InquiriesPage from './components/dashboard/inquiries-page/InquiriesPage.jsx';
import CustomersPage from './components/dashboard/customers-page/CustomersPage.jsx';
import CustomerDetailPage from './components/dashboard/customers-page/CustomerDetailPage.jsx';
import AdminPage from './components/admin/AdminPage.jsx';
import AdminShell from './components/admin/AdminShell.jsx';
import CustomSiteFormPage from './components/customSite/CustomSiteFormPage.jsx';
import ProfilePage from './components/profile/ProfilePage.jsx';
import PaymentsConnectPage from './components/dashboard/payments-connect/PaymentsConnectPage.jsx';
import ChargesPage from './components/dashboard/charges/ChargesPage.jsx';
import OverviewPage from './components/dashboard/overview/OverviewPage.jsx';
import HelpChrome from './components/help/HelpChrome.jsx';
import AppShell from './components/ui/AppShell.jsx';
import { saveSite } from './lib/saveSite.js';
import { parkEditorState, demoEditorState, stateAfterDemo, DEMO_BACK_LABELS } from './lib/demoPreview.js';
import { publishSite } from './lib/publishSite.js';
import { buildTemplateMeta, unpackGeneratedContent, withWidgetKeys } from './lib/siteRender.js';
import { builtForCustomer, freeSiteBusinessInfo } from './lib/freeSiteHandover.js';
import { supabase, isImpersonationTab } from './lib/supabase.js';
import { useAlert } from './components/ui/AlertProvider.jsx';
import { isEffectiveSchedulerActive } from './lib/subscriptionGating.js';
import {
  initialLanding, canUseAdmin, readWorkspace, writeWorkspace, adminSearch, stripAdminParams,
  isAdminSection, DEFAULT_ADMIN_SECTION,
} from './lib/adminWorkspace.js';

export default function App() {
  const { session, loading, isRecovery, clearRecovery, profile, profileReady } = useAuth();
  const { toast } = useAlert();
  const isPro = isEffectiveSchedulerActive(profile);

  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState(null);
  const [businessInfo, setBusinessInfo] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [generatedCopy, setGeneratedCopy] = useState(null);
  const [editedCopy, setEditedCopy] = useState(null);
  const [images, setImages] = useState({});
  const [error, setError] = useState(null);
  const [customColors, setCustomColors] = useState({});
  const [showLogin, setShowLogin] = useState(null); // null | 'signin' | 'signup'
  const [customFonts, setCustomFonts] = useState({});
  // Super admins have two workspaces: Admin (its own shell, view 'admin' +
  // adminSection) and their business, the same app every owner sees
  // (Overview, Sites, ...). Owners land on Overview so returning users see
  // how their booking page is performing (new users get a "Build My Site"
  // CTA there). An ?admin= link opens that Admin section (the custom website
  // emails link to ?admin=custom-sites&project=<id>), and a super admin
  // otherwise lands in Admin unless they last used their business view in
  // this browser. The profile here is the cached one, if any.
  const [landing] = useState(() => initialLanding({
    search: typeof window !== 'undefined' ? window.location.search : '',
    profile,
    impersonating: isImpersonationTab,
    remembered: readWorkspace(),
  }));
  const [view, setView] = useState(landing.view); // 'wizard' | 'overview' | 'dashboard' | 'admin' | 'bookings-page' | 'customers' | 'customer-detail' | 'booking-settings' | 'profile' | 'payments-connect' | 'charges'
  const [adminSection, setAdminSection] = useState(landing.section);
  // Bumped by every Admin tab click: clicking "Custom websites" while a
  // project is open goes back to the list.
  const [adminNavKey, setAdminNavKey] = useState(0);
  const [settingsSiteId, setSettingsSiteId] = useState(null);
  // A custom-website project's site opened in the editor or its booking
  // settings: Back returns to that project (Admin > Custom websites).
  const [returnToProject, setReturnToProject] = useState(null);
  // An editor opened from Admin > Free websites: Back returns there.
  const [returnToFreeSites, setReturnToFreeSites] = useState(false);
  const [customSitesProjectId, setCustomSitesProjectId] = useState(landing.projectId);
  const [selectedCustomerKey, setSelectedCustomerKey] = useState(null);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [selectedWidgetIds, setSelectedWidgetIds] = useState([]);
  const [siteId, setSiteId] = useState(null);
  const saveTimerRef = useRef(null);
  const [draftRestored, setDraftRestored] = useState(false);
  // True when the preview was reached by clicking "Edit" on a dashboard site
  // (vs. coming through the new-wizard flow). Drives the Back button label/target.
  const [editingExistingSite, setEditingExistingSite] = useState(false);

  // Per-user localStorage key for the in-progress wizard draft.
  // Lets users recover their typed-in data if generation fails or they refresh.
  const draftKey = session?.user?.email ? `genius-wizard-draft:${session.user.email}` : null;

  // Restore draft once auth session is available
  useEffect(() => {
    if (!draftKey || draftRestored) return;
    if (siteId) { setDraftRestored(true); return; }
    if (Object.keys(businessInfo).length > 0 || businessType) { setDraftRestored(true); return; }
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft?.businessType) setBusinessType(draft.businessType);
        if (draft?.businessInfo) setBusinessInfo(draft.businessInfo);
        if (draft?.selectedTemplate) setSelectedTemplate(draft.selectedTemplate);
        if (draft?.step && draft.step >= 1 && draft.step <= 4) setStep(draft.step);
      }
    } catch { /* ignore */ }
    setDraftRestored(true);
  }, [draftKey, draftRestored, businessInfo, businessType, siteId]);

  // Persist draft to localStorage as the user fills out the wizard.
  // Once a siteId exists, the data is auto-saved to Supabase so we no longer need the local draft.
  useEffect(() => {
    if (!draftKey || !draftRestored) return;
    if (siteId || step >= 5) {
      localStorage.removeItem(draftKey);
      return;
    }
    if (!businessType && Object.keys(businessInfo).length === 0) {
      localStorage.removeItem(draftKey);
      return;
    }
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        businessType,
        businessInfo,
        selectedTemplate,
        step,
        savedAt: Date.now(),
      }));
    } catch { /* quota exceeded — ignore */ }
  }, [draftKey, draftRestored, businessType, businessInfo, selectedTemplate, step, siteId]);

  // Ensure Google Reviews widget key is in editedCopy when user is signed in.
  // Not on a site the team builds for a customer (a custom or free website):
  // the signed-in admin's own reviews widget would end up on the customer's
  // site.
  useEffect(() => {
    if (!session?.user?.id || !editedCopy) return;
    if (editedCopy.googleWidgetKey) return;
    if (builtForCustomer(businessInfo)) return;
    (async () => {
      try {
        const { data: widgets } = await supabase
          .from('widget_configs')
          .select('type, widget_key')
          .eq('user_id', session.user.id)
          .eq('type', 'google-reviews')
          .order('created_at', { ascending: false })
          .limit(1);
        if (!widgets?.length) return;
        const gr = widgets[0];
        if (gr?.widget_key) {
          setEditedCopy(prev => ({ ...prev, googleWidgetKey: gr.widget_key }));
          setGeneratedCopy(prev => prev ? { ...prev, googleWidgetKey: gr.widget_key } : prev);
        }
      } catch (e) { /* ignore */ }
    })();
  }, [session?.user?.id, editedCopy?.googleWidgetKey, businessInfo?.customProjectId, businessInfo?.freeSiteId]); // eslint-disable-line

  // Demo preview: a template with placeholder data, no AI call needed. It
  // borrows the editor's state slots, so entering it parks the real editor
  // state in demoReturn (siteId included: a demo has no site to save to) and
  // leaving it puts that state back. returnTo is where Back leads:
  // 'admin' | 'editor' | 'templates'.
  const [isDemoPreview, setIsDemoPreview] = useState(false);
  const [demoReturn, setDemoReturn] = useState(null);

  // Overrides from autoSave calls made since the last render. One editor
  // action can change two things (a service rename also updates
  // copy.heroServices): each call cancels the previous timer, and the second
  // call's closure still holds the state from before the first change, so
  // without this queue the first change would never be saved. A render
  // brings every change into state, so the queue starts over each render.
  const queuedSaveRef = useRef({ id: null, overrides: {} });
  queuedSaveRef.current = { id: null, overrides: {} };

  // Auto-save site to Supabase (debounced)
  const autoSave = useCallback((callOverrides = {}) => {
    if (!session?.user?.id) return;
    // Never save demo content. A save scheduled before the demo opened
    // still runs: it carries the real site's state from back then.
    if (isDemoPreview) return;
    const id = callOverrides.siteId || siteId;
    if (!id) return;
    const queued = queuedSaveRef.current.id === id ? queuedSaveRef.current.overrides : {};
    const overrides = { ...queued, ...callOverrides };
    queuedSaveRef.current = { id, overrides };
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveSite({
        siteId: id,
        userId: session.user.id,
        businessInfo: overrides.businessInfo || businessInfo,
        generatedCopy: overrides.editedCopy || editedCopy,
        templateId: overrides.templateId || selectedTemplate,
        images: overrides.images || images,
        widgetConfigIds: selectedWidgetIds,
        customColors: overrides.customColors ?? customColors,
        customFonts: overrides.customFonts ?? customFonts,
      }).catch(err => console.error('Auto-save failed:', err));
    }, 1500);
  }, [session, isDemoPreview, siteId, businessInfo, editedCopy, selectedTemplate, images, selectedWidgetIds, customColors, customFonts]);

  // Latest autoSave and siteId, for async work that finishes after later
  // renders. Calling the autoSave captured when that work started would
  // save the state from back then (e.g. an empty dashboard state).
  const latestRef = useRef({});
  latestRef.current = { autoSave, siteId };

  // The latest businessInfo / images, also updated inside the change
  // handlers. A package photo upload or a Google rating refresh finishes
  // after later edits and calls the handler from the render it started in;
  // its function update must apply to the current value, or it would undo
  // whatever was typed meanwhile.
  const liveEditsRef = useRef({});
  liveEditsRef.current = { businessInfo, images };

  const templateMeta = selectedTemplate
    ? buildTemplateMeta(selectedTemplate, customColors, customFonts)
    : null;

  const goTo = (s) => setStep(s);
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const handleBusinessTypeSelect = (typeId) => {
    setBusinessType(typeId);
    setSelectedTemplate(null);
    setGeneratedCopy(null);
    setEditedCopy(null);
    setImages({});
    setEditingExistingSite(false);
    goTo(2);
  };

  const handleBusinessInfoSubmit = (info) => {
    setBusinessInfo({ ...info, businessType });
    goTo(3);
  };

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId);
    setCustomColors({});
    setCustomFonts({});
  };

  const handleGenerate = () => {
    setError(null);
    goTo(4);
  };

  const handleGenerateSuccess = async (copy) => {
    // Merge widget keys — check businessInfo first, then fetch from Supabase
    const merged = { ...copy };
    // Instagram disabled pending Meta App Review
    // if (businessInfo.instagramWidgetKey) merged.instagramWidgetKey = businessInfo.instagramWidgetKey;
    if (businessInfo.googleWidgetKey) merged.googleWidgetKey = businessInfo.googleWidgetKey;

    // If still missing, fetch from Supabase. Never for a site the team
    // builds for a customer: those are the admin's own widgets.
    if (session?.user?.id && !builtForCustomer(businessInfo) && (!merged.instagramWidgetKey || !merged.googleWidgetKey)) {
      try {
        const { data: widgets } = await supabase
          .from('widget_configs')
          .select('type, widget_key')
          .eq('user_id', session.user.id)
          .in('type', ['instagram-feed', 'google-reviews'])
          .order('created_at', { ascending: false });
        if (widgets) {
          const ig = widgets.find(w => w.type === 'instagram-feed');
          const gr = widgets.find(w => w.type === 'google-reviews');
          if (ig && !merged.instagramWidgetKey) merged.instagramWidgetKey = ig.widget_key;
          if (gr && !merged.googleWidgetKey) merged.googleWidgetKey = gr.widget_key;
        }
      } catch (e) { /* ignore */ }
    }

    setGeneratedCopy(merged);
    setEditedCopy(structuredClone(merged));
    setImages({});
    const newSiteId = siteId || crypto.randomUUID();
    setSiteId(newSiteId);
    goTo(5);
    // Auto-save after generation
    autoSave({ siteId: newSiteId, editedCopy: merged });
  };

  const handleGenerateError = (msg) => {
    setError(msg);
    goTo(3);
  };

  const handleStartOver = () => {
    setStep(1);
    setBusinessType(null);
    setBusinessInfo({});
    setSelectedTemplate(null);
    setGeneratedCopy(null);
    setEditedCopy(null);
    setImages({});
    setError(null);
    setCustomColors({});
    setCustomFonts({});
    setSelectedWidgetIds([]);
    setIsDemoPreview(false);
    setDemoReturn(null);
    setSiteId(null);
    setEditingExistingSite(false);
    if (draftKey) {
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    }
  };

  // Nav callbacks for the Payments and Charges tabs. Must stay above any
  // early-return guards below so hook count is stable across renders
  // (React #310 bait). Both tabs show only when VITE_STRIPE_PUBLISHABLE_KEY
  // is set. Production sets it, so Stripe Connect payments and charges are
  // live for real users; leave it unset in an environment without Stripe.
  const PAYMENTS_TAB_ENABLED = !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  const goPaymentsConnect = useCallback(() => { setView('payments-connect'); }, []);
  const onOpenPaymentsConnectProp = PAYMENTS_TAB_ENABLED ? goPaymentsConnect : undefined;
  const goCharges = useCallback(() => { setView('charges'); }, []);
  const onOpenChargesProp = PAYMENTS_TAB_ENABLED ? goCharges : undefined;
  const [chargesAutoOpen, setChargesAutoOpen] = useState(false);
  const goCharge = useCallback(() => { setChargesAutoOpen(true); setView('charges'); }, []);
  const onChargeProp = PAYMENTS_TAB_ENABLED ? goCharge : undefined;

  useEffect(() => {
    if (view !== 'charges') setChargesAutoOpen(false);
  }, [view]);

  // Only a profile that belongs to the signed-in user counts: the cached one
  // can be someone else's until AuthContext replaces it. Never in a "View as
  // user" tab, which shows the customer's app only.
  const ownProfile = session && profile && profile.id === session.user.id ? profile : null;
  const adminAllowed = canUseAdmin(ownProfile, isImpersonationTab);

  // The landing above used the cached profile, if any. When the signed-in
  // user's own profile arrives and says something else (a first sign-in
  // with no cache, a cache left by another user, a new super admin), land
  // again, unless they already opened something. Signing out re-arms it for
  // whoever signs in next in this tab.
  const landingKey = (p) => (p ? `${p.id}|${canUseAdmin(p, isImpersonationTab)}` : null);
  const landedForRef = useRef(landingKey(profile));
  useEffect(() => {
    if (!loading && !session) landedForRef.current = null;
  }, [loading, session]);
  useEffect(() => {
    if (!ownProfile) return;
    const key = landingKey(ownProfile);
    if (landedForRef.current === key) return;
    landedForRef.current = key;
    if (view !== 'overview') return;
    const next = initialLanding({
      search: window.location.search,
      profile: ownProfile,
      impersonating: isImpersonationTab,
      remembered: readWorkspace(),
    });
    if (next.view === 'admin') { setAdminSection(next.section); setView('admin'); }
  }, [ownProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ?admin= links, and the Admin view left behind by an admin who signed
  // out, never show the Admin workspace to anyone else: Overview instead.
  // Waits for the user's own profile (a cached one may be stale); a missing
  // profile also lands on Overview rather than an endless spinner.
  useEffect(() => {
    if (view === 'admin' && profileReady && !adminAllowed) setView('overview');
  }, [view, profileReady, adminAllowed]);

  // The address bar follows the Admin section, so a reload or a copied link
  // comes back to it; leaving Admin drops the admin params (other params,
  // e.g. ?help=, stay).
  useEffect(() => {
    if (typeof window === 'undefined' || !session) return;
    const { pathname, search, hash } = window.location;
    const next = view === 'admin' && adminAllowed ? adminSearch(adminSection) : stripAdminParams(search);
    if (next !== search) window.history.replaceState(window.history.state, '', pathname + next + hash);
  }, [view, adminSection, adminAllowed, session]);


  // Domain Connect callback: close popup, notify opener
  if (typeof window !== 'undefined' && window.location.pathname === '/domain-connected') {
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'domain-connected' }, window.location.origin);
        window.close();
      }
    } catch {}
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
        <div className="text-center">
          <p className="text-lg font-semibold text-[#1a1a1a] mb-2">Domain connected!</p>
          <p className="text-sm text-ink-tertiary">You can close this window and return to the app.</p>
        </div>
      </div>
    );
  }

  // Custom website intake form: public, the token in the link is the key.
  if (typeof window !== 'undefined' && window.location.pathname === '/custom-site') {
    return <CustomSiteFormPage />;
  }

  // Booking deposit confirmation pages — public, no auth required.
  if (typeof window !== 'undefined' && window.location.pathname === '/booking-confirmed') {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl border border-black/[0.07] shadow-sm overflow-hidden">
          <div className="h-1.5 bg-[#cc0000]" />
          <div className="px-8 py-10 text-center">
            <div className="w-16 h-16 rounded-full bg-[#cc0000]/10 flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#cc0000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-[11px] font-semibold text-[#cc0000] uppercase tracking-[2px] mb-2">Deposit Received</p>
            <h1 className="text-2xl font-[900] text-[#1a1a1a] tracking-tight mb-2">You're all booked!</h1>
            <p className="text-sm text-[#666] leading-relaxed mb-6">
              Your deposit was processed and your appointment is confirmed. Check your email for the details — we'll be in touch soon.
            </p>
            <a
              href="/"
              className="inline-block px-6 py-2.5 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white text-sm font-semibold transition-colors"
            >
              Back to home
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (typeof window !== 'undefined' && window.location.pathname === '/booking-cancelled') {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl border border-black/[0.07] shadow-sm overflow-hidden">
          <div className="h-1.5 bg-[#888]" />
          <div className="px-8 py-10 text-center">
            <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-[2px] mb-2">Payment Cancelled</p>
            <h1 className="text-2xl font-[900] text-[#1a1a1a] tracking-tight mb-2">No worries.</h1>
            <p className="text-sm text-[#666] leading-relaxed mb-6">
              Your deposit wasn't charged. Your booking request is still on file — the shop may follow up with you directly to confirm your appointment.
            </p>
            <a
              href="/"
              className="inline-block px-6 py-2.5 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white text-sm font-semibold transition-colors"
            >
              Back to home
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Auth gate
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
      <div className="w-8 h-8 border-4 border-gray-300 border-t-[#cc0000] rounded-full animate-spin" />
    </div>
  );
  if (!session) {
    return showLogin
      ? <LoginPage initialMode={showLogin} />
      : <LandingPage
          onSignIn={() => setShowLogin('signin')}
          onSignUp={() => setShowLogin('signup')}
        />;
  }
  if (isRecovery) return <ResetPasswordPage onComplete={() => { clearRecovery(); window.history.replaceState({}, '', window.location.pathname); }} />;

  const handleSignOut = async () => {
    // In an admin's "View as user" tab, end only that tab's session: the
    // default global sign-out would also sign the customer out everywhere.
    await supabase.auth.signOut(isImpersonationTab ? { scope: 'local' } : undefined);
  };

  // Open the Admin workspace, by default on the section the admin was last
  // in. `projectId` opens that custom website project.
  const openAdmin = (section = adminSection, { projectId = null } = {}) => {
    setCustomSitesProjectId(projectId);
    setAdminSection(isAdminSection(section) ? section : DEFAULT_ADMIN_SECTION);
    setView('admin');
    writeWorkspace('admin');
  };
  const switchToBusiness = () => {
    writeWorkspace('business');
    setView('overview');
  };
  // Sections opened from inside Admin (dashboard cards, Leads -> Pipeline).
  const goAdminSection = (section) => {
    setCustomSitesProjectId(null);
    setAdminSection(section);
  };
  // The Admin tabs: also start the section over and scroll to the top.
  const handleAdminNav = (section) => {
    goAdminSection(section);
    setAdminNavKey((k) => k + 1);
    window.scrollTo(0, 0);
  };
  // Back from a custom website project's site (editor, booking settings).
  const backToProject = () => {
    const projectId = returnToProject;
    setReturnToProject(null);
    openAdmin('custom-sites', { projectId });
  };
  const backToFreeSites = () => {
    setReturnToFreeSites(false);
    openAdmin('free-sites');
  };

  // Single source of truth for the business header navigation, spread into
  // <AppShell> so every customer page renders the identical nav. The active
  // item is driven by AppShell's `active` prop, not by which handler a page
  // omits. Admin pages are not in it: super admins get one "Admin" switch.
  const navHandlers = {
    onOpenOverview: () => setView('overview'),
    onMySites: () => setView('dashboard'),
    onOpenInquiries: () => setView('inquiries'),
    onOpenBookings: () => setView('bookings-page'),
    onOpenCustomers: () => setView('customers'),
    onOpenCharges: onOpenChargesProp,
    onCharge: onChargeProp,
    onOpenPaymentsConnect: onOpenPaymentsConnectProp,
    onSwitchToAdmin: adminAllowed ? () => openAdmin() : undefined,
    onOpenProfile: () => setView('profile'),
    onSignOut: handleSignOut,
  };

  // `returnTo`: a custom-website project id when opened from that project;
  // `toFreeSites`: opened from Admin > Free websites.
  const handleEditSite = async (site, { returnTo = null, toFreeSites = false } = {}) => {
    setReturnToProject(returnTo);
    setReturnToFreeSites(toFreeSites);
    setSiteId(site.id);
    setBusinessType(site.business_info?.businessType || null);
    setBusinessInfo(site.business_info || {});
    setSelectedTemplate(site.template_id);
    // The dashboard list query omits the heavy generated_content column (to keep
    // the list light), so load it for this specific site before opening the
    // editor — otherwise the editor renders with empty copy/images.
    let fullGenerated = site.generated_content;
    if (fullGenerated == null) {
      const { data } = await supabase
        .from('sites').select('generated_content').eq('id', site.id).single();
      fullGenerated = data?.generated_content;
    }
    const {
      copy: storedCopy,
      images: siteImages,
      customColors: savedCustomColors,
      customFonts: savedCustomFonts,
    } = unpackGeneratedContent(fullGenerated);
    // Sites the team builds for a customer never take the signed-in
    // admin's widget keys (see the effect above).
    const copy = builtForCustomer(site.business_info)
      ? storedCopy
      : await withWidgetKeys(storedCopy, session?.user?.id, supabase);

    setGeneratedCopy(copy);
    setEditedCopy(structuredClone(copy));
    setImages(siteImages);
    setSelectedWidgetIds(site.widget_config_ids || []);
    setCustomColors(savedCustomColors);
    setCustomFonts(savedCustomFonts);
    setIsDemoPreview(false);
    setDemoReturn(null);
    setEditingExistingSite(true);
    setStep(5);
    setView('wizard');

    // Heal legacy base64 images: upload to storage, rewrite _images to URLs.
    // Best-effort and non-blocking so the editor opens immediately. Old drafts
    // with inline base64 otherwise blow past Netlify's publish payload limit.
    (async () => {
      try {
        const { migrateLegacyImages } = await import('./lib/imageUpload.js');
        const { migrated, images: fixed } = await migrateLegacyImages(siteImages, site.id);
        // Uploads take a while: only apply the result if this site is still
        // the one open, and save through the latest state.
        if (migrated && latestRef.current.siteId === site.id) {
          setImages(fixed);
          latestRef.current.autoSave({ siteId: site.id, images: fixed });
        }
      } catch { /* leave base64 in place; retry next open */ }
    })();
  };

  if (view === 'inquiries') {
    return (
      <AppShell active="inquiries" nav={navHandlers} userEmail={session?.user?.email} profile={profile}>
        <InquiriesPage
          userId={session?.user?.id}
          profile={profile}
          onExit={() => setView('dashboard')}
        />
      </AppShell>
    );
  }

  if (view === 'bookings-page') {
    return (
      <AppShell active="bookings" nav={navHandlers} userEmail={session?.user?.email} profile={profile}>
        <BookingsPage
          userId={session?.user?.id}
          profile={profile}
          onExit={() => setView('dashboard')}
        />
      </AppShell>
    );
  }

  if (view === 'customers') {
    return (
      <AppShell active="customers" nav={navHandlers} userEmail={session?.user?.email} profile={profile}>
        <CustomersPage
          userId={session?.user?.id}
          profile={profile}
          onExit={() => setView('dashboard')}
          onOpenCustomerDetail={(key) => { setSelectedCustomerKey(key); setView('customer-detail'); }}
        />
      </AppShell>
    );
  }

  if (view === 'customer-detail' && selectedCustomerKey) {
    return (
      <AppShell active="customers" nav={navHandlers} userEmail={session?.user?.email} profile={profile}>
        <CustomerDetailPage
          userId={session?.user?.id}
          userEmail={session?.user?.email}
          profile={profile}
          identityKey={selectedCustomerKey}
          onBackToCustomers={() => { setSelectedCustomerKey(null); setView('customers'); }}
          onOpenBookings={() => { setSelectedCustomerKey(null); setView('bookings-page'); }}
        />
      </AppShell>
    );
  }

  if (view === 'booking-settings' && settingsSiteId) {
    // Opened from a custom website project: it is Admin work, so it keeps
    // the Admin shell and leads back to the project.
    const fromProject = !!returnToProject && adminAllowed;
    const body = (
      <>
        {fromProject && (
          <div className="max-w-5xl mx-auto px-4 pt-6">
            <button
              type="button"
              onClick={() => { setSettingsSiteId(null); backToProject(); }}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-tertiary hover:text-[#1a1a1a]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
              Back to project
            </button>
          </div>
        )}
        <BookingSettingsPage
          siteId={settingsSiteId}
          onExit={() => {
            setSettingsSiteId(null);
            if (fromProject) backToProject();
            else { setReturnToProject(null); setView('dashboard'); }
          }}
        />
      </>
    );
    if (fromProject) {
      return (
        <AdminShell
          section="custom-sites"
          onSection={(section) => { setSettingsSiteId(null); setReturnToProject(null); openAdmin(section); }}
          onSwitchToBusiness={() => { setSettingsSiteId(null); setReturnToProject(null); switchToBusiness(); }}
          onOpenProfile={() => { setSettingsSiteId(null); setReturnToProject(null); setView('profile'); }}
          onSignOut={handleSignOut}
          userEmail={session?.user?.email}
          profile={profile}
        >
          {body}
        </AdminShell>
      );
    }
    return (
      <AppShell active="bookings" nav={navHandlers} userEmail={session?.user?.email} profile={profile}>
        {body}
      </AppShell>
    );
  }

  if (view === 'profile') {
    return (
      <AppShell active="profile" nav={navHandlers} userEmail={session?.user?.email} profile={profile}>
        <ProfilePage onExit={() => setView('dashboard')} />
      </AppShell>
    );
  }

  if (view === 'payments-connect') {
    return (
      <AppShell active="payments-connect" nav={navHandlers} userEmail={session?.user?.email} profile={profile}>
        <PaymentsConnectPage
          userId={session?.user?.id}
          profile={profile}
          onOpenCharges={onOpenChargesProp}
        />
      </AppShell>
    );
  }

  if (view === 'charges') {
    return (
      <AppShell active="charges" nav={navHandlers} userEmail={session?.user?.email} profile={profile}>
        <ChargesPage
          userId={session?.user?.id}
          profile={profile}
          autoOpen={chargesAutoOpen}
          onExit={() => setView('dashboard')}
        />
      </AppShell>
    );
  }

  // Setters for the editor state slots the demo borrows (see demoPreview.js).
  const applyEditorState = (state) => {
    const setters = {
      siteId: setSiteId,
      selectedTemplate: setSelectedTemplate,
      generatedCopy: setGeneratedCopy,
      editedCopy: setEditedCopy,
      images: setImages,
      customColors: setCustomColors,
      customFonts: setCustomFonts,
      editingExistingSite: setEditingExistingSite,
      step: setStep,
    };
    for (const [key, value] of Object.entries(state)) setters[key]?.(value);
  };

  // Open the demo in the editor (step 5). Parks the real editor state first,
  // unless a demo is already open (its snapshot is the real state).
  const startDemo = (templateId, returnTo) => {
    if (!isDemoPreview) {
      setDemoReturn(parkEditorState({
        siteId, selectedTemplate, generatedCopy, editedCopy, images,
        customColors, customFonts, editingExistingSite, step,
      }, returnTo));
    }
    applyEditorState(demoEditorState(templateId, DEMO_GENERATED_COPY));
    setIsDemoPreview(true);
  };

  // Admin-only: jump straight into the editor with stub data, skipping the
  // wizard. Useful for testing tour/editor changes and for showcasing the
  // editor to prospects without spinning up real data. Resets
  // editingExistingSite (so WebsitePreview's tour-suppression effect won't
  // fire) and clears the tour flag (so the tour actually shows).
  // returnTo: 'admin' (Admin dashboard quick action) or 'editor' (editor
  // toolbar).
  const handleDashboardDemo = (returnTo) => {
    try { localStorage.removeItem('editor_tour_done_v3'); } catch { /* ignore */ }
    startDemo('detailing_sporty', returnTo);
    setView('wizard');
  };

  // The Admin workspace. Declared after handleDashboardDemo: its handlers
  // call it.
  if (view === 'admin') {
    // Not (yet) known to be a super admin: the profile is still loading, or
    // the guard effect above is moving this tab to Overview.
    if (!adminAllowed) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-[#cc0000] rounded-full animate-spin" />
        </div>
      );
    }
    return (
      <AdminShell
        section={adminSection}
        onSection={handleAdminNav}
        onSwitchToBusiness={switchToBusiness}
        onOpenProfile={() => setView('profile')}
        onSignOut={handleSignOut}
        userEmail={session?.user?.email}
        profile={profile}
      >
        <AdminPage
          section={adminSection}
          onSection={goAdminSection}
          navKey={adminNavKey}
          projectId={customSitesProjectId}
          onOpenProject={(projectId) => openAdmin('custom-sites', { projectId })}
          onOpenSiteEditor={async (siteId, projectId) => {
            const { data: site, error: siteError } = await supabase.from('sites').select('*').eq('id', siteId).maybeSingle();
            if (siteError || !site) { toast('Could not open the site', 'error'); return; }
            // Saving from this session would make the signed-in admin the
            // site's owner: someone else's site is edited as them (View as user).
            if (site.user_id !== session?.user?.id) {
              toast('This site is in the customer\'s account. Edit it from Admin › Customers › View as user.', 'error');
              return;
            }
            await handleEditSite(site, { returnTo: projectId });
          }}
          onOpenBookingSettings={(siteId, projectId) => {
            setReturnToProject(projectId);
            setSettingsSiteId(siteId);
            setView('booking-settings');
          }}
          onOpenDemo={() => handleDashboardDemo('admin')}
          onBuildFreeSite={(row) => {
            // The normal builder from step 1, with what the admin already
            // knows and the row's marker: the first save links the site to
            // the row (free-site-admin), and the builder's own widgets stay
            // off it.
            handleStartOver();
            setBusinessInfo(freeSiteBusinessInfo(row));
            setView('wizard');
            window.scrollTo(0, 0);
          }}
          onOpenFreeSiteEditor={async (siteId) => {
            const { data: site, error: siteError } = await supabase.from('sites').select('*').eq('id', siteId).maybeSingle();
            if (siteError || !site) { toast('Could not open the site', 'error'); return; }
            // Publishing from this session uses the signed-in admin's
            // account: someone else's site is edited as them (View as user).
            if (site.user_id !== session?.user?.id) {
              toast('This site is in another account. Ask the team member who built it, or use Admin › Customers › View as user.', 'error');
              return;
            }
            await handleEditSite(site, { toFreeSites: true });
          }}
        />
      </AdminShell>
    );
  }

  // Flush any debounced autoSave and persist the latest edits synchronously.
  // Returns true on success so callers (Save Draft / Publish) can chain on it.
  const flushSaveSite = async () => {
    if (isDemoPreview) return true; // demo content is never saved
    clearTimeout(saveTimerRef.current);
    if (!siteId || !session?.user?.id) return true;
    await saveSite({
      siteId,
      userId: session.user.id,
      businessInfo,
      generatedCopy: editedCopy,
      templateId: selectedTemplate,
      images,
      widgetConfigIds: selectedWidgetIds,
      customColors,
      customFonts,
    });
    return true;
  };

  // "Save Draft" from the editor toolbar — saves the latest edits to
  // Supabase without leaving the editor. Republishing the live site
  // happens via the Publish button (handlePublish below) or the
  // dashboard's existing Republish action. Errors get a top-right toast
  // because they need attention; success is an inline "Saved" checkmark
  // on the button itself, so we don't toast and don't swallow the throw.
  const handleSaveDraft = async () => {
    try {
      await flushSaveSite();
    } catch (err) {
      console.error('Save draft failed:', err);
      toast(`Save failed: ${err.message}`, 'error');
      throw err;
    }
  };

  // "Publish" from the editor toolbar — saves the draft first, then
  // pushes the latest content live via publishSite (R2 upload). Returns
  // publish-site's { publishedUrl, bookingUrl, slug } so the toolbar can
  // show where the site went live; toasts on error.
  const handlePublishFromEditor = async () => {
    try {
      await flushSaveSite();
      // Guarantee no inline base64 images remain before publishing — otherwise
      // the exported HTML can exceed Netlify's ~6MB function limit and the
      // publish fails. Opening the editor heals images in the background, but a
      // quick Publish can beat it, so migrate any stragglers here first.
      let imagesToPublish = images;
      try {
        const { migrateLegacyImages } = await import('./lib/imageUpload.js');
        const { migrated, images: fixed } = await migrateLegacyImages(images, siteId);
        if (migrated) {
          imagesToPublish = fixed;
          setImages(fixed);
          autoSave({ images: fixed });
        }
      } catch { /* fall back to publishing whatever we have */ }
      return await publishSite({
        siteId,
        businessInfo,
        generatedCopy: editedCopy,
        templateId: selectedTemplate,
        templateMeta: { ...templateMeta, colors: templateMeta?.colors || {} },
        images: imagesToPublish,
        selectedWidgetIds,
        isPro,
      });
    } catch (err) {
      console.error('Publish failed:', err);
      toast(`Publish failed: ${err.message}`, 'error');
      throw err;
    }
  };

  if (view === 'booking-only-setup') {
    return (
      <>
        <BookingOnlySetup
          onDone={() => setView('dashboard')}
          onCancel={() => setView('dashboard')}
        />
        <HelpChrome profile={profile} />
      </>
    );
  }

  if (view === 'overview') {
    return (
      <AppShell active="overview" nav={navHandlers} userEmail={session?.user?.email} profile={profile}>
        <OverviewPage
          userId={session?.user?.id}
          onNewSite={() => { handleStartOver(); setView('wizard'); }}
          onNewBookingPage={() => setView('booking-only-setup')}
        />
      </AppShell>
    );
  }

  if (view === 'dashboard') {
    return (
      <AppShell active="sites" nav={navHandlers} userEmail={session?.user?.email} profile={profile}>
        <DashboardPage
          onNewSite={() => { handleStartOver(); setView('wizard'); }}
          onNewBookingPage={() => setView('booking-only-setup')}
          onEditSite={handleEditSite}
          profile={profile}
          onOpenBookingSettings={(siteId) => { setReturnToProject(null); setSettingsSiteId(siteId); setView('booking-settings'); }}
        />
      </AppShell>
    );
  }

  // Wizard step 3: "Preview" on a template card.
  const handlePreviewDemo = (templateId) => startDemo(templateId, 'templates');

  // Leave the demo: put the parked editor state back and return to where
  // the demo was opened from.
  const handleBackFromDemo = () => {
    const { state, view: nextView } = stateAfterDemo(demoReturn, selectedTemplate);
    setIsDemoPreview(false);
    setDemoReturn(null);
    applyEditorState(state);
    if (nextView) setView(nextView);
  };


  // Step 5 is full-screen preview, no wizard shell
  if (step === 5 && generatedCopy) {
    return (
      <>
      <WebsitePreview
        siteId={siteId}
        businessInfo={isDemoPreview ? DEMO_BUSINESS_INFO : { ...businessInfo, businessType: businessInfo?.businessType || businessType }}
        onBusinessInfoChange={isDemoPreview ? undefined : (next) => {
          const resolved = typeof next === 'function' ? next(liveEditsRef.current.businessInfo) : next;
          liveEditsRef.current = { ...liveEditsRef.current, businessInfo: resolved };
          setBusinessInfo(resolved);
          latestRef.current.autoSave({ businessInfo: resolved });
        }}
        generatedCopy={generatedCopy}
        editedCopy={editedCopy}
        onEditedCopyChange={(newCopy) => { setEditedCopy(newCopy); autoSave({ editedCopy: newCopy }); }}
        images={images}
        onImagesChange={(newImages) => {
          const resolved = typeof newImages === 'function' ? newImages(liveEditsRef.current.images) : newImages;
          liveEditsRef.current = { ...liveEditsRef.current, images: resolved };
          setImages(resolved);
          latestRef.current.autoSave({ images: resolved });
        }}
        templateId={selectedTemplate}
        templateMeta={templateMeta}
        customColors={customColors}
        onCustomColors={(next) => {
          const resolved = typeof next === 'function' ? next(customColors) : next;
          setCustomColors(resolved);
          autoSave({ customColors: resolved });
        }}
        customFonts={customFonts}
        onCustomFonts={(next) => {
          const resolved = typeof next === 'function' ? next(customFonts) : next;
          setCustomFonts(resolved);
          autoSave({ customFonts: resolved });
        }}
        onBack={
          isDemoPreview
            ? handleBackFromDemo
            : editingExistingSite && returnToProject
              ? backToProject
              : editingExistingSite && returnToFreeSites
                ? backToFreeSites
                : editingExistingSite
                  ? () => setView('dashboard')
                  : () => goTo(3)
        }
        backLabel={isDemoPreview
          ? DEMO_BACK_LABELS[demoReturn?.returnTo] || 'Back to Templates'
          : editingExistingSite && returnToProject ? 'Back to project'
            : editingExistingSite && returnToFreeSites ? 'Back to Free websites'
              : editingExistingSite ? 'Back to Sites' : 'Back to Templates'}
        onExport={isDemoPreview || editingExistingSite ? null : () => goTo(6)}
        onSaveDraft={!isDemoPreview && editingExistingSite ? handleSaveDraft : null}
        onPublish={!isDemoPreview && editingExistingSite ? handlePublishFromEditor : null}
        onStartOver={() => { handleStartOver(); setView('dashboard'); }}
        onSwitchTemplate={(newTemplateId) => {
          setSelectedTemplate(newTemplateId);
          setCustomColors({});
          setCustomFonts({});
          autoSave({ templateId: newTemplateId, customColors: {}, customFonts: {} });
        }}
        isDemoPreview={isDemoPreview}
        editingExistingSite={editingExistingSite}
        onPreviewDemo={() => handleDashboardDemo('editor')}
      />
      <HelpChrome profile={profile} />
      </>
    );
  }

  // Step 5.5 — Social Feeds (between preview and export)
  if (step === 5.5) {
    return (
      <>
        <StepSocialFeeds
          selectedWidgetIds={selectedWidgetIds}
          onWidgetIdsChange={setSelectedWidgetIds}
          businessInfo={businessInfo}
          onWidgetKeysChange={({ googleWidgetKey, instagramWidgetKey }) => {
            setEditedCopy((prev) => ({ ...prev, googleWidgetKey, instagramWidgetKey }));
          }}
          onNext={() => goTo(6)}
          onBack={() => goTo(5)}
        />
        <HelpChrome profile={profile} />
      </>
    );
  }

  // Step 6 is export
  if (step === 6 && generatedCopy) {
    return (
      <>
        <StepExport
          siteId={siteId}
          businessInfo={businessInfo}
          generatedCopy={editedCopy || generatedCopy}
          templateId={selectedTemplate}
          templateMeta={templateMeta}
          images={images}
          selectedWidgetIds={selectedWidgetIds}
          onBack={() => goTo(5)}
          onStartOver={() => { handleStartOver(); setView('dashboard'); }}
        />
        <HelpChrome profile={profile} />
      </>
    );
  }

  return (
    <>
      <WizardShell step={step} onBack={goBack} userEmail={session?.user?.email} profile={profile} onMySites={() => setView('dashboard')} onOpenBookings={() => setView('bookings-page')} onSwitchToAdmin={navHandlers.onSwitchToAdmin} onSignOut={handleSignOut}>
        {step === 1 && (
          <StepBusinessType onSelect={handleBusinessTypeSelect} />
        )}
        {step === 2 && (
          <StepBusinessInfo
            businessType={businessType}
            initialValues={businessInfo}
            onSubmit={handleBusinessInfoSubmit}
          />
        )}
        {step === 3 && (
          <StepTemplatePicker
            businessType={businessType}
            selected={selectedTemplate}
            onSelect={handleTemplateSelect}
            onGenerate={handleGenerate}
            onPreview={handlePreviewDemo}
            error={error}
            customColors={customColors}
            onCustomColors={setCustomColors}
          />
        )}
        {step === 4 && (
          <StepGenerating
            businessInfo={businessInfo}
            templateMeta={templateMeta}
            onSuccess={handleGenerateSuccess}
            onError={handleGenerateError}
          />
        )}
      </WizardShell>
      <HelpChrome profile={profile} />
    </>
  );
}
