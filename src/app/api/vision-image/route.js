import { NextResponse } from 'next/server';
import generateImage from '@/lib/tti';

export async function POST(request) {
  try {
    const { prompt, imageUrl, model } = await request.json();

    const image = await generateImage({ 
      prompt, 
      imageUrl, 
      model 
    });

    return NextResponse.json({ image });
  } catch (error) {
    console.error('Vision image generation error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error generating image' },
      { status: 500 }
    );
  }
}