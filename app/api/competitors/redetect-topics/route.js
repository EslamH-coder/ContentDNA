import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import { verifyShowAccess } from '@/lib/apiShowAccess';
import { detectTopic } from '@/lib/topicDetector';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { showId, forceAll = false } = await request.json();
    
    if (!showId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }

    // Verify user has access to this show
    const { authorized, error: accessError } = await verifyShowAccess(showId, request);
    
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied to this show' }, { status: 403 });
    }

    console.log('🔄 Re-detecting topics for competitor videos...', { showId, forceAll });

    // Get topic definitions for this show
    const { data: topics, error: topicsError } = await supabaseAdmin
      .from('topic_definitions')
      .select('*')
      .eq('show_id', showId)
      .eq('is_active', true);

    if (topicsError) {
      console.error('❌ Error fetching topics:', topicsError);
      return NextResponse.json({ error: 'Failed to fetch topic definitions' }, { status: 500 });
    }

    if (!topics || topics.length === 0) {
      return NextResponse.json({ error: 'No topic definitions found for this show' }, { status: 400 });
    }

    console.log(`📚 Loaded ${topics.length} topic definitions`);

    // Get competitor IDs for this show (join through competitors table)
    const { data: competitors, error: competitorsError } = await supabaseAdmin
      .from('competitors')
      .select('id')
      .eq('show_id', showId);

    if (competitorsError) {
      console.error('❌ Error fetching competitors:', competitorsError);
      return NextResponse.json({ error: 'Failed to fetch competitors' }, { status: 500 });
    }

    if (!competitors || competitors.length === 0) {
      return NextResponse.json({ error: 'No competitors found for this show' }, { status: 400 });
    }

    const competitorIds = competitors.map(c => c.id);
    console.log(`📺 Found ${competitorIds.length} competitors`);

    // Get videos that need topic detection (via competitor_id)
    let query = supabaseAdmin
      .from('competitor_videos')
      .select('id, title, detected_topic, competitor_id')
      .in('competitor_id', competitorIds);

    if (!forceAll) {
      // Only videos without topics or with "other" topics
      query = query.or('detected_topic.is.null,detected_topic.ilike.%other%');
    }

    const { data: videos, error: videosError } = await query;

    if (videosError) {
      console.error('❌ Error fetching videos:', videosError);
      return NextResponse.json({ error: 'Failed to fetch competitor videos' }, { status: 500 });
    }

    console.log(`📹 Processing ${videos?.length || 0} videos`);

    if (!videos || videos.length === 0) {
      return NextResponse.json({ 
        success: true, 
        processed: 0,
        updated: 0,
        noMatch: 0,
        message: 'No videos need topic detection'
      });
    }

    // Detect topics for each video
    let updated = 0;
    let noMatch = 0;
    const topicCounts = {};

    for (const video of videos) {
      try {
        const detection = await detectTopic(video.title, '', showId);
        
        if (detection.topicId && detection.topicId !== 'other_stories' && detection.confidence > 0) {
          const { error: updateError } = await supabaseAdmin
            .from('competitor_videos')
            .update({ detected_topic: detection.topicId })
            .eq('id', video.id);

          if (updateError) {
            console.error(`❌ Error updating video ${video.id}:`, updateError);
          } else {
            updated++;
            topicCounts[detection.topicId] = (topicCounts[detection.topicId] || 0) + 1;
            
            if (updated % 10 === 0) {
              console.log(`📊 Progress: ${updated}/${videos.length} videos updated...`);
            }
          }
        } else {
          noMatch++;
        }
      } catch (videoError) {
        console.error(`❌ Error processing video ${video.id}:`, videoError);
        noMatch++;
      }
    }

    console.log(`✅ Updated ${updated} videos, ${noMatch} had no match`);

    return NextResponse.json({
      success: true,
      processed: videos.length,
      updated,
      noMatch,
      topicDistribution: topicCounts,
      message: `Processed ${videos.length} videos: ${updated} updated, ${noMatch} had no topic match`
    });

  } catch (error) {
    console.error('❌ Topic detection error:', error);
    return NextResponse.json({ error: error.message || 'Failed to re-detect topics' }, { status: 500 });
  }
}


