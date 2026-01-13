/**
 * VIDEO PATTERN ANALYSIS API
 */

import { NextResponse } from 'next/server';
import { analyzeVideoPatterns } from '@/lib/analysis/videoPatternAnalyzer.js';

// GET /api/analysis/patterns
export async function GET(request) {
  try {
    const patterns = await analyzeVideoPatterns();
    return NextResponse.json({ success: true, ...patterns });
  } catch (error) {
    console.error('Pattern analysis API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}




