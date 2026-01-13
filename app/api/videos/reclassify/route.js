import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function PUT(request) {
  const { showId, videoId, newTopicId } = await request.json();

  if (!showId || !videoId || !newTopicId) {
    return NextResponse.json({ error: 'showId, videoId, and newTopicId required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('channel_videos')
      .update({ 
        topic_id: newTopicId,
        auto_topic_id: null // Clear auto-classification since manually changed
      })
      .eq('show_id', showId)
      .eq('video_id', videoId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, video: data });

  } catch (error) {
    console.error('Error reclassifying video:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}



