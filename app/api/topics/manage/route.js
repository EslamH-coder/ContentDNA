import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// CREATE new topic
export async function POST(request) {
  const { showId, topicId, topic_name_en, topic_name_ar, keywords, description } = await request.json();

  if (!showId || !topicId) {
    return NextResponse.json({ error: 'showId and topicId required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('topic_definitions')
      .insert({
        show_id: showId,
        topic_id: topicId,
        topic_name_en,
        topic_name_ar,
        keywords,
        description
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, topic: data });

  } catch (error) {
    console.error('Error creating topic:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// UPDATE existing topic
export async function PUT(request) {
  const { showId, topicId, topic_name_en, topic_name_ar, keywords, description } = await request.json();

  if (!showId || !topicId) {
    return NextResponse.json({ error: 'showId and topicId required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('topic_definitions')
      .update({
        topic_name_en,
        topic_name_ar,
        keywords,
        description
      })
      .eq('show_id', showId)
      .eq('topic_id', topicId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, topic: data });

  } catch (error) {
    console.error('Error updating topic:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE topic (reassign videos to other_stories)
export async function DELETE(request) {
  const { showId, topicId } = await request.json();

  if (!showId || !topicId) {
    return NextResponse.json({ error: 'showId and topicId required' }, { status: 400 });
  }

  if (topicId === 'other_stories') {
    return NextResponse.json({ error: 'Cannot delete other_stories topic' }, { status: 400 });
  }

  try {
    // First, reassign all videos to other_stories
    const { data: updated } = await supabase
      .from('channel_videos')
      .update({ topic_id: 'other_stories' })
      .eq('show_id', showId)
      .eq('topic_id', topicId)
      .select('video_id');

    // Then delete the topic
    const { error } = await supabase
      .from('topic_definitions')
      .delete()
      .eq('show_id', showId)
      .eq('topic_id', topicId);

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      videosReassigned: updated?.length || 0 
    });

  } catch (error) {
    console.error('Error deleting topic:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}



