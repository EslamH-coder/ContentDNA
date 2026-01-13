import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const showId = searchParams.get('showId') || '59dd9aef-bc59-4f79-b944-b8a345cf71c3';

  try {
    // Get one sample video with all columns
    const { data: sample, error } = await supabase
      .from('channel_videos')
      .select('*')
      .eq('show_id', showId)
      .limit(1)
      .single();

    if (error) throw error;

    // Get column names and sample values
    const columns = Object.keys(sample || {});
    
    // Get stats
    const { data: stats } = await supabase
      .from('channel_videos')
      .select('video_id, views, views_organic, views_7_days, views_7_days_organic, views_30_days, views_30_days_organic, published_at, format')
      .eq('show_id', showId)
      .limit(10);

    return NextResponse.json({ 
      success: true, 
      columns,
      columnCount: columns.length,
      sampleVideo: sample,
      sampleStats: stats,
      note: 'This endpoint shows all columns in channel_videos table for debugging purposes'
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error.message,
      details: error.details || null,
      hint: error.hint || null
    }, { status: 500 });
  }
}



