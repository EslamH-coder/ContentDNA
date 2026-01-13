import { NextResponse } from 'next/server';
import { loadDNA } from '@/lib/dna/dnaStorage.js';

/**
 * API Endpoint: Get DNA dashboard data
 * GET /api/dna/dashboard
 */
export async function GET() {
  try {
    const dna = await loadDNA();
    
    // Calculate summary stats
    const topicCount = Object.keys(dna.topics).length;
    const totalVideos = Object.values(dna.topics).reduce((sum, t) => sum + (t.videos_count || 0), 0);
    const avgViews = totalVideos > 0 
      ? Math.round(Object.values(dna.topics).reduce((sum, t) => sum + (t.avg_views || 0) * (t.videos_count || 0), 0) / totalVideos)
      : 0;
    
    return NextResponse.json({
      success: true,
      topics: dna.topics,
      hooks: dna.hooks,
      insights: dna.insights,
      banned: dna.banned,
      metadata: dna.metadata,
      summary: {
        topic_count: topicCount,
        total_videos: totalVideos,
        avg_views: avgViews
      }
    });
  } catch (error) {
    console.error('Error loading DNA dashboard:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load DNA dashboard' },
      { status: 500 }
    );
  }
}




