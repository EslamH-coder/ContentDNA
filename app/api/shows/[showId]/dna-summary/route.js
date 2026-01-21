import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/supabaseServer';
import { verifyShowAccess } from '@/lib/apiShowAccess';

const db = supabaseAdmin || createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET(request, { params }) {
  try {
    const { showId } = params;

    if (!showId) {
      return NextResponse.json({ error: 'showId is required' }, { status: 400 });
    }

    // Verify user has access to this show
    const { authorized, error: accessError } = await verifyShowAccess(showId, request);
    
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied to this show' }, { status: 403 });
    }

    // Load DNA topics
    let dnaTopics = [];
    try {
      const { loadTopics } = await import('@/lib/taxonomy/unifiedTaxonomyService');
      dnaTopics = await loadTopics(showId, db);
    } catch (error) {
      console.warn('Could not load DNA topics:', error);
    }

    // Get topic performance from videos
    const { data: videos, error: videosError } = await db
      .from('videos')
      .select('topic_id, view_count, like_count, comment_count, performance_classification, format')
      .eq('show_id', showId)
      .not('topic_id', 'is', null);

    const topicPerformance = {};
    if (videos && !videosError) {
      videos.forEach(video => {
        const topicId = video.topic_id;
        if (!topicId) return;

        if (!topicPerformance[topicId]) {
          topicPerformance[topicId] = {
            totalViews: 0,
            totalVideos: 0,
            overPerforming: 0,
            average: 0,
            underPerforming: 0,
            longForm: { totalViews: 0, totalVideos: 0 },
            shortForm: { totalViews: 0, totalVideos: 0 }
          };
        }

        const stats = topicPerformance[topicId];
        stats.totalViews += video.view_count || 0;
        stats.totalVideos += 1;

        if (video.performance_classification === 'over_performing') {
          stats.overPerforming += 1;
        } else if (video.performance_classification === 'average') {
          stats.average += 1;
        } else if (video.performance_classification === 'under_performing') {
          stats.underPerforming += 1;
        }

        // Track by format
        if (video.format === 'long_form') {
          stats.longForm.totalViews += video.view_count || 0;
          stats.longForm.totalVideos += 1;
        } else if (video.format === 'short_form') {
          stats.shortForm.totalViews += video.view_count || 0;
          stats.shortForm.totalVideos += 1;
        }
      });

      // Calculate performance ratios
      Object.keys(topicPerformance).forEach(topicId => {
        const stats = topicPerformance[topicId];
        const avgViews = stats.totalVideos > 0 ? stats.totalViews / stats.totalVideos : 0;
        stats.avgViews = Math.round(avgViews);
        stats.successRate = stats.totalVideos > 0 
          ? Math.round((stats.overPerforming / stats.totalVideos) * 100) 
          : 0;

        // Calculate format performance ratios
        const longAvg = stats.longForm.totalVideos > 0 
          ? stats.longForm.totalViews / stats.longForm.totalVideos 
          : 0;
        const shortAvg = stats.shortForm.totalVideos > 0 
          ? stats.shortForm.totalViews / stats.shortForm.totalVideos 
          : 0;
        
        stats.long_multiplier = avgViews > 0 ? longAvg / avgViews : 0;
        stats.short_multiplier = avgViews > 0 ? shortAvg / avgViews : 0;
      });
    }

    // Get audience interests from comments
    const { data: comments, error: commentsError } = await db
      .from('comments')
      .select('*')
      .eq('show_id', showId)
      .limit(1000);

    const audienceInterests = {
      fromComments: [],
      fromVideos: []
    };

    if (comments && !commentsError) {
      // Extract actionable comments (questions, requests, actionable)
      audienceInterests.fromComments = comments
        .filter(c => c.question || c.request || c.is_actionable)
        .map(c => ({
          text: c.text || c.question || c.request,
          type: c.question ? 'question' : c.request ? 'request' : 'actionable',
          likes: c.likes || 0,
          topic: c.topic || null
        }))
        .slice(0, 50); // Limit to top 50
    }

    // Get winning patterns from DNA data (if available)
    const { data: showData, error: showError } = await db
      .from('shows')
      .select('dna_data')
      .eq('id', showId)
      .single();

    const winningPatterns = showData?.dna_data?.winningPatterns || [];

    return NextResponse.json({
      success: true,
      data: {
        dnaTopics: dnaTopics.map(t => ({
          topicId: t.topic_id,
          topicName: t.topic_name_en || t.topic_id,
          topicNameAr: t.topic_name_ar,
          keywords: t.allKeywords || t.keywords || [],
          matchCount: t.match_count || 0,
          likedCount: t.liked_count || 0,
          rejectedCount: t.rejected_count || 0,
          producedCount: t.produced_count || 0
        })),
        topicPerformance,
        audienceInterests,
        winningPatterns
      }
    });
  } catch (error) {
    console.error('Error in DNA summary:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch DNA summary' },
      { status: 500 }
    );
  }
}
