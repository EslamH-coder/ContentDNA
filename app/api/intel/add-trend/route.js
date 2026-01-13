/**
 * API: Add Manual Trend
 */

import { NextResponse } from 'next/server';
import { addManualTrend, addTwitterTrend, addTikTokTrend, addTopicIdea, addAnyUrl } from '@/lib/intelligence/manualTrendInput.js';
import { scoreTopicWithEvidence } from '@/lib/intelligence/evidenceScorer.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, url, topic, description, note, persona } = body;
    
    let trend;
    
    // Route to appropriate function based on type
    switch (type) {
      case 'twitter':
        trend = await addTwitterTrend(url, note);
        break;
      case 'tiktok':
        trend = await addTikTokTrend(url, note);
        break;
      case 'idea':
        trend = await addTopicIdea(topic, description, persona);
        break;
      case 'url':
        trend = await addAnyUrl(url, note);
        break;
      default:
        trend = await addManualTrend({ type, url, topic, description, note, persona });
    }
    
    // Immediately score it
    const topicToScore = trend.topic || trend.url || trend.note || '';
    const scored = await scoreTopicWithEvidence(topicToScore, 'MANUAL');
    
    return NextResponse.json({
      success: true,
      trend,
      score: scored
    });
  } catch (error) {
    console.error('Add trend API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}




