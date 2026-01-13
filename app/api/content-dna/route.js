import { getChannelDNA } from '@/lib/contentDNA';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const showId = searchParams.get('showId');
    
    if (!showId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }
    
    const dna = await getChannelDNA(showId);
    return NextResponse.json({ success: true, dna });
  } catch (error) {
    console.error('Error getting channel DNA:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}



