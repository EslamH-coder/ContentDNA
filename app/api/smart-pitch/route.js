import { NextResponse } from 'next/server';
import { generateSmartPitches } from '@/lib/smartPitch.js';
import { analyzeShowPatterns, getShowWinningPatterns } from '@/lib/patternAnalysis.js';

export async function POST(request) {
  try {
    const { action, showId, signal, options } = await request.json();
    
    switch (action) {
      case 'generate':
        // Generate pitches for a signal
        if (!signal || !showId) {
          return NextResponse.json({ error: 'Missing signal or showId' }, { status: 400 });
        }
        
        const pitches = await generateSmartPitches(signal, showId, options || {});
        return NextResponse.json({ success: true, data: pitches });
      
      case 'analyze':
        // Analyze show patterns
        if (!showId) {
          return NextResponse.json({ error: 'Missing showId' }, { status: 400 });
        }
        
        const analysis = await analyzeShowPatterns(showId, options || {});
        return NextResponse.json({ success: true, data: analysis });
      
      case 'getPatterns':
        // Get existing patterns
        if (!showId) {
          return NextResponse.json({ error: 'Missing showId' }, { status: 400 });
        }
        
        const patterns = await getShowWinningPatterns(showId, options?.contentType);
        return NextResponse.json({ success: true, data: patterns });
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Smart Pitch API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
