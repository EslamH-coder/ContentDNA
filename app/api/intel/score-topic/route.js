/**
 * API: Score Topic with Evidence
 */

import { NextResponse } from 'next/server';
import { scoreWithEvidence } from '@/lib/intelligence/evidenceScorer.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { topic, sourceType } = body;
    
    if (!topic) {
      return NextResponse.json(
        { success: false, error: 'Topic is required' },
        { status: 400 }
      );
    }
    
    const result = await scoreWithEvidence(topic, { 
      sourceType: sourceType || 'manual',
      useAI: true,
      generatePitchText: false
    });
    
    return NextResponse.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Score topic API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

