import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { detectTopic } from '@/lib/topicDetector';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { showId } = await request.json();

    if (!showId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }

    console.log('🏷️ Starting topic detection for competitor videos...');

    // Get all competitors for this show
    const { data: competitors } = await supabase
      .from('competitors')
      .select('id')
      .eq('show_id', showId);

    if (!competitors || competitors.length === 0) {
      return NextResponse.json({ error: 'No competitors found' }, { status: 404 });
    }

    const competitorIds = competitors.map(c => c.id);

    // Get all competitor videos without topics or with 'other_stories'
    const { data: videos } = await supabase
      .from('competitor_videos')
      .select('id, title')
      .in('competitor_id', competitorIds)
      .or('detected_topic.is.null,detected_topic.eq.other_stories');

    if (!videos || videos.length === 0) {
      return NextResponse.json({ message: 'All videos already have topics', updated: 0 });
    }

    console.log(`🏷️ Processing ${videos.length} videos...`);

    let updated = 0;
    let topicCounts = {};

    for (const video of videos) {
      try {
        const { topicId, confidence } = await detectTopic(video.title, '', showId);
        
        // Only update if we found a real topic (not other_stories) with good confidence
        // Or if confidence is high even for other_stories (to update null values)
        if (topicId && (topicId !== 'other_stories' || confidence > 0)) {
          const { error: updateError } = await supabase
            .from('competitor_videos')
            .update({ detected_topic: topicId })
            .eq('id', video.id);
          
          if (updateError) {
            console.error(`❌ Error updating video ${video.id}:`, updateError);
          } else {
            updated++;
            topicCounts[topicId] = (topicCounts[topicId] || 0) + 1;
            
            if (updated % 10 === 0) {
              console.log(`📊 Progress: ${updated}/${videos.length} videos updated...`);
            }
          }
        }
      } catch (videoError) {
        console.error(`❌ Error processing video ${video.id}:`, videoError);
      }
    }

    console.log(`✅ Updated ${updated} videos with topics`);
    console.log('📊 Topic distribution:', topicCounts);

    return NextResponse.json({
      success: true,
      message: `Detected topics for ${updated} videos`,
      updated,
      topicDistribution: topicCounts
    });

  } catch (error) {
    console.error('❌ Error detecting topics:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


