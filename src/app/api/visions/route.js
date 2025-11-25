import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const visionId = searchParams.get('visionId');

    if (!userId && !visionId) {
      return NextResponse.json(
        { error: 'userId or visionId is required' },
        { status: 400 }
      );
    }

    if (visionId) {
      const result = await query(
        'SELECT vision_id, user_id, title, description, character_description, story_running_summary, journal_running_summary, image_url, chat_history, short_term_todos, long_term_todos, created_at FROM visions WHERE vision_id = $1',
        [visionId]
      );
      if (!result.rowCount) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json({ vision: result.rows[0] });
    }

    const result = await query(
      'SELECT vision_id, title, description, character_description, story_running_summary, journal_running_summary, image_url, chat_history, short_term_todos, long_term_todos, created_at FROM visions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    return NextResponse.json({ visions: result.rows });
  } catch (error) {
    console.error('Fetch visions error', error);
    return NextResponse.json(
      { error: 'Failed to fetch visions' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { userId, title, description, characterDescription, chatHistory, imageUrl, shortTermTodos, longTermTodos, storyRunningSummary, journalRunningSummary } = await request.json();

    if (!userId || !title) {
      return NextResponse.json(
        { error: 'userId and title are required' },
        { status: 400 }
      );
    }

    try {
      const historyJson = chatHistory ? JSON.stringify(chatHistory) : '[]';
      const shortJson = shortTermTodos ? JSON.stringify(shortTermTodos) : '[]';
      const longJson = longTermTodos ? JSON.stringify(longTermTodos) : '[]';

      const result = await query(
        `INSERT INTO visions (user_id, title, description, character_description, story_running_summary, journal_running_summary, chat_history, image_url, short_term_todos, long_term_todos)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10::jsonb)
         RETURNING vision_id, title, description, character_description, story_running_summary, journal_running_summary, image_url, short_term_todos, long_term_todos, created_at`,
        [userId, title, description, characterDescription, storyRunningSummary || null, journalRunningSummary || null, historyJson, imageUrl || null, shortJson, longJson]
      );
      return NextResponse.json({ vision: result.rows[0] }, { status: 201 });
    } catch (err) {
      // If the DB hasn't been migrated to the new columns, fall back to minimal insert.
      if (err.code === '42703') {
        const result = await query(
          `INSERT INTO visions (user_id, title, description)
           VALUES ($1, $2, $3)
           RETURNING vision_id, title, description, created_at`,
          [userId, title, description]
        );
        return NextResponse.json({ vision: result.rows[0], warning: 'Saved without character/image/chat fields; migrate DB to store them.' }, { status: 201 });
      }
      if (err.code === '23503') {
        return NextResponse.json(
          { error: 'User not found. Please log in again.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: err.message || 'Failed to save vision', detail: err.detail || err.code },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Create vision error', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save vision', detail: error?.detail || error?.code },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const { visionId, userId, title, description, characterDescription, chatHistory, imageUrl, shortTermTodos, longTermTodos, storyRunningSummary, journalRunningSummary } = await request.json();

    if (!visionId || !userId) {
      return NextResponse.json(
        { error: 'visionId and userId are required' },
        { status: 400 }
      );
    }

    try {
      const historyJson = chatHistory ? JSON.stringify(chatHistory) : '[]';
      const shortJson = shortTermTodos ? JSON.stringify(shortTermTodos) : '[]';
      const longJson = longTermTodos ? JSON.stringify(longTermTodos) : '[]';

      const result = await query(
        `UPDATE visions
         SET title = $1,
             description = $2,
             character_description = $3,
             story_running_summary = $4,
             journal_running_summary = $5,
             chat_history = $6::jsonb,
             image_url = $7,
             short_term_todos = $8::jsonb,
             long_term_todos = $9::jsonb
         WHERE vision_id = $10 AND user_id = $11
         RETURNING vision_id, user_id, title, description, character_description, story_running_summary, journal_running_summary, image_url, chat_history, short_term_todos, long_term_todos, created_at`,
        [title, description, characterDescription, storyRunningSummary || null, journalRunningSummary || null, historyJson, imageUrl || null, shortJson, longJson, visionId, userId]
      );

      if (!result.rowCount) {
        return NextResponse.json(
          { error: 'Vision not found or you do not have permission to update it' },
          { status: 404 }
        );
      }

      return NextResponse.json({ vision: result.rows[0] });
    } catch (err) {
      if (err.code === '42703') {
        const result = await query(
          `UPDATE visions
           SET title = $1,
               description = $2
           WHERE vision_id = $3 AND user_id = $4
           RETURNING vision_id, user_id, title, description, created_at`,
          [title, description, visionId, userId]
        );

        if (!result.rowCount) {
          return NextResponse.json(
            { error: 'Vision not found or you do not have permission to update it' },
            { status: 404 }
          );
        }

        return NextResponse.json({ vision: result.rows[0], warning: 'Updated without character/image/chat/todo fields; migrate DB to store them.' });
      }
      if (err.code === '23503') {
        return NextResponse.json(
          { error: 'User not found. Please log in again.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: err.message || 'Failed to update vision', detail: err.detail || err.code },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Update vision error', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update vision', detail: error?.detail || error?.code },
      { status: 500 }
    );
  }
}
