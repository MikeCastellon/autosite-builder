import { useState, useCallback, useRef } from 'react';
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
import ResetPasswordPage from './components/auth/ResetPasswordPage.jsx';
import DashboardPage from './components/dashboard/DashboardPage.jsx';
import { saveSite } from './lib/saveSite.js';
import { supabase } from './lib/supabase.js';

export default function App() {
  const { session, loading, isRecovery, clearRecovery } = useAuth();

  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState(null);
  const [businessInfo, setBusinessInfo] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [generatedCopy, setGeneratedCopy] = useState(null);
  const [editedCopy, setEditedCopy] = useState(null);
  const [images, setImages] = useState({});
  const [error, setError] = useState(null);
  const [customColors, setCustomColors] = useState({});
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'wizard'
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [selectedWidgetIds, setSelectedWidgetIds] = useState([]);
  const [siteId, setSiteId] = useState(null);
  const saveTimerRef = useRef(null);

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
      }).catch(err => console.error('Auto-save failed:', err));
    }, 1500);
  }, [session, siteId, businessInfo, editedCopy, selectedTemplate, images, selectedWidgetIds]);

  const templateMeta = selectedTemplate
    ? { ...TEMPLATES[selectedTemplate], colors: { ...TEMPLATES[selectedTemplate].colors, ...customColors } }
    : null;

  const goTo = (s) => setStep(s);
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const handleBusinessTypeSelect = (typeId) => {
    setBusinessType(typeId);
    setSelectedTemplate(null);
    setGeneratedCopy(null);
    setEditedCopy(null);
    setImages({});
    goTo(2);
  };

  const handleBusinessInfoSubmit = (info) => {
    setBusinessInfo({ ...info, businessType });
    goTo(3);
  };

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId);
    setCustomColors({});
  };

  const handleGenerate = () => {
    setError(null);
    goTo(4);
  };

  const handleGenerateSuccess = async (copy) => {
    // Merge widget keys — check businessInfo first, then fetch from Supabase
    const merged = { ...copy };
    if (businessInfo.instagramWidgetKey) merged.instagramWidgetKey = businessInfo.instagramWidgetKey;
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
    setSelectedWidgetIds([]);
    setIsDemoPreview(false);
    setSiteId(null);
  };

  // Demo preview — shows a template with placeholder data, no AI call needed
  const [isDemoPreview, setIsDemoPreview] = useState(false);

  // Auth gate
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
      <div className="w-8 h-8 border-4 border-gray-300 border-t-[#cc0000] rounded-full animate-spin" />
    </div>
  );
  if (!session) return <LoginPage />;
  if (isRecovery) return <ResetPasswordPage onComplete={() => { clearRecovery(); window.location.hash = ''; }} />;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleEditSite = async (site) => {
    setSiteId(site.id);
    setBusinessType(site.business_info?.businessType || null);
    setBusinessInfo(site.business_info || {});
    setSelectedTemplate(site.template_id);
    const copy = site.generated_content || {};
    const siteImages = copy._images || {};
    delete copy._images;

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
    setCustomColors({});
    setIsDemoPreview(false);
    setStep(5);
    setView('wizard');
  };

  if (view === 'dashboard') {
    return <DashboardPage
      onNewSite={() => { handleStartOver(); setView('wizard'); }}
      onEditSite={handleEditSite}
      onSignOut={handleSignOut}
      userEmail={session?.user?.email}
    />;
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
      <WebsitePreview
        businessInfo={isDemoPreview ? DEMO_BUSINESS_INFO : businessInfo}
        generatedCopy={generatedCopy}
        editedCopy={editedCopy}
        onEditedCopyChange={(newCopy) => { setEditedCopy(newCopy); autoSave({ editedCopy: newCopy }); }}
        images={images}
        onImagesChange={(newImages) => { const resolved = typeof newImages === 'function' ? newImages(images) : newImages; setImages(resolved); autoSave({ images: resolved }); }}
        templateId={selectedTemplate}
        templateMeta={templateMeta}
        customColors={customColors}
        onCustomColors={setCustomColors}
        onBack={isDemoPreview ? handleBackFromDemo : () => { setView('dashboard'); }}
        onExport={isDemoPreview ? null : () => goTo(6)}
        onStartOver={() => { handleStartOver(); setView('dashboard'); }}
        isDemoPreview={isDemoPreview}
      />
    );
  }

  // Step 5.5 — Social Feeds (between preview and export)
  if (step === 5.5) {
    return (
      <StepSocialFeeds
        selectedWidgetIds={selectedWidgetIds}
        onWidgetIdsChange={setSelectedWidgetIds}
        onWidgetKeysChange={({ googleWidgetKey, instagramWidgetKey }) => {
          setEditedCopy((prev) => ({ ...prev, googleWidgetKey, instagramWidgetKey }));
        }}
        onNext={() => goTo(6)}
        onBack={() => goTo(5)}
      />
    );
  }

  // Step 6 is export
  if (step === 6 && generatedCopy) {
    return (
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
    );
  }

  return (
    <WizardShell step={step} onBack={goBack}>
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
  );
}
