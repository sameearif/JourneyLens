import { NextResponse } from 'next/server';
import { transcribeAudio } from '@/lib/asr';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = file.name || 'audio.webm';
    const mimeType = file.type || 'audio/webm';

    const { text, raw } = await transcribeAudio({
      file: buffer,
      filename,
      mimeType,
    });

    return NextResponse.json({ text, raw });
  } catch (error) {
    console.error('ASR route error', error);
    return NextResponse.json(
      { error: error?.message || 'Transcription failed' },
      { status: 500 }
    );
  }
}
