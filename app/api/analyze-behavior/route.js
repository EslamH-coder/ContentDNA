import { NextResponse } from 'next/server';
import { analyzeBehaviorPatterns } from '@/lib/behavior/behaviorAnalyzer.js';
import { reframeContent } from '@/lib/behavior/behaviorReframer.js';
import { formatBehaviorScore } from '@/lib/behavior/behaviorScoreDisplay.js';

/**
 * API Endpoint: Analyze news item against behavior patterns
 * POST /api/analyze-behavior
 * Body: { newsItem: { title, description, ... } }
 */
export async function POST(req) {
  try {
    const { newsItem } = await req.json();
    
    if (!newsItem || !newsItem.title) {
      return NextResponse.json(
        { success: false, error: 'newsItem with title is required' },
        { status: 400 }
      );
    }
    
    // Analyze behavior patterns
    const analysis = analyzeBehaviorPatterns(newsItem);
    
    // Get reframe suggestions if needed
    const reframe = analysis.patterns_matched < 4 
      ? reframeContent(newsItem, analysis)
      : null;
    
    // Format for display
    const displayData = formatBehaviorScore(analysis);
    
    return NextResponse.json({
      success: true,
      
      // For UI display
      display: displayData,
      
      // Full analysis
      analysis,
      
      // Reframe suggestions (if needed)
      reframe,
      
      // Quick summary
      summary: {
        score: analysis.total_score,
        patterns: `${analysis.patterns_matched}/6`,
        status: analysis.recommendation.status,
        ready: analysis.patterns_matched >= 4
      }
    });
  } catch (error) {
    console.error('Error analyzing behavior patterns:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}




