import { NextResponse } from 'next/server';
import { STORY_SYSTEM_PROMPT, STORY_IMAGE_PROMPT } from '@/lib/prompts';
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

    const { description, title, characterDescription, fullName } = await request.json();

    if (!description) {
      return NextResponse.json({ error: 'description is required to generate a story' }, { status: 400 });
    }

    const storyContext = [
      title ? `Vision Title: ${title}` : null,
      `Vision Description: ${description}`,
      fullName ? `Main Character Name: ${fullName}` : null,
      'Write the first chapter of this motivational story.',
    ]
      .filter(Boolean)
      .join('\n');

    const storyContents = [
      { role: 'user', parts: [{ text: STORY_SYSTEM_PROMPT.trim() }] },
      { role: 'user', parts: [{ text: storyContext }] },
    ];

    const storyResponse = await ai.models.generateContent({
      model: MODEL,
      contents: storyContents,
    });

    const story = storyResponse?.text || '';

    if (!story.trim()) {
      return NextResponse.json({ error: 'Story generation returned empty text' }, { status: 500 });
    }

    const imageContext = [
      `Vision Description: ${description}`,
      characterDescription ? `Character Description: ${characterDescription}` : null,
      fullName ? `Main Character Name: ${fullName}` : null,
      'Chapter Text:',
      story,
    ]
      .filter(Boolean)
      .join('\n');

    const imagePromptResponse = await ai.models.generateContent({
      model: MODEL,
      contents: [
        { role: 'user', parts: [{ text: STORY_IMAGE_PROMPT.trim() }] },
        { role: 'user', parts: [{ text: imageContext }] },
      ],
    });

    const imagePrompt = imagePromptResponse?.text?.trim() || '';

    return NextResponse.json({ story, imagePrompt });
  } catch (error) {
    console.error('Story generation error', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate story' },
      { status: 500 }
    );
  }
}
