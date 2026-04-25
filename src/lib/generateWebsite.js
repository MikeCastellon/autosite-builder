export async function generateWebsite(businessInfo, templateMeta) {
  let response;
  try {
    response = await fetch('/.netlify/functions/generate-website', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessInfo, templateMeta }),
    });
  } catch (networkErr) {
    throw new Error('Network error — check your connection and try again.');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    // Response wasn't JSON (e.g. Netlify timeout HTML, 502, etc.)
    throw new Error(`Server error (${response.status}) — please try again.`);
  }

  if (!response.ok) {
    throw new Error(data?.error || `Generation failed (${response.status})`);
  }

  if (!data?.copy) {
    throw new Error('No copy returned from generator — please try again.');
  }

  return data.copy;
}
