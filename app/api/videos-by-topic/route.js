import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const showId = searchParams.get('showId');
  const topicId = searchParams.get('topicId');

  if (!showId || !topicId) {
    return NextResponse.json({ error: 'showId and topicId required' }, { status: 400 });
  }

  try {
    const { data: videos, error } = await supabase
      .from('channel_videos')
      .select(`
        video_id,
        youtube_url,
        title,
        format,
        views,
        views_organic,
        views_from_ads,
        ad_percentage,
        performance_hint,
        viral_score,
        hook_text,
        thumbnail_url,
        publish_date,
        topic_id,
        entities,
        content_archetype
      `)
      .eq('show_id', showId)
      .eq('topic_id', topicId)
      .order('views_organic', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, videos: videos || [] });

  } catch (error) {
    console.error('Error fetching videos by topic:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}



