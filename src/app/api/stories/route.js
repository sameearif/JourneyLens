import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const visionId = searchParams.get('visionId');

    if (!visionId) {
      return NextResponse.json({ error: 'visionId is required' }, { status: 400 });
    }

    const result = await query(
      `SELECT story_id, vision_id, story_text, story_images, chapter_image_description, created_at
       FROM stories
       WHERE vision_id = $1
       ORDER BY created_at ASC`,
      [visionId]
    );

    return NextResponse.json({ stories: result.rows });
  } catch (error) {
    console.error('Fetch stories error', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch stories' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { visionId, storyText, storyImagePrompt, storyImageUrl, chapter = 1, runningSummary } = await request.json();

    if (!visionId || !storyText) {
      return NextResponse.json(
        { error: 'visionId and storyText are required' },
        { status: 400 }
      );
    }

    const storyJson = JSON.stringify({ chapter, text: storyText });
    const imagesJson = JSON.stringify([{ chapter, prompt: storyImagePrompt || '', image: storyImageUrl || '' }]);
    const descriptionsJson = JSON.stringify([{ chapter, prompt: storyImagePrompt || '' }]);

    const insertStory = await query(
      `INSERT INTO stories (vision_id, story_text, story_images, chapter_image_description)
       VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb)
       RETURNING story_id, vision_id, story_text, story_images, chapter_image_description, created_at`,
      [visionId, storyJson, imagesJson, descriptionsJson]
    );

    if (runningSummary) {
      await query(
        'UPDATE visions SET story_running_summary = $1 WHERE vision_id = $2',
        [runningSummary, visionId]
      );
    }

    return NextResponse.json({ story: insertStory.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Create story error', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save story', detail: error?.detail || error?.code },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const { storyId, imageUrl, imagePrompt } = await request.json();
    if (!storyId) {
      return NextResponse.json({ error: 'storyId is required' }, { status: 400 });
    }

    const existing = await query(
      'SELECT story_images, chapter_image_description FROM stories WHERE story_id = $1',
      [storyId]
    );
    if (!existing.rowCount) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    const currentImages = Array.isArray(existing.rows[0].story_images) ? existing.rows[0].story_images : [];
    const currentDescriptions = Array.isArray(existing.rows[0].chapter_image_description)
      ? existing.rows[0].chapter_image_description
      : [];

    const updatedImages =
      currentImages.length > 0
        ? [{ ...currentImages[0], image: imageUrl || currentImages[0].image, prompt: imagePrompt || currentImages[0].prompt }]
        : [{ chapter: 1, image: imageUrl || '', prompt: imagePrompt || '' }];

    const updatedDescriptions =
      currentDescriptions.length > 0
        ? [{ ...currentDescriptions[0], prompt: imagePrompt || currentDescriptions[0].prompt }]
        : [{ chapter: updatedImages[0].chapter || 1, prompt: imagePrompt || '' }];

    const result = await query(
      `UPDATE stories
       SET story_images = $1::jsonb,
           chapter_image_description = $2::jsonb
       WHERE story_id = $3
       RETURNING story_id, vision_id, story_text, story_images, chapter_image_description, created_at`,
      [JSON.stringify(updatedImages), JSON.stringify(updatedDescriptions), storyId]
    );

    return NextResponse.json({ story: result.rows[0] });
  } catch (error) {
    console.error('Update story error', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update story', detail: error?.detail || error?.code },
      { status: 500 }
    );
  }
}
