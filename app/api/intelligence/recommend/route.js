/**
 * RECOMMENDATION API
 * Main endpoint for generating recommendations
 */

import { NextResponse } from 'next/server';
import { generateRecommendations } from '@/lib/intelligence/recommendationEngineV3.js';

export async function POST(request) {
  try {
    const body = await request.json();
    
    const {
      rssItems = [],
      manualTrends = [],
      limit = 20
    } = body;

    console.log(`\n📡 API: Generating recommendations for ${rssItems.length} RSS items, ${manualTrends.length} trends`);

    const result = await generateRecommendations({
      rssItems,
      manualTrends,
      limit
    });

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Recommendation error:', error);
    console.error('Stack:', error.stack);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}




