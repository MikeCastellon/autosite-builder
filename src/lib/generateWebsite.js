export async function generateWebsite(businessInfo, templateMeta) {
  const response = await fetch('/.netlify/functions/generate-website', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessInfo, templateMeta }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Generation failed');
  }

  return data.copy;
}
