/**
 * RECOMMENDATION API ROUTES
 */

import { NextResponse } from 'next/server';
import { getRecommendations, scoreNewsWithAllData } from '@/lib/recommendations/unifiedRecommender.js';
import { importAllData, loadUnifiedData } from '@/lib/data/dataImporter.js';
import { analyzeComments } from '@/lib/analysis/commentAnalyzer.js';
import { analyzeVideoPatterns } from '@/lib/analysis/videoPatternAnalyzer.js';

// GET /api/recommendations
export async function GET(request) {
  try {
    const recommendations = await getRecommendations();
    return NextResponse.json({ success: true, ...recommendations });
  } catch (error) {
    console.error('Recommendations API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/recommendations/score-news
export async function POST(request) {
  try {
    const body = await request.json();
    const { newsItem } = body;
    
    if (!newsItem) {
      return NextResponse.json(
        { success: false, error: 'newsItem is required' },
        { status: 400 }
      );
    }
    
    const scored = await scoreNewsWithAllData(newsItem);
    return NextResponse.json({ success: true, ...scored });
  } catch (error) {
    console.error('Score news API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
