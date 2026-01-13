import { generateSmartHook } from '@/lib/contentDNA';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { showId, topic, style } = await request.json();
    
    if (!showId || !topic) {
      return NextResponse.json({ 
        error: 'showId and topic required' 
      }, { status: 400 });
    }
    
    const result = await generateSmartHook(showId, topic, style);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error generating smart hook:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}



