import { getThumbnailAdvice } from '@/lib/contentDNA';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { showId, topic } = await request.json();
    
    if (!showId || !topic) {
      return NextResponse.json({ 
        error: 'showId and topic required' 
      }, { status: 400 });
    }
    
    const result = await getThumbnailAdvice(showId, topic);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error getting thumbnail advice:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}



