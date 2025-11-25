import { NextResponse } from 'next/server';
import { SYSTEM_PROMPT, SUMMARY_PROMPT, LONG_TERM_TODOS_PROMPT, SHORT_TERM_TODOS_PROMPT } from '@/lib/prompts';
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

    const { messages } = await request.json();

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }

    const contents = [
      { role: 'user', parts: [{ text: SYSTEM_PROMPT.trim() }] },
      ...messages.map((msg) => ({
        role: msg.role || 'user',
        parts: [{ text: msg.content || '' }],
      })),
      { role: 'user', parts: [{ text: SUMMARY_PROMPT.trim() }] },
    ];

    const summarize = async () => {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents,
      });
      return response?.text || '';
    };

    const generateLongTodos = async () => {
      const longPrompt = [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT.trim() }] },
        ...contents.slice(1), // include chat history and summary prompt context
        { role: 'user', parts: [{ text: LONG_TERM_TODOS_PROMPT.trim() }] },
      ];
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: longPrompt,
      });
      return response?.text || '';
    };

    const generateShortTodos = async () => {
      const shortPrompt = [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT.trim() }] },
        ...contents.slice(1),
        { role: 'user', parts: [{ text: SHORT_TERM_TODOS_PROMPT.trim() }] },
      ];
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: shortPrompt,
      });
      return response?.text || '';
    };

    const summaryRaw = await summarize();

    const tryParseJson = (text) => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    };

    const normalizeList = (val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        const trimmed = val.trim();
        const parsed = tryParseJson(trimmed);
        if (Array.isArray(parsed)) return parsed;
        const match = trimmed.match(/\[(.*)\]/);
        const inner = match ? match[1] : trimmed;
        return inner
          .split(',')
          .map((s) => s.replace(/^[\s"']+|[\s"']+$/g, ''))
          .filter(Boolean);
      }
      return [];
    };

    let parsed = tryParseJson(summaryRaw);

    if (!parsed) {
      const match = summaryRaw.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = tryParseJson(match[0]);
      }
    }

    if (!parsed) {
      return NextResponse.json(
        { error: 'Failed to parse summary' },
        { status: 500 }
      );
    }

    // Fetch todos sequentially
    const longTodosRaw = await generateLongTodos();
    const shortTodosRaw = await generateShortTodos();

    const longParsed = tryParseJson(longTodosRaw) || {};
    const shortParsed = tryParseJson(shortTodosRaw) || {};

    return NextResponse.json({
      title: parsed.title || '',
      description: parsed.description || '',
      characterDescription: parsed.characterDescription || parsed.character_description || '',
      longTermTodos: normalizeList(longParsed.longTermTodos || longParsed.long_term_todos),
      shortTermTodos: normalizeList(shortParsed.shortTermTodos || shortParsed.short_term_todos),
    });
  } catch (error) {
    console.error('Chat summary error', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
