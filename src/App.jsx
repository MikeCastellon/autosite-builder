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
import DashboardPage from './components/dashboard/DashboardPage.jsx';
import { saveSite } from './lib/saveSite.js';
import { supabase } from './lib/supabase.js';

export default function App() {
  const { session, loading } = useAuth();

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

  const handleGenerateSuccess = (copy) => {
    setGeneratedCopy(copy);
    setEditedCopy(structuredClone(copy));
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleEditSite = (site) => {
    setSiteId(site.id);
    setBusinessType(site.business_info?.businessType || null);
    setBusinessInfo(site.business_info || {});
    setSelectedTemplate(site.template_id);
    const copy = site.generated_content || {};
    const siteImages = copy._images || {};
    delete copy._images;
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
        onBack={isDemoPreview ? handleBackFromDemo : () => goTo(3)}
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
