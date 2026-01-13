import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import SimpleIntelligenceEngine from '@/lib/intelligence/simpleIntelligenceEngine';
import { getLearningStats } from '@/lib/learning/applyLearning';

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

    const engine = new SimpleIntelligenceEngine(supabaseAdmin, showId);
    const results = await engine.run();
    
    // Get learning stats for response
    const learningStats = await getLearningStats(supabaseAdmin, showId);
    
    // Add learning info to response
    return NextResponse.json({
      ...results,
      learning: {
        applied: learningStats.hasLearning,
        feedback_count: learningStats.feedbackCount,
        top_topics: learningStats.topTopics,
        avoided_topics: learningStats.avoidedTopics,
        preferences: learningStats.preferences
      }
    });
  } catch (error) {
    console.error('Simple Intelligence Engine Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}


