import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import IntelligenceEngine from '@/lib/intelligence/intelligenceEngine';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const showId = searchParams.get('show_id') || '00000000-0000-0000-0000-000000000004';

  try {
    if (!supabaseAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Supabase not configured'
      }, { status: 500 });
    }

    const engine = new IntelligenceEngine(supabaseAdmin, showId);
    const results = await engine.run();
    
    return NextResponse.json(results);
  } catch (error) {
    console.error('Intelligence Engine Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}




