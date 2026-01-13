/**
 * API: Get 360° Recommendations (V2 with Groq AI)
 */

import { NextResponse } from 'next/server';
import { generateRecommendations } from '@/lib/intelligence/recommendationEngineV3.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rssItemsParam = searchParams.get('rssItems');
    
    let rssItems = [];
    if (rssItemsParam) {
      try {
        rssItems = JSON.parse(decodeURIComponent(rssItemsParam));
      } catch (e) {
        console.warn('Could not parse rssItems param:', e.message);
      }
    }
    
    console.log(`\n📡 API: Generating recommendations for ${rssItems.length} RSS items`);
    
    const result = await generateRecommendations({
      rssItems,
      manualTrends: [],
      limit: 20
    });
    
    // Always return success, even if empty results
    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('❌ Recommendations API error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Stack:', error.stack);
    
    // Return a valid response even on error
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error occurred',
      errorType: error.name || 'Error',
      recommendations: [],
      personaStatus: { totalServed: 0, totalTarget: 14, personas: {} },
      underserved: [],
      stats: {
        processed: 0,
        filtered: 0,
        recommended: 0,
        processingTime: '0'
      }
    }, { status: 500 });
  }
}

