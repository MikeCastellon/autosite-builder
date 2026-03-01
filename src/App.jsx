import { useState } from 'react';
import WizardShell from './components/wizard/WizardShell.jsx';
import StepBusinessType from './components/wizard/StepBusinessType.jsx';
import StepBusinessInfo from './components/wizard/StepBusinessInfo.jsx';
import StepTemplatePicker from './components/wizard/StepTemplatePicker.jsx';
import StepGenerating from './components/wizard/StepGenerating.jsx';
import WebsitePreview from './components/preview/WebsitePreview.jsx';
import StepExport from './components/wizard/StepExport.jsx';
import { TEMPLATES } from './data/templates.js';
import { DEMO_BUSINESS_INFO, DEMO_GENERATED_COPY } from './data/demoData.js';

export default function App() {
  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState(null);
  const [businessInfo, setBusinessInfo] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [generatedCopy, setGeneratedCopy] = useState(null);
  const [error, setError] = useState(null);
  const [customColors, setCustomColors] = useState({});

  const templateMeta = selectedTemplate
    ? { ...TEMPLATES[selectedTemplate], colors: { ...TEMPLATES[selectedTemplate].colors, ...customColors } }
    : null;

  const goTo = (s) => setStep(s);
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const handleBusinessTypeSelect = (typeId) => {
    setBusinessType(typeId);
    setSelectedTemplate(null);
    setGeneratedCopy(null);
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
    setError(null);
  };

  // Demo preview — shows a template with placeholder data, no AI call needed
  const [isDemoPreview, setIsDemoPreview] = useState(false);
  const handlePreviewDemo = (templateId) => {
    setSelectedTemplate(templateId);
    setGeneratedCopy(DEMO_GENERATED_COPY);
    setIsDemoPreview(true);
    goTo(5);
  };
  const handleBackFromDemo = () => {
    setGeneratedCopy(null);
    setIsDemoPreview(false);
    goTo(3);
  };

  // Dev-only quick test: jump straight to preview with first template + demo data
  const handleDevQuickTest = () => {
    setSelectedTemplate('detailing_premium');
    setGeneratedCopy(DEMO_GENERATED_COPY);
    setIsDemoPreview(true);
    goTo(5);
  };

  // Step 5 is full-screen preview, no wizard shell
  if (step === 5 && generatedCopy) {
    return (
      <WebsitePreview
        businessInfo={isDemoPreview ? DEMO_BUSINESS_INFO : businessInfo}
        generatedCopy={generatedCopy}
        templateId={selectedTemplate}
        templateMeta={templateMeta}
        onBack={isDemoPreview ? handleBackFromDemo : () => goTo(3)}
        onExport={isDemoPreview ? null : () => goTo(6)}
        onStartOver={handleStartOver}
        isDemoPreview={isDemoPreview}
      />
    );
  }

  // Step 6 is export
  if (step === 6 && generatedCopy) {
    return (
      <StepExport
        businessInfo={businessInfo}
        generatedCopy={generatedCopy}
        templateId={selectedTemplate}
        templateMeta={templateMeta}
        onBack={() => goTo(5)}
        onStartOver={handleStartOver}
      />
    );
  }

  return (
    <WizardShell step={step} onBack={goBack}>
      {import.meta.env.DEV && (
        <button
          onClick={handleDevQuickTest}
          style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: 0.85 }}
        >
          ⚡ Quick Test
        </button>
      )}
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
