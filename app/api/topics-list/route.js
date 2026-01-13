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
    // Get topics with video counts
    const { data: topics, error } = await supabase
      .from('topic_definitions')
      .select('topic_id, topic_name_en, topic_name_ar, keywords, description')
      .eq('show_id', showId)
      .order('topic_name_en');

    if (error) throw error;

    // Get video counts per topic
    const { data: counts } = await supabase
      .from('channel_videos')
      .select('topic_id')
      .eq('show_id', showId);

    const countMap = {};
    counts?.forEach(v => {
      if (v.topic_id) {
        countMap[v.topic_id] = (countMap[v.topic_id] || 0) + 1;
      }
    });

    const topicsWithCounts = topics.map(t => ({
      ...t,
      video_count: countMap[t.topic_id] || 0
    })).sort((a, b) => b.video_count - a.video_count);

    return NextResponse.json({ success: true, topics: topicsWithCounts });

  } catch (error) {
    console.error('Error fetching topics list:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

