import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const showId = searchParams.get('showId');
  
  if (!showId) {
    return NextResponse.json({ error: 'showId required' }, { status: 400 });
  }
  
  try {
    // Get show status
    const { data: show } = await supabase
      .from('shows')
      .select('*, youtube_accounts(*)')
      .eq('id', showId)
      .single();
    
    // Get logs
    const { data: logs } = await supabase
      .from('onboarding_logs')
      .select('*')
      .eq('show_id', showId)
      .order('created_at', { ascending: false })
      .limit(20);
    
    // Get video stats
    const { data: videos } = await supabase
      .from('channel_videos')
      .select('thumbnail_analyzed, ai_analyzed, transcript_available, analytics_fetched, performance_hint')
      .eq('show_id', showId);
    
    const stats = {
      total: videos?.length || 0,
      thumbnails_analyzed: videos?.filter(v => v.thumbnail_analyzed).length || 0,
      ai_analyzed: videos?.filter(v => v.ai_analyzed).length || 0,
      transcripts_found: videos?.filter(v => v.transcript_available).length || 0,
      analytics_fetched: videos?.filter(v => v.analytics_fetched).length || 0,
      overperforming: videos?.filter(v => v.performance_hint === 'Overperforming').length || 0
    };
    
    return NextResponse.json({
      success: true,
      show: {
        id: show.id,
        name: show.name,
        status: show.onboarding_status,
        progress: show.onboarding_progress,
        error: show.onboarding_error,
        youtube: show.youtube_accounts ? {
          channelTitle: show.youtube_accounts.channel_title,
          channelId: show.youtube_accounts.channel_id
        } : null
      },
      stats,
      logs
    });
    
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}



