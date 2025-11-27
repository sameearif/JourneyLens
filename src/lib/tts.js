const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY;
const TTS_ENDPOINT = 'https://api.deepinfra.com/v1/openai/audio/speech';
const TTS_MODEL = 'hexgrad/Kokoro-82M';
const TTS_VOICE = 'af_bella';

function assertKey() {
  if (!DEEPINFRA_API_KEY) {
    throw new Error('DEEPINFRA_API_KEY is not set');
  }
}

export async function synthesizeSpeech({ text, model = TTS_MODEL, voice = TTS_VOICE } = {}) {
  assertKey();
  if (!text) throw new Error('Text is required for TTS');

  const resp = await fetch(TTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPINFRA_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      response_format: 'mp3',
    }),
  });

  const contentType = resp.headers.get('content-type') || '';
  let data = {};
  let audioBase64 = null;

  if (contentType.includes('audio')) {
    const buffer = Buffer.from(await resp.arrayBuffer());
    audioBase64 = buffer.toString('base64');
  } else {
    const raw = await resp.text();
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
    }
  }

  if (!resp.ok) {
    const errMsg =
      typeof data?.error === 'string'
        ? data.error
        : data?.error?.message || data?.message || data?.raw || 'TTS request failed';
    throw new Error(errMsg);
  }

  audioBase64 =
    audioBase64 ||
    data?.audio ||
    data?.audio_base64 ||
    data?.output ||
    data?.data?.audio ||
    data?.data ||
    data?.response?.audio;

  if (!audioBase64 || typeof audioBase64 !== 'string') {
    throw new Error('No audio returned from TTS service');
  }

  return {
    audio: audioBase64,
    raw: data,
  };
}

export default synthesizeSpeech;
