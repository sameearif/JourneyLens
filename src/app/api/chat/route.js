import { NextResponse } from 'next/server';
import { SYSTEM_PROMPT } from '@/lib/prompts';
import { MODEL, getGeminiClient } from '@/lib/llm';

export async function POST(request) {
  try {
    let ai;
    try {
      ai = getGeminiClient();
    } catch (err) {
      return NextResponse.json(
        { error: err.message || 'GEMINI_API_KEY (or GOOGLE_API_KEY) is not set' },
        { status: 500 }
      );
    }

    const { messages, systemPrompt } = await request.json();

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }

    const basePrompt = (systemPrompt || SYSTEM_PROMPT || '').trim();
    const contents = [
      basePrompt
        ? {
            role: 'user',
            parts: [{ text: basePrompt }],
          }
        : null,
      ...messages.map((msg) => ({
        role: msg.role || 'user',
        parts: [{ text: msg.content || '' }],
      })),
    ].filter(Boolean);

    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
    });

    const text = response?.text || '';

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Chat API error', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate response' },
      { status: 500 }
    );
  }
}
