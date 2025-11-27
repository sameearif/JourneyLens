const TOGETHER_API_KEY = process.env.TOGETHER_AI_API || process.env.TOGETHER_API_KEY;
const TOGETHER_ASR_ENDPOINT = 'https://api.together.xyz/v1/audio/transcriptions';
const ASR_MODEL = 'openai/whisper-large-v3';

function assertKey() {
  if (!TOGETHER_API_KEY) {
    throw new Error('TOGETHER_AI_API (or TOGETHER_API_KEY) is not set');
  }
}

export async function transcribeAudio({ file, filename = 'audio.webm', mimeType = 'audio/webm', model = ASR_MODEL } = {}) {
  assertKey();
  if (!file) {
    throw new Error('Audio file is required for transcription');
  }

  const blob = file instanceof Blob ? file : new Blob([file], { type: mimeType || 'application/octet-stream' });
  const formData = new FormData();
  formData.append('model', model);
  formData.append('file', blob, filename);

  const resp = await fetch(TOGETHER_ASR_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOGETHER_API_KEY}`,
    },
    body: formData,
  });

  const raw = await resp.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }

  if (!resp.ok) {
    const errMsg =
      typeof data?.error === 'string'
        ? data.error
        : data?.error?.message || data?.message || data?.raw || 'Transcription failed';
    throw new Error(errMsg);
  }

  return {
    text: data?.text || '',
    raw: data,
  };
}

export default transcribeAudio;
