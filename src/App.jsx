import { useState } from 'react';
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
    goTo(5);
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
  };

  const [selectedWidgetIds, setSelectedWidgetIds] = useState([]);

  // Demo preview — shows a template with placeholder data, no AI call needed
  const [isDemoPreview, setIsDemoPreview] = useState(false);

  // Auth gate — placed after all hooks
  if (loading) return null;
  if (!session) return <LoginPage />;

  if (view === 'dashboard') {
    return <DashboardPage onNewSite={() => { handleStartOver(); setView('wizard'); }} />;
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
        onEditedCopyChange={setEditedCopy}
        images={images}
        onImagesChange={setImages}
        templateId={selectedTemplate}
        templateMeta={templateMeta}
        onBack={isDemoPreview ? handleBackFromDemo : () => goTo(3)}
        onExport={isDemoPreview ? null : () => goTo(5.5)}
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
        businessInfo={businessInfo}
        generatedCopy={editedCopy || generatedCopy}
        templateId={selectedTemplate}
        templateMeta={templateMeta}
        images={images}
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
