import { useState, useCallback, useRef, useEffect } from 'react';
import WizardShell from './components/wizard/WizardShell.jsx';
import StepBusinessType from './components/wizard/StepBusinessType.jsx';
import StepBusinessInfo from './components/wizard/StepBusinessInfo.jsx';
import StepTemplatePicker from './components/wizard/StepTemplatePicker.jsx';
import StepGenerating from './components/wizard/StepGenerating.jsx';
import WebsitePreview from './components/preview/WebsitePreview.jsx';
import StepExport from './components/wizard/StepExport.jsx';
import StepSocialFeeds from './components/wizard/StepSocialFeeds.jsx';
import { TEMPLATES } from './data/templates.js';
import { DEMO_BUSINESS_INFO, DEMO_GENERATED_COPY } from './data/demoData.js';
import { useAuth } from './lib/AuthContext.jsx';
import LoginPage from './components/auth/LoginPage.jsx';
import LandingPage from './components/LandingPage.jsx';
import ResetPasswordPage from './components/auth/ResetPasswordPage.jsx';
import DashboardPage from './components/dashboard/DashboardPage.jsx';
import BookingSettingsPage from './components/dashboard/booking-settings/BookingSettingsPage.jsx';
import BookingsPage from './components/dashboard/bookings-page/BookingsPage.jsx';
import CustomersPage from './components/dashboard/customers-page/CustomersPage.jsx';
import CustomerDetailPage from './components/dashboard/customers-page/CustomerDetailPage.jsx';
import AdminPage from './components/admin/AdminPage.jsx';
import ProfilePage from './components/profile/ProfilePage.jsx';
import PaymentsConnectPage from './components/dashboard/payments-connect/PaymentsConnectPage.jsx';
import HelpChrome from './components/help/HelpChrome.jsx';
import { saveSite } from './lib/saveSite.js';
import { supabase } from './lib/supabase.js';

