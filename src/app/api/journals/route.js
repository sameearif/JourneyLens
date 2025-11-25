import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getGeminiClient, MODEL } from '@/lib/llm';
import { JOURNAL_SUMMARY_PROMPT, NEXT_CHAPTER_PROMPT, STORY_IMAGE_PROMPT } from '@/lib/prompts';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const visionId = searchParams.get('visionId');

    if (!visionId) {
      return NextResponse.json({ error: 'visionId is required' }, { status: 400 });
    }

    const result = await query(
      `SELECT journal_id, vision_id, entry_date, journal_text, created_at
       FROM journals
       WHERE vision_id = $1
       ORDER BY entry_date DESC, created_at DESC`,
      [visionId]
    );

    return NextResponse.json({ journals: result.rows });
  } catch (error) {
    console.error('Fetch journals error', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch journals' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { visionId, entryDate, journalText } = await request.json();

    if (!visionId || !journalText) {
      return NextResponse.json(
        { error: 'visionId and journalText are required' },
        { status: 400 }
      );
    }

    let ai;
    try {
      ai = getGeminiClient();
    } catch (err) {
      return NextResponse.json(
        { error: err.message || 'GEMINI_API_KEY (or GOOGLE_API_KEY) is not set' },
        { status: 500 }
      );
    }

    const visionResult = await query(
      `SELECT vision_id, title, description, character_description, story_running_summary, journal_running_summary, image_url
       FROM visions WHERE vision_id = $1`,
      [visionId]
    );
    if (!visionResult.rowCount) {
      return NextResponse.json({ error: 'Vision not found' }, { status: 404 });
    }
    const vision = visionResult.rows[0];

    const lastStoryResult = await query(
      `SELECT story_text, story_id
       FROM stories
       WHERE vision_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [visionId]
    );
    const lastStoryRaw = lastStoryResult.rows?.[0]?.story_text || null;
    let lastChapterNumber = 0;
    let lastChapterText = '';
    try {
      const parsed = typeof lastStoryRaw === 'string' ? JSON.parse(lastStoryRaw) : lastStoryRaw;
      if (parsed && typeof parsed === 'object') {
        lastChapterNumber = parsed.chapter || 0;
        lastChapterText = parsed.text || '';
      }
    } catch {
      lastChapterNumber = 0;
      lastChapterText = '';
    }

    const updatedJournalSummaryResp = await ai.models.generateContent({
      model: MODEL,
      contents: [
        { role: 'user', parts: [{ text: JOURNAL_SUMMARY_PROMPT.trim() }] },
        { role: 'user', parts: [{ text: `previousSummary:\n${vision.journal_running_summary || ''}\n\nnewEntry:\n${journalText}` }] },
      ],
    });
    const updatedJournalSummary = updatedJournalSummaryResp?.text?.trim() || '';

    const nextChapterResp = await ai.models.generateContent({
      model: MODEL,
      contents: [
        { role: 'user', parts: [{ text: NEXT_CHAPTER_PROMPT.trim() }] },
        {
          role: 'user',
          parts: [{ text: `visionTitle: ${vision.title || ''}\nvisionDescription: ${vision.description || ''}\nstoryRunningSummary: ${vision.story_running_summary || ''}\nlastChapter: ${lastChapterText || ''}\nlatestJournal: ${journalText}` }],
        },
      ],
    });
    const nextChapterText = nextChapterResp?.text?.trim() || '';

    const storyImagePromptResp = await ai.models.generateContent({
      model: MODEL,
      contents: [
        { role: 'user', parts: [{ text: STORY_IMAGE_PROMPT.trim() }] },
        {
            role: 'user',
          parts: [{
            text: `Vision Description: ${vision.description || ''}\nCharacter Description: ${vision.character_description || ''}\nCharacter Design: ${vision.character_description || ''}\nLatest Chapter: ${nextChapterText}`,
          }],
        },
      ],
    });
    let storyImagePrompt = storyImagePromptResp?.text?.trim() || '';

    // Fallback prompt if model returns empty
    if (!storyImagePrompt) {
      storyImagePrompt = [
        'Illustrate this chapter:',
        nextChapterText.slice(0, 400),
        vision.character_description ? `Keep the character consistent: ${vision.character_description}` : null,
      ].filter(Boolean).join('\n');
    }

    let storyImageUrl = '';
    const promptForImage = [
      storyImagePrompt,
      vision.character_description ? `Keep the established character style: ${vision.character_description}` : null,
      vision.image_url ? `Reference image for consistency: ${vision.image_url}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    if (storyImagePrompt) {
      try {
        const imageUrl = new URL('/api/vision-image', request.url);
        const imgResp = await fetch(imageUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: promptForImage,
            imageUrl: vision.image_url || null,
            model: 'black-forest-labs/FLUX.1-kontext-dev',
          }),
        });
        const imgData = await imgResp.json();
        if (imgResp.ok && imgData.image) {
          storyImageUrl = imgData.image;
        }
      } catch (imgErr) {
        console.error('Chapter image generation failed', imgErr);
      }
    }

    const result = await query(
      `INSERT INTO journals (vision_id, entry_date, journal_text)
       VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3)
       RETURNING journal_id, vision_id, entry_date, journal_text, created_at`,
      [visionId, entryDate || null, journalText]
    );
    const newJournal = result.rows[0];

    await query(
      `UPDATE visions
       SET journal_running_summary = $1,
           story_running_summary = $2
       WHERE vision_id = $3`,
      [
        updatedJournalSummary || null,
        vision.story_running_summary
          ? `${vision.story_running_summary}\n\n${nextChapterText}`.trim()
          : nextChapterText || null,
        visionId,
      ]
    );

    // Save next chapter
    if (nextChapterText) {
      const storyJson = JSON.stringify({ chapter: lastChapterNumber + 1, text: nextChapterText });
      const imagesJson = JSON.stringify([{ chapter: lastChapterNumber + 1, prompt: storyImagePrompt || '', image: storyImageUrl || '' }]);
      await query(
      `INSERT INTO stories (vision_id, story_text, story_images, chapter_image_description)
         VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb)`,
        [visionId, storyJson, imagesJson, JSON.stringify([{ chapter: lastChapterNumber + 1, prompt: storyImagePrompt || '' }])]
      );
    }

    return NextResponse.json({ journal: newJournal, journalRunningSummary: updatedJournalSummary, nextChapter: nextChapterText, storyImage: storyImageUrl }, { status: 201 });
  } catch (error) {
    console.error('Create journal error', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save journal entry', detail: error?.detail || error?.code },
      { status: 500 }
    );
  }
}
