import { useState } from 'react';
import WizardShell from './components/wizard/WizardShell.jsx';
import StepBusinessType from './components/wizard/StepBusinessType.jsx';
import StepBusinessInfo from './components/wizard/StepBusinessInfo.jsx';
import StepTemplatePicker from './components/wizard/StepTemplatePicker.jsx';
import StepGenerating from './components/wizard/StepGenerating.jsx';
import WebsitePreview from './components/preview/WebsitePreview.jsx';
import StepExport from './components/wizard/StepExport.jsx';
import { TEMPLATES } from './data/templates.js';

export default function App() {
  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState(null);
  const [businessInfo, setBusinessInfo] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [generatedCopy, setGeneratedCopy] = useState(null);
  const [error, setError] = useState(null);

  const templateMeta = selectedTemplate ? TEMPLATES[selectedTemplate] : null;

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

  // Step 5 is full-screen preview, no wizard shell
  if (step === 5 && generatedCopy) {
    return (
      <WebsitePreview
        businessInfo={businessInfo}
        generatedCopy={generatedCopy}
        templateId={selectedTemplate}
        templateMeta={templateMeta}
        onBack={() => goTo(3)}
        onExport={() => goTo(6)}
        onStartOver={handleStartOver}
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
          error={error}
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
