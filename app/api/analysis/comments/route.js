/**
 * COMMENT ANALYSIS API
 */

import { NextResponse } from 'next/server';
import { analyzeComments } from '@/lib/analysis/commentAnalyzer.js';

// POST /api/analysis/comments
export async function POST(request) {
  try {
    const analysis = await analyzeComments();
    return NextResponse.json({ success: true, ...analysis });
  } catch (error) {
    console.error('Comment analysis API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}




