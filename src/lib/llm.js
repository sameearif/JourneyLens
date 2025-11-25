// Together AI chat client helper.
// Provides a minimal wrapper with the same shape used elsewhere (models.generateContent).

export const MODEL = 'meta-llama/Llama-3.3-70B-Instruct-Turbo'; // Recommended stable model
const TOGETHER_API_KEY = process.env.TOGETHER_AI_API || process.env.TOGETHER_API_KEY;
const TOGETHER_CHAT_ENDPOINT = 'https://api.together.xyz/v1/chat/completions';

function buildMessages(contents = []) {
  const mapRole = (r) => {
    if (!r) return 'user';
    const lowered = r.toLowerCase();
    if (lowered === 'model') return 'assistant';
    if (['assistant', 'system', 'user', 'tool', 'function'].includes(lowered)) return lowered;
    return 'user';
  };

  return contents.map((c) => ({
    role: mapRole(c.role),
    content: (c.parts || [])
      .map((p) => (typeof p?.text === 'string' ? p.text : ''))
      .filter(Boolean)
      .join('\n'),
  }));
}

export function getGeminiClient() {
  if (!TOGETHER_API_KEY) {
    throw new Error('TOGETHER_AI_API (or TOGETHER_API_KEY) is not set');
  }

  return {
    models: {
      async generateContent({ model = MODEL, contents }) {
        const messages = buildMessages(contents);

        const resp = await fetch(TOGETHER_CHAT_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TOGETHER_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages,
          }),
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
              : data?.error?.message ||
                data?.message ||
                data?.raw ||
                JSON.stringify(data);
          throw new Error(errMsg || 'LLM request failed');
        }

        // Return the raw markdown content directly
        const rawText = data?.choices?.[0]?.message?.content || '';
        
        return { text: rawText.trim() };
      },
    },
  };
}

export default getGeminiClient;