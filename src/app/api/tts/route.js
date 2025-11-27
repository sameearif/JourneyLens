import { NextResponse } from 'next/server';
import { synthesizeSpeech } from '@/lib/tts';

export async function POST(request) {
  try {
    const body = await request.json();
    const { text, model, voice } = body || {};

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const { audio, raw } = await synthesizeSpeech({ text, model, voice });
    return NextResponse.json({ audio, raw });
  } catch (error) {
    console.error('TTS route error', error);
    return NextResponse.json(
      { error: error?.message || 'TTS failed' },
      { status: 500 }
    );
  }
}
