const TOGETHER_API_KEY = process.env.TOGETHER_AI_API || process.env.TOGETHER_API_KEY;

export const IMAGE_MODEL = 'black-forest-labs/FLUX.1-schnell';
export const SECONDARY_IMAGE_MODEL = 'black-forest-labs/FLUX.1-kontext-dev';

const TOGETHER_IMAGE_ENDPOINT = 'https://api.together.xyz/v1/images/generations';

export async function generateImage({ prompt, imageUrl, model }) {
  if (imageUrl) console.log("ImageUrl start:", imageUrl.substring(0, 50) + "...");
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('prompt is required');
  }
  if (!TOGETHER_API_KEY) {
    throw new Error('TOGETHER_AI_API is not set');
  }

  const activeModel = model || IMAGE_MODEL;
  
  console.log("Active Model is:", activeModel);

  const promptWithReference =
    imageUrl && typeof imageUrl === 'string'
      ? `${prompt}\n\n(Style reference: generate an image consistent with the previous visual context)`
      : prompt;

  const payload = {
    model: activeModel,
    prompt: promptWithReference,
    width: 1792, 
    height: 960,
    steps: activeModel === SECONDARY_IMAGE_MODEL ? 28 : 4,
    response_format: 'b64_json',
  };

  if (imageUrl && typeof imageUrl === 'string' && activeModel === SECONDARY_IMAGE_MODEL) {
    console.log(`[generateImage] SUCCESS: Attaching image payload.`);
    
    payload.image_url = imageUrl;
  } else {
    console.log(`[generateImage] SKIPPING image attachment. Condition failed.`);
    console.log(`Reason: Model Match? ${activeModel === SECONDARY_IMAGE_MODEL}`);
  }

  const resp = await fetch(TOGETHER_IMAGE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOGETHER_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const raw = await resp.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    console.error("Non-JSON Response:", raw); 
    data = { raw };
  }

  if (!resp.ok) {
    console.error("Together AI Error Details:", data);
    throw new Error(data.error?.message || data.error || 'Image generation failed');
  }

  const imageData = data?.data?.[0];
  const base64 = imageData?.b64_json || imageData?.b64_binary;
  const url = imageData?.url || imageData?.data;

  if (base64) return `data:image/png;base64,${base64}`;
  if (url) return url;

  throw new Error('No image returned from Together');
}

export default generateImage;