export default function App() {
  const { session, loading, isRecovery, clearRecovery, profile } = useAuth();

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
  // Default landing view for an authenticated user is the dashboard so returning
  // users see their existing site (and free-plan limit) instead of being dropped
  // back into the wizard. New users with zero sites see the "Build My Site" CTA there.
  const [view, setView] = useState('dashboard'); // 'wizard' | 'dashboard' | 'admin' | 'bookings-page' | 'customers' | 'customer-detail' | 'booking-settings' | 'profile' | 'payments-connect'
  const [settingsSiteId, setSettingsSiteId] = useState(null);
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

  // Ensure Google Reviews widget key is in editedCopy when user is signed in
  useEffect(() => {
    if (!session?.user?.id || !editedCopy) return;
    if (editedCopy.googleWidgetKey) return;
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
  }, [session?.user?.id, editedCopy?.googleWidgetKey]); // eslint-disable-line

  // Auto-save site to Supabase (debounced)
  const autoSave = useCallback((overrides = {}) => {
    if (!session?.user?.id) return;
    const id = overrides.siteId || siteId;
    if (!id) return;
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
  }, [session, siteId, businessInfo, editedCopy, selectedTemplate, images, selectedWidgetIds, customColors, customFonts]);

  const templateMeta = selectedTemplate
    ? {
        ...TEMPLATES[selectedTemplate],
        colors: { ...TEMPLATES[selectedTemplate].colors, ...customColors },
        font: customFonts.font ?? TEMPLATES[selectedTemplate].font,
        bodyFont: customFonts.bodyFont ?? TEMPLATES[selectedTemplate].bodyFont,
      }
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

    // If still missing, fetch from Supabase
    if (session?.user?.id && (!merged.instagramWidgetKey || !merged.googleWidgetKey)) {
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
    autoSave({ siteId: newSiteId, editedCopy: copy });
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
    setSiteId(null);
    setEditingExistingSite(false);
    if (draftKey) {
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    }
  };

  // Demo preview — shows a template with placeholder data, no AI call needed
  const [isDemoPreview, setIsDemoPreview] = useState(false);

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
          <p className="text-sm text-[#888]">You can close this window and return to the app.</p>
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
    await supabase.auth.signOut();
  };

  const goPaymentsConnect = useCallback(() => { setView('payments-connect'); }, []);

  const handleEditSite = async (site) => {
    setSiteId(site.id);
    setBusinessType(site.business_info?.businessType || null);
    setBusinessInfo(site.business_info || {});
    setSelectedTemplate(site.template_id);
    const copy = site.generated_content || {};
    const siteImages = copy._images || {};
    const savedCustomColors = copy._customColors || {};
    const savedCustomFonts = copy._customFonts || {};
    delete copy._images;
    delete copy._customColors;
    delete copy._customFonts;

    // Fetch latest widget keys from Supabase if not already in copy
    if (session?.user?.id && (!copy.instagramWidgetKey || !copy.googleWidgetKey)) {
      try {
        const { data: widgets } = await supabase
          .from('widget_configs')
          .select('type, widget_key')
          .eq('user_id', session.user.id)
          .in('type', ['instagram-feed', 'google-reviews'])
          .order('created_at', { ascending: false });
        if (widgets) {
          const igWidget = widgets.find(w => w.type === 'instagram-feed');
          const grWidget = widgets.find(w => w.type === 'google-reviews');
          if (igWidget && !copy.instagramWidgetKey) copy.instagramWidgetKey = igWidget.widget_key;
          if (grWidget && !copy.googleWidgetKey) copy.googleWidgetKey = grWidget.widget_key;
        }
      } catch (e) { /* ignore */ }
    }

    setGeneratedCopy(copy);
    setEditedCopy(structuredClone(copy));
    setImages(siteImages);
    setSelectedWidgetIds(site.widget_config_ids || []);
    setCustomColors(savedCustomColors);
    setCustomFonts(savedCustomFonts);
    setIsDemoPreview(false);
    setEditingExistingSite(true);
    setStep(5);
    setView('wizard');
  };

  if (view === 'bookings-page') {
    return (
      <>
        <BookingsPage
          userId={session?.user?.id}
          profile={profile}
          userEmail={session?.user?.email}
          onExit={() => setView('dashboard')}
          onOpenCustomers={() => setView('customers')}
          onOpenAdmin={() => setView('admin')}
          onOpenProfile={() => setView('profile')}
          onOpenPaymentsConnect={goPaymentsConnect}
          onSignOut={handleSignOut}
        />
        <HelpChrome profile={profile} />
      </>
    );
  }

  if (view === 'customers') {
    return (
      <>
        <CustomersPage
          userId={session?.user?.id}
          profile={profile}
          userEmail={session?.user?.email}
          onExit={() => setView('dashboard')}
          onOpenBookings={() => setView('bookings-page')}
          onOpenAdmin={() => setView('admin')}
          onOpenProfile={() => setView('profile')}
          onOpenPaymentsConnect={goPaymentsConnect}
          onOpenCustomerDetail={(key) => { setSelectedCustomerKey(key); setView('customer-detail'); }}
          onSignOut={handleSignOut}
        />
        <HelpChrome profile={profile} />
      </>
    );
  }

  if (view === 'customer-detail' && selectedCustomerKey) {
    return (
      <>
        <CustomerDetailPage
          userId={session?.user?.id}
          userEmail={session?.user?.email}
          profile={profile}
          identityKey={selectedCustomerKey}
          onExit={() => { setSelectedCustomerKey(null); setView('dashboard'); }}
          onBackToCustomers={() => { setSelectedCustomerKey(null); setView('customers'); }}
          onOpenBookings={() => { setSelectedCustomerKey(null); setView('bookings-page'); }}
          onOpenAdmin={() => { setSelectedCustomerKey(null); setView('admin'); }}
          onOpenProfile={() => { setSelectedCustomerKey(null); setView('profile'); }}
          onOpenPaymentsConnect={() => { setSelectedCustomerKey(null); setView('payments-connect'); }}
          onSignOut={handleSignOut}
        />
        <HelpChrome profile={profile} />
      </>
    );
  }

  if (view === 'booking-settings' && settingsSiteId) {
    return (
      <>
        <BookingSettingsPage
          siteId={settingsSiteId}
          onExit={() => { setSettingsSiteId(null); setView('dashboard'); }}
          onOpenBookings={() => { setSettingsSiteId(null); setView('bookings-page'); }}
          onOpenCustomers={() => { setSettingsSiteId(null); setView('customers'); }}
          onOpenAdmin={() => { setSettingsSiteId(null); setView('admin'); }}
          onOpenProfile={() => { setSettingsSiteId(null); setView('profile'); }}
          onOpenPaymentsConnect={() => { setSettingsSiteId(null); setView('payments-connect'); }}
          onSignOut={handleSignOut}
        />
        <HelpChrome profile={profile} />
      </>
    );
  }

  if (view === 'admin') {
    return (
      <>
        <AdminPage
          onExit={() => setView('dashboard')}
          onOpenBookings={() => setView('bookings-page')}
          onOpenCustomers={() => setView('customers')}
          onOpenProfile={() => setView('profile')}
          onOpenPaymentsConnect={goPaymentsConnect}
          onSignOut={handleSignOut}
        />
        <HelpChrome profile={profile} />
      </>
    );
  }

  if (view === 'profile') {
    return (
      <>
        <ProfilePage
          onExit={() => setView('dashboard')}
          onOpenBookings={() => setView('bookings-page')}
          onOpenCustomers={() => setView('customers')}
          onOpenAdmin={() => setView('admin')}
          onOpenPaymentsConnect={goPaymentsConnect}
          onSignOut={handleSignOut}
        />
        <HelpChrome profile={profile} />
      </>
    );
  }

  if (view === 'payments-connect') {
    return (
      <>
        <PaymentsConnectPage
          userId={session?.user?.id}
          profile={profile}
          userEmail={session?.user?.email}
          onExit={() => setView('dashboard')}
          onOpenBookings={() => setView('bookings-page')}
          onOpenCustomers={() => setView('customers')}
          onOpenAdmin={() => setView('admin')}
          onOpenProfile={() => setView('profile')}
          onOpenPaymentsConnect={goPaymentsConnect}
          onSignOut={handleSignOut}
        />
        <HelpChrome profile={profile} />
      </>
    );
  }

  if (view === 'dashboard') {
    return (
      <>
        <DashboardPage
          onNewSite={() => { handleStartOver(); setView('wizard'); }}
          onEditSite={handleEditSite}
          onSignOut={handleSignOut}
          userEmail={session?.user?.email}
          profile={profile}
          onOpenAdmin={() => setView('admin')}
          onOpenBookings={() => setView('bookings-page')}
          onOpenCustomers={() => setView('customers')}
          onOpenProfile={() => setView('profile')}
          onOpenPaymentsConnect={goPaymentsConnect}
          onOpenBookingSettings={(siteId) => { setSettingsSiteId(siteId); setView('booking-settings'); }}
        />
        <HelpChrome profile={profile} />
      </>
    );
  }

  const handlePreviewDemo = (templateId) => {
    setSelectedTemplate(templateId);
    setGeneratedCopy(DEMO_GENERATED_COPY);
    setEditedCopy(structuredClone(DEMO_GENERATED_COPY));
    setImages({});
    setIsDemoPreview(true);
    goTo(5);
  };
  const handleBackFromDemo = () => {
    setGeneratedCopy(null);
    setEditedCopy(null);
    setImages({});
    setIsDemoPreview(false);
    goTo(3);
  };


  // Step 5 is full-screen preview, no wizard shell
  if (step === 5 && generatedCopy) {
    return (
      <>
      <WebsitePreview
        businessInfo={isDemoPreview ? DEMO_BUSINESS_INFO : { ...businessInfo, businessType: businessInfo?.businessType || businessType }}
        onBusinessInfoChange={isDemoPreview ? undefined : (next) => {
          const resolved = typeof next === 'function' ? next(businessInfo) : next;
          setBusinessInfo(resolved);
          autoSave({ businessInfo: resolved });
        }}
        generatedCopy={generatedCopy}
        editedCopy={editedCopy}
        onEditedCopyChange={(newCopy) => { setEditedCopy(newCopy); autoSave({ editedCopy: newCopy }); }}
        images={images}
        onImagesChange={(newImages) => { const resolved = typeof newImages === 'function' ? newImages(images) : newImages; setImages(resolved); autoSave({ images: resolved }); }}
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
            : editingExistingSite
              ? () => setView('dashboard')
              : () => goTo(3)
        }
        backLabel={editingExistingSite ? 'Back to Sites' : 'Back to Templates'}
        onExport={isDemoPreview ? null : () => goTo(6)}
        onStartOver={() => { handleStartOver(); setView('dashboard'); }}
        onSwitchTemplate={(newTemplateId) => {
          setSelectedTemplate(newTemplateId);
          setCustomColors({});
          setCustomFonts({});
          autoSave({ templateId: newTemplateId, customColors: {}, customFonts: {} });
        }}
        isDemoPreview={isDemoPreview}
        editingExistingSite={editingExistingSite}
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
      <WizardShell step={step} onBack={goBack} userEmail={session?.user?.email} profile={profile} onMySites={() => setView('dashboard')} onOpenBookings={() => setView('bookings-page')} onOpenAdmin={() => setView('admin')} onSignOut={handleSignOut}>
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
