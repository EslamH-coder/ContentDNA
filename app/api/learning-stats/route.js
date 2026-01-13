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
    // Get feedback from recommendation_feedback table
    const { data: feedbacks, error } = await supabase
      .from('recommendation_feedback')
      .select('*')
      .eq('show_id', showId);

    if (error) throw error;

    // Calculate stats
    const stats = {
      liked: 0,
      rejected: 0,
      saved: 0,
      produced: 0,
      total: feedbacks?.length || 0
    };

    // Topic preference tracking
    const topicScores = {};

    for (const feedback of feedbacks || []) {
      // Count by action
      if (feedback.action === 'liked') stats.liked++;
      else if (feedback.action === 'rejected') stats.rejected++;
      else if (feedback.action === 'saved') stats.saved++;
      else if (feedback.action === 'produced') stats.produced++;

      // Track topic preferences
      const topicName = feedback.evidence_summary?.matched_topic || feedback.topic_type || 'General';
      
      if (!topicScores[topicName]) {
        topicScores[topicName] = { liked: 0, rejected: 0, total: 0 };
      }
      topicScores[topicName].total++;
      
      if (feedback.action === 'liked' || feedback.action === 'saved' || feedback.action === 'produced') {
        topicScores[topicName].liked++;
      } else if (feedback.action === 'rejected') {
        topicScores[topicName].rejected++;
      }
    }

    // Calculate topic preference weights
    const topicPreferences = Object.entries(topicScores)
      .map(([name, data]) => {
        const likedRatio = data.total > 0 ? data.liked / data.total : 0;
        const rejectedRatio = data.total > 0 ? data.rejected / data.total : 0;
        const weight = rejectedRatio > 0 
          ? likedRatio / rejectedRatio 
          : likedRatio > 0 ? 2 : 1;
        
        return {
          name,
          weight: Math.min(Math.max(weight, 0.5), 2),
          liked: data.liked,
          rejected: data.rejected,
          total: data.total
        };
      })
      .filter(t => t.total >= 1)
      .sort((a, b) => b.weight - a.weight);

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        topicPreferences
      }
    });

  } catch (error) {
    console.error('Learning stats error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